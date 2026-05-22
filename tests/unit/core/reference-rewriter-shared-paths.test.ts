import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';
import { rewriteGeneratedReferences } from '../../../src/core/reference/rewriter.js';
import { resolveOutputCollisions } from '../../../src/core/generate/collision.js';

function makeConfig(targets: ValidatedConfig['targets']): ValidatedConfig {
  return {
    version: 1,
    targets,
    features: ['rules', 'skills'],
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
    ],
    commands: [],
    agents: [],
    skills: [
      {
        source: join(projectRoot, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
        name: 'api-gen',
        description: '',
        body: '',
        supportingFiles: [],
      },
    ],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('rewriteGeneratedReferences — skipPaths', () => {
  it('returns results in the skipPaths set unchanged (canonical refs preserved)', () => {
    const projectRoot = '/proj';
    const canonicalContent = 'See .agentsmesh/skills/api-gen/SKILL.md.';
    const results: GenerateResult[] = [
      {
        target: 'amp',
        path: 'AGENTS.md',
        content: canonicalContent,
        status: 'created',
      },
      {
        target: 'amp',
        path: '.agents/skills/api-gen/SKILL.md',
        content: '',
        status: 'created',
      },
    ];

    const rewritten = rewriteGeneratedReferences(
      results,
      makeCanonical(projectRoot),
      makeConfig(['amp']),
      projectRoot,
      'project',
      ['amp'],
      new Set(['AGENTS.md']),
    );

    expect(rewritten[0]!.content).toBe(canonicalContent);
  });

  it('still rewrites non-skipped paths normally', () => {
    const projectRoot = '/proj';
    const results: GenerateResult[] = [
      {
        target: 'amp',
        path: 'AGENTS.md',
        content: 'See .agentsmesh/skills/api-gen/SKILL.md.',
        status: 'created',
      },
      {
        target: 'amp',
        path: '.agents/skills/api-gen/SKILL.md',
        content: 'See .agentsmesh/rules/_root.md for context.',
        status: 'created',
      },
    ];

    const rewritten = rewriteGeneratedReferences(
      results,
      makeCanonical(projectRoot),
      makeConfig(['amp']),
      projectRoot,
      'project',
      ['amp'],
      new Set(['AGENTS.md']),
    );

    expect(rewritten[0]!.content).toBe('See .agentsmesh/skills/api-gen/SKILL.md.');
    expect(rewritten[1]!.content).not.toBe('See .agentsmesh/rules/_root.md for context.');
  });

  it('produces byte-identical content for the same shared path across different targets', () => {
    const projectRoot = '/proj';
    const sharedContent = 'See .agentsmesh/skills/api-gen/SKILL.md.';
    const results: GenerateResult[] = [
      {
        target: 'amp',
        path: 'AGENTS.md',
        content: sharedContent,
        status: 'created',
      },
      {
        target: 'factory-droid',
        path: 'AGENTS.md',
        content: sharedContent,
        status: 'created',
      },
      {
        target: 'amp',
        path: '.agents/skills/api-gen/SKILL.md',
        content: '',
        status: 'created',
      },
      {
        target: 'factory-droid',
        path: '.factory/skills/api-gen/SKILL.md',
        content: '',
        status: 'created',
      },
    ];

    const rewritten = rewriteGeneratedReferences(
      results,
      makeCanonical(projectRoot),
      makeConfig(['amp', 'factory-droid']),
      projectRoot,
      'project',
      ['amp', 'factory-droid'],
      new Set(['AGENTS.md']),
    );

    const amp = rewritten.find((r) => r.target === 'amp' && r.path === 'AGENTS.md');
    const factory = rewritten.find((r) => r.target === 'factory-droid' && r.path === 'AGENTS.md');
    expect(amp?.content).toBe(factory?.content);
    expect(() => resolveOutputCollisions(rewritten)).not.toThrow();
  });

  it('collision resolver merges identical shared AGENTS.md into a single result', () => {
    const sharedContent = 'See .agentsmesh/skills/api-gen/SKILL.md.';
    const results: GenerateResult[] = [
      { target: 'amp', path: 'AGENTS.md', content: sharedContent, status: 'created' },
      { target: 'factory-droid', path: 'AGENTS.md', content: sharedContent, status: 'created' },
      { target: 'jules', path: 'AGENTS.md', content: sharedContent, status: 'created' },
    ];

    const merged = resolveOutputCollisions(results);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.content).toBe(sharedContent);
  });

  it('R-7: resolves amp/cline AGENTS.md collision by preferring the version with embedded rules', () => {
    // amp embeds non-root rules in AGENTS.md; cline emits them to .clinerules/*.md
    // and writes only the root rule to AGENTS.md. After stripping the optional
    // embedded-rules block they're identical, so amp's richer rendering wins.
    const cline =
      'Root rule body.\n\n<!-- agentsmesh:root-generation-contract:start -->\nContract.\n<!-- agentsmesh:root-generation-contract:end -->';
    const amp =
      'Root rule body.\n\n<!-- agentsmesh:embedded-rules:start -->\n## Code review\nBody.\n<!-- agentsmesh:embedded-rules:end -->\n\n<!-- agentsmesh:root-generation-contract:start -->\nContract.\n<!-- agentsmesh:root-generation-contract:end -->';
    const results: GenerateResult[] = [
      { target: 'amp', path: 'AGENTS.md', content: amp, status: 'created' },
      { target: 'cline', path: 'AGENTS.md', content: cline, status: 'created' },
    ];
    const merged = resolveOutputCollisions(results);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.content).toBe(amp);
  });

  it('R-7: STILL throws when amp/cline AGENTS.md content differs beyond optional blocks', () => {
    // If the non-block content actually differs, the collision is real and must throw.
    const cline = 'Root rule body A.\n';
    const amp =
      'Root rule body B.\n<!-- agentsmesh:embedded-rules:start -->\nx\n<!-- agentsmesh:embedded-rules:end -->';
    const results: GenerateResult[] = [
      { target: 'amp', path: 'AGENTS.md', content: amp, status: 'created' },
      { target: 'cline', path: 'AGENTS.md', content: cline, status: 'created' },
    ];
    expect(() => resolveOutputCollisions(results)).toThrow(/Conflicting generated outputs/);
  });

  it('omitting skipPaths preserves existing rewrite behavior', () => {
    const projectRoot = '/proj';
    const results: GenerateResult[] = [
      {
        target: 'amp',
        path: 'AGENTS.md',
        content: 'See .agentsmesh/skills/api-gen/SKILL.md.',
        status: 'created',
      },
      {
        target: 'amp',
        path: '.agents/skills/api-gen/SKILL.md',
        content: '',
        status: 'created',
      },
    ];

    const rewritten = rewriteGeneratedReferences(
      results,
      makeCanonical(projectRoot),
      makeConfig(['amp']),
      projectRoot,
      'project',
      ['amp'],
    );

    expect(rewritten[0]!.content).not.toBe('See .agentsmesh/skills/api-gen/SKILL.md.');
    expect(rewritten[0]!.content).toContain('.agents/skills/api-gen/SKILL.md');
  });

  it('empty skipPaths set behaves like undefined (no-op skip)', () => {
    const projectRoot = '/proj';
    const results: GenerateResult[] = [
      {
        target: 'amp',
        path: 'AGENTS.md',
        content: 'See .agentsmesh/skills/api-gen/SKILL.md.',
        status: 'created',
      },
      {
        target: 'amp',
        path: '.agents/skills/api-gen/SKILL.md',
        content: '',
        status: 'created',
      },
    ];

    const rewritten = rewriteGeneratedReferences(
      results,
      makeCanonical(projectRoot),
      makeConfig(['amp']),
      projectRoot,
      'project',
      ['amp'],
      new Set<string>(),
    );

    expect(rewritten[0]!.content).toContain('.agents/skills/api-gen/SKILL.md');
  });

  it('skipPaths containing a path no result emits has no effect on rewriting', () => {
    const projectRoot = '/proj';
    const results: GenerateResult[] = [
      {
        target: 'amp',
        path: 'AGENTS.md',
        content: 'See .agentsmesh/skills/api-gen/SKILL.md.',
        status: 'created',
      },
      {
        target: 'amp',
        path: '.agents/skills/api-gen/SKILL.md',
        content: '',
        status: 'created',
      },
    ];

    const rewritten = rewriteGeneratedReferences(
      results,
      makeCanonical(projectRoot),
      makeConfig(['amp']),
      projectRoot,
      'project',
      ['amp'],
      new Set(['some/nonexistent/file.md']),
    );

    expect(rewritten[0]!.content).toContain('.agents/skills/api-gen/SKILL.md');
  });

  it('skipping a content path (e.g. skill SKILL.md) preserves its canonical refs but is not the intended use', () => {
    // Sanity check: skipPaths is path-agnostic at the rewriter level; the engine restricts
    // skipping to root-instruction paths via computeSharedRootInstructionPaths.
    const projectRoot = '/proj';
    const skillPath = '.agents/skills/api-gen/SKILL.md';
    const skillContent = 'Refer to ./references/checklist.md and .agentsmesh/rules/_root.md.';
    const results: GenerateResult[] = [
      {
        target: 'amp',
        path: skillPath,
        content: skillContent,
        status: 'created',
      },
    ];

    const rewritten = rewriteGeneratedReferences(
      results,
      makeCanonical(projectRoot),
      makeConfig(['amp']),
      projectRoot,
      'project',
      ['amp'],
      new Set([skillPath]),
    );

    // When skipped, content stays byte-identical (no rewriting performed).
    expect(rewritten[0]!.content).toBe(skillContent);
  });

  it('skipping AGENTS.md does not affect rewriting of skill content emitted by the same target', () => {
    const projectRoot = '/proj';
    const results: GenerateResult[] = [
      {
        target: 'amp',
        path: 'AGENTS.md',
        content: 'See .agentsmesh/skills/api-gen/SKILL.md.',
        status: 'created',
      },
      {
        target: 'amp',
        path: '.agents/skills/api-gen/SKILL.md',
        content: 'See .agentsmesh/rules/_root.md for context.',
        status: 'created',
      },
    ];

    const rewritten = rewriteGeneratedReferences(
      results,
      makeCanonical(projectRoot),
      makeConfig(['amp']),
      projectRoot,
      'project',
      ['amp'],
      new Set(['AGENTS.md']),
    );

    const agents = rewritten.find((r) => r.path === 'AGENTS.md');
    const skill = rewritten.find((r) => r.path === '.agents/skills/api-gen/SKILL.md');
    expect(agents?.content).toBe('See .agentsmesh/skills/api-gen/SKILL.md.');
    // The skill file is not skipped → its canonical reference is rewritten.
    expect(skill?.content).not.toBe('See .agentsmesh/rules/_root.md for context.');
  });
});
