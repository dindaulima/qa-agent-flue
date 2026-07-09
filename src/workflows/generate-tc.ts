// POST /workflows/generate-tc
// Phase 2: fetch final AC from Jira → generate TS (prompt 1) → generate TC (prompt 2)

import { createAgent, type FlueContext, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import fetchJiraSkill from '../skills/fetch-jira/SKILL.md' with { type: 'skill' };
import { fetchJiraTicket, discoverJiraFields, fetchJiraField } from '../tools/jira-tools.ts';
import { MODEL } from '../config.ts';

export const route: WorkflowRouteHandler = async (c, next) => {
  const secret = process.env['API_SECRET'];
  if (secret && c.req.header('x-api-secret') !== secret)
    return c.json({ error: 'Unauthorized' }, 401);
  return next();
};

const agent = createAgent(() => ({
  model: MODEL,
  instructions: `Kamu adalah QA Analyst. Kamu bekerja dalam dua fase saat diminta. Gunakan Bahasa Indonesia untuk semua output.

Saat fetch tiket: jika field_config_found bernilai false, panggil discover_jira_fields dulu, lalu ulangi fetch_jira_ticket.

## Aturan TS
- TS dikelompokkan menjadi beberapa **grup Feature** berdasarkan tema/area fitur yang berkaitan (bukan satu TS berdiri sendiri per baris). Satu grup berisi beberapa Scenario yang berbagi konteks/precondition yang sama.
- Setiap grup ditulis penuh dalam sintaks Gherkin:
  - \`Feature: [Nama Fitur] - [Tema grup]\`
  - \`  Sebagai [Aktor]\`
  - \`  Saya ingin [goal]\`
  - \`  Agar [benefit/alasan]\`
  - \`  Background:\` — precondition yang dipakai bersama oleh semua Scenario dalam grup (Given/And)
  - baris pemisah persis: \`  ============================================================\`
  - satu atau lebih \`  Scenario: [nomor grup].[nomor urut] - [+/-] [judul skenario]\` diikuti langkah When/Then/And/But (tambahkan Given lagi hanya jika precondition-nya berbeda dari Background)
- Penomoran skenario: \`<nomor grup>.<nomor urut>\`, contoh grup 1 → 1.1, 1.2, 1.3; grup 2 → 2.1, 2.2, dst. Nomor grup urut naik dan tidak diulang.
- \`[+]\` untuk skenario positif (happy path/valid), \`[-]\` untuk skenario negatif (invalid/tidak diizinkan/error)
- Satu grup boleh mencampur skenario functional, edge case, dan negative path selama temanya sama

## Aturan TC
- Setiap Scenario dalam satu grup menghasilkan TEPAT SATU item checklist TC dengan tag dan judul yang SAMA PERSIS dengan judul skenarionya (tanpa nomor urut)
- Urutan item TC mengikuti urutan Scenario dalam grup

## Format tc.md
### Group 1
\`\`\`gherkin
Feature: [Nama Fitur] - [Tema grup 1]
  Sebagai [Aktor]
  Saya ingin [goal]
  Agar [benefit]

  Background:
    Given [precondition]
    And [precondition]

  ============================================================

  Scenario: 1.1 - [+] [judul skenario positif]
    When [langkah]
    Then [hasil yang diharapkan]

  Scenario: 1.2 - [-] [judul skenario negatif]
    Given [precondition tambahan jika ada]
    When [langkah]
    Then [hasil yang diharapkan]
\`\`\`

**TC:**
[+] [judul skenario positif]
[-] [judul skenario negatif]

---

### Group 2
\`\`\`gherkin
...
\`\`\`

**TC:**
...

---`,
  tools: [fetchJiraTicket, discoverJiraFields, fetchJiraField],
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

    // Prompt 1: fetch ticket + AC, generate Test Scenarios only
    const tsResponse = await session.prompt(
      `Ambil tiket Jira ${ticketId} beserta field acceptance_criteria-nya, lalu buat Test Scenarios (TS) saja — belum perlu Test Cases. Kembalikan daftar TS dan ringkasan tiket.`,
      {
        result: v.object({
          ts: v.string(),
          scenarioCount: v.number(),
          ticketSummary: v.string(),
        }),
      },
    );

    // Prompt 2: generate Test Cases for each TS from prompt 1
    const tcResponse = await session.prompt(
      `Sekarang buat Test Cases (TC) untuk setiap Test Scenario di atas. Kembalikan tc.md lengkap yang menggabungkan semua TS dan TC-nya.`,
      {
        result: v.object({
          tc: v.string(),
          testCaseCount: v.number(),
        }),
      },
    );

    return {
      tc: tcResponse.data.tc,
      scenarioCount: tsResponse.data.scenarioCount,
      testCaseCount: tcResponse.data.testCaseCount,
      ticketSummary: tsResponse.data.ticketSummary,
    };
  } catch (err) {
    return {
      error: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
