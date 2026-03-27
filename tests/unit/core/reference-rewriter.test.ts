import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';

const mockBuildArtifactPathMap = vi.hoisted(() => vi.fn());

vi.mock('../../../src/core/reference/output-source-map.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/core/reference/output-source-map.js')>();
  return {
    ...actual,
    buildArtifactPathMap: (
      ...args: Parameters<typeof actual.buildArtifactPathMap>
    ): ReturnType<typeof actual.buildArtifactPathMap> => {
      mockBuildArtifactPathMap(...args);
      return actual.buildArtifactPathMap(...args);
    },
  };
});

import { rewriteGeneratedReferences } from '../../../src/core/reference/rewriter.js';

function makeConfig(targets: ValidatedConfig['targets']): ValidatedConfig {
  return {
    version: 1,
    targets,
    features: ['rules', 'commands', 'agents', 'skills'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

function makeCanonical(projectRoot: string): CanonicalFiles {
  return {
    rules: [
      {
        source: join(projectRoot, '.agentsmesh', 'rules', '_root.md'),
        root: true,
        targets: [],
        description: '',
        globs: [],
        body: '',
      },
      {
        source: join(projectRoot, '.agentsmesh', 'rules', 'typescript.md'),
        root: false,
        targets: [],
        description: '',
        globs: ['src/**/*.ts'],
        body: '',
      },
    ],
    commands: [
      {
        source: join(projectRoot, '.agentsmesh', 'commands', 'review.md'),
        name: 'review',
        description: '',
        allowedTools: [],
        body: '',
      },
    ],
    agents: [
      {
        source: join(projectRoot, '.agentsmesh', 'agents', 'reviewer.md'),
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
    ],
    skills: [
      {
        source: join(projectRoot, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
        name: 'api-gen',
        description: '',
        body: '',
        supportingFiles: [
          {
            relativePath: 'references/checklist.md',
            absolutePath: join(
              projectRoot,
              '.agentsmesh',
              'skills',
              'api-gen',
              'references',
              'checklist.md',
            ),
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

describe('rewriteGeneratedReferences', () => {
  it('rewrites root and nested artifact links to project-root paths', () => {
    const projectRoot = '/proj';
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/CLAUDE.md',
        content:
          'See .agentsmesh/rules/typescript.md, .agentsmesh/commands/review.md, .agentsmesh/agents/reviewer.md, and .agentsmesh/skills/api-gen/references/checklist.md.',
        status: 'created',
      },
      {
        target: 'claude-code',
        path: '.claude/commands/review.md',
        content: 'Load .agentsmesh/skills/api-gen/SKILL.md.',
        status: 'created',
      },
      {
        target: 'claude-code',
        path: '.claude/rules/typescript.md',
        content: '',
        status: 'created',
      },
      {
        target: 'claude-code',
        path: '.claude/agents/reviewer.md',
        content: '',
        status: 'created',
      },
      {
        target: 'claude-code',
        path: '.claude/skills/api-gen/SKILL.md',
        content: '',
        status: 'created',
      },
      {
        target: 'claude-code',
        path: '.claude/skills/api-gen/references/checklist.md',
        content: '',
        status: 'created',
      },
    ];

    const rewritten = rewriteGeneratedReferences(
      results,
      makeCanonical(projectRoot),
      makeConfig(['claude-code']),
      projectRoot,
    );

    expect(rewritten[0]!.content).toContain('.claude/rules/typescript.md');
    expect(rewritten[0]!.content).toContain('.claude/commands/review.md');
    expect(rewritten[0]!.content).toContain('.claude/agents/reviewer.md');
    expect(rewritten[0]!.content).toContain('.claude/skills/api-gen/references/checklist.md');
    expect(rewritten[1]!.content).toContain('.claude/skills/api-gen/SKILL.md');
  });

  it('leaves unmapped codex non-root rule references unchanged', () => {
    const projectRoot = '/proj';
    const canonical = makeCanonical(projectRoot);
    canonical.rules[1] = { ...canonical.rules[1]!, globs: [] };

    const rewritten = rewriteGeneratedReferences(
      [
        {
          target: 'codex-cli',
          path: 'AGENTS.md',
          content: 'See .agentsmesh/rules/typescript.md.',
          status: 'created',
        },
      ],
      canonical,
      makeConfig(['codex-cli']),
      projectRoot,
    );

    expect(rewritten[0]!.content).toContain('.agentsmesh/rules/typescript.md');
  });

  it('skips outputs that have no canonical text source mapping', () => {
    const rewritten = rewriteGeneratedReferences(
      [
        {
          target: 'cursor',
          path: '.cursor/mcp.json',
          content: '{"note":".agentsmesh/commands/review.md"}',
          status: 'created',
        },
      ],
      makeCanonical('/proj'),
      makeConfig(['cursor']),
      '/proj',
    );

    expect(rewritten[0]!.content).toBe('{"note":".agentsmesh/commands/review.md"}');
  });

  it('rewrites Copilot .github/instructions rule outputs from their canonical rule source', () => {
    const projectRoot = '/proj';
    const canonical = makeCanonical(projectRoot);
    canonical.rules[1] = {
      ...canonical.rules[1]!,
      body: 'See .agentsmesh/rules/typescript.md.',
    };
    const results: GenerateResult[] = [
      {
        target: 'copilot',
        path: '.github/instructions/typescript.instructions.md',
        content: 'See .agentsmesh/rules/typescript.md.',
        status: 'created',
      },
      {
        target: 'copilot',
        path: '.github/copilot-instructions.md',
        content: '',
        status: 'created',
      },
    ];

    const rewritten = rewriteGeneratedReferences(
      results,
      canonical,
      makeConfig(['copilot']),
      projectRoot,
    );

    expect(rewritten[0]!.content).toContain('.github/instructions/typescript.instructions.md');
  });

  it('rewrites absolute canonical paths through the generated artifact map', () => {
    const projectRoot = '/proj';
    const rewritten = rewriteGeneratedReferences(
      [
        {
          target: 'claude-code',
          path: '.claude/CLAUDE.md',
          content:
            'Absolute: /proj/.agentsmesh/rules/typescript.md, /proj/.agentsmesh/commands/review.md, /proj/.agentsmesh/skills/api-gen/references/checklist.md.',
          status: 'created',
        },
        {
          target: 'claude-code',
          path: '.claude/rules/typescript.md',
          content: '',
          status: 'created',
        },
        {
          target: 'claude-code',
          path: '.claude/commands/review.md',
          content: '',
          status: 'created',
        },
        {
          target: 'claude-code',
          path: '.claude/skills/api-gen/SKILL.md',
          content: '',
          status: 'created',
        },
        {
          target: 'claude-code',
          path: '.claude/skills/api-gen/references/checklist.md',
          content: '',
          status: 'created',
        },
      ],
      makeCanonical(projectRoot),
      makeConfig(['claude-code']),
      projectRoot,
    );

    expect(rewritten[0]!.content).toBe(
      'Absolute: .claude/rules/typescript.md, .claude/commands/review.md, .claude/skills/api-gen/references/checklist.md.',
    );
  });

  it('rewrites windsurf shared and scoped AGENTS outputs from their canonical rule sources', () => {
    const projectRoot = '/proj';
    const canonical = makeCanonical(projectRoot);
    const results: GenerateResult[] = [
      {
        target: 'windsurf',
        path: 'AGENTS.md',
        content: 'Use .agentsmesh/skills/api-gen/ and .agentsmesh/skills/api-gen/references/.',
        status: 'created',
      },
      {
        target: 'windsurf',
        path: 'src/AGENTS.md',
        content: 'Use .agentsmesh/skills/api-gen/SKILL.md.',
        status: 'created',
      },
      {
        target: 'windsurf',
        path: '.windsurf/rules/typescript.md',
        content: '',
        status: 'created',
      },
      {
        target: 'windsurf',
        path: '.windsurf/skills/api-gen/SKILL.md',
        content: '',
        status: 'created',
      },
      {
        target: 'windsurf',
        path: '.windsurf/skills/api-gen/references/checklist.md',
        content: '',
        status: 'created',
      },
    ];

    const rewritten = rewriteGeneratedReferences(
      results,
      canonical,
      makeConfig(['windsurf']),
      projectRoot,
    );

    expect(rewritten[0]!.content).toContain('.windsurf/skills/api-gen/');
    expect(rewritten[0]!.content).toContain('.windsurf/skills/api-gen/references/');
    expect(rewritten[1]!.content).toContain('.windsurf/skills/api-gen/SKILL.md');
  });

  it('reuses one artifact map for multiple outputs of the same target', () => {
    const projectRoot = '/proj';
    mockBuildArtifactPathMap.mockClear();

    rewriteGeneratedReferences(
      [
        {
          target: 'claude-code',
          path: '.claude/CLAUDE.md',
          content: 'See .agentsmesh/skills/api-gen/references/checklist.md.',
          status: 'created',
        },
        {
          target: 'claude-code',
          path: '.claude/commands/review.md',
          content: 'Load .agentsmesh/skills/api-gen/SKILL.md.',
          status: 'created',
        },
      ],
      makeCanonical(projectRoot),
      makeConfig(['claude-code']),
      projectRoot,
    );

    expect(mockBuildArtifactPathMap).toHaveBeenCalledTimes(1);
  });

  it('skips rewriting non-markdown outputs even when they map to canonical sources', () => {
    const projectRoot = '/proj';
    const canonical = makeCanonical(projectRoot);
    canonical.skills[0] = {
      ...canonical.skills[0]!,
      supportingFiles: [
        ...canonical.skills[0]!.supportingFiles,
        {
          relativePath: 'template.ts',
          absolutePath: join(projectRoot, '.agentsmesh', 'skills', 'api-gen', 'template.ts'),
          content: '',
        },
      ],
    };

    const rewritten = rewriteGeneratedReferences(
      [
        {
          target: 'claude-code',
          path: '.claude/skills/api-gen/template.ts',
          content: 'const ref = ".agentsmesh/skills/api-gen/references/checklist.md";',
          status: 'created',
        },
      ],
      canonical,
      makeConfig(['claude-code']),
      projectRoot,
    );

    expect(rewritten[0]!.content).toBe(
      'const ref = ".agentsmesh/skills/api-gen/references/checklist.md";',
    );
  });
});
