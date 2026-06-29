// Jira REST API client — rewrite of tools/jira/client.py

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export function getJiraConfig(): JiraConfig {
  const baseUrl = (process.env['JIRA_BASE_URL'] ?? '').replace(/\/$/, '');
  const email = process.env['JIRA_EMAIL'] ?? '';
  const apiToken = process.env['JIRA_API_TOKEN'] ?? '';

  const missing = [
    ['JIRA_BASE_URL', baseUrl],
    ['JIRA_EMAIL', email],
    ['JIRA_API_TOKEN', apiToken],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0)
    throw new Error(`Missing Jira env vars: ${missing.join(', ')}. Copy .env.example to .env.`);

  return { baseUrl, email, apiToken };
}

function authHeader(config: JiraConfig): Record<string, string> {
  const token = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function jiraGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const config = getJiraConfig();
  const url = new URL(`${config.baseUrl}/rest/api/3${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { headers: authHeader(config) });
  if (!res.ok) throw new Error(`Jira GET ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

export async function jiraPost(path: string, payload: unknown): Promise<unknown> {
  const config = getJiraConfig();
  const res = await fetch(`${config.baseUrl}/rest/api/3${path}`, {
    method: 'POST',
    headers: authHeader(config),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira POST ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

export async function jiraPut(path: string, payload: unknown): Promise<void> {
  const config = getJiraConfig();
  const res = await fetch(`${config.baseUrl}/rest/api/3${path}`, {
    method: 'PUT',
    headers: authHeader(config),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira PUT ${path} → ${res.status}: ${body}`);
  }
}
