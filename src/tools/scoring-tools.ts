// Scoring tool for QA artifact quality evaluation
// Applies weighted criteria to produce Task Feasibility Score and QA Quality Score

import { Type, defineTool } from '@flue/runtime';

const TF_WEIGHTS: Record<string, number> = {
  expected_result: 0.20,
  business_rules: 0.20,
  clarity: 0.20,
  completeness: 0.15,
  actionability: 0.15,
  scope_boundary: 0.10,
};

const AC_WEIGHTS: Record<string, number> = {
  validity: 0.20,
  behavioral_clarity: 0.20,
  testability: 0.25,
  non_ambiguity: 0.15,
  business_alignment: 0.15,
  dependency_awareness: 0.05,
};

const TS_WEIGHTS: Record<string, number> = {
  journey_based: 0.15,
  real_world_relevance: 0.20,
  crucial_paths_covered: 0.30,
  full_coverage: 0.25,
  prioritization: 0.10,
};

const TC_WEIGHTS: Record<string, number> = {
  functional: 0.25,
  visual_ui: 0.10,
  flow_ux: 0.15,
  security: 0.20,
  edge_cases: 0.10,
  data_validation: 0.10,
  anomaly_negative: 0.10,
};

function weighted(scores: Record<string, number>, weights: Record<string, number>): number {
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (scores[key] ?? 0) * weight;
  }
  return Math.round(total * 10) / 10;
}

function tfVerdict(score: number): 'LAYAK' | 'PERLU_REVISI' | 'TIDAK_LAYAK' {
  return score >= 70 ? 'LAYAK' : score >= 50 ? 'PERLU_REVISI' : 'TIDAK_LAYAK';
}

function qaVerdict(score: number): 'BAIK' | 'CUKUP' | 'PERLU_PERBAIKAN' {
  return score >= 80 ? 'BAIK' : score >= 60 ? 'CUKUP' : 'PERLU_PERBAIKAN';
}

export const calculateQaScore = defineTool({
  name: 'calculate_qa_score',
  description: 'Hitung skor kualitas QA berdasarkan penilaian sub-kriteria (skala 0-100 per sub-kriteria). Mengembalikan Task Feasibility Score, AC/TS/TC score, dan QA Quality Score dengan bobot yang sudah ditentukan.',
  parameters: Type.Object({
    taskFeasibility: Type.Object({
      expected_result: Type.Number({ description: 'Skor 0-100: goals/ekspektasi fitur sudah jelas?' }),
      business_rules: Type.Number({ description: 'Skor 0-100: business rules tertulis dengan jelas?' }),
      clarity: Type.Number({ description: 'Skor 0-100: tidak ada ambiguitas, bisa dipahami semua pembaca?' }),
      completeness: Type.Number({ description: 'Skor 0-100: ada context, stories, ekspektasi, business rules, scope?' }),
      actionability: Type.Number({ description: 'Skor 0-100: QA/Dev bisa langsung kerja tanpa bertanya lagi?' }),
      scope_boundary: Type.Number({ description: 'Skor 0-100: jelas mana yang in-scope dan out-of-scope?' }),
    }),
    ac: Type.Object({
      validity: Type.Number({ description: 'Skor 0-100: AC mengandung rules/aturan yang harus dipenuhi?' }),
      behavioral_clarity: Type.Number({ description: 'Skor 0-100: mendeskripsikan perilaku sistem yang observable?' }),
      testability: Type.Number({ description: 'Skor 0-100: bisa diverifikasi melalui pengujian?' }),
      non_ambiguity: Type.Number({ description: 'Skor 0-100: tidak ada kata abu-abu tanpa definisi jelas?' }),
      business_alignment: Type.Number({ description: 'Skor 0-100: mencakup business rules dari PM, bukan hanya teknikal?' }),
      dependency_awareness: Type.Number({ description: 'Skor 0-100: mencakup cara handle sistem lain yang terintegrasi?' }),
    }),
    ts: Type.Object({
      journey_based: Type.Number({ description: 'Skor 0-100: ditulis dari POV User dengan Given/When/Then?' }),
      real_world_relevance: Type.Number({ description: 'Skor 0-100: merefleksikan perilaku user sebenarnya?' }),
      crucial_paths_covered: Type.Number({ description: 'Skor 0-100: mencakup user journey paling penting sesuai jobs-to-be-done?' }),
      full_coverage: Type.Number({ description: 'Skor 0-100: mencakup semua kondisi normal DAN tidak normal?' }),
      prioritization: Type.Number({ description: 'Skor 0-100: MoSCoW priority masuk akal, ada minimal 1 Must Have?' }),
    }),
    tc: Type.Object({
      functional: Type.Number({ description: 'Skor 0-100: fungsionalitas utama fitur sudah dicover?' }),
      visual_ui: Type.Number({ description: 'Skor 0-100: layout, responsiveness, typography, component states?' }),
      flow_ux: Type.Number({ description: 'Skor 0-100: end-to-end user journey dengan input/output fitur lain?' }),
      security: Type.Number({ description: 'Skor 0-100: autentikasi, hak akses, pelanggaran security?' }),
      edge_cases: Type.Number({ description: 'Skor 0-100: kasus anomali, nilai batas input?' }),
      data_validation: Type.Number({ description: 'Skor 0-100: required fields, format checks, type constraints, expected output?' }),
      anomaly_negative: Type.Number({ description: 'Skor 0-100: unexpected inputs, broken flows, race conditions?' }),
    }),
  }),
  execute: async ({ taskFeasibility, ac, ts, tc }) => {
    const tfScore = weighted(taskFeasibility as Record<string, number>, TF_WEIGHTS);
    const acScore = weighted(ac as Record<string, number>, AC_WEIGHTS);
    const tsScore = weighted(ts as Record<string, number>, TS_WEIGHTS);
    const tcScore = weighted(tc as Record<string, number>, TC_WEIGHTS);
    const qaQualityScore = Math.round((acScore * 0.30 + tsScore * 0.30 + tcScore * 0.40) * 10) / 10;

    return JSON.stringify({
      task_feasibility_score: tfScore,
      ac_score: acScore,
      ts_score: tsScore,
      tc_score: tcScore,
      qa_quality_score: qaQualityScore,
      verdict: {
        task_feasibility: tfVerdict(tfScore),
        qa_quality: qaVerdict(qaQualityScore),
      },
      score_breakdown: {
        task_feasibility: { score: tfScore, weights: TF_WEIGHTS, raw: taskFeasibility },
        ac: { score: acScore, weights: AC_WEIGHTS, raw: ac },
        ts: { score: tsScore, weights: TS_WEIGHTS, raw: ts },
        tc: { score: tcScore, weights: TC_WEIGHTS, raw: tc },
      },
    }, null, 2);
  },
});
