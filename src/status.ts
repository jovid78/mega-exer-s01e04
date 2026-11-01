import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight, type DigestRow } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

export type Counts = { ok: number; retry: number; fail: number };

// counts = null when the night can't be read (views render "—").
export type NightSummary = { night: string; counts: Counts | null };

// Jobs counted by their last status.
export function tally(rows: DigestRow[]): Counts {
  const counts: Counts = { ok: 0, retry: 0, fail: 0 };
  for (const r of rows) counts[r.lastStatus] += 1;
  return counts;
}

export function summarizeNight(runsDir: string, night: string): NightSummary {
  const result = readNight(runsDir, night);
  return { night, counts: result.found ? tally(result.rows) : null };
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => summarizeNight(config.runsDir, n)),
  };
}
