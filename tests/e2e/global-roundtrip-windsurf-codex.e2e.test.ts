import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import {
  fileExists,
  fileContains,
  readText,
  validJson,
  fileNotExists,
  dirFilesExactly,
} from './helpers/assertions.js';
import { markdownFrontmatter, markdownHasNoFrontmatter } from './helpers/file-shape.js';
import { useGlobalEnv } from './helpers/global-roundtrip-setup.js';

describe('global mode round-trip: Windsurf', () => {
  const env = useGlobalEnv();

  it('canonical → generate --global → import --global → matches canonical', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'commands'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'windsurf-skill'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'windsurf-skill', 'references'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nWindsurf guidelines\n',
    );
    writeFileSync(
      join(canonicalDir, 'commands', 'build.md'),
      '---\ndescription: Build\n---\n# Build\nBuild the project\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'windsurf-skill', 'SKILL.md'),
      '---\ndescription: Windsurf skill\n---\n# Windsurf Skill\nHelps with Windsurf\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'windsurf-skill', 'references', 'guide.md'),
      '# Guide\nUse workflows.\n',
    );
    writeFileSync(
      join(canonicalDir, 'mcp.json'),
      '{"mcpServers":{"test":{"command":"node","args":[]}}}',
    );
    writeFileSync(
      join(canonicalDir, 'hooks.yaml'),
      'PreToolUse:\n  - matcher: ".*"\n    type: command\n    command: echo test\n',
    );
    writeFileSync(join(canonicalDir, 'ignore'), 'node_modules\n');
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [windsurf]\nfeatures: [rules, commands, skills, mcp, hooks, ignore]\n',
    );

    const gen = await runCli('generate --global --targets windsurf', projectDir);
    expect(gen.exitCode).toBe(0);

    // 1. Global rules (docs: ~/.codeium/windsurf/memories/global_rules.md)
    fileExists(join(homeDir, '.codeium', 'windsurf', 'memories', 'global_rules.md'));
    fileContains(
      join(homeDir, '.codeium', 'windsurf', 'memories', 'global_rules.md'),
      'Windsurf guidelines',
    );
    markdownHasNoFrontmatter(join(homeDir, '.codeium', 'windsurf', 'memories', 'global_rules.md'));

    // 2. Skills primary (docs: ~/.codeium/windsurf/skills/<skill>/SKILL.md)
    fileExists(join(homeDir, '.codeium', 'windsurf', 'skills', 'windsurf-skill', 'SKILL.md'));
    fileContains(
      join(homeDir, '.codeium', 'windsurf', 'skills', 'windsurf-skill', 'SKILL.md'),
      'Helps with Windsurf',
    );
    expect(
      markdownFrontmatter(
        join(homeDir, '.codeium', 'windsurf', 'skills', 'windsurf-skill', 'SKILL.md'),
      ).name,
    ).toBe('windsurf-skill');
    fileExists(
      join(homeDir, '.codeium', 'windsurf', 'skills', 'windsurf-skill', 'references', 'guide.md'),
    );

    // 3. Skills mirror (docs: ~/.agents/skills/)
    fileExists(join(homeDir, '.agents', 'skills', 'windsurf-skill', 'SKILL.md'));
    fileContains(
      join(homeDir, '.agents', 'skills', 'windsurf-skill', 'SKILL.md'),
      'Helps with Windsurf',
    );
    fileExists(join(homeDir, '.agents', 'skills', 'windsurf-skill', 'references', 'guide.md'));

    // 4. Workflows (docs: ~/.codeium/windsurf/global_workflows/*.md)
    fileExists(join(homeDir, '.codeium', 'windsurf', 'global_workflows', 'build.md'));
    fileContains(
      join(homeDir, '.codeium', 'windsurf', 'global_workflows', 'build.md'),
      'Build the project',
    );
    expect(
      markdownFrontmatter(join(homeDir, '.codeium', 'windsurf', 'global_workflows', 'build.md'))
        .description,
    ).toBe('Build');

    // 5. Hooks (docs: ~/.codeium/windsurf/hooks.json)
    fileExists(join(homeDir, '.codeium', 'windsurf', 'hooks.json'));
    validJson(join(homeDir, '.codeium', 'windsurf', 'hooks.json'));

    // 6. MCP (docs: ~/.codeium/windsurf/mcp_config.json)
    fileExists(join(homeDir, '.codeium', 'windsurf', 'mcp_config.json'));
    validJson(join(homeDir, '.codeium', 'windsurf', 'mcp_config.json'));
    const mcp = JSON.parse(readText(join(homeDir, '.codeium', 'windsurf', 'mcp_config.json')));
    expect(mcp.mcpServers.test).toBeDefined();

    // 7. Ignore (docs: ~/.codeium/.codeiumignore)
    fileExists(join(homeDir, '.codeium', '.codeiumignore'));
    fileContains(join(homeDir, '.codeium', '.codeiumignore'), 'node_modules');
    fileNotExists(join(homeDir, '.codeium', 'windsurf', 'AGENTS.md'));
    dirFilesExactly(join(homeDir, '.codeium'), [
      '.codeiumignore',
      'windsurf/global_workflows/build.md',
      'windsurf/hooks.json',
      'windsurf/mcp_config.json',
      'windsurf/memories/global_rules.md',
      'windsurf/skills/windsurf-skill/SKILL.md',
      'windsurf/skills/windsurf-skill/references/guide.md',
    ]);
    dirFilesExactly(join(homeDir, '.agents'), [
      'skills/windsurf-skill/SKILL.md',
      'skills/windsurf-skill/references/guide.md',
    ]);

    // Windsurf importer reads project-level paths — bridge generated global files for import
    writeFileSync(
      join(homeDir, '.windsurfrules'),
      readText(join(homeDir, '.codeium', 'windsurf', 'memories', 'global_rules.md')),
    );
    mkdirSync(join(homeDir, '.windsurf', 'skills', 'windsurf-skill', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(homeDir, '.windsurf', 'skills', 'windsurf-skill', 'SKILL.md'),
      readText(join(homeDir, '.codeium', 'windsurf', 'skills', 'windsurf-skill', 'SKILL.md')),
    );
    writeFileSync(
      join(homeDir, '.windsurf', 'skills', 'windsurf-skill', 'references', 'guide.md'),
      readText(
        join(homeDir, '.codeium', 'windsurf', 'skills', 'windsurf-skill', 'references', 'guide.md'),
      ),
    );
    writeFileSync(
      join(homeDir, '.windsurfignore'),
      readText(join(homeDir, '.codeium', '.codeiumignore')),
    );
    writeFileSync(
      join(homeDir, '.windsurf', 'hooks.json'),
      readText(join(homeDir, '.codeium', 'windsurf', 'hooks.json')),
    );
    mkdirSync(join(homeDir, '.windsurf', 'workflows'), { recursive: true });
    writeFileSync(
      join(homeDir, '.windsurf', 'workflows', 'build.md'),
      readText(join(homeDir, '.codeium', 'windsurf', 'global_workflows', 'build.md')),
    );
    writeFileSync(
      join(homeDir, '.windsurf', 'mcp_config.json'),
      readText(join(homeDir, '.codeium', 'windsurf', 'mcp_config.json')),
    );

    rmSync(canonicalDir, { recursive: true, force: true });
    mkdirSync(canonicalDir, { recursive: true });

    const imp = await runCli('import --global --from windsurf', projectDir);
    expect(imp.exitCode).toBe(0);

    fileExists(join(canonicalDir, 'rules', '_root.md'));
    fileContains(join(canonicalDir, 'rules', '_root.md'), 'Windsurf guidelines');
    fileExists(join(canonicalDir, 'commands', 'build.md'));
    fileContains(join(canonicalDir, 'commands', 'build.md'), 'Build the project');
    fileExists(join(canonicalDir, 'skills', 'windsurf-skill', 'SKILL.md'));
    fileExists(join(canonicalDir, 'skills', 'windsurf-skill', 'references', 'guide.md'));
    fileExists(join(canonicalDir, 'hooks.yaml'));
    fileExists(join(canonicalDir, 'ignore'));
    fileExists(join(canonicalDir, 'mcp.json'));
    const importedMcp = JSON.parse(readText(join(canonicalDir, 'mcp.json')));
    expect(importedMcp.mcpServers.test).toBeDefined();
  });
});
