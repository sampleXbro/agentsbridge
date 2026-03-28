import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { buildReferenceMap, isMarkdownLikeOutput } from '../../../src/core/reference/map.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';

function config(targets: ValidatedConfig['targets']): ValidatedConfig {
  return {
    version: 1,
    targets,
    features: ['rules', 'skills'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

function canonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [
      {
        source: '/proj/.agentsmesh/skills/post-feature-qa/SKILL.md',
        name: 'post-feature-qa',
        description: '',
        body: '',
        supportingFiles: [],
      },
      {
        source: '/proj/.agentsmesh/skills/add-agent-target/SKILL.md',
        name: 'add-agent-target',
        description: '',
        body: '',
        supportingFiles: [
          {
            relativePath: 'references/checklist.md',
            absolutePath: join('/proj/.agentsmesh/skills/add-agent-target/references/checklist.md'),
            content: '',
          },
        ],
      },
    ],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('buildReferenceMap', () => {
  it.each([
    ['claude-code', '.claude/skills'],
    ['cursor', '.cursor/skills'],
    ['copilot', '.github/skills'],
    ['gemini-cli', '.gemini/skills'],
    ['cline', '.cline/skills'],
    ['codex-cli', '.agents/skills'],
    ['windsurf', '.windsurf/skills'],
  ] as const)('maps skill file and directory references for %s', (target, skillDir) => {
    const refs = buildReferenceMap(target, canonical(), config([target]));

    expect(refs.get('.agentsmesh/skills/post-feature-qa')).toBe(`${skillDir}/post-feature-qa`);
    expect(refs.get('.agentsmesh/skills/post-feature-qa/')).toBe(`${skillDir}/post-feature-qa/`);
    expect(refs.get('.agentsmesh/skills/add-agent-target/SKILL.md')).toBe(
      `${skillDir}/add-agent-target/SKILL.md`,
    );
    expect(refs.get('.agentsmesh/skills/add-agent-target/references')).toBe(
      `${skillDir}/add-agent-target/references`,
    );
    expect(refs.get('.agentsmesh/skills/add-agent-target/references/')).toBe(
      `${skillDir}/add-agent-target/references/`,
    );
    expect(refs.get('.agentsmesh/skills/add-agent-target/references/checklist.md')).toBe(
      `${skillDir}/add-agent-target/references/checklist.md`,
    );
  });

  it('maps command references for windsurf to workflow paths', () => {
    const can = canonical();
    can.commands = [
      {
        source: '/proj/.agentsmesh/commands/deploy.md',
        name: 'deploy',
        description: '',
        allowedTools: [],
        body: '',
      },
    ];
    const cfg = config(['windsurf']);
    cfg.features = ['rules', 'commands', 'skills'];
    const refs = buildReferenceMap('windsurf', can, cfg);
    expect(refs.get('.agentsmesh/commands/deploy.md')).toBe('.windsurf/workflows/deploy.md');
  });

  it('maps command references for gemini-cli to TOML command files', () => {
    const can = canonical();
    can.commands = [
      {
        source: '/proj/.agentsmesh/commands/deploy.md',
        name: 'deploy',
        description: '',
        allowedTools: [],
        body: '',
      },
    ];
    const cfg = config(['gemini-cli']);
    cfg.features = ['rules', 'commands', 'skills'];
    const refs = buildReferenceMap('gemini-cli', can, cfg);
    expect(refs.get('.agentsmesh/commands/deploy.md')).toBe('.gemini/commands/deploy.toml');
  });

  it('maps `:`-namespaced gemini-cli command references to nested TOML paths', () => {
    const can = canonical();
    can.commands = [
      {
        source: '/proj/.agentsmesh/commands/git:commit.md',
        name: 'git:commit',
        description: '',
        allowedTools: [],
        body: '',
      },
    ];
    const cfg = config(['gemini-cli']);
    cfg.features = ['rules', 'commands', 'skills'];
    const refs = buildReferenceMap('gemini-cli', can, cfg);
    expect(refs.get('.agentsmesh/commands/git:commit.md')).toBe('.gemini/commands/git/commit.toml');
  });

  it('maps Copilot scoped rules to .instructions.md files', () => {
    const can = canonical();
    can.rules = [
      {
        source: '/proj/.agentsmesh/rules/typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: ['src/**/*.ts'],
        body: '',
      },
    ];
    const cfg = config(['copilot']);
    cfg.features = ['rules', 'skills'];
    const refs = buildReferenceMap('copilot', can, cfg);
    expect(refs.get('.agentsmesh/rules/typescript.md')).toBe(
      '.github/instructions/typescript.instructions.md',
    );
  });

  it('maps agent references for windsurf to projected skill paths', () => {
    const can = canonical();
    can.agents = [
      {
        source: '/proj/.agentsmesh/agents/reviewer.md',
        name: 'reviewer',
        description: '',
        tools: [],
        disallowedTools: [],
        model: '',
        permissionMode: '',
        maxTurns: 0,
        mcpServers: [],
        hooks: {},
        skills: [],
        memory: '',
        body: '',
      },
    ];
    const cfg = config(['windsurf']);
    cfg.features = ['rules', 'agents', 'skills'];
    const refs = buildReferenceMap('windsurf', can, cfg);
    expect(refs.has('.agentsmesh/agents/reviewer.md')).toBe(true);
    expect(refs.get('.agentsmesh/agents/reviewer.md')).toContain('.windsurf/skills/');
  });

  it('returns empty map for an unknown target', () => {
    const refs = buildReferenceMap('unknown-agent' as never, canonical(), config([]));
    expect(refs.size).toBe(0);
  });
});

describe('isMarkdownLikeOutput', () => {
  it.each([
    ['CLAUDE.md', true],
    ['.cursor/rules/ts.mdc', true],
    ['.windsurfrules', true],
    ['GEMINI.md', true],
    ['AGENTS.md', true],
    ['.github/instructions/ts.instructions.md', true],
    ['.claude/settings.json', false],
    ['.mcp.json', false],
    ['.codex/config.toml', false],
  ])('returns correct value for %s', (path, expected) => {
    expect(isMarkdownLikeOutput(path)).toBe(expected);
  });
});
