// Flue tool definitions for writing to Jira
// Rewrite of tools/jira/update_ticket.py

import { Type, defineTool } from '@flue/runtime';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jiraGet, jiraPut } from './jira-client.ts';
import { markdownToAdf, parseTcMarkdown, scenariosToAdfTable } from './adf.ts';

const FIELDS_JSON = join(dirname(fileURLToPath(import.meta.url)), 'fields.json');

async function loadProjectFields(projectKey: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(FIELDS_JSON, 'utf-8');
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    return all[projectKey] ?? {};
  } catch {
    return {};
  }
}

async function fetchExistingAdf(ticketId: string, fieldKey: string): Promise<unknown[]> {
  const data = await jiraGet(`/issue/${ticketId}`, { fields: fieldKey }) as Record<string, unknown>;
  const val = (data['fields'] as Record<string, unknown>)?.[fieldKey];
  if (typeof val === 'object' && val !== null && (val as Record<string, unknown>)['type'] === 'doc') {
    return ((val as Record<string, unknown>)['content'] as unknown[]) ?? [];
  }
  return [];
}

export const writeJiraAc = defineTool({
  name: 'write_jira_ac',
  description: 'Write Acceptance Criteria markdown to the AC field in a Jira ticket. Use append=true to add below existing content (Phase 1), or append=false to overwrite (Refine AC).',
  parameters: Type.Object({
    ticketId: Type.String({ description: 'Jira ticket ID, e.g. PROJ-123' }),
    acMarkdown: Type.String({ description: 'AC content in markdown format' }),
    append: Type.Boolean({ description: 'true = append below existing AC; false = overwrite entire AC field' }),
  }),
  execute: async ({ ticketId, acMarkdown, append }) => {
    const projectKey = ticketId.split('-')[0]!.toUpperCase();
    const pf = await loadProjectFields(projectKey);
    const acField = pf['acceptance_criteria'];

    if (!acField) return `No AC field configured for project ${projectKey}. Run discover_jira_fields first.`;

    let adf = markdownToAdf(acMarkdown);

    if (append) {
      const existing = await fetchExistingAdf(ticketId, acField);
      if (existing.length > 0) {
        adf = { version: 1, type: 'doc', content: [...existing, { type: 'rule' }, ...(adf['content'] as unknown[])] };
      }
    }

    await jiraPut(`/issue/${ticketId}`, { fields: { [acField]: adf } });
    return `AC written to ${ticketId} (${append ? 'appended' : 'overwritten'}).`;
  },
});

export const writeJiraTc = defineTool({
  name: 'write_jira_tc',
  description: 'Write Test Scenarios and Test Cases as a structured ADF table to the Test Case field in a Jira ticket. Input is the full tc.md content.',
  parameters: Type.Object({
    ticketId: Type.String({ description: 'Jira ticket ID, e.g. PROJ-123' }),
    tcMarkdown: Type.String({ description: 'Full tc.md content with TS and TC blocks' }),
  }),
  execute: async ({ ticketId, tcMarkdown }) => {
    const projectKey = ticketId.split('-')[0]!.toUpperCase();
    const pf = await loadProjectFields(projectKey);
    const tcField = pf['test_case'];

    if (!tcField) return `No TC field configured for project ${projectKey}. Run discover_jira_fields first.`;

    const scenarios = parseTcMarkdown(tcMarkdown);
    if (scenarios.length === 0) return 'No TS blocks found in tc content. Check the format.';

    const adf = scenariosToAdfTable(scenarios);
    await jiraPut(`/issue/${ticketId}`, { fields: { [tcField]: adf } });
    return `Written ${scenarios.length} test scenario(s) to ${ticketId}.`;
  },
});

export const checkJiraTcField = defineTool({
  name: 'check_jira_tc_field',
  description: 'Check whether the Test Case field in a Jira ticket already has content. Use before writing TC to avoid accidental overwrites.',
  parameters: Type.Object({
    ticketId: Type.String({ description: 'Jira ticket ID' }),
  }),
  execute: async ({ ticketId }) => {
    const projectKey = ticketId.split('-')[0]!.toUpperCase();
    const pf = await loadProjectFields(projectKey);
    const tcField = pf['test_case'];

    if (!tcField) return `No TC field configured for project ${projectKey}.`;

    const existing = await fetchExistingAdf(ticketId, tcField);
    return existing.length > 0 ? 'TC field already has content.' : 'TC field is empty — safe to write.';
  },
});
