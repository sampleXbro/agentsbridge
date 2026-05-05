import { describe, it, expect, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { fileExists, fileContains, readText } from './helpers/assertions.js';
import { useGlobalEnv } from './helpers/global-roundtrip-setup.js';

describe('global mode: reference rewriting', () => {
  const env = useGlobalEnv();

  it('canonical links are rewritten to global paths and back', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'ref-skill', 'references'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nSee [skill](.agentsmesh/skills/ref-skill/SKILL.md)\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'ref-skill', 'SKILL.md'),
      '---\ndescription: Skill\n---\n# Skill\nSee [ref](.agentsmesh/skills/ref-skill/references/guide.md)\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'ref-skill', 'references', 'guide.md'),
      '# Guide\nReference guide\n',
    );
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\n',
    );

    const gen = await runCli('generate --global --targets claude-code', projectDir);
    expect(gen.exitCode).toBe(0);

    // Markdown destinations must be rewritten to global generated paths.
    const rootContent = readText(join(homeDir, '.claude', 'CLAUDE.md'));
    expect(rootContent).toContain('[skill](./skills/ref-skill/SKILL.md)');
    expect(rootContent).not.toContain('.agentsmesh/');

    const skillContent = readText(join(homeDir, '.claude', 'skills', 'ref-skill', 'SKILL.md'));
    expect(skillContent).toContain('[ref](./references/guide.md)');
    expect(skillContent).not.toContain('.agentsmesh/');

    rmSync(canonicalDir, { recursive: true, force: true });
    mkdirSync(canonicalDir, { recursive: true });

    const imp = await runCli('import --global --from claude-code', projectDir);
    expect(imp.exitCode).toBe(0);

    // After import, paths are normalized back to exact canonical-relative destinations.
    const reimportedRoot = readText(join(canonicalDir, 'rules', '_root.md'));
    expect(reimportedRoot).toContain('[skill](../skills/ref-skill/SKILL.md)');
    expect(reimportedRoot).not.toContain('[skill](./skills/ref-skill/SKILL.md)');

    const reimportedSkill = readText(join(canonicalDir, 'skills', 'ref-skill', 'SKILL.md'));
    expect(reimportedSkill).toContain('[ref](./references/guide.md)');
  });
});

describe('global mode: error handling', () => {
  const env = useGlobalEnv();

  it('import --global fails gracefully when no global config exists', async () => {
    const { canonicalDir, projectDir } = env;
    mkdirSync(canonicalDir, { recursive: true });
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );

    const imp = await runCli('import --global --from claude-code', projectDir);
    expect(imp.exitCode).toBe(0);
    expect(imp.stdout + imp.stderr).toMatch(/Nothing to import from/i);
  });

  it('generate --global fails when HOME is not set', async () => {
    const { projectDir } = env;
    vi.unstubAllEnvs();
    vi.stubEnv('HOME', '');
    vi.stubEnv('USERPROFILE', '');

    const canonicalDir = join(projectDir, '.agentsmesh');
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '---\ndescription: Root\n---\n# Root\n');
    writeFileSync(
      join(projectDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );

    const gen = await runCli('generate --global', projectDir);
    expect(gen.exitCode).not.toBe(0);
    expect(gen.stderr).toMatch(/HOME|home|directory|not found/i);
  });
});

describe('global mode: edge cases', () => {
  const env = useGlobalEnv();

  it('handles empty canonical directory gracefully', async () => {
    const { canonicalDir, projectDir } = env;
    mkdirSync(canonicalDir, { recursive: true });
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );

    const gen = await runCli('generate --global --targets claude-code', projectDir);
    // Succeeds with no output when there is nothing to generate
    expect(gen.exitCode).toBe(0);
  });

  it('each target generates its own skill dir in global mode', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'shared'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nShared rules\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'shared', 'SKILL.md'),
      '---\ndescription: Shared\n---\n# Shared\nShared skill\n',
    );

    // Generate claude-code only first to avoid cross-target skill conflicts
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\n',
    );
    const genClaude = await runCli('generate --global --targets claude-code', projectDir);
    expect(genClaude.exitCode).toBe(0);

    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [cursor]\nfeatures: [rules, skills]\n',
    );
    const genCursor = await runCli('generate --global --targets cursor', projectDir);
    expect(genCursor.exitCode).toBe(0);

    // Each target has its own skill dir
    fileExists(join(homeDir, '.claude', 'skills', 'shared', 'SKILL.md'));
    fileExists(join(homeDir, '.cursor', 'skills', 'shared', 'SKILL.md'));
  });

  it('regeneration overwrites previous output', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nVersion 1\n',
    );
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );

    await runCli('generate --global --targets claude-code', projectDir);
    fileContains(join(homeDir, '.claude', 'CLAUDE.md'), 'Version 1');

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nVersion 2\n',
    );
    await runCli('generate --global --targets claude-code', projectDir);
    fileContains(join(homeDir, '.claude', 'CLAUDE.md'), 'Version 2');
  });

  it('missing features in canonical generate without error', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nTest\n',
    );
    // Request features that don't exist in canonical
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules, commands, agents, skills, mcp, hooks]\n',
    );

    const gen = await runCli('generate --global --targets claude-code', projectDir);
    expect(gen.exitCode).toBe(0);
    fileExists(join(homeDir, '.claude', 'CLAUDE.md'));
  });
});
