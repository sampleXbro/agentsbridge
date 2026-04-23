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

describe('global mode round-trip: Junie', () => {
  const env = useGlobalEnv();

  it('canonical → generate --global → import --global → matches canonical', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'commands'), { recursive: true });
    mkdirSync(join(canonicalDir, 'agents'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'junie-skill'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'junie-skill', 'references'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nJunie guidelines\n',
    );
    writeFileSync(
      join(canonicalDir, 'rules', 'style.md'),
      '---\ndescription: Style\nglobs: ["**/*.ts"]\n---\n# Style\nUse semicolons\n',
    );
    writeFileSync(
      join(canonicalDir, 'commands', 'review.md'),
      '---\ndescription: Review\n---\n# Review\nReview the code\n',
    );
    writeFileSync(
      join(canonicalDir, 'agents', 'reviewer.md'),
      '---\ndescription: Reviewer agent\n---\n# Reviewer\nAgent body\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'junie-skill', 'SKILL.md'),
      '---\ndescription: Skill\n---\n# Skill\nSkill body\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'junie-skill', 'references', 'rubric.md'),
      '# Rubric\nStay focused.\n',
    );
    writeFileSync(
      join(canonicalDir, 'mcp.json'),
      '{"mcpServers":{"test":{"command":"node","args":[]}}}',
    );
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [junie]\nfeatures: [rules, commands, agents, skills, mcp]\n',
    );

    const gen = await runCli('generate --global --targets junie', projectDir);
    expect(gen.exitCode).toBe(0);

    // 1. AGENTS.md — root + all named rules aggregated (docs: ~/.junie/AGENTS.md)
    fileExists(join(homeDir, '.junie', 'AGENTS.md'));
    fileContains(join(homeDir, '.junie', 'AGENTS.md'), 'Junie guidelines');
    fileContains(join(homeDir, '.junie', 'AGENTS.md'), 'Use semicolons');
    markdownHasNoFrontmatter(join(homeDir, '.junie', 'AGENTS.md'));

    // 2. Commands (docs: ~/.junie/commands/*.md)
    fileExists(join(homeDir, '.junie', 'commands', 'review.md'));
    fileContains(join(homeDir, '.junie', 'commands', 'review.md'), 'Review the code');
    expect(markdownFrontmatter(join(homeDir, '.junie', 'commands', 'review.md')).description).toBe(
      'Review',
    );

    // 3. Agents (docs: ~/.junie/agents/*.md)
    fileExists(join(homeDir, '.junie', 'agents', 'reviewer.md'));
    fileContains(join(homeDir, '.junie', 'agents', 'reviewer.md'), 'Agent body');
    expect(markdownFrontmatter(join(homeDir, '.junie', 'agents', 'reviewer.md')).name).toBe(
      'reviewer',
    );

    // 4. Skills (docs: ~/.junie/skills/<skill>/SKILL.md)
    fileExists(join(homeDir, '.junie', 'skills', 'junie-skill', 'SKILL.md'));
    fileContains(join(homeDir, '.junie', 'skills', 'junie-skill', 'SKILL.md'), 'Skill body');
    expect(
      markdownFrontmatter(join(homeDir, '.junie', 'skills', 'junie-skill', 'SKILL.md')).name,
    ).toBe('junie-skill');
    fileExists(join(homeDir, '.junie', 'skills', 'junie-skill', 'references', 'rubric.md'));

    // 5. Skills mirror (docs: ~/.agents/skills/ — JUNIE_GLOBAL_AGENTS_SKILLS_DIR)
    fileExists(join(homeDir, '.agents', 'skills', 'junie-skill', 'SKILL.md'));
    fileContains(join(homeDir, '.agents', 'skills', 'junie-skill', 'SKILL.md'), 'Skill body');
    fileExists(join(homeDir, '.agents', 'skills', 'junie-skill', 'references', 'rubric.md'));

    // 6. MCP (docs: ~/.junie/mcp/mcp.json)
    fileExists(join(homeDir, '.junie', 'mcp', 'mcp.json'));
    validJson(join(homeDir, '.junie', 'mcp', 'mcp.json'));
    const mcp = JSON.parse(readText(join(homeDir, '.junie', 'mcp', 'mcp.json')));
    expect(mcp.mcpServers.test).toBeDefined();

    // Ignore is suppressed in Junie global mode (no ~/.aiignore generated)
    fileNotExists(join(homeDir, '.aiignore'));
    dirFilesExactly(join(homeDir, '.junie'), [
      'AGENTS.md',
      'agents/reviewer.md',
      'commands/review.md',
      'mcp/mcp.json',
      'skills/junie-skill/SKILL.md',
      'skills/junie-skill/references/rubric.md',
    ]);
    dirFilesExactly(join(homeDir, '.agents'), [
      'skills/junie-skill/SKILL.md',
      'skills/junie-skill/references/rubric.md',
    ]);

    rmSync(canonicalDir, { recursive: true, force: true });
    mkdirSync(canonicalDir, { recursive: true });

    const imp = await runCli('import --global --from junie', projectDir);
    expect(imp.exitCode).toBe(0);

    // Root rule recoverable from AGENTS.md
    fileExists(join(canonicalDir, 'rules', '_root.md'));
    fileContains(join(canonicalDir, 'rules', '_root.md'), 'Junie guidelines');

    // Named rules are aggregated into AGENTS.md — individual rules cannot be recovered
    fileExists(join(canonicalDir, 'commands', 'review.md'));
    fileExists(join(canonicalDir, 'agents', 'reviewer.md'));
    fileExists(join(canonicalDir, 'skills', 'junie-skill', 'SKILL.md'));
    fileExists(join(canonicalDir, 'skills', 'junie-skill', 'references', 'rubric.md'));
    fileExists(join(canonicalDir, 'mcp.json'));
  });
});

