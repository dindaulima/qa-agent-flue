// Custom Hono app — mounts Flue under /api and adds health check

import { flue } from '@flue/runtime/routing';
import { Hono, type MiddlewareHandler } from 'hono';

const app = new Hono();

app.get('/health', c => c.json({ status: 'ok', service: 'qa-agent-flue' }));

// All Flue agents and workflows are mounted under /api
// Agents:    POST /api/agents/qa-analyst/:id
// Workflows: POST /api/workflows/generate-ac
//            POST /api/workflows/generate-tc
//            POST /api/workflows/write-jira-ac
//            POST /api/workflows/write-jira-tc
//            POST /api/workflows/evaluate-qa
//            POST /api/workflows/generate-sign-off
app.route('/api', flue());

const requireSecret: MiddlewareHandler = async (c, next) => {
  const secret = process.env['API_SECRET'];
  if (secret && c.req.header('x-api-secret') !== secret)
    return c.json({ error: 'Unauthorized' }, 401);
  return next();
};

// GET /api/run-result/:runId
// Polling endpoint sederhana: return { status, result } tanpa stream events.
// Baca langsung dari SQLite untuk bypass in-memory run registry Flue.
// - status "running"   → belum selesai, poll lagi
// - status "completed" → result berisi hasil workflow
// - status "errored"   → error berisi pesan error
import { DatabaseSync } from 'node:sqlite';
const DB_PATH = './data/flue.db';

app.get('/api/run-result/:runId', requireSecret, (c) => {
  const runId = c.req.param('runId');
  const streamPath = `runs/${runId}`;

  const db = new DatabaseSync(DB_PATH);
  try {
    const stream = db.prepare(
      'SELECT next_offset, closed FROM flue_event_streams WHERE path = ?'
    ).get(streamPath) as { next_offset: number; closed: number } | undefined;

    if (!stream) return c.json({ error: 'Run not found' }, 404);
    if (!stream.closed) return c.json({ status: 'running' });

    // Run selesai — ambil last 100 events untuk cari run_end
    const lastPageStart = Math.max(0, stream.next_offset - 100);
    const entries = db.prepare(
      'SELECT data FROM flue_event_stream_entries WHERE path = ? AND seq >= ? ORDER BY seq ASC'
    ).all(streamPath, lastPageStart) as { data: string }[];

    const runEnd = entries.map(e => JSON.parse(e.data)).find((ev: any) => ev.type === 'run_end');
    if (!runEnd) return c.json({ status: 'running' });

    if (runEnd.isError) {
      return c.json({ status: 'errored', error: runEnd.error ?? null, durationMs: runEnd.durationMs });
    }
    return c.json({ status: 'completed', result: runEnd.result ?? null, durationMs: runEnd.durationMs });
  } finally {
    db.close();
  }
});

export default app;
