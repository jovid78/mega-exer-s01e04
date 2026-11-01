import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

type LogLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Parse one line at the edge. Anything that isn't a well-formed log line is null.
export function parseLine(text: string): LogLine | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.at !== 'string' || v.at === '') return null;
  if (typeof v.job !== 'string' || v.job === '') return null;
  if (typeof v.status !== 'string' || !STATUSES.includes(v.status)) return null;
  if (v.owner !== null && typeof v.owner !== 'string') return null;
  if (v.error !== undefined && typeof v.error !== 'string') return null;
  return {
    at: v.at,
    job: v.job,
    status: v.status as RunStatus,
    owner: v.owner,
    error: v.error ?? null,
  };
}

// Pure: the text of one night's log to its rows (sorted by job) and bad-line count.
export function digest(text: string): { rows: DigestRow[]; badLines: number } {
  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines += 1;
      continue;
    }
    const row = byJob.get(line.job);
    if (!row) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    // The log is append-only: file order is time order, the last line wins.
    row.runs += 1;
    if (line.status === 'retry') row.retries += 1;
    row.owner = line.owner;
    row.lastStatus = line.status;
    row.lastError = line.error;
    row.lastAt = line.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
}

export const readNight: ReadNight = (runsDir, night): Night => {
  if (!NIGHT.test(night)) return { found: false };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { found: false };
    throw err;
  }
  return { found: true, ...digest(text) };
};
