import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { delay, pollForWatch, watchStabilityDelayMs } from '../harness/watch.js';

const TEST_DIR = join(tmpdir(), 'am-e2e-watch-features');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

function regenCount(output: string): number {
  return output.match(/Regenerated\./g)?.length ?? 0;
}

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'commands'), { recursive: true });
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'skills', 'api-generator'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, commands, skills, mcp, hooks, permissions]\n',
  );
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Root\n',
  );
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'),
    '---\ndescription: Review\n---\nInitial review command\n',
  );
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md'),
    '---\ndescription: API generator\n---\n# API Generator\n',
  );
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'mcp.json'),
    JSON.stringify(
      { mcpServers: { context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] } } },
      null,
      2,
    ),
  );
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'hooks.yaml'),
    'PostToolUse:\n  - matcher: Write\n    command: prettier --write "$FILE_PATH"\n',
  );
  writeFileSync(join(TEST_DIR, '.agentsmesh', 'permissions.yaml'), 'allow:\n  - Read\n');
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('watch feature coverage', () => {
  it('reacts once per feature edit across commands, skills, mcp, hooks, and permissions', async () => {
    const child = spawn('node', [CLI_PATH, 'watch'], {
      cwd: TEST_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });

    await pollForWatch(() => {
      expect(regenCount(stdout)).toBe(1);
      expect(readFileSync(join(TEST_DIR, '.claude', 'commands', 'review.md'), 'utf-8')).toContain(
        'Initial review command',
      );
    });

    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'),
      '---\ndescription: Review\n---\nUpdated review command\n',
    );
    await pollForWatch(() => {
      expect(regenCount(stdout)).toBe(2);
      expect(readFileSync(join(TEST_DIR, '.claude', 'commands', 'review.md'), 'utf-8')).toContain(
        'Updated review command',
      );
    });

    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md'),
      '---\ndescription: API generator\n---\n# API Generator\nUpdated skill body\n',
    );
    await pollForWatch(() => {
      expect(regenCount(stdout)).toBe(3);
      expect(
        readFileSync(join(TEST_DIR, '.claude', 'skills', 'api-generator', 'SKILL.md'), 'utf-8'),
      ).toContain('Updated skill body');
    });

    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'),
      '---\ndescription: Review\n---\nSecond command update\n',
    );
    await pollForWatch(() => {
      expect(regenCount(stdout)).toBe(4);
      expect(readFileSync(join(TEST_DIR, '.claude', 'commands', 'review.md'), 'utf-8')).toContain(
        'Second command update',
      );
    });

    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'mcp.json'),
      JSON.stringify(
        { mcpServers: { context7: { command: 'pnpm', args: ['context7'] } } },
        null,
        2,
      ),
    );
    await pollForWatch(() => {
      expect(regenCount(stdout)).toBe(5);
      expect(readFileSync(join(TEST_DIR, '.mcp.json'), 'utf-8')).toContain('"pnpm"');
    });

    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'hooks.yaml'),
      'PostToolUse:\n  - matcher: Write\n    command: eslint --fix "$FILE_PATH"\n',
    );
    await pollForWatch(() => {
      expect(regenCount(stdout)).toBe(6);
      expect(readFileSync(join(TEST_DIR, '.claude', 'settings.json'), 'utf-8')).toContain(
        'eslint --fix',
      );
    });

    await delay(watchStabilityDelayMs());
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'permissions.yaml'),
      'allow:\n  - Read\n  - Grep\n',
    );
    await pollForWatch(() => {
      expect(regenCount(stdout)).toBe(6);
      expect(readFileSync(join(TEST_DIR, '.claude', 'settings.json'), 'utf-8')).toContain('"Grep"');
      expect(stdout).toContain('✓ native');
    });

    child.kill('SIGINT');
    await new Promise((resolve) => child.on('exit', resolve));
  });
});
