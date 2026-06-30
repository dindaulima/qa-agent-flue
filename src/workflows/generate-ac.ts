// POST /workflows/generate-ac
// Phase 1: fetch Jira ticket → analyze → generate Acceptance Criteria

import { createAgent, type FlueContext, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import fetchJiraSkill from '../skills/fetch-jira/SKILL.md' with { type: 'skill' };
import { fetchJiraTicket, discoverJiraFields } from '../tools/jira-tools.ts';
import { MODEL } from '../config.ts';

export const route: WorkflowRouteHandler = async (c, next) => {
  const secret = process.env['API_SECRET'];
  if (secret && c.req.header('x-api-secret') !== secret)
    return c.json({ error: 'Unauthorized' }, 401);
  return next();
};

const agent = createAgent(() => ({
  model: MODEL,
  instructions: `Kamu adalah QA Analyst. Tugasmu adalah membuat atau memperkaya Acceptance Criteria dari tiket Jira. Gunakan Bahasa Indonesia untuk semua output.

## Prioritas Sumber AC
PENTING: Field acceptance_criteria (AC QA) adalah sumber UTAMA dan PALING AKURAT tentang scope fitur. Deskripsi Jira ditulis oleh PM/Support dan bisa saja lebih sempit dari scope implementasi aktual. JANGAN abaikan atau ganti AC yang sudah ditulis QA.

Langkah-langkah:
1. Panggil fetch_jira_ticket dengan ticketId yang diberikan.
2. Tentukan kondisi sumber AC (Layer B):
   - Kondisi 1 — acceptance_criteria KOSONG DAN description tidak ada AC: buat AC dari awal berdasarkan description + analisis kebutuhan.
   - Kondisi 2 — acceptance_criteria KOSONG tapi description mengandung AC: ekstrak dan reformulasi AC dari description ke struktur QA.
   - Kondisi 3 — acceptance_criteria SUDAH DIISI oleh QA: GUNAKAN AC yang ada sebagai basis utama. Description hanya konteks latar belakang. JANGAN ganti atau abaikan poin AC yang sudah ada. Hanya tambahkan poin baru jika ada aspek yang benar-benar belum tercakup.
3. Analisis Layer A (berdasarkan sumber dari Layer B):
   - Kebutuhan eksplisit, validasi implisit, peran pengguna, integrasi, alur data, ambiguitas.
4. Hasilkan output:
   - Kondisi 1 & 2: buat AC baru mencakup aspek Fungsional, Teknis, Integrasi, dan Integritas Data.
   - Kondisi 3: tampilkan AC yang sudah ada (tidak diubah), lalu jika ada gap, tambahkan poin baru saja.
5. Kembalikan AC dalam format markdown beserta ringkasan singkat.

Format AC (daftar bernomor, tanpa header kategori):
## Acceptance Criteria

- AC-1: [kriteria]
- AC-2: [kriteria]
...`,
  tools: [fetchJiraTicket, discoverJiraFields],
  skills: [fetchJiraSkill],
}));

interface Payload {
  ticketId: string;
}

export async function run({ init, payload }: FlueContext<Payload>) {
  const { ticketId } = payload;

  try {
    const harness = await init(agent);
    const session = await harness.session();

    const response = await session.prompt(
      `Buat Acceptance Criteria untuk tiket Jira: ${ticketId}`,
      {
        result: v.object({
          ac: v.string(),
          ticketSummary: v.string(),
          ticketUrl: v.string(),
          acSourceCondition: v.union([
            v.literal('generated_from_scratch'),
            v.literal('extracted_from_description'),
            v.literal('enriched_from_existing'),
          ]),
        }),
      },
    );

    return response.data;
  } catch (err) {
    return {
      error: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
