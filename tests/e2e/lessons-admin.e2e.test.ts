/**
 * E2E: lessons CLI lifecycle/admin ops against the real binary — deprecate,
 * merge, strip-markers, import-md (fix #1: clean message, no ENOENT, when no
 * legacy store exists), and the global flag-ordering fix (#3: --json/--verbose
 * before the command name no longer swallow it).
 *
 * The recall/capture core lives in lessons.e2e.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { addLessonCli } from './helpers/lessons-cli.js';

const LEGACY_FIXTURE = resolve(process.cwd(), 'tests/fixtures/lessons/legacy-input');

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'am-lessons-admin-e2e-'));
});

afterEach(() => {
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe('lessons CLI — deprecate', () => {
  it('deprecates a lesson and hides it from show', async () => {
    const keep = await addLessonCli(dir, 'Keeper lesson', {
      topic: 'e2e',
      newTopic: true,
      summary: 's',
    });
    const drop = await addLessonCli(dir, 'Doomed lesson', { topic: 'e2e' });
    const dep = await runCli(`lessons deprecate ${drop}`, dir);
    expect(dep.exitCode).toBe(0);

    const show = await runCli('lessons show e2e', dir);
    expect(show.stdout).toContain('Keeper lesson');
    expect(show.stdout).not.toContain('Doomed lesson');
    expect(keep).not.toBe(drop);
  });

  it('unknown lesson exits 1', async () => {
    const r = await runCli('lessons deprecate does-not-exist', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('Unknown lesson');
  });

  it('missing id exits 2', async () => {
    const r = await runCli('lessons deprecate', dir);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain('Usage: agentsmesh lessons deprecate');
  });

  it('--superseded-by unknown exits 1', async () => {
    const id = await addLessonCli(dir, 'Has superseder check', {
      topic: 'e2e',
      newTopic: true,
      summary: 's',
    });
    const r = await runCli(`lessons deprecate ${id} --superseded-by ghost`, dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('Unknown superseder: ghost');
  });
});

describe('lessons CLI — merge', () => {
  it('absorbs the loser into the keeper', async () => {
    const keeper = await addLessonCli(dir, 'Keeper of triggers', {
      topic: 'e2e',
      newTopic: true,
      summary: 's',
      extra: ['--trigger-kw', 'keepkw'],
    });
    const loser = await addLessonCli(dir, 'Loser of triggers', {
      topic: 'e2e',
      extra: ['--trigger-kw', 'losekw'],
    });
    const merge = await runCli(`lessons merge ${loser} ${keeper}`, dir);
    expect(merge.exitCode).toBe(0);
    expect(merge.stdout).toContain('Merged');

    const recall = await runCli('lessons query --keyword losekw', dir);
    expect(recall.stdout).toContain('Keeper of triggers');
  });

  it('unknown ids exit 1', async () => {
    const r = await runCli('lessons merge a b', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('unknown lesson');
  });

  it('missing second id exits 2', async () => {
    const r = await runCli('lessons merge only-one', dir);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain('Usage: agentsmesh lessons merge');
  });
});

describe('lessons CLI — strip-markers', () => {
  it('--dry-run reports without writing, then real run reports', async () => {
    await addLessonCli(dir, 'Strip markers seed', { topic: 'e2e', newTopic: true, summary: 's' });
    const dry = await runCli('lessons strip-markers --dry-run', dir);
    expect(dry.exitCode).toBe(0);
    expect(dry.stdout).toContain('Would strip');

    const real = await runCli('lessons strip-markers', dir);
    expect(real.exitCode).toBe(0);
    expect(real.stdout).toContain('Stripped');
  });
});

describe('lessons CLI — import-md (fix #1: no ENOENT without a legacy store)', () => {
  it('empty dir returns a clean "nothing to migrate" message, exit 1, no ENOENT', async () => {
    const r = await runCli('lessons import-md', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('No legacy lessons store found');
    expect(r.stderr).not.toContain('ENOENT');
  });

  it('--force without a legacy store still returns the clean message (no ENOENT)', async () => {
    const r = await runCli('lessons import-md --force', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('No legacy lessons store found');
    expect(r.stderr).not.toContain('ENOENT');
  });

  it('--verbose without a legacy store prints no stack trace', async () => {
    const r = await runCli('--verbose lessons import-md', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).not.toContain('ENOENT');
    expect(r.stderr).not.toMatch(/\n\s+at\s/); // no node stack frames
  });

  it('refuses when lessons.json already exists', async () => {
    await addLessonCli(dir, 'Existing graph', { topic: 'e2e', newTopic: true, summary: 's' });
    const r = await runCli('lessons import-md', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('lessons.json already exists');
  });

  it('migrates a real legacy tree and removes the legacy artifacts', async () => {
    mkdirSync(join(dir, '.agentsmesh', 'lessons'), { recursive: true });
    cpSync(LEGACY_FIXTURE, join(dir, '.agentsmesh', 'lessons'), { recursive: true });

    const r = await runCli('lessons import-md --migrated-at 2026-06-06', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('Imported lessons: topics=2 lessons=5 triggers=7');

    expect(existsSync(join(dir, '.agentsmesh/lessons/lessons.json'))).toBe(true);
    expect(existsSync(join(dir, '.agentsmesh/lessons/index.yaml'))).toBe(false);

    const validate = await runCli('lessons validate', dir);
    expect(validate.exitCode).toBe(0);
    expect(validate.stdout).toContain('Lessons graph: ok.');
  });

  it('--merge recovers a stranded legacy store into a populated graph (no data loss)', async () => {
    // Populated graph first...
    await addLessonCli(dir, 'Graph-only lesson kept on merge', {
      topic: 'graph-topic',
      newTopic: true,
      summary: 'Graph topic',
      extra: ['--trigger-kw', 'graphkw'],
    });
    // ...then a legacy store coexists (the stranded state).
    mkdirSync(join(dir, '.agentsmesh', 'lessons'), { recursive: true });
    cpSync(LEGACY_FIXTURE, join(dir, '.agentsmesh', 'lessons'), { recursive: true });

    // Without --merge/--force it refuses and points at --merge.
    const refused = await runCli('lessons import-md', dir);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain('--merge');

    const merged = await runCli('lessons import-md --merge --migrated-at 2026-06-06', dir);
    expect(merged.exitCode).toBe(0);
    expect(existsSync(join(dir, '.agentsmesh/lessons/index.yaml'))).toBe(false);

    // Both the graph lesson and the migrated legacy lessons are recallable.
    const graphHit = await runCli('lessons query --keyword graphkw --all', dir);
    expect(graphHit.stdout).toContain('Graph-only lesson kept on merge');
    const legacyHit = await runCli('lessons query --keyword alpha --all', dir);
    expect(legacyHit.exitCode).toBe(0);
    const validate = await runCli('lessons validate', dir);
    expect(validate.exitCode).toBe(0);
  });
});

describe('lessons CLI — global flag ordering (fix #3)', () => {
  it('--json before the command resolves to lessons and emits the envelope', async () => {
    const r = await runCli('--json lessons topics', dir);
    expect(r.exitCode).toBe(0);
    const env = JSON.parse(r.stdout) as { success: boolean; command: string };
    expect(env.success).toBe(true);
    expect(env.command).toBe('lessons');
  });

  it('--verbose before the command does not misparse it as unknown', async () => {
    const r = await runCli('--verbose lessons topics', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).not.toContain('Unknown command');
  });

  it('--json after the command still produces the envelope', async () => {
    const r = await runCli('lessons topics --json', dir);
    expect(r.exitCode).toBe(0);
    const env = JSON.parse(r.stdout) as { success: boolean; command: string };
    expect(env.command).toBe('lessons');
  });

  it('bare --version still prints the version (parser fix did not break it)', async () => {
    const bare = await runCli('--version', dir);
    expect(bare.exitCode).toBe(0);
    expect(bare.stdout).toMatch(/v\d+\.\d+\.\d+/);
  });
});
