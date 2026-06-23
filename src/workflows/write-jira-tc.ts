// POST /workflows/write-jira-tc
// Write TC markdown as ADF table to Jira — no LLM needed

import { type FlueContext, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jiraGet, jiraPut } from '../tools/jira-client.ts';
import { parseTcMarkdown, scenariosToAdfTable } from '../tools/adf.ts';

export const route: WorkflowRouteHandler = async (c, next) => {
  const secret = process.env['API_SECRET'];
  if (secret && c.req.header('x-api-secret') !== secret)
    return c.json({ error: 'Unauthorized' }, 401);
  return next();
};

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

interface Payload {
  ticketId: string;
  tcMarkdown: string;
  overwrite?: boolean;
}

const resultSchema = v.object({
  success: v.boolean(),
  message: v.string(),
  ticketId: v.string(),
  scenarioCount: v.optional(v.number()),
  tcFieldWasPopulated: v.optional(v.boolean()),
});

export async function run({ payload }: FlueContext<Payload>) {
  const { ticketId, tcMarkdown, overwrite = false } = payload;

  const projectKey = ticketId.split('-')[0]!.toUpperCase();
  const pf = await loadProjectFields(projectKey);
  const tcField = pf['test_case'];

  if (!tcField) {
    return v.parse(resultSchema, {
      success: false,
      message: `No TC field configured for project ${projectKey}. Call discover-fields first.`,
      ticketId,
    });
  }

  // Check if TC field already has content
  const data = await jiraGet(`/issue/${ticketId}`, { fields: tcField }) as Record<string, unknown>;
  const existing = (data['fields'] as Record<string, unknown>)?.[tcField];
  const hasContent = typeof existing === 'object' && existing !== null &&
    (existing as Record<string, unknown>)['type'] === 'doc' &&
    ((existing as Record<string, unknown>)['content'] as unknown[])?.length > 0;

  if (hasContent && !overwrite) {
    return v.parse(resultSchema, {
      success: false,
      message: `TC field already has content for ${ticketId}. Send overwrite: true to replace it.`,
      ticketId,
      tcFieldWasPopulated: true,
    });
  }

  const scenarios = parseTcMarkdown(tcMarkdown);
  if (scenarios.length === 0) {
    return v.parse(resultSchema, {
      success: false,
      message: 'No TS blocks found in tcMarkdown. Check the format.',
      ticketId,
    });
  }

  const adf = scenariosToAdfTable(scenarios);
  await jiraPut(`/issue/${ticketId}`, { fields: { [tcField]: adf } });

  return v.parse(resultSchema, {
    success: true,
    message: `Written ${scenarios.length} test scenario(s) to ${ticketId}.`,
    ticketId,
    scenarioCount: scenarios.length,
    tcFieldWasPopulated: hasContent,
  });
}
