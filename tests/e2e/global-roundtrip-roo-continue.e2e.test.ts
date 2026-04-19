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

describe('global mode round-trip: Roo Code', () => {
  const env = useGlobalEnv();

  it('canonical → generate --global → import --global → matches canonical', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'commands'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'roo-skill'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'roo-skill', 'references'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nRoo instructions\n',
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
      join(canonicalDir, 'skills', 'roo-skill', 'SKILL.md'),
      '---\ndescription: Roo skill\n---\n# Roo\nSkill body\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'roo-skill', 'references', 'runbook.md'),
      '# Runbook\nBuild cleanly.\n',
    );
    writeFileSync(
      join(canonicalDir, 'mcp.json'),
      '{"mcpServers":{"test":{"command":"node","args":[]}}}',
    );
    writeFileSync(join(canonicalDir, 'ignore'), 'dist\n');
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [roo-code]\nfeatures: [rules, commands, skills, mcp, ignore]\n',
    );

    const gen = await runCli('generate --global --targets roo-code', projectDir);
    expect(gen.exitCode).toBe(0);

    // 1. Root → ~/.roo/AGENTS.md (rewritten from .roo/rules/00-root.md per global layout)
    fileExists(join(homeDir, '.roo', 'AGENTS.md'));
    fileContains(join(homeDir, '.roo', 'AGENTS.md'), 'Roo instructions');
    markdownHasNoFrontmatter(join(homeDir, '.roo', 'AGENTS.md'));

    // 2. Named rules (docs: ~/.roo/rules/*.md)
    fileExists(join(homeDir, '.roo', 'rules', 'testing.md'));
    fileContains(join(homeDir, '.roo', 'rules', 'testing.md'), 'Write tests');
    markdownHasNoFrontmatter(join(homeDir, '.roo', 'rules', 'testing.md'));

    // 3. Commands (docs: ~/.roo/commands/*.md)
    fileExists(join(homeDir, '.roo', 'commands', 'build.md'));
    fileContains(join(homeDir, '.roo', 'commands', 'build.md'), 'Build the project');
    expect(markdownFrontmatter(join(homeDir, '.roo', 'commands', 'build.md')).description).toBe(
      'Build',
    );

    // 4. Skills (docs: ~/.roo/skills/<skill>/SKILL.md)
    fileExists(join(homeDir, '.roo', 'skills', 'roo-skill', 'SKILL.md'));
    fileContains(join(homeDir, '.roo', 'skills', 'roo-skill', 'SKILL.md'), 'Skill body');
    expect(markdownFrontmatter(join(homeDir, '.roo', 'skills', 'roo-skill', 'SKILL.md')).name).toBe(
      'roo-skill',
    );
    fileExists(join(homeDir, '.roo', 'skills', 'roo-skill', 'references', 'runbook.md'));

    // 5. Skills mirror (docs: ~/.agents/skills/ — ROO_CODE_GLOBAL_AGENTS_SKILLS_DIR)
    fileExists(join(homeDir, '.agents', 'skills', 'roo-skill', 'SKILL.md'));
    fileContains(join(homeDir, '.agents', 'skills', 'roo-skill', 'SKILL.md'), 'Skill body');
    fileExists(join(homeDir, '.agents', 'skills', 'roo-skill', 'references', 'runbook.md'));

    // 6. MCP (docs: ~/mcp_settings.json — Roo global MCP path)
    fileExists(join(homeDir, 'mcp_settings.json'));
    validJson(join(homeDir, 'mcp_settings.json'));
    const mcp = JSON.parse(readText(join(homeDir, 'mcp_settings.json')));
    expect(mcp.mcpServers.test).toBeDefined();

    // 7. Ignore (docs: ~/.rooignore)
    fileExists(join(homeDir, '.rooignore'));
    fileContains(join(homeDir, '.rooignore'), 'dist');
    dirFilesExactly(join(homeDir, '.roo'), [
      'AGENTS.md',
      'commands/build.md',
      'rules/testing.md',
      'skills/roo-skill/SKILL.md',
      'skills/roo-skill/references/runbook.md',
    ]);
    dirFilesExactly(join(homeDir, '.agents'), [
      'skills/roo-skill/SKILL.md',
      'skills/roo-skill/references/runbook.md',
    ]);

    rmSync(canonicalDir, { recursive: true, force: true });
    mkdirSync(canonicalDir, { recursive: true });

    const imp = await runCli('import --global --from roo-code', projectDir);
    expect(imp.exitCode).toBe(0);

    fileExists(join(canonicalDir, 'rules', '_root.md'));
    fileContains(join(canonicalDir, 'rules', '_root.md'), 'Roo instructions');
    fileExists(join(canonicalDir, 'rules', 'testing.md'));
    fileContains(join(canonicalDir, 'rules', 'testing.md'), 'Write tests');
    fileExists(join(canonicalDir, 'commands', 'build.md'));
    fileContains(join(canonicalDir, 'commands', 'build.md'), 'Build the project');
    fileExists(join(canonicalDir, 'skills', 'roo-skill', 'SKILL.md'));
    fileExists(join(canonicalDir, 'skills', 'roo-skill', 'references', 'runbook.md'));
    fileExists(join(canonicalDir, 'mcp.json'));
    fileExists(join(canonicalDir, 'ignore'));
    fileContains(join(canonicalDir, 'ignore'), 'dist');
  });
});

