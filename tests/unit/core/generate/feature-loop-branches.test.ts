import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  computeStatus,
  emitGeneratedOutput,
  featureContext,
  generateFeature,
  resolveGeneratedOutputPath,
} from '../../../../src/core/generate/feature-loop.js';
import type { CanonicalFiles, GenerateResult } from '../../../../src/core/types.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cov-fl-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function emptyCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('computeStatus', () => {
  it('returns created when existing is null', () => {
    expect(computeStatus(null, 'x')).toBe('created');
  });
  it('returns updated when existing differs', () => {
    expect(computeStatus('a', 'b')).toBe('updated');
  });
  it('returns unchanged when equal', () => {
    expect(computeStatus('a', 'a')).toBe('unchanged');
  });
});

describe('resolveGeneratedOutputPath — branches', () => {
  it('returns null for completely unknown target', () => {
    expect(resolveGeneratedOutputPath('not-a-real-target', 'foo.md', 'project')).toBeNull();
  });

  it('returns rewritten path for known builtin target (claude-code project)', () => {
    const out = resolveGeneratedOutputPath('claude-code', '.claude/CLAUDE.md', 'project');
    expect(typeof out).toBe('string');
  });
});

describe('emitGeneratedOutput', () => {
  it('returns null when target unresolvable and pushes nothing', async () => {
    const results: GenerateResult[] = [];
    const out = await emitGeneratedOutput(
      results,
      'unknown-target-xyz',
      { path: 'whatever.md', content: 'x' },
      projectRoot,
      'project',
    );
    expect(out).toBeNull();
    expect(results).toEqual([]);
  });

  it('replaces pending result for same target+path and uses mergeContent', async () => {
    // Pre-create file so existing != null path
    const path = '.claude/CLAUDE.md';
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    writeFileSync(join(projectRoot, path), 'OLD');

    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path,
        content: 'first-draft',
        status: 'created',
      },
    ];
    const resolved = await emitGeneratedOutput(
      results,
      'claude-code',
      { path, content: 'NEW' },
      projectRoot,
      'project',
      {
        mergeContent: (existing, pending, incoming) =>
          `${existing ?? ''}|pending=${pending?.content ?? ''}|incoming=${incoming}`,
      },
    );
    expect(resolved).toBeTruthy();
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toContain('OLD|pending=first-draft|incoming=NEW');
    expect(results[0]?.currentContent).toBe('OLD');
  });

  it('appends a new result when no pending result exists for the path', async () => {
    const results: GenerateResult[] = [];
    const resolved = await emitGeneratedOutput(
      results,
      'claude-code',
      { path: '.claude/CLAUDE.md', content: 'fresh' },
      projectRoot,
      'project',
    );
    expect(resolved).toBeTruthy();
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('created');
    expect(results[0]?.currentContent).toBeUndefined();
  });
});

describe('featureContext — branches', () => {
  it('returns level=none when target is unknown', () => {
    const ctx = featureContext('not-a-target', 'rules', 'project');
    expect(ctx.capability.level).toBe('none');
    expect(ctx.scope).toBe('project');
  });

  it('returns the actual capability for a known target', () => {
    const ctx = featureContext('claude-code', 'rules', 'project');
    expect(ctx.capability.level).not.toBe('none');
  });
});

describe('generateFeature — branches', () => {
  it('returns immediately when feature disabled', async () => {
    const results: GenerateResult[] = [];
    let called = false;
    await generateFeature(
      results,
      ['claude-code'],
      emptyCanonical(),
      projectRoot,
      false,
      'project',
      'rules',
      () => {
        called = true;
        return () => [];
      },
    );
    expect(called).toBe(false);
    expect(results).toEqual([]);
  });

  it('skips targets without a generator function', async () => {
    const results: GenerateResult[] = [];
    await generateFeature(
      results,
      ['claude-code'],
      emptyCanonical(),
      projectRoot,
      true,
      'project',
      'rules',
      () => undefined,
    );
    expect(results).toEqual([]);
  });

  it('skips emit when path resolves to null', async () => {
    const results: GenerateResult[] = [];
    await generateFeature(
      results,
      ['unknown-target'],
      emptyCanonical(),
      projectRoot,
      true,
      'project',
      'rules',
      () => () => [{ path: 'wherever.md', content: 'x' }],
    );
    expect(results).toEqual([]);
  });
});