describe('global mode round-trip: Kiro', () => {
  const env = useGlobalEnv();

  it('canonical → generate --global → import --global → matches canonical', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'agents'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'kiro-skill'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'kiro-skill', 'references'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nKiro instructions\n',
    );
    writeFileSync(
      join(canonicalDir, 'rules', 'typescript.md'),
      '---\ndescription: TypeScript\nglobs: ["**/*.ts"]\n---\n# TS\nStrict mode\n',
    );
    writeFileSync(
      join(canonicalDir, 'agents', 'helper.md'),
      '---\ndescription: Helper\n---\n# Helper\nAgent body\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'kiro-skill', 'SKILL.md'),
      '---\ndescription: Kiro skill\n---\n# Kiro\nSkill body\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'kiro-skill', 'references', 'notes.md'),
      '# Notes\nUse Kiro.\n',
    );
    writeFileSync(
      join(canonicalDir, 'mcp.json'),
      '{"mcpServers":{"test":{"command":"node","args":[]}}}',
    );
    writeFileSync(join(canonicalDir, 'ignore'), 'node_modules\n');
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [kiro]\nfeatures: [rules, agents, skills, mcp, ignore]\n',
    );

    const gen = await runCli('generate --global --targets kiro', projectDir);
    expect(gen.exitCode).toBe(0);

    // 1. Root instruction in steering dir (docs: ~/.kiro/steering/AGENTS.md)
    fileExists(join(homeDir, '.kiro', 'steering', 'AGENTS.md'));
    fileContains(join(homeDir, '.kiro', 'steering', 'AGENTS.md'), 'Kiro instructions');
    markdownHasNoFrontmatter(join(homeDir, '.kiro', 'steering', 'AGENTS.md'));

    // 2. Named rules in steering dir (docs: ~/.kiro/steering/*.md)
    fileExists(join(homeDir, '.kiro', 'steering', 'typescript.md'));
    fileContains(join(homeDir, '.kiro', 'steering', 'typescript.md'), 'Strict mode');
    expect(markdownFrontmatter(join(homeDir, '.kiro', 'steering', 'typescript.md')).inclusion).toBe(
      'fileMatch',
    );

    // 3. Skills (docs: ~/.kiro/skills/<skill>/SKILL.md)
    fileExists(join(homeDir, '.kiro', 'skills', 'kiro-skill', 'SKILL.md'));
    fileContains(join(homeDir, '.kiro', 'skills', 'kiro-skill', 'SKILL.md'), 'Skill body');
    expect(
      markdownFrontmatter(join(homeDir, '.kiro', 'skills', 'kiro-skill', 'SKILL.md')).name,
    ).toBe('kiro-skill');
    fileExists(join(homeDir, '.kiro', 'skills', 'kiro-skill', 'references', 'notes.md'));

    // 4. Skills mirror (docs: ~/.agents/skills/ — KIRO_GLOBAL_AGENTS_SKILLS_DIR)
    fileExists(join(homeDir, '.agents', 'skills', 'kiro-skill', 'SKILL.md'));
    fileContains(join(homeDir, '.agents', 'skills', 'kiro-skill', 'SKILL.md'), 'Skill body');
    fileExists(join(homeDir, '.agents', 'skills', 'kiro-skill', 'references', 'notes.md'));

    // 5. Agents (docs: ~/.kiro/agents/*.md)
    fileExists(join(homeDir, '.kiro', 'agents', 'helper.md'));
    fileContains(join(homeDir, '.kiro', 'agents', 'helper.md'), 'Agent body');
    expect(markdownFrontmatter(join(homeDir, '.kiro', 'agents', 'helper.md')).name).toBe('helper');

    // 6. MCP (docs: ~/.kiro/settings/mcp.json)
    fileExists(join(homeDir, '.kiro', 'settings', 'mcp.json'));
    validJson(join(homeDir, '.kiro', 'settings', 'mcp.json'));
    const mcp = JSON.parse(readText(join(homeDir, '.kiro', 'settings', 'mcp.json')));
    expect(mcp.mcpServers.test).toBeDefined();

    // 7. Ignore (docs: ~/.kiro/settings/kiroignore)
    fileExists(join(homeDir, '.kiro', 'settings', 'kiroignore'));
    fileContains(join(homeDir, '.kiro', 'settings', 'kiroignore'), 'node_modules');
    dirFilesExactly(join(homeDir, '.kiro'), [
      'agents/helper.md',
      'settings/kiroignore',
      'settings/mcp.json',
      'skills/kiro-skill/SKILL.md',
      'skills/kiro-skill/references/notes.md',
      'steering/AGENTS.md',
      'steering/typescript.md',
    ]);
    dirFilesExactly(join(homeDir, '.agents'), [
      'skills/kiro-skill/SKILL.md',
      'skills/kiro-skill/references/notes.md',
    ]);

    rmSync(canonicalDir, { recursive: true, force: true });
    mkdirSync(canonicalDir, { recursive: true });

    const imp = await runCli('import --global --from kiro', projectDir);
    expect(imp.exitCode).toBe(0);

    fileExists(join(canonicalDir, 'rules', '_root.md'));
    fileContains(join(canonicalDir, 'rules', '_root.md'), 'Kiro instructions');
    fileExists(join(canonicalDir, 'rules', 'typescript.md'));
    fileContains(join(canonicalDir, 'rules', 'typescript.md'), 'Strict mode');
    fileExists(join(canonicalDir, 'agents', 'helper.md'));
    fileContains(join(canonicalDir, 'agents', 'helper.md'), 'Agent body');
    fileExists(join(canonicalDir, 'skills', 'kiro-skill', 'SKILL.md'));
    fileExists(join(canonicalDir, 'skills', 'kiro-skill', 'references', 'notes.md'));
    fileExists(join(canonicalDir, 'mcp.json'));
    fileExists(join(canonicalDir, 'ignore'));
    fileContains(join(canonicalDir, 'ignore'), 'node_modules');
  });
});
