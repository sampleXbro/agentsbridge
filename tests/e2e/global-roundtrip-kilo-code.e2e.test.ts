/**
 * Global mode round-trip e2e for Kilo Code.
 *
 * Verifies that canonical → `agentsmesh generate --global --targets kilo-code`
 * writes the documented unified `~/.config/kilo/...` layout (root rule,
 * commands, and agents as plain files; additional rules and MCP servers
 * folded into the shared `~/.config/kilo/kilo.jsonc`), mirrors skills into
 * `~/.agents/skills/`, suppresses global ignore output entirely (no
 * documented global `.kilocodeignore` equivalent), and the inverse import
 * recovers canonical content.
 */

import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import {
  fileExists,
  fileNotExists,
  fileContains,
  readText,
  validJson,
  dirFilesExactly,
} from './helpers/assertions.js';
import { markdownFrontmatter } from './helpers/file-shape.js';
import { useGlobalEnv } from './helpers/global-roundtrip-setup.js';

describe('global mode round-trip: Kilo Code', () => {
  const env = useGlobalEnv();

  it('canonical → generate --global → import --global → matches canonical', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'commands'), { recursive: true });
    mkdirSync(join(canonicalDir, 'agents'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'kilo-skill', 'references'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      [
        '---',
        'description: Root',
        '---',
        '# Root',
        'Kilo instructions',
        'Use `.agentsmesh/commands/build.md` with `.agentsmesh/agents/reviewer.md`.',
        'Load `.agentsmesh/skills/kilo-skill/SKILL.md` when needed.',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(canonicalDir, 'rules', 'testing.md'),
      '---\ndescription: Testing\nglobs: ["**/*.test.ts"]\n---\n# Test\nWrite tests\n',
    );
    writeFileSync(
      join(canonicalDir, 'commands', 'build.md'),
      '---\ndescription: Build\n---\n# Build\nBuild the project\n',
    );
    writeFileSync(
      join(canonicalDir, 'agents', 'reviewer.md'),
      '---\ndescription: Reviewer\n---\n# Reviewer\nReview code carefully\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'kilo-skill', 'SKILL.md'),
      '---\ndescription: Kilo skill\n---\n# Kilo\nSkill body\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'kilo-skill', 'references', 'runbook.md'),
      '# Runbook\nBuild cleanly.\n',
    );
    writeFileSync(
      join(canonicalDir, 'mcp.json'),
      '{"mcpServers":{"test":{"command":"node","args":[]}}}',
    );
    writeFileSync(join(canonicalDir, 'ignore'), 'dist\n');
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [kilo-code]\nfeatures: [rules, commands, agents, skills, mcp, ignore, permissions]\n',
    );

    const gen = await runCli('generate --global --targets kilo-code', projectDir);
    expect(gen.exitCode).toBe(0);

    // 1. Root → ~/.config/kilo/AGENTS.md (rewritten from project-mode AGENTS.md).
    fileExists(join(homeDir, '.config', 'kilo', 'AGENTS.md'));
    fileContains(join(homeDir, '.config', 'kilo', 'AGENTS.md'), 'Kilo instructions');
    fileContains(join(homeDir, '.config', 'kilo', 'AGENTS.md'), '.config/kilo/commands/build.md');
    fileContains(join(homeDir, '.config', 'kilo', 'AGENTS.md'), '.config/kilo/agents/reviewer.md');
    fileContains(join(homeDir, '.config', 'kilo', 'AGENTS.md'), '.kilo/skills/kilo-skill/SKILL.md');

    // 2. Named rules under ~/.config/kilo/rules/.
    fileExists(join(homeDir, '.config', 'kilo', 'rules', 'testing.md'));
    fileContains(join(homeDir, '.config', 'kilo', 'rules', 'testing.md'), 'Write tests');

    // 3. Commands under ~/.config/kilo/commands/.
    fileExists(join(homeDir, '.config', 'kilo', 'commands', 'build.md'));
    fileContains(join(homeDir, '.config', 'kilo', 'commands', 'build.md'), 'Build the project');
    expect(
      markdownFrontmatter(join(homeDir, '.config', 'kilo', 'commands', 'build.md')).description,
    ).toBe('Build');

    // 4. Native first-class agents at ~/.config/kilo/agents/<slug>.md with mode: subagent.
    fileExists(join(homeDir, '.config', 'kilo', 'agents', 'reviewer.md'));
    fileContains(join(homeDir, '.config', 'kilo', 'agents', 'reviewer.md'), 'Review code carefully');
    expect(
      markdownFrontmatter(join(homeDir, '.config', 'kilo', 'agents', 'reviewer.md')),
    ).toMatchObject({
      mode: 'subagent',
      description: 'Reviewer',
    });

    // 5. Skills stay at ~/.kilo/skills/<slug>/SKILL.md (documented separately).
    fileExists(join(homeDir, '.kilo', 'skills', 'kilo-skill', 'SKILL.md'));
    fileContains(join(homeDir, '.kilo', 'skills', 'kilo-skill', 'SKILL.md'), 'Skill body');
    fileExists(join(homeDir, '.kilo', 'skills', 'kilo-skill', 'references', 'runbook.md'));

    // 6. Skills mirror at ~/.agents/skills/ (cross-tool compat).
    fileExists(join(homeDir, '.agents', 'skills', 'kilo-skill', 'SKILL.md'));
    fileContains(join(homeDir, '.agents', 'skills', 'kilo-skill', 'SKILL.md'), 'Skill body');
    fileExists(join(homeDir, '.agents', 'skills', 'kilo-skill', 'references', 'runbook.md'));

    // 7. No standalone mcp.json — MCP folds into kilo.jsonc's `mcp` key.
    fileNotExists(join(homeDir, '.kilo', 'mcp.json'));
    fileNotExists(join(homeDir, '.config', 'kilo', 'mcp.json'));

    // 8. No global ignore file at all (downgraded to 'none' — no documented mechanism).
    fileNotExists(join(homeDir, '.kilocodeignore'));

    // 9. Shared ~/.config/kilo/kilo.jsonc carries instructions + mcp + permission keys.
    const configPath = join(homeDir, '.config', 'kilo', 'kilo.jsonc');
    fileExists(configPath);
    validJson(configPath);
    const config = JSON.parse(readText(configPath));
    expect(config.instructions).toEqual(['rules/*.md']);
    expect(config.mcp.test).toEqual({ type: 'local', command: ['node'] });

    dirFilesExactly(join(homeDir, '.kilo'), [
      'skills/kilo-skill/SKILL.md',
      'skills/kilo-skill/references/runbook.md',
    ]);
    dirFilesExactly(join(homeDir, '.config', 'kilo'), [
      'AGENTS.md',
      'agents/reviewer.md',
      'commands/build.md',
      'kilo.jsonc',
      'rules/testing.md',
    ]);
    dirFilesExactly(join(homeDir, '.agents'), [
      'skills/kilo-skill/SKILL.md',
      'skills/kilo-skill/references/runbook.md',
    ]);

    // Round-trip: nuke canonical and import back from the global layout.
    rmSync(canonicalDir, { recursive: true, force: true });
    mkdirSync(canonicalDir, { recursive: true });

    const imp = await runCli('import --global --from kilo-code', projectDir);
    expect(imp.exitCode).toBe(0);

    fileExists(join(canonicalDir, 'rules', '_root.md'));
    fileContains(join(canonicalDir, 'rules', '_root.md'), 'Kilo instructions');
    fileContains(join(canonicalDir, 'rules', '_root.md'), '.agentsmesh/commands/build.md');
    fileContains(join(canonicalDir, 'rules', '_root.md'), '.agentsmesh/agents/reviewer.md');
    fileContains(join(canonicalDir, 'rules', '_root.md'), '.agentsmesh/skills/kilo-skill/SKILL.md');
    fileExists(join(canonicalDir, 'rules', 'testing.md'));
    fileContains(join(canonicalDir, 'rules', 'testing.md'), 'Write tests');
    fileExists(join(canonicalDir, 'commands', 'build.md'));
    fileContains(join(canonicalDir, 'commands', 'build.md'), 'Build the project');
    fileExists(join(canonicalDir, 'agents', 'reviewer.md'));
    fileContains(join(canonicalDir, 'agents', 'reviewer.md'), 'Review code carefully');
    fileContains(join(canonicalDir, 'agents', 'reviewer.md'), 'description: Reviewer');
    fileExists(join(canonicalDir, 'skills', 'kilo-skill', 'SKILL.md'));
    fileExists(join(canonicalDir, 'skills', 'kilo-skill', 'references', 'runbook.md'));
    fileExists(join(canonicalDir, 'mcp.json'));
    const importedMcp = JSON.parse(readText(join(canonicalDir, 'mcp.json')));
    expect(importedMcp.mcpServers.test).toBeDefined();

    // No global ignore concept — nothing to import back.
    fileNotExists(join(canonicalDir, 'ignore'));
  });
});
