// POST /workflows/write-jira-ac
// Write AC markdown to Jira — no LLM needed, pure deterministic operation

import { type FlueContext, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jiraGet, jiraPut } from '../tools/jira-client.ts';
import { markdownToAdf } from '../tools/adf.ts';

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
  acMarkdown: string;
  append: boolean;
}

const resultSchema = v.object({
  success: v.boolean(),
  message: v.string(),
  ticketId: v.string(),
  mode: v.union([v.literal('append'), v.literal('overwrite')]),
});

export async function run({ payload }: FlueContext<Payload>) {
  const { ticketId, acMarkdown, append } = payload;

  const projectKey = ticketId.split('-')[0]!.toUpperCase();
  const pf = await loadProjectFields(projectKey);
  const acField = pf['acceptance_criteria'];

  if (!acField) {
    return v.parse(resultSchema, {
      success: false,
      message: `No AC field configured for project ${projectKey}. Call discover-fields first.`,
      ticketId,
      mode: append ? 'append' : 'overwrite',
    });
  }

  let adf = markdownToAdf(acMarkdown);

  if (append) {
    const data = await jiraGet(`/issue/${ticketId}`, { fields: acField }) as Record<string, unknown>;
    const existing = (data['fields'] as Record<string, unknown>)?.[acField];
    if (typeof existing === 'object' && existing !== null && (existing as Record<string, unknown>)['type'] === 'doc') {
      const existingContent = ((existing as Record<string, unknown>)['content'] as unknown[]) ?? [];
      if (existingContent.length > 0) {
        adf = { version: 1, type: 'doc', content: [...existingContent, { type: 'rule' }, ...(adf['content'] as unknown[])] };
      }
    }
  }

  await jiraPut(`/issue/${ticketId}`, { fields: { [acField]: adf } });

  return v.parse(resultSchema, {
    success: true,
    message: `AC written to ${ticketId} (${append ? 'appended' : 'overwritten'}).`,
    ticketId,
    mode: append ? 'append' : 'overwrite',
  });
}
