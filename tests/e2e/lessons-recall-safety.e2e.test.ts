/**
 * E2E: recall safety + leanness through the real binary —
 *   - ReDoS guard: capturing a catastrophic-backtracking command_pattern is
 *     rejected (UNSAFE_TRIGGER_PATTERN); recall never executes one.
 *   - default token budget: a broad match is trimmed by the default budget
 *     unless `--all` is passed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli, runCliArgs } from './helpers/run-cli.js';
import { addLessonCli } from './helpers/lessons-cli.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'am-lessons-safety-e2e-'));
});

afterEach(() => {
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe('lessons CLI — ReDoS guard (P1)', () => {
  // Includes the reviewer-reported bypasses of the old star-height heuristic.
  it.each(['(a+)+$', '(a|aa)+$', '(a|a?)+$', 'a+a+$'])(
    'rejects a capture with catastrophic-backtracking command_pattern %j',
    async (pattern) => {
      const r = await runCliArgs(
        [
          'lessons',
          'add',
          'redos rule',
          '--topic',
          'sec',
          '--new-topic',
          '--topic-summary',
          'security',
          '--trigger-cmd',
          pattern,
        ],
        dir,
      );
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toContain('UNSAFE_TRIGGER_PATTERN');
    },
  );

  it('accepts a linear command_pattern', async () => {
    const r = await runCliArgs(
      [
        'lessons',
        'add',
        'safe rule',
        '--topic',
        'sec',
        '--new-topic',
        '--topic-summary',
        'security',
        '--trigger-cmd',
        '^git commit',
      ],
      dir,
    );
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('Added lesson');
  });

  it('recall against an adversarial command returns promptly (no hang)', async () => {
    await addLessonCli(dir, 'safe recall rule', {
      topic: 'sec',
      newTopic: true,
      summary: 's',
      extra: ['--trigger-cmd', '^pnpm test'],
    });
    const adversarial = 'a'.repeat(40) + '!';
    const start = Date.now();
    const r = await runCli(`lessons query --cmd ${adversarial}`, dir);
    expect(Date.now() - start).toBeLessThan(5000);
    expect(r.exitCode).toBe(0);
  });
});

describe('lessons CLI — default token budget (P2)', () => {
  // ~250-char rule ≈ ~63 tokens; 8 of them (~500 tokens) exceed the 400 budget.
  const filler = 'word '.repeat(50).trim();

  async function seedLongLessons(): Promise<void> {
    for (let i = 0; i < 8; i++) {
      await addLessonCli(dir, `Long budget rule ${i} ${filler}`, {
        topic: 'budget',
        newTopic: i === 0,
        summary: 'Budget topic',
        extra: ['--trigger-kw', 'budgetkw'],
      });
    }
  }

  it('default query is trimmed by the budget; --all returns the full match set', async () => {
    await seedLongLessons();

    const def = await runCli('lessons query --keyword budgetkw --format json', dir);
    expect(def.exitCode).toBe(0);
    const defData = JSON.parse(def.stdout) as { lessons: unknown[]; totalMatches: number };
    expect(defData.totalMatches).toBe(8);
    expect(defData.lessons.length).toBeLessThan(8); // budget trimmed

    const all = await runCli('lessons query --keyword budgetkw --all --format json', dir);
    const allData = JSON.parse(all.stdout) as { lessons: unknown[] };
    expect(allData.lessons.length).toBe(8);
  });
});
