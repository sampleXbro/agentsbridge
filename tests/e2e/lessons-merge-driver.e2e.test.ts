import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCliArgs } from './helpers/run-cli.js';

// Forward slashes only: this path is embedded in a git merge-driver command
// (below) that git runs via `sh`, where a Windows `\` path has its separators
// eaten as escapes (`D:\a\...\cli.js` -> `D:aagentsmeshdistcli.js` ->
// MODULE_NOT_FOUND, git reports a conflict). Node accepts `/` on Windows.
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js').replaceAll('\\', '/');

let dir: string;
let mainBranch: string;

function git(...args: string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

async function addLesson(rule: string, topic: string, file: string): Promise<void> {
  await runCliArgs(
    ['lessons', 'add', rule, '--topic', topic, '--new-topic', '--topic-summary', `${topic}.`, '--trigger-file', file],
    dir,
  );
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-mergedrv-e2e-'));
  git('init', '-q');
  git('config', 'user.email', 't@e.st');
  git('config', 'user.name', 'Test');
  await runCliArgs(['init', '--lessons'], dir);
  // Wire the merge driver (per-clone git config + committed .gitattributes).
  writeFileSync(
    join(dir, '.gitattributes'),
    '.agentsmesh/lessons/lessons.json merge=agentsmesh-lessons\n',
  );
  git('config', 'merge.agentsmesh-lessons.name', 'agentsmesh lessons union');
  git('config', 'merge.agentsmesh-lessons.driver', `node ${CLI_PATH} lessons merge-driver %O %A %B`);
  git('add', '-A');
  git('commit', '-qm', 'base');
  mainBranch = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('lessons.json git merge driver', () => {
  it('auto-merges two parallel captures with no conflict', async () => {
    git('checkout', '-q', '-b', 'branch-x');
    await addLesson('Rule X.', 'tx', 'src/x.ts');
    git('add', '-A');
    git('commit', '-qm', 'add x');

    git('checkout', '-q', mainBranch);
    git('checkout', '-q', '-b', 'branch-y');
    await addLesson('Rule Y.', 'ty', 'src/y.ts');
    git('add', '-A');
    git('commit', '-qm', 'add y');

    git('checkout', '-q', 'branch-x');
    const merge = git('merge', '--no-edit', 'branch-y');

    expect(merge.status, `merge stdout=${merge.stdout}\nstderr=${merge.stderr}`).toBe(0); // no conflict
    const graph = JSON.parse(
      readFileSync(join(dir, '.agentsmesh/lessons/lessons.json'), 'utf8'),
    ) as { lessons: Record<string, { rule: string }> };
    const rules = Object.values(graph.lessons).map((l) => l.rule);
    expect(rules).toContain('Rule X.');
    expect(rules).toContain('Rule Y.');
  });
});