describe('global mode round-trip: Continue', () => {
  const env = useGlobalEnv();

  it('canonical → generate --global → import --global → matches canonical', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'commands'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'continue-skill'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'continue-skill', 'references'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nContinue instructions\n',
    );
    writeFileSync(
      join(canonicalDir, 'rules', 'style.md'),
      '---\ndescription: Style\n---\n# Style\nCode style rules\n',
    );
    writeFileSync(
      join(canonicalDir, 'commands', 'explain.md'),
      '---\ndescription: Explain\n---\n# Explain\nExplain the code\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'continue-skill', 'SKILL.md'),
      '---\ndescription: Continue skill\n---\n# Continue\nSkill body\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'continue-skill', 'references', 'context.md'),
      '# Context\nExplain with context.\n',
    );
    writeFileSync(
      join(canonicalDir, 'mcp.json'),
      '{"mcpServers":{"test":{"command":"node","args":[]}}}',
    );
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [continue]\nfeatures: [rules, commands, skills, mcp]\n',
    );

    const gen = await runCli('generate --global --targets continue', projectDir);
    expect(gen.exitCode).toBe(0);

    // 1. Root rule (docs: ~/.continue/rules/general.md)
    fileExists(join(homeDir, '.continue', 'rules', 'general.md'));
    fileContains(join(homeDir, '.continue', 'rules', 'general.md'), 'Continue instructions');
    expect(markdownFrontmatter(join(homeDir, '.continue', 'rules', 'general.md')).description).toBe(
      'Root',
    );

    // 2. Named rules (docs: ~/.continue/rules/*.md)
    fileExists(join(homeDir, '.continue', 'rules', 'style.md'));
    fileContains(join(homeDir, '.continue', 'rules', 'style.md'), 'Code style rules');
    expect(markdownFrontmatter(join(homeDir, '.continue', 'rules', 'style.md')).description).toBe(
      'Style',
    );

    // 3. Commands as prompts (docs: ~/.continue/prompts/*.md)
    fileExists(join(homeDir, '.continue', 'prompts', 'explain.md'));
    fileContains(join(homeDir, '.continue', 'prompts', 'explain.md'), 'Explain the code');
    expect(
      markdownFrontmatter(join(homeDir, '.continue', 'prompts', 'explain.md')).description,
    ).toBe('Explain');

    // 4. Skills (docs: ~/.continue/skills/<skill>/SKILL.md)
    fileExists(join(homeDir, '.continue', 'skills', 'continue-skill', 'SKILL.md'));
    fileContains(join(homeDir, '.continue', 'skills', 'continue-skill', 'SKILL.md'), 'Skill body');
    expect(
      markdownFrontmatter(join(homeDir, '.continue', 'skills', 'continue-skill', 'SKILL.md')).name,
    ).toBe('continue-skill');
    fileExists(join(homeDir, '.continue', 'skills', 'continue-skill', 'references', 'context.md'));

    // 5. MCP (docs: ~/.continue/mcpServers/agentsmesh.json)
    fileExists(join(homeDir, '.continue', 'mcpServers', 'agentsmesh.json'));
    validJson(join(homeDir, '.continue', 'mcpServers', 'agentsmesh.json'));
    const mcp = JSON.parse(readText(join(homeDir, '.continue', 'mcpServers', 'agentsmesh.json')));
    expect(mcp.mcpServers.test).toBeDefined();

    // 6. Compatibility mirror (docs: ~/.agents/skills/)
    fileExists(join(homeDir, '.agents', 'skills', 'continue-skill', 'SKILL.md'));
    fileContains(join(homeDir, '.agents', 'skills', 'continue-skill', 'SKILL.md'), 'Skill body');
    fileExists(join(homeDir, '.agents', 'skills', 'continue-skill', 'references', 'context.md'));
    dirFilesExactly(join(homeDir, '.continue'), [
      'mcpServers/agentsmesh.json',
      'prompts/explain.md',
      'rules/general.md',
      'rules/style.md',
      'skills/continue-skill/SKILL.md',
      'skills/continue-skill/references/context.md',
    ]);
    dirFilesExactly(join(homeDir, '.agents'), [
      'skills/continue-skill/SKILL.md',
      'skills/continue-skill/references/context.md',
    ]);

    rmSync(canonicalDir, { recursive: true, force: true });
    mkdirSync(canonicalDir, { recursive: true });

    const imp = await runCli('import --global --from continue', projectDir);
    expect(imp.exitCode).toBe(0);

    fileExists(join(canonicalDir, 'rules', '_root.md'));
    fileContains(join(canonicalDir, 'rules', '_root.md'), 'Continue instructions');
    fileExists(join(canonicalDir, 'rules', 'style.md'));
    fileContains(join(canonicalDir, 'rules', 'style.md'), 'Code style rules');
    fileExists(join(canonicalDir, 'commands', 'explain.md'));
    fileContains(join(canonicalDir, 'commands', 'explain.md'), 'Explain the code');
    fileExists(join(canonicalDir, 'skills', 'continue-skill', 'SKILL.md'));
    fileExists(join(canonicalDir, 'skills', 'continue-skill', 'references', 'context.md'));
    fileExists(join(canonicalDir, 'mcp.json'));
  });
});
