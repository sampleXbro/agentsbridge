import { describe, it, expect, afterEach, vi } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGenerate } from '../../../../src/cli/commands/generate.js';
import { importFromKimiCode } from '../../../../src/targets/kimi-code/importer.js';
import { listFilesRecursive } from '../../../contract/matrix-helpers.js';

const ALL_FEATURES = 'features: [rules, commands, agents, skills, mcp, hooks, ignore, permissions]';
const CONFIG = `version: 1\ntargets: [kimi-code]\n${ALL_FEATURES}\n`;

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

function copyCanonical(into: string): void {
  cpSync(
    join(process.cwd(), 'tests', 'e2e', 'fixtures', 'canonical-full', '.agentsmesh'),
    join(into, '.agentsmesh'),
    { recursive: true },
  );
}

function canonicalPaths(root: string): string[] {
  return listFilesRecursive(join(root, '.agentsmesh'))
    .filter((file) => file !== 'agentsmesh.yaml')
    .map((file) => `.agentsmesh/${file}`)
    .sort();
}

describe('kimi-code round-trip (project scope)', () => {
  it('generate -> import -> generate is stable and loses no canonical entity', async () => {
    const root = tempDir('kimi-rt-');
    copyCanonical(root);
    writeFileSync(join(root, 'agentsmesh.yaml'), CONFIG);
    expect((await runGenerate({}, root, { printMatrix: false })).exitCode).toBe(0);

    rmSync(join(root, '.agentsmesh'), { recursive: true, force: true });
    await importFromKimiCode(root, { scope: 'project' });

    expect(canonicalPaths(root)).toEqual([
      '.agentsmesh/agents/code-reviewer.md',
      '.agentsmesh/agents/researcher.md',
      '.agentsmesh/commands/review.md',
      '.agentsmesh/mcp.json',
      '.agentsmesh/rules/_root.md',
      '.agentsmesh/rules/typescript.md',
      '.agentsmesh/skills/api-generator/SKILL.md',
      '.agentsmesh/skills/api-generator/references/route-checklist.md',
      '.agentsmesh/skills/api-generator/template.ts',
    ]);

    expect((await runGenerate({}, root, { printMatrix: false })).exitCode).toBe(0);
    expect(
      (await runGenerate({ check: true }, root, { printMatrix: false })).exitCode,
      'second generate changed the output',
    ).toBe(0);
  });

  it('keeps an SSE server SSE across generate -> import -> generate', async () => {
    const root = tempDir('kimi-sse-');
    copyCanonical(root);
    writeFileSync(join(root, 'agentsmesh.yaml'), CONFIG);
    writeFileSync(
      join(root, '.agentsmesh/mcp.json'),
      '{"mcpServers":{"events":{"type":"sse","url":"https://events.example.com/sse"}}}',
    );

    await runGenerate({}, root, { printMatrix: false });
    expect(JSON.parse(readFileSync(join(root, '.kimi-code/mcp.json'), 'utf-8'))).toEqual({
      mcpServers: {
        events: {
          transport: 'sse',
          type: 'sse',
          url: 'https://events.example.com/sse',
          headers: {},
          env: {},
        },
      },
    });

    rmSync(join(root, '.agentsmesh/mcp.json'));
    await importFromKimiCode(root, { scope: 'project' });
    expect(
      JSON.parse(readFileSync(join(root, '.agentsmesh/mcp.json'), 'utf-8')).mcpServers.events.type,
    ).toBe('sse');
  });

  it('revoking a canonical rule clears it from the generated instruction file', async () => {
    const root = tempDir('kimi-revoke-');
    copyCanonical(root);
    writeFileSync(join(root, 'agentsmesh.yaml'), CONFIG);
    await runGenerate({}, root, { printMatrix: false });
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf-8')).toContain('rules/typescript.md');

    rmSync(join(root, '.agentsmesh/rules/typescript.md'));
    await runGenerate({}, root, { printMatrix: false });
    const regenerated = readFileSync(join(root, 'AGENTS.md'), 'utf-8');
    expect(regenerated).not.toContain('rules/typescript.md');
    expect(regenerated).not.toContain('agentsmesh:embedded-rules:start');
  });
});

describe('kimi-code round-trip (global scope)', () => {
  it('generate --global -> import --global -> generate --global is stable', async () => {
    const homeDir = tempDir('kimi-rt-home-');
    const projectDir = tempDir('kimi-rt-cwd-');
    mkdirSync(join(homeDir, '.agentsmesh'), { recursive: true });
    copyCanonical(homeDir);
    writeFileSync(join(homeDir, '.agentsmesh', 'agentsmesh.yaml'), CONFIG);
    vi.stubEnv('HOME', homeDir);
    vi.stubEnv('USERPROFILE', homeDir);

    expect((await runGenerate({ global: true }, projectDir, { printMatrix: false })).exitCode).toBe(
      0,
    );
    rmSync(join(homeDir, '.agentsmesh'), { recursive: true, force: true });
    await importFromKimiCode(homeDir, { scope: 'global' });

    expect(canonicalPaths(homeDir)).toEqual([
      '.agentsmesh/agents/code-reviewer.md',
      '.agentsmesh/agents/researcher.md',
      '.agentsmesh/commands/review.md',
      '.agentsmesh/hooks.yaml',
      '.agentsmesh/mcp.json',
      '.agentsmesh/permissions.yaml',
      '.agentsmesh/rules/_root.md',
      '.agentsmesh/rules/typescript.md',
      '.agentsmesh/skills/api-generator/SKILL.md',
      '.agentsmesh/skills/api-generator/references/route-checklist.md',
      '.agentsmesh/skills/api-generator/template.ts',
    ]);

    writeFileSync(join(homeDir, '.agentsmesh', 'agentsmesh.yaml'), CONFIG);
    expect((await runGenerate({ global: true }, projectDir, { printMatrix: false })).exitCode).toBe(
      0,
    );
    expect(
      (await runGenerate({ global: true, check: true }, projectDir, { printMatrix: false }))
        .exitCode,
      'second global generate changed the output',
    ).toBe(0);
  });

  it('revoking canonical permissions clears the rules from config.toml', async () => {
    const homeDir = tempDir('kimi-revoke-home-');
    const projectDir = tempDir('kimi-revoke-cwd-');
    mkdirSync(join(homeDir, '.agentsmesh'), { recursive: true });
    copyCanonical(homeDir);
    writeFileSync(join(homeDir, '.agentsmesh', 'agentsmesh.yaml'), CONFIG);
    vi.stubEnv('HOME', homeDir);
    vi.stubEnv('USERPROFILE', homeDir);

    await runGenerate({ global: true }, projectDir, { printMatrix: false });
    expect(readFileSync(join(homeDir, '.kimi-code/config.toml'), 'utf-8')).toContain('permission');

    writeFileSync(join(homeDir, '.agentsmesh', 'permissions.yaml'), 'allow: []\ndeny: []\n');
    writeFileSync(join(homeDir, '.agentsmesh', 'hooks.yaml'), '{}\n');
    await runGenerate({ global: true }, projectDir, { printMatrix: false });

    const config = readFileSync(join(homeDir, '.kimi-code/config.toml'), 'utf-8');
    expect(config).not.toContain('permission');
    expect(config).not.toContain('hooks');
  });
});
