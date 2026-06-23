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
- Judul: "[Aktor] dapat [melakukan sesuatu]" atau "[Aktor] tidak dapat [melakukan sesuatu]"
- Format Gherkin: Given / When / Then sebagai bullet list
- Tipe: Functional, Visual, Flow
- Prioritas: M / S / C / W (MoSCoW)
- Edge case dan negative path → TS terpisah

## Aturan TC
- [+] aktor DAPAT melakukan sesuatu (positive/happy path)
- [-] aktor TIDAK DAPAT melakukan sesuatu (negative/invalid/tidak tersedia)
- Granular: satu TC per field, aturan validasi, atau perilaku

## Format tc.md
### TS-01: [Aktor] dapat [melakukan sesuatu]
**Type:** Functional
**Priority:** M

**Given**
- [prasyarat]

**When**
- [langkah 1]

**Then**
- [hasil yang diharapkan]

**TC:**
[+] [Aktor] dapat [kondisi valid]
[-] [Aktor] tidak dapat [kondisi tidak valid]

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
