// The contract for the morning digest (plan.md § 1). Section 2 builds against this file.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in runs/<night>.jsonl.
export type DigestRow = {
  job: string;
  owner: string | null; // from the job's last line; null = no owner (views render "—")
  runs: number; // all lines for the job, retries included
  retries: number; // lines with status "retry"
  lastStatus: RunStatus; // from the job's last line
  lastError: string | null; // from the job's last line; null = no error (views render "—")
  firstAt: string; // `at` as logged, offset kept, never converted to UTC
  lastAt: string; // same
};

// "No such night" (404) vs "empty night" (rows: [], "nothing ran").
// badLines = lines that did not parse; counted, never thrown.
export type Night =
  | { found: false }
  | { found: true; rows: DigestRow[]; badLines: number };

// Rows come back sorted by job: page, JSON and board share this order.
// A night that is not YYYY-MM-DD is { found: false }, so it never reaches other files.
export type ReadNight = (runsDir: string, night: string) => Night;

// The reader itself lives in read.ts; re-exported here so section 2 imports one file.
export { readNight } from './read.js';
