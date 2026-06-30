// Flue tool definitions for reading from Jira
// Rewrite of tools/jira/get_ticket.py + discover_fields.py

import { Type, defineTool } from '@flue/runtime';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jiraGet, jiraPost } from './jira-client.ts';
import { fieldText } from './adf.ts';

const FIELDS_JSON = join(process.cwd(), 'src', 'tools', 'fields.json');

const BASE_FIELDS = [
  'summary', 'description', 'status', 'issuetype', 'priority',
  'reporter', 'assignee', 'labels', 'components',
  'customfield_10016', 'customfield_10014',
  'subtasks', 'issuelinks', 'comment',
];

const AC_KEYWORDS = ['acceptance criteria', 'acceptances criteria'];
const TC_KEYWORDS = ['test case', 'test cases'];
const QA_FEEDBACK_KEYWORDS = ['qa feedback'];
const QA_TESTER_EXACT = ['qa', 'qa/tester', 'tester/qa', 'quality assurance', 'qa testing'];

function matchFieldCategory(name: string): string | null {
  const n = name.toLowerCase().trim();
  if (AC_KEYWORDS.some(k => n.includes(k))) return 'acceptance_criteria';
  if (TC_KEYWORDS.some(k => n.includes(k))) return 'test_case';
  if (QA_FEEDBACK_KEYWORDS.some(k => n.includes(k))) return 'qa_feedback';
  if (QA_TESTER_EXACT.some(k => n === k)) return 'qa_tester';
  return null;
}

function extractQaTester(value: unknown): string {
  if (!value) return '';
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((u: unknown) => (u as Record<string, string>)['displayName'] ?? '')
    .filter(Boolean)
    .join(', ');
}

async function loadProjectFields(projectKey: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(FIELDS_JSON, 'utf-8');
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    return all[projectKey] ?? {};
  } catch {
    return {};
  }
}

async function saveProjectFields(projectKey: string, fields: Record<string, string>): Promise<void> {
  let existing: Record<string, Record<string, string>> = {};
  try {
    existing = JSON.parse(await readFile(FIELDS_JSON, 'utf-8'));
  } catch { /* first run */ }
  existing[projectKey] = fields;
  await writeFile(FIELDS_JSON, JSON.stringify(existing, null, 2));
}

// Calls GET /field to get all Jira fields, cross-references with fields that have
// values in the given ticket to resolve duplicate field names across projects.
async function discoverProjectFields(ticketId: string, projectKey: string): Promise<Record<string, string>> {
  const found: Record<string, string> = {};

  // Strategy 1: project-specific editmeta (most accurate, requires edit permission)
  try {
    const meta = await jiraGet(`/issue/${ticketId}/editmeta`) as Record<string, unknown>;
    const fields = (meta['fields'] ?? {}) as Record<string, Record<string, unknown>>;
    for (const [key, field] of Object.entries(fields)) {
      const category = matchFieldCategory((field['name'] as string) ?? '');
      if (category && !found[category]) found[category] = key;
    }
  } catch { /* no edit permission — fall back */ }

  // Strategy 2: GET /field cross-referenced with customfields populated in this ticket.
  // This avoids picking the wrong ID when multiple fields share the same name across projects.
  if (Object.keys(found).length < 2) {
    try {
      const issueData = await jiraGet(`/issue/${ticketId}`, { fields: '*all' }) as Record<string, unknown>;
      const issueFields = (issueData['fields'] ?? {}) as Record<string, unknown>;
      const populatedIds = new Set(
        Object.entries(issueFields)
          .filter(([k, v]) => k.startsWith('customfield_') && v !== null && v !== undefined)
          .map(([k]) => k),
      );

      type JiraField = { id: string; name: string };
      const allFields = await jiraGet('/field') as JiraField[];
      for (const field of allFields) {
        if (!populatedIds.has(field.id)) continue;
        const category = matchFieldCategory(field.name ?? '');
        if (category && !found[category]) found[category] = field.id;
      }
    } catch { /* ignore */ }
  }

  await saveProjectFields(projectKey, found);
  return found;
}

