import { existsSync, readFileSync } from 'node:fs';
import { parseBullets, type ParsedBullet } from './bullet-parser.js';
import { hashBullet } from './bullet-hash.js';
import { loadLedger } from './ledger.js';
import type { LessonsPaths } from './paths.js';

export interface UnroutedBullet {
  readonly hash: string;
  readonly lineNumber: number;
  readonly preview: string;
}

export interface CheckJournalResult {
  readonly ok: boolean;
  readonly checked: number;
  readonly unrouted: UnroutedBullet[];
}

/**
 * Verify every bullet in the lessons journal is recorded in the ledger
 * (either routed to a topic or explicitly marked `skip`). Returns a structured
 * result; callers decide how to surface the outcome (CLI exit, CI annotation,
 * etc.).
 *
 * Missing journal → ok=true, checked=0. Missing ledger → all journal bullets
 * count as unrouted. Designed for use as a pre-commit / CI gate that fails
 * the build when journal bullets have not been distilled.
 */
export function checkJournalCoverage(paths: LessonsPaths): CheckJournalResult {
  if (!existsSync(paths.journal)) {
    return { ok: true, checked: 0, unrouted: [] };
  }
  const bullets = parseBullets(readFileSync(paths.journal, 'utf8'));
  const ledger = loadLedger(paths.ledger);
  const unrouted: UnroutedBullet[] = [];
  for (const bullet of bullets) {
    const hash = hashBullet(bullet.text);
    if (ledger.assignments[hash] !== undefined) continue;
    unrouted.push({ hash, lineNumber: bullet.lineNumber, preview: previewOf(bullet) });
  }
  return { ok: unrouted.length === 0, checked: bullets.length, unrouted };
}

function previewOf(bullet: ParsedBullet): string {
  const newlineAt = bullet.text.indexOf('\n');
  const firstLine = newlineAt === -1 ? bullet.text : bullet.text.slice(0, newlineAt);
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
}
