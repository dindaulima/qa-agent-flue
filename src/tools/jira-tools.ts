// Flue tool definitions for reading from Jira
// Rewrite of tools/jira/get_ticket.py + discover_fields.py

import { Type, defineTool } from '@flue/runtime';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jiraGet } from './jira-client.ts';
import { fieldText } from './adf.ts';

const FIELDS_JSON = join(dirname(fileURLToPath(import.meta.url)), 'fields.json');

const BASE_FIELDS = [
  'summary', 'description', 'status', 'issuetype', 'priority',
  'reporter', 'assignee', 'labels', 'components',
  'customfield_10016', 'customfield_10014',
  'subtasks', 'issuelinks', 'comment',
];

async function loadProjectFields(projectKey: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(FIELDS_JSON, 'utf-8');
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    return all[projectKey] ?? {};
  } catch {
    return {};
  }
}

export const fetchJiraTicket = defineTool({
  name: 'fetch_jira_ticket',
  description: 'Fetch a Jira ticket and extract all relevant fields for QA analysis (description, existing AC, TC, comments, linked tickets).',
  parameters: Type.Object({
    ticketId: Type.String({ description: 'Jira ticket ID, e.g. PROJ-123' }),
  }),
  execute: async ({ ticketId }) => {
    const projectKey = ticketId.split('-')[0]!.toUpperCase();
    const pf = await loadProjectFields(projectKey);

    const customKeys = Object.values(pf);
    const allFields = [...new Set([...BASE_FIELDS, ...customKeys])];

    const data = await jiraGet(`/issue/${ticketId}`, { fields: allFields.join(',') }) as Record<string, unknown>;
    const fields = (data['fields'] ?? {}) as Record<string, unknown>;

    const baseUrl = (data['self'] as string ?? '').split('/rest/')[0];

    const linked = ((fields['issuelinks'] as unknown[]) ?? []).map((link: unknown) => {
      const l = link as Record<string, unknown>;
      const direction = 'inwardIssue' in l ? 'inward' : 'outward';
      const related = (l['inwardIssue'] ?? l['outwardIssue'] ?? {}) as Record<string, unknown>;
      return {
        type: (l['type'] as Record<string, string>)?.['name'] ?? '',
        direction,
        key: (related['key'] as string) ?? '',
        summary: ((related['fields'] as Record<string, unknown>)?.['summary'] as string) ?? '',
      };
    });

    const subtasks = ((fields['subtasks'] as unknown[]) ?? []).map((s: unknown) => {
      const st = s as Record<string, unknown>;
      return { key: st['key'] as string, summary: ((st['fields'] as Record<string, unknown>)?.['summary'] as string) ?? '' };
    });

    const comments = ((fields['comment'] as Record<string, unknown>)?.['comments'] as unknown[] ?? [])
      .map((c: unknown) => {
        const cm = c as Record<string, unknown>;
        const body = fieldText(cm['body']);
        return body.trim() ? {
          author: ((cm['author'] as Record<string, string>)?.['displayName']) ?? '',
          body: body.trim(),
        } : null;
      })
      .filter(Boolean);

    const hasPf = Object.keys(pf).length > 0;

    return JSON.stringify({
      key: data['key'],
      url: `${baseUrl}/browse/${data['key']}`,
      summary: fieldText(fields['summary']),
      type: fieldText(fields['issuetype']),
      status: fieldText(fields['status']),
      priority: fieldText(fields['priority']),
      reporter: fieldText(fields['reporter']),
      assignee: fieldText(fields['assignee']),
      labels: fields['labels'] ?? [],
      components: ((fields['components'] as unknown[]) ?? []).map((c: unknown) => (c as Record<string, string>)['name']),
      description: fieldText(fields['description']),
      acceptance_criteria: hasPf ? fieldText(fields[pf['acceptance_criteria'] ?? '']) : null,
      test_case: hasPf ? fieldText(fields[pf['test_case'] ?? '']) : null,
      qa_feedback: hasPf ? fieldText(fields[pf['qa_feedback'] ?? '']) : null,
      field_config_found: hasPf,
      linked_tickets: linked,
      subtasks,
      comments,
    }, null, 2);
  },
});

export const discoverJiraFields = defineTool({
  name: 'discover_jira_fields',
  description: 'Auto-discover and save custom field keys (AC, Test Case, QA Feedback) for a Jira project. Run once per new project.',
  parameters: Type.Object({
    ticketId: Type.String({ description: 'Any ticket ID from the project, e.g. PROJ-123' }),
  }),
  execute: async ({ ticketId }) => {
    const projectKey = ticketId.split('-')[0]!.toUpperCase();

    const meta = await jiraGet(`/issue/${ticketId}/editmeta`) as Record<string, unknown>;
    const fields = (meta['fields'] ?? {}) as Record<string, Record<string, unknown>>;

    const AC_KEYWORDS = ['acceptance criteria', 'kriteria penerimaan', 'ac field', 'acceptance_criteria'];
    const TC_KEYWORDS = ['test case', 'test cases', 'tc field'];
    const QA_KEYWORDS = ['qa feedback', 'qa notes', 'quality assurance'];

    const found: Record<string, string> = {};

    for (const [key, field] of Object.entries(fields)) {
      const name = ((field['name'] as string) ?? '').toLowerCase();
      if (AC_KEYWORDS.some(k => name.includes(k))) found['acceptance_criteria'] = key;
      else if (TC_KEYWORDS.some(k => name.includes(k))) found['test_case'] = key;
      else if (QA_KEYWORDS.some(k => name.includes(k))) found['qa_feedback'] = key;
    }

    let existing: Record<string, Record<string, string>> = {};
    try {
      existing = JSON.parse(await readFile(FIELDS_JSON, 'utf-8'));
    } catch { /* first run */ }

    existing[projectKey] = found;
    await writeFile(FIELDS_JSON, JSON.stringify(existing, null, 2));

    return `Saved field mapping for ${projectKey}: ${JSON.stringify(found)}`;
  },
});

export const fetchJiraField = defineTool({
  name: 'fetch_jira_field',
  description: 'Fetch the raw content of a specific field from a Jira ticket (e.g. acceptance_criteria or test_case).',
  parameters: Type.Object({
    ticketId: Type.String({ description: 'Jira ticket ID' }),
    fieldName: Type.Union([
      Type.Literal('acceptance_criteria'),
      Type.Literal('test_case'),
      Type.Literal('qa_feedback'),
    ], { description: 'Which field to fetch' }),
  }),
  execute: async ({ ticketId, fieldName }) => {
    const projectKey = ticketId.split('-')[0]!.toUpperCase();
    const pf = await loadProjectFields(projectKey);

    const fieldKey = pf[fieldName];
    if (!fieldKey) return `No field key configured for '${fieldName}' in project ${projectKey}. Run discover_jira_fields first.`;

    const data = await jiraGet(`/issue/${ticketId}`, { fields: fieldKey }) as Record<string, unknown>;
    const value = (data['fields'] as Record<string, unknown>)?.[fieldKey];
    return fieldText(value) || '(empty)';
  },
});
