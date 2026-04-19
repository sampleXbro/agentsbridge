import { describe, it, expect } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import {
  dirFilesExactly,
  fileContains,
  fileExists,
  readText,
  validJson,
} from './helpers/assertions.js';
import {
  markdownFrontmatter,
  markdownHasNoFrontmatter,
  readToml,
  validToml,
} from './helpers/file-shape.js';
import { useGlobalEnv } from './helpers/global-roundtrip-setup.js';

describe('global mode round-trip: Gemini CLI', () => {
  const env = useGlobalEnv();

  it('canonical → generate --global → import --global → matches canonical', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'commands'), { recursive: true });
    mkdirSync(join(canonicalDir, 'agents'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'gemini-skill', 'references'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nGemini guidelines\n',
    );
    writeFileSync(
      join(canonicalDir, 'commands', 'test.md'),
      '---\ndescription: Test\n---\n# Test\nRun tests\n',
    );
    writeFileSync(
      join(canonicalDir, 'agents', 'scout.md'),
      '---\ndescription: Scout\n---\n# Scout\nExplore the codebase\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'gemini-skill', 'SKILL.md'),
      '---\ndescription: Gemini skill\n---\n# Gemini Skill\nHelps with Gemini\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'gemini-skill', 'references', 'brief.md'),
      '# Brief\nExplore first.\n',
    );
    writeFileSync(
      join(canonicalDir, 'mcp.json'),
      '{"mcpServers":{"test":{"command":"node","args":[]}}}',
    );
    writeFileSync(
      join(canonicalDir, 'hooks.yaml'),
      'PreToolUse:\n  - matcher: ".*"\n    type: command\n    command: echo test\n',
    );
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [gemini-cli]\nfeatures: [rules, commands, agents, skills, mcp, hooks]\n',
    );

    const gen = await runCli('generate --global --targets gemini-cli', projectDir);
    expect(gen.exitCode).toBe(0);

    fileContains(join(homeDir, '.gemini', 'GEMINI.md'), 'Gemini guidelines');
    markdownHasNoFrontmatter(join(homeDir, '.gemini', 'GEMINI.md'));
    validJson(join(homeDir, '.gemini', 'settings.json'));
    const settings = JSON.parse(readText(join(homeDir, '.gemini', 'settings.json')));
    expect(settings.mcpServers?.test).toBeDefined();
    expect(settings.hooks).toBeDefined();
    validToml(join(homeDir, '.gemini', 'commands', 'test.toml'));
    expect(readToml(join(homeDir, '.gemini', 'commands', 'test.toml')).description).toBe('Test');
    expect(markdownFrontmatter(join(homeDir, '.gemini', 'agents', 'scout.md')).name).toBe('scout');
    expect(
      markdownFrontmatter(join(homeDir, '.gemini', 'skills', 'gemini-skill', 'SKILL.md')).name,
    ).toBe('gemini-skill');
    fileExists(join(homeDir, '.gemini', 'skills', 'gemini-skill', 'references', 'brief.md'));
    fileContains(
      join(homeDir, '.agents', 'skills', 'gemini-skill', 'SKILL.md'),
      'Helps with Gemini',
    );
    fileExists(join(homeDir, '.agents', 'skills', 'gemini-skill', 'references', 'brief.md'));
    fileContains(join(homeDir, '.gemini', 'AGENTS.md'), 'Gemini guidelines');
    markdownHasNoFrontmatter(join(homeDir, '.gemini', 'AGENTS.md'));
    dirFilesExactly(join(homeDir, '.gemini'), [
      'AGENTS.md',
      'GEMINI.md',
      'agents/scout.md',
      'commands/test.toml',
      'settings.json',
      'skills/gemini-skill/SKILL.md',
      'skills/gemini-skill/references/brief.md',
    ]);
    dirFilesExactly(join(homeDir, '.agents'), [
      'skills/gemini-skill/SKILL.md',
      'skills/gemini-skill/references/brief.md',
    ]);

    rmSync(canonicalDir, { recursive: true, force: true });
    mkdirSync(canonicalDir, { recursive: true });

    const imp = await runCli('import --global --from gemini-cli', projectDir);
    expect(imp.exitCode).toBe(0);

    fileContains(join(canonicalDir, 'rules', '_root.md'), 'Gemini guidelines');
    fileContains(join(canonicalDir, 'commands', 'test.md'), 'Run tests');
    fileExists(join(canonicalDir, 'skills', 'gemini-skill', 'SKILL.md'));
    fileExists(join(canonicalDir, 'skills', 'gemini-skill', 'references', 'brief.md'));
    fileContains(join(canonicalDir, 'agents', 'scout.md'), 'Explore the codebase');
    fileExists(join(canonicalDir, 'mcp.json'));
    fileExists(join(canonicalDir, 'hooks.yaml'));
  });
});