export const fetchJiraTicket = defineTool({
  name: 'fetch_jira_ticket',
  description: 'Fetch a Jira ticket and extract all relevant fields for QA analysis (description, AC, TC, QA tester, QA feedback, comments, linked tickets). Auto-discovers custom field IDs for new projects.',
  parameters: Type.Object({
    ticketId: Type.String({ description: 'Jira ticket ID, e.g. PROJ-123' }),
  }),
  execute: async ({ ticketId }) => {
    const projectKey = ticketId.split('-')[0]!.toUpperCase();
    let pf = await loadProjectFields(projectKey);

    if (Object.keys(pf).length === 0) {
      pf = await discoverProjectFields(ticketId, projectKey);
    }

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
      qa_tester: hasPf ? extractQaTester(fields[pf['qa_tester'] ?? '']) : null,
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
  description: 'Force re-discover and overwrite custom field mapping (AC, TC, QA tester, QA feedback) for a Jira project. Use when auto-discovery produced wrong results or fields changed.',
  parameters: Type.Object({
    ticketId: Type.String({ description: 'Any ticket ID from the project that has AC and TC filled in, e.g. PROJ-123' }),
  }),
  execute: async ({ ticketId }) => {
    const projectKey = ticketId.split('-')[0]!.toUpperCase();
    const found = await discoverProjectFields(ticketId, projectKey);
    const foundCount = Object.keys(found).length;
    if (foundCount === 0) {
      return `WARNING: No fields found for project ${projectKey}. Field names may not match known keywords. Verify in Jira and add manually to fields.json. Keywords — AC: ${JSON.stringify(AC_KEYWORDS)}, TC: ${JSON.stringify(TC_KEYWORDS)}, QA feedback: ${JSON.stringify(QA_FEEDBACK_KEYWORDS)}, QA tester (exact): ${JSON.stringify(QA_TESTER_EXACT)}`;
    }
    return `Saved field mapping for ${projectKey} (${foundCount}/4 fields found): ${JSON.stringify(found)}`;
  },
});

export const fetchEpicChildren = defineTool({
  name: 'fetch_epic_children',
  description: 'Fetch all child tickets under an Epic using JQL (supports both classic "Epic Link" and next-gen "parent" hierarchy). Returns ticket data including test_case content. Excludes Cancelled/Canceled/Backlog tickets.',
  parameters: Type.Object({
    epicId: Type.String({ description: 'Epic ticket ID, e.g. PROJ-100' }),
  }),
  execute: async ({ epicId }) => {
    const projectKey = epicId.split('-')[0]!.toUpperCase();
    let pf = await loadProjectFields(projectKey);

    if (Object.keys(pf).length === 0) {
      pf = await discoverProjectFields(epicId, projectKey);
    }

    const customKeys = Object.values(pf);
    const searchFields = [...new Set([...BASE_FIELDS, ...customKeys])].join(',');

    // Issue key values must NOT be quoted in JQL; field names with spaces need quotes
    const jql = `("Epic Link" = ${epicId} OR parent = ${epicId}) AND status NOT IN ("Cancelled", "Canceled", "Canceled", "Cancel", "Backlog") ORDER BY created ASC`;

    const data = await jiraPost('/search/jql', {
      jql,
      fields: searchFields.split(','),
      maxResults: 100,
    }) as Record<string, unknown>;

    const issues = (data['issues'] as unknown[]) ?? [];
    const baseUrl = issues.length > 0
      ? ((issues[0] as Record<string, unknown>)['self'] as string ?? '').split('/rest/')[0]
      : '';

    const hasPf = Object.keys(pf).length > 0;

    const tickets = issues.map((issue: unknown) => {
      const iss = issue as Record<string, unknown>;
      const fields = (iss['fields'] ?? {}) as Record<string, unknown>;
      const key = iss['key'] as string;
      const testCaseText = hasPf ? fieldText(fields[pf['test_case'] ?? '']) : '';

      return {
        key,
        url: `${baseUrl}/browse/${key}`,
        summary: fieldText(fields['summary']),
        type: fieldText(fields['issuetype']),
        status: fieldText(fields['status']),
        assignee: fieldText(fields['assignee']),
        reporter: fieldText(fields['reporter']),
        description: fieldText(fields['description']),
        acceptance_criteria: hasPf ? fieldText(fields[pf['acceptance_criteria'] ?? '']) : '',
        test_case: testCaseText,
        has_test_case: testCaseText.trim().length > 0,
        qa_tester: hasPf ? extractQaTester(fields[pf['qa_tester'] ?? '']) : '',
        qa_feedback: hasPf ? fieldText(fields[pf['qa_feedback'] ?? '']) : '',
      };
    });

    return JSON.stringify({
      epicId,
      field_config_found: hasPf,
      total: tickets.length,
      tickets,
    }, null, 2);
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
      Type.Literal('qa_tester'),
      Type.Literal('qa_feedback'),
    ], { description: 'Which field to fetch' }),
  }),
  execute: async ({ ticketId, fieldName }) => {
    const projectKey = ticketId.split('-')[0]!.toUpperCase();
    let pf = await loadProjectFields(projectKey);

    if (Object.keys(pf).length === 0) {
      pf = await discoverProjectFields(ticketId, projectKey);
    }

    const fieldKey = pf[fieldName];
    if (!fieldKey) return `Field '${fieldName}' not found for project ${projectKey}. Try discover_jira_fields with a ticket that has this field filled in.`;

    const data = await jiraGet(`/issue/${ticketId}`, { fields: fieldKey }) as Record<string, unknown>;
    const value = (data['fields'] as Record<string, unknown>)?.[fieldKey];
    return fieldName === 'qa_tester' ? extractQaTester(value) || '(empty)' : fieldText(value) || '(empty)';
  },
});
