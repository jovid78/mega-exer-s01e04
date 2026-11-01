import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const good = [
  '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}',
  '{"at":"2026-10-28T23:00:06+01:00","job":"lane/sync","status":"retry","owner":"rook","error":"timeout"}',
  '{"at":"2026-10-29T00:00:04+01:00","job":"lane/sync","status":"ok","owner":null}',
  '',
].join('\n');

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-'));
  fs.writeFileSync(path.join(dir, '2026-01-01.jsonl'), good);
  fs.writeFileSync(path.join(dir, '2026-01-02.jsonl'), '');
  fs.writeFileSync(path.join(dir, '2026-01-03.jsonl'), good + 'not json\n');
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

type Body = { night: string; rows: { job: string }[]; badLines: number };
const api = async (night: string) => {
  const res = await app.request(`/api/digest/${night}`);
  return { res, body: (await res.json()) as Body };
};
const page = async (night: string) => {
  const res = await app.request(`/digest/${night}`);
  return { res, html: await res.text() };
};

describe('digest routes', () => {
  it('good night: 200, and the JSON jobs match the page in order', async () => {
    const p = await page('2026-01-01');
    const a = await api('2026-01-01');
    expect(p.res.status).toBe(200);
    expect(a.res.status).toBe(200);
    const jobs = a.body.rows.map((r) => r.job);
    expect(jobs).toEqual(['lane/sync', 'rig/rotate-logs']);
    const positions = jobs.map((j) => p.html.indexOf(j));
    expect(positions.every((i) => i >= 0)).toBe(true);
    expect([...positions].sort((x, y) => x - y)).toEqual(positions);
    expect(a.body.badLines).toBe(0);
  });

  it('night with no file: 404 on both', async () => {
    expect((await page('2026-01-09')).res.status).toBe(404);
    expect((await api('2026-01-09')).res.status).toBe(404);
  });

  it('empty night: page says nothing ran, JSON rows is []', async () => {
    const p = await page('2026-01-02');
    const a = await api('2026-01-02');
    expect(p.res.status).toBe(200);
    expect(p.html).toContain('nothing ran');
    expect(a.res.status).toBe(200);
    expect(a.body.rows).toEqual([]);
  });

  it('night with a bad line: 200, bad line counted on both', async () => {
    const p = await page('2026-01-03');
    const a = await api('2026-01-03');
    expect(p.res.status).toBe(200);
    expect(p.html).toContain('1 line could not be read');
    expect(a.res.status).toBe(200);
    expect(a.body.badLines).toBe(1);
  });

  it('non-date night: 404 on both', async () => {
    expect((await page('abc')).res.status).toBe(404);
    const a = await api('abc');
    expect(a.res.status).toBe(404);
    expect(a.body).toEqual({ error: 'no such night' });
  });
});
