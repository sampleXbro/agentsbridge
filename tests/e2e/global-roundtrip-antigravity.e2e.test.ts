import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import {
  fileExists,
  fileContains,
  readText,
  validJson,
  dirFilesExactly,
} from './helpers/assertions.js';
import { markdownFrontmatter, markdownHasNoFrontmatter } from './helpers/file-shape.js';
import { useGlobalEnv } from './helpers/global-roundtrip-setup.js';

/**
 * Global Antigravity layout (descriptor.globalSupport + constants):
 * - Rules: single ~/.gemini/antigravity/GEMINI.md (named canonical rules are merged on generate)
 * - Commands: ~/.gemini/antigravity/workflows/*.md
 * - Skills: ~/.gemini/antigravity/skills/<name>/SKILL.md
 * - MCP: ~/.gemini/antigravity/mcp_config.json
 */
describe('global mode round-trip: Antigravity', () => {
  const env = useGlobalEnv();

  it('canonical → generate --global → import --global → restores commands, skills, MCP, root rule', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'commands'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'ag-skill'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'ag-skill', 'references'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nAntigravity root body\n',
    );
    writeFileSync(
      join(canonicalDir, 'rules', 'quality.md'),
      '---\ndescription: Quality\n---\n# Quality\nUse AG checks\n',
    );
    writeFileSync(
      join(canonicalDir, 'commands', 'ship.md'),
      '---\ndescription: Ship\n---\n# Ship\nShip the release\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'ag-skill', 'SKILL.md'),
      '---\ndescription: AG skill\n---\n# AG Skill\nSkill content\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'ag-skill', 'references', 'notes.md'),
      '# Notes\nUse Antigravity.\n',
    );
    writeFileSync(
      join(canonicalDir, 'mcp.json'),
      JSON.stringify({ mcpServers: { demo: { command: 'node', args: ['--version'] } } }, null, 2),
    );
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [antigravity]\nfeatures: [rules, commands, skills, mcp]\n',
    );

    const gen = await runCli('generate --global --targets antigravity', projectDir);
    expect(gen.exitCode).toBe(0);

    fileExists(join(homeDir, '.gemini', 'antigravity', 'GEMINI.md'));
    fileContains(join(homeDir, '.gemini', 'antigravity', 'GEMINI.md'), 'Antigravity root body');
    fileContains(join(homeDir, '.gemini', 'antigravity', 'GEMINI.md'), 'Use AG checks');
    markdownHasNoFrontmatter(join(homeDir, '.gemini', 'antigravity', 'GEMINI.md'));

    fileExists(join(homeDir, '.gemini', 'antigravity', 'workflows', 'ship.md'));
    fileContains(
      join(homeDir, '.gemini', 'antigravity', 'workflows', 'ship.md'),
      'Ship the release',
    );
    markdownHasNoFrontmatter(join(homeDir, '.gemini', 'antigravity', 'workflows', 'ship.md'));

    fileExists(join(homeDir, '.gemini', 'antigravity', 'skills', 'ag-skill', 'SKILL.md'));
    fileContains(
      join(homeDir, '.gemini', 'antigravity', 'skills', 'ag-skill', 'SKILL.md'),
      'Skill content',
    );
    expect(
      markdownFrontmatter(join(homeDir, '.gemini', 'antigravity', 'skills', 'ag-skill', 'SKILL.md'))
        .name,
    ).toBe('ag-skill');
    fileExists(
      join(homeDir, '.gemini', 'antigravity', 'skills', 'ag-skill', 'references', 'notes.md'),
    );

    fileExists(join(homeDir, '.gemini', 'antigravity', 'mcp_config.json'));
    validJson(join(homeDir, '.gemini', 'antigravity', 'mcp_config.json'));
    expect(
      JSON.parse(readText(join(homeDir, '.gemini', 'antigravity', 'mcp_config.json'))).mcpServers,
    ).toHaveProperty('demo');
    dirFilesExactly(join(homeDir, '.gemini', 'antigravity'), [
      'GEMINI.md',
      'mcp_config.json',
      'skills/ag-skill/SKILL.md',
      'skills/ag-skill/references/notes.md',
      'workflows/ship.md',
    ]);

    rmSync(canonicalDir, { recursive: true, force: true });
    mkdirSync(canonicalDir, { recursive: true });

    const imp = await runCli('import --global --from antigravity', projectDir);
    expect(imp.exitCode).toBe(0);

    fileExists(join(canonicalDir, 'rules', '_root.md'));
    fileContains(join(canonicalDir, 'rules', '_root.md'), 'Antigravity root body');
    fileExists(join(canonicalDir, 'commands', 'ship.md'));
    fileContains(join(canonicalDir, 'commands', 'ship.md'), 'Ship the release');
    fileExists(join(canonicalDir, 'skills', 'ag-skill', 'SKILL.md'));
    fileContains(join(canonicalDir, 'skills', 'ag-skill', 'SKILL.md'), 'Skill content');
    fileExists(join(canonicalDir, 'skills', 'ag-skill', 'references', 'notes.md'));
    fileExists(join(canonicalDir, 'mcp.json'));
    validJson(join(canonicalDir, 'mcp.json'));
  });
});
