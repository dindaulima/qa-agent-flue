// POST /workflows/generate-sign-off
// Generate a Software Testing Sign-Off document from a Jira ticket (or Epic with children).
// Supports: single ticket OR Epic → automatically fetches all relevant child tickets.
//
// Design: 2-prompt approach to minimize SQLite storage.
// Prompt 1 fetches + computes everything → returns COMPACT structured data (no full ticket content).
// Prompt 2 receives only the compact data → generates the markdown document.

import { createAgent, type FlueContext, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import generateSignOffSkill from '../skills/generate-sign-off/SKILL.md' with { type: 'skill' };
import { fetchJiraTicket, discoverJiraFields, fetchEpicChildren } from '../tools/jira-tools.ts';
import { MODEL } from '../config.ts';

export const route: WorkflowRouteHandler = async (c, next) => {
  const secret = process.env['API_SECRET'];
  if (secret && c.req.header('x-api-secret') !== secret)
    return c.json({ error: 'Unauthorized' }, 401);
  return next();
};

const agent = createAgent(() => ({
  model: MODEL,
  instructions: `Kamu adalah QA Analyst yang membuat dokumen Software Testing Sign-Off berdasarkan data dari Jira.
Gunakan Bahasa Indonesia untuk seluruh isi dokumen sign-off, kecuali terminologi teknis/QA yang sudah lazim dalam Bahasa Inggris (misalnya: Test Case, Test Scenario, Sign-Off, Passed, Failed, Happy Path, Edge Case, dll.).

Cara menghitung TC dari test_case field:
- Total TC = jumlah baris bernomor (ordered list) yang berisi tag [+] atau [-] di kolom Evidence
- Passed TC: jika kolom Status pada baris TS = "passed" (case-insensitive) → semua TC di baris itu dihitung passed. Jika bukan, dan tidak ada anotasi manual eksplisit per item (misal ditandai PASSED/FAILED oleh QA) → TC pada baris tersebut dihitung belum passed
- Failed TC = Total TC - Passed TC`,

  tools: [fetchJiraTicket, discoverJiraFields, fetchEpicChildren],
  skills: [generateSignOffSkill],
}));

// Compact result schema — Prompt 1 returns this (no full ticket content)
const compactResultSchema = v.object({
  isEpic: v.boolean(),
  processedTickets: v.number(),
  totalScenario: v.number(),
  totalTc: v.number(),
  passedTc: v.number(),
  failedTc: v.number(),
  developer: v.string(),
  qa: v.string(),
  // One entry per ticket for the Test Cases table
  ticketSummaries: v.array(v.object({
    key: v.string(),
    url: v.string(),
    summary: v.string(),
  })),
  // Rows for Scope Testing table
  scopeRows: v.array(v.object({
    scope: v.string(),
    accommodated: v.string(), // "✔" or "x"
  })),
  // Known issues / QA notes
  knownIssues: v.array(v.string()),
});

interface Payload {
  ticketId: string;
}

export async function run({ init, payload }: FlueContext<Payload>) {
  const { ticketId } = payload;

  try {
    const harness = await init(agent);
    const session = await harness.session();

    // --- Prompt 1: Fetch, filter, compute, extract → return COMPACT data only ---
    const p1 = await session.prompt(
      `Ambil tiket Jira "${ticketId}".
- Jika field_config_found false → panggil discover_jira_fields dulu, lalu fetch ulang.
- Cek apakah tiket ini bertipe Epic.
  * Jika Epic → panggil fetch_epic_children("${ticketId}").
  * Jika bukan Epic → gunakan tiket ini saja.
- Filter: hanya tickets dengan test_case tidak kosong; abaikan status Cancelled/Canceled/Cancel/Backlog.

Untuk setiap ticket yang lolos, lakukan semua analisis berikut:
1. Hitung metrics dari test_case:
   - totalScenario: jumlah "Scenario:" di dalam blok Gherkin pada kolom Test Scenario (satu baris tabel = satu grup Feature yang bisa berisi beberapa Scenario — JANGAN hitung jumlah baris tabel)
   - totalTc: jumlah item bernomor berisi tag [+] atau [-] di kolom Evidence
   - passedTc: jika status kolom TS = "passed" → semua TC di baris itu passed; jika tidak dan tidak ada anotasi manual eksplisit per item → 0 untuk baris tersebut
2. Buat ticketSummary singkat & jelas (max 12 kata) untuk tabel Test Cases — paraphrase jika summary Jira bertele-tele
3. Extract scopeRows (max 3–4 per ticket) dari description dan acceptance_criteria:
   - scope: highlight perubahan fitur utama
   - accommodated: "✔" jika tercakup di TS/TC; "x" jika eksplisit tidak terakomodir
4. Extract knownIssues dari acceptance_criteria, test_case, qa_feedback (cari ⚠️, ❗, "Catatan", "Note", "Notes", "Known Issue")
5. Tentukan developer dari assignee, QA dari qa_feedback atau komentar QA

Gabungkan metrics dari semua tickets.

PENTING: Kembalikan HANYA struktur data kompak di bawah ini. Jangan sertakan kembali isi tiket lengkap.`,
      { result: compactResultSchema },
    );

    if (p1.data.processedTickets === 0) {
      return {
        error: true,
        message: 'Tidak ada ticket dengan Test Case yang ditemukan.',
      };
    }

    // --- Prompt 2: Generate markdown from compact data only (no full ticket content) ---
    const p2 = await session.prompt(
      `Buat dokumen Software Testing Sign-Off lengkap dalam Bahasa Inggris menggunakan template di skill.

Data:
${JSON.stringify(p1.data)}

Aturan:
- Gunakan Bahasa Indonesia untuk semua teks naratif; pertahankan terminologi QA/teknis dalam Bahasa Inggris (Test Case, Test Scenario, Passed, Failed, Happy Path, Edge Case, dll.)
- Project Details: isi Developer dan QA dari data; kosongkan field lainnya
- Key Metrics: gunakan angka dari data
- Overall Status: "Approved" jika failedTc=0; "Approved with Known Issues" jika ada failed/known issues; "Not Approved" jika ada blokir signifikan
- Test Coverage: Browser = Chrome (versi stabil terbaru, Windows 10 Pro); Devices = Desktop only; Test Type = Functional, UI; Instances = kosong
- Scope Testing: gunakan scopeRows dari data
- Test Cases table: gunakan ticketSummaries dari data (satu baris per ticket)
- Known Issues: gunakan knownIssues dari data; jika kosong tulis "(Tidak ada known issues)"

Kembalikan hanya signOffMarkdown.`,
      {
        result: v.object({
          signOffMarkdown: v.string(),
        }),
      },
    );

    return {
      ticketId,
      isEpic: p1.data.isEpic,
      processedTickets: p1.data.processedTickets,
      totalScenario: p1.data.totalScenario,
      totalTc: p1.data.totalTc,
      passedTc: p1.data.passedTc,
      failedTc: p1.data.failedTc,
      developer: p1.data.developer,
      qa: p1.data.qa,
      signOffMarkdown: p2.data.signOffMarkdown,
    };
  } catch (err) {
    return {
      error: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
