// POST /workflows/evaluate-qa
// Evaluate QA artifact quality (AC, TS, TC) from a Jira ticket.
// Split into 4 prompts (Feasibility, AC, TS, TC) to avoid timeout on large tickets.

import { createAgent, type FlueContext, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import qaEvaluatorSkill from '../skills/qa-evaluator/SKILL.md' with { type: 'skill' };
import { fetchJiraTicket, discoverJiraFields, fetchJiraField } from '../tools/jira-tools.ts';
import { calculateQaScore } from '../tools/scoring-tools.ts';
import { MODEL } from '../config.ts';

export const route: WorkflowRouteHandler = async (c, next) => {
  const secret = process.env['API_SECRET'];
  if (secret && c.req.header('x-api-secret') !== secret)
    return c.json({ error: 'Unauthorized' }, 401);
  return next();
};

const agent = createAgent(() => ({
  model: MODEL,
  instructions: `Kamu adalah QA Analyst yang mengevaluasi kualitas artefak QA dari tiket Jira. Gunakan Bahasa Indonesia untuk semua output.

## Aturan Evaluasi

- Gunakan rubrik per sub-kriteria di skill untuk menentukan skor 0–100. Cocokkan kondisi tiket ke anchor yang paling sesuai.
- Skor harus mencerminkan kualitas aktual konten — tidak terlalu generous, tidak terlalu strict.
- Kutip contoh konkrit dari konten tiket saat menjelaskan skor.
- Jika field kosong atau null → beri skor 0 untuk semua sub-kriteria kategori tersebut.
- Gunakan field test_case untuk mengevaluasi TS dan TC. Jika berisi tabel, kolom Test Scenario = TS, kolom Test Case & Evidence = TC.`,

  tools: [fetchJiraTicket, discoverJiraFields, fetchJiraField, calculateQaScore],
  skills: [qaEvaluatorSkill],
}));

const feasibilityScoresSchema = v.object({
  expected_result: v.number(),
  business_rules: v.number(),
  clarity: v.number(),
  completeness: v.number(),
  actionability: v.number(),
  scope_boundary: v.number(),
});

const acScoresSchema = v.object({
  validity: v.number(),
  behavioral_clarity: v.number(),
  testability: v.number(),
  non_ambiguity: v.number(),
  business_alignment: v.number(),
  dependency_awareness: v.number(),
});

const tsScoresSchema = v.object({
  journey_based: v.number(),
  real_world_relevance: v.number(),
  crucial_paths_covered: v.number(),
  full_coverage: v.number(),
  prioritization: v.number(),
});

const tcScoresSchema = v.object({
  functional: v.number(),
  visual_ui: v.number(),
  flow_ux: v.number(),
  security: v.number(),
  edge_cases: v.number(),
  data_validation: v.number(),
  anomaly_negative: v.number(),
});

interface Payload {
  ticketId: string;
}

export async function run({ init, payload }: FlueContext<Payload>) {
  const { ticketId } = payload;

  try {
    const harness = await init(agent);
    const session = await harness.session();

    // --- Prompt 1: Fetch ticket + Task Feasibility ---
    const p1 = await session.prompt(
      `Ambil tiket Jira "${ticketId}".
- Jika field_config_found false → panggil discover_jira_fields dulu, lalu fetch_jira_ticket ulang.
- Evaluasi Task Feasibility menggunakan rubrik sub-kriteria di skill.
- PENTING: Jika field acceptance_criteria (AC QA) sudah diisi, gunakan sebagai bukti tambahan untuk menilai kualitas description. AC QA mencerminkan scope implementasi aktual. Jika scope AC QA jauh lebih luas dari description (misal: description hanya menyebut 1 kasus tapi AC QA mencakup arsitektur, UI baru, dan business rules yang tidak disebutkan di description) → ini bukti description underspecified → turunkan skor completeness, business_rules, actionability, dan scope_boundary sesuai gap yang ditemukan.
- Kembalikan: ringkasan tiket (1–2 kalimat), URL tiket, skor tiap sub-kriteria Task Feasibility, dan rationale singkat.`,
      {
        result: v.object({
          ticketSummary: v.string(),
          ticketUrl: v.string(),
          rationaleFeasibility: v.string(),
          scores: feasibilityScoresSchema,
        }),
      },
    );

    // --- Prompt 2: Acceptance Criteria ---
    const p2 = await session.prompt(
      `Sekarang evaluasi Acceptance Criteria dari tiket yang sama.
- Gunakan rubrik sub-kriteria AC di skill.
- Jika field acceptance_criteria kosong atau null → beri semua skor 0.
- Kembalikan: skor tiap sub-kriteria AC dan rationale singkat.`,
      {
        result: v.object({
          rationaleAc: v.string(),
          scores: acScoresSchema,
        }),
      },
    );

    // --- Prompt 3: Test Scenarios ---
    const p3 = await session.prompt(
      `Sekarang evaluasi Test Scenarios dari tiket yang sama.
- Gunakan rubrik sub-kriteria TS di skill.
- Data TS ada di field test_case. Jika berisi tabel, baca kolom Test Scenario.
- Jika field test_case kosong atau null → beri semua skor 0.
- Kembalikan: skor tiap sub-kriteria TS dan rationale singkat.`,
      {
        result: v.object({
          rationaleTs: v.string(),
          scores: tsScoresSchema,
        }),
      },
    );

    // --- Prompt 4: Test Cases + calculate_qa_score + gap analysis + rekomendasi ---
    const p4 = await session.prompt(
      `Sekarang evaluasi Test Cases dari tiket yang sama.
- Gunakan rubrik sub-kriteria TC di skill.
- Data TC ada di field test_case. Jika berisi tabel, baca kolom Test Case & Evidence.
- Jika field test_case kosong atau null → beri semua skor 0.

Setelah mendapat skor TC, panggil calculate_qa_score dengan semua skor berikut:
- taskFeasibility: ${JSON.stringify(p1.data.scores)}
- ac: ${JSON.stringify(p2.data.scores)}
- ts: ${JSON.stringify(p3.data.scores)}
- tc: (skor TC yang baru kamu evaluasi)

Setelah calculate_qa_score dipanggil, kembalikan:
- Skor TC per sub-kriteria dan rationale
- Skor final dari calculate_qa_score (taskFeasibilityScore, acScore, tsScore, tcScore, qaQualityScore, verdictTaskFeasibility, verdictQaQuality)
- Gap analysis konkrit — sebutkan poin spesifik:
  * gapDescToAc: requirement di description yang belum ada AC-nya (satu arah: desc→AC)
  * gapAcQaToDesc: aspek di AC QA yang TIDAK disebutkan di description sama sekali — ini menandakan description underspecified atau terlalu sempit dibanding scope aktual. Jika AC QA kosong, isi dengan "(AC QA belum ada, tidak bisa dievaluasi)".
  * gapAcToTs: AC yang tidak punya TS
  * gapTsToTc: TS yang tidak punya TC
- Rekomendasi actionable`,
      {
        result: v.object({
          rationaleTc: v.string(),
          tcScores: tcScoresSchema,
          taskFeasibilityScore: v.number(),
          acScore: v.number(),
          tsScore: v.number(),
          tcScore: v.number(),
          qaQualityScore: v.number(),
          verdictTaskFeasibility: v.union([
            v.literal('LAYAK'),
            v.literal('PERLU_REVISI'),
            v.literal('TIDAK_LAYAK'),
          ]),
          verdictQaQuality: v.union([
            v.literal('BAIK'),
            v.literal('CUKUP'),
            v.literal('PERLU_PERBAIKAN'),
          ]),
          gapDescToAc: v.string(),
          gapAcQaToDesc: v.string(),
          gapAcToTs: v.string(),
          gapTsToTc: v.string(),
          recommendations: v.array(v.string()),
        }),
      },
    );

    return {
      ticketSummary: p1.data.ticketSummary,
      ticketUrl: p1.data.ticketUrl,
      taskFeasibilityScore: p4.data.taskFeasibilityScore,
      acScore: p4.data.acScore,
      tsScore: p4.data.tsScore,
      tcScore: p4.data.tcScore,
      qaQualityScore: p4.data.qaQualityScore,
      verdictTaskFeasibility: p4.data.verdictTaskFeasibility,
      verdictQaQuality: p4.data.verdictQaQuality,
      rationaleFeasibility: p1.data.rationaleFeasibility,
      rationaleAc: p2.data.rationaleAc,
      rationaleTs: p3.data.rationaleTs,
      rationaleTc: p4.data.rationaleTc,
      gapDescToAc: p4.data.gapDescToAc,
      gapAcQaToDesc: p4.data.gapAcQaToDesc,
      gapAcToTs: p4.data.gapAcToTs,
      gapTsToTc: p4.data.gapTsToTc,
      recommendations: p4.data.recommendations,
    };
  } catch (err) {
    return {
      error: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
