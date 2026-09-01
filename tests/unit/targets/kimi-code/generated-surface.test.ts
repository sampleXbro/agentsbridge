import { describe, it, expect, afterEach, vi } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { runGenerate } from '../../../../src/cli/commands/generate.js';
import { listFilesRecursive } from '../../../contract/matrix-helpers.js';
import { KIMI_CODE_GLOBAL_CONFIG_FILE } from '../../../../src/targets/kimi-code/constants.js';

const ALL_FEATURES = 'features: [rules, commands, agents, skills, mcp, hooks, ignore, permissions]';

const created: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  created.push(dir);
  return dir;
}

function seedCanonical(root: string, targets: string): void {
  cpSync(
    join(process.cwd(), 'tests', 'e2e', 'fixtures', 'canonical-full', '.agentsmesh'),
    join(root, '.agentsmesh'),
    { recursive: true },
  );
  writeFileSync(
    join(root, 'agentsmesh.yaml'),
    `version: 1\ntargets: [${targets}]\n${ALL_FEATURES}\n`,
  );
}

function projectFixture(targets: string): string {
  const root = tempDir('kimi-project-');
  seedCanonical(root, targets);
  return root;
}

/** Global mode reads `~/.agentsmesh` and writes under the home directory. */
function globalFixture(targets: string): { homeDir: string; projectDir: string } {
  const homeDir = tempDir('kimi-home-');
  const projectDir = tempDir('kimi-cwd-');
  mkdirSync(join(homeDir, '.agentsmesh'), { recursive: true });
  cpSync(
    join(process.cwd(), 'tests', 'e2e', 'fixtures', 'canonical-full', '.agentsmesh'),
    join(homeDir, '.agentsmesh'),
    { recursive: true },
  );
  writeFileSync(
    join(homeDir, '.agentsmesh', 'agentsmesh.yaml'),
    `version: 1\ntargets: [${targets}]\n${ALL_FEATURES}\n`,
  );
  vi.stubEnv('HOME', homeDir);
  vi.stubEnv('USERPROFILE', homeDir);
  return { homeDir, projectDir };
}

function generated(root: string): string[] {
  return listFilesRecursive(root)
    .filter((file) => file !== 'agentsmesh.yaml')
    .filter((file) => !file.startsWith('.agentsmesh/') && !file.startsWith('.agentsmeshcache'))
    .sort();
}

describe('kimi-code generated surface (project scope)', () => {
  it('writes exactly the declared project artifacts', async () => {
    const root = projectFixture('kimi-code');
    expect((await runGenerate({}, root, { printMatrix: false })).exitCode).toBe(0);
    expect(generated(root)).toEqual([
      '.kimi-code/agents/code-reviewer.md',
      '.kimi-code/agents/researcher.md',
      '.kimi-code/mcp.json',
      '.kimi-code/skills/am-command-review/SKILL.md',
      '.kimi-code/skills/api-generator/SKILL.md',
      '.kimi-code/skills/api-generator/references/route-checklist.md',
      '.kimi-code/skills/api-generator/template.ts',
      'AGENTS.md',
    ]);
  });

  it('writes no config.toml, no .mcp.json and nothing under .agents/', async () => {
    const root = projectFixture('kimi-code');
    await runGenerate({}, root, { printMatrix: false });
    const paths = generated(root);
    expect(paths).not.toContain('.kimi-code/config.toml');
    expect(paths).not.toContain('.mcp.json');
    expect(paths.filter((p) => p.startsWith('.agents/'))).toEqual([]);
  });

  it('shares AGENTS.md byte-for-byte with the targets that already own it', async () => {
    const solo = projectFixture('kimi-code');
    await runGenerate({}, solo, { printMatrix: false });
    const soloContent = readFileSync(join(solo, 'AGENTS.md'), 'utf-8');

    const shared = projectFixture('kimi-code, warp, codex-cli');
    expect((await runGenerate({}, shared, { printMatrix: false })).exitCode).toBe(0);
    expect(readFileSync(join(shared, 'AGENTS.md'), 'utf-8')).toBe(soloContent);
  });
});

describe('kimi-code generated surface (global scope)', () => {
  it('writes exactly the declared global artifacts, config.toml included', async () => {
    const { homeDir, projectDir } = globalFixture('kimi-code');
    expect((await runGenerate({ global: true }, projectDir, { printMatrix: false })).exitCode).toBe(
      0,
    );
    expect(generated(homeDir)).toEqual([
      '.kimi-code/AGENTS.md',
      '.kimi-code/agents/code-reviewer.md',
      '.kimi-code/agents/researcher.md',
      '.kimi-code/config.toml',
      '.kimi-code/mcp.json',
      '.kimi-code/skills/am-command-review/SKILL.md',
      '.kimi-code/skills/api-generator/SKILL.md',
      '.kimi-code/skills/api-generator/references/route-checklist.md',
      '.kimi-code/skills/api-generator/template.ts',
    ]);
    expect(parseToml(readFileSync(join(homeDir, KIMI_CODE_GLOBAL_CONFIG_FILE), 'utf-8'))).toEqual({
      hooks: [
        { event: 'PostToolUse', matcher: 'Write|Edit', command: 'prettier --write $FILE_PATH' },
      ],
      permission: {
        rules: [
          { decision: 'allow', pattern: 'Read' },
          { decision: 'allow', pattern: 'Grep' },
          { decision: 'allow', pattern: 'LS' },
          { decision: 'allow', pattern: 'Bash(npm run test:*)' },
          { decision: 'deny', pattern: 'WebFetch' },
          { decision: 'deny', pattern: 'Bash(curl:*)' },
          { decision: 'deny', pattern: 'Read(./.env)' },
        ],
      },
    });
  });

  it('removes a stale generated skill but never the user config.toml', async () => {
    const { homeDir, projectDir } = globalFixture('kimi-code');
    await runGenerate({ global: true }, projectDir, { printMatrix: false });
    mkdirSync(join(homeDir, '.kimi-code/skills/stale'), { recursive: true });
    writeFileSync(join(homeDir, '.kimi-code/skills/stale/SKILL.md'), '---\nname: stale\n---\n');

    expect((await runGenerate({ global: true }, projectDir, { printMatrix: false })).exitCode).toBe(
      0,
    );
    expect(generated(homeDir)).toContain('.kimi-code/config.toml');
    expect(generated(homeDir)).not.toContain('.kimi-code/skills/stale/SKILL.md');
  });

  it('does not write the cross-tool ~/.agents files that other targets own', async () => {
    const { homeDir, projectDir } = globalFixture('kimi-code');
    await runGenerate({ global: true }, projectDir, { printMatrix: false });
    expect(generated(homeDir).filter((p) => p.startsWith('.agents/'))).toEqual([]);
  });
});
