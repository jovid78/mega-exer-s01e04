import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight, type DigestRow } from '../src/digest/types.js';

function rowsOf(runsDir: string, night: string): { rows: DigestRow[]; badLines: number } {
  const n = readNight(runsDir, night);
  if (!n.found) throw new Error(`night ${night} not found`);
  return n;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const { rows, badLines } = rowsOf('runs', '2026-10-28');
  const row = (job: string) => rows.find((r) => r.job === job);

  it('has 5 jobs, sorted by job, and 1 bad line', () => {
    expect(rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(badLines).toBe(1);
  });

  it('counts retries as runs', () => {
    expect(row('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    expect(row('lane/sync')).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastAt: '2026-10-29T05:00:04+01:00' });
  });

  it('keeps the last status and error of a failed job', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
  });

  it('keeps a row with a null owner', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok' });
  });

  it('keeps times as logged, with their offset', () => {
    expect(row('fixtures/refresh')).toMatchObject({
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });
});

describe('readNight edges', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(dir, '2026-01-01.jsonl'), '');
  writeFileSync(
    join(dir, '2026-01-02.jsonl'),
    [
      'not json',
      '[1,2]',
      '{"at":"2026-01-02T01:00:00+01:00","job":"x","status":"maybe","owner":null}',
      '{"at":"2026-01-02T01:00:00+01:00","status":"ok","owner":null}',
      '',
      '{"at":"2026-01-02T01:00:00-05:00","job":"x","status":"ok","owner":null}',
    ].join('\n'),
  );

  it('tells a missing night from an empty one', () => {
    expect(readNight(dir, '2026-01-09')).toEqual({ found: false });
    expect(readNight(dir, '2026-01-01')).toEqual({ found: true, rows: [], badLines: 0 });
  });

  it('refuses a night that is not YYYY-MM-DD', () => {
    expect(readNight(dir, '../runs/2026-10-28')).toEqual({ found: false });
  });

  it('counts bad lines without throwing and skips blank ones', () => {
    const { rows, badLines } = rowsOf(dir, '2026-01-02');
    expect(badLines).toBe(4);
    expect(rows).toEqual([
      {
        job: 'x',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-01-02T01:00:00-05:00',
        lastAt: '2026-01-02T01:00:00-05:00',
      },
    ]);
  });
});
