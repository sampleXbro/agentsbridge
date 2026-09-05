import { getCommandMatcher } from './regex-safety.js';

/**
 * Breadth guardrail for `command_pattern` triggers. A pattern that matches the
 * empty string (`.*`, `^`, `x*`, `(git)?`) or nearly every command (` `, `.`,
 * `\w`) fires on EVERY recall — it is not a trigger, it is a leak that dilutes
 * every command-shaped lesson. Breadth is probed empirically against a fixed
 * corpus of unrelated commands, so the verdict is deterministic and does not
 * depend on regex-shape heuristics. Invalid or unsafe patterns are never
 * "broad": those fall through to the existing INVALID/UNSAFE rejection.
 */

/** Twenty unrelated commands; a pattern hitting most of them is a leak, not a trigger. */
export const COMMAND_PROBE_CORPUS: readonly string[] = [
  'git status',
  'git commit -m "wip"',
  'pnpm test',
  'npx vitest run src/x.test.ts',
  'ls -la',
  'cat README.md',
  'rm -rf dist',
  'mkdir -p build/out',
  'node scripts/build.js',
  'docker compose up -d',
  'curl -s https://example.com',
  'echo hello > out.txt',
  "sed -i 's/a/b/' file.txt",
  'pnpm lint --fix',
  'python3 -m pytest',
  'cargo build --release',
  'make',
  'npm install --global typescript',
  'cp a.txt b.txt',
  'grep -rn TODO src',
];

/** Broad when the pattern hits MORE than this share of the probe corpus. */
const BROAD_HIT_RATIO = 0.5;

/** Generous per-probe work bound; the corpus is tiny, so this never trips a real pattern. */
const PROBE_BUDGET = 100_000;

/** True when `pattern` matches the empty string or most of the probe corpus. */
export function isBroadCommandPattern(pattern: string): boolean {
  const matcher = getCommandMatcher(pattern);
  if (matcher === null) return false;
  if (matcher.test('', { remaining: PROBE_BUDGET })) return true;
  let hits = 0;
  for (const command of COMMAND_PROBE_CORPUS) {
    if (matcher.test(command, { remaining: PROBE_BUDGET })) hits += 1;
  }
  return hits > COMMAND_PROBE_CORPUS.length * BROAD_HIT_RATIO;
}
