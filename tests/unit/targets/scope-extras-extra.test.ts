import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateCopilotGlobalExtras } from '../../../src/targets/copilot/scope-extras.js';
import { generateContinueScopeExtras } from '../../../src/targets/continue/scope-extras.js';
import type { CanonicalFiles, CanonicalRule } from '../../../src/core/types.js';

function rules(rule?: Partial<CanonicalRule>): CanonicalRule[] {
  if (!rule) return [];
  return [
    {
      source: '.agentsmesh/rules/_root.md',
      root: false,
      targets: [],
      description: '',
      globs: [],
      body: '',
      ...rule,
    },
  ];
}

function makeCanonical(partial: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...partial,
  };
}

let projectRoot = '';
beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-scope-extras-'));
});
afterEach(() => {
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  projectRoot = '';
});

describe('generateCopilotGlobalExtras', () => {
  it('returns [] when scope=project', async () => {
    const out = await generateCopilotGlobalExtras(
      makeCanonical({ rules: rules({ root: true, body: 'B' }) }),
      projectRoot,
      'project',
      new Set(['rules']),
    );
    expect(out).toEqual([]);
  });

  it('returns [] when rules feature not enabled', async () => {
    const out = await generateCopilotGlobalExtras(
      makeCanonical({ rules: rules({ root: true, body: 'B' }) }),
      projectRoot,
      'global',
      new Set(['skills']),
    );
    expect(out).toEqual([]);
  });

  it('returns [] when no root rule exists', async () => {
    const out = await generateCopilotGlobalExtras(
      makeCanonical({ rules: rules({ root: false, body: 'B' }) }),
      projectRoot,
      'global',
      new Set(['rules']),
    );
    expect(out).toEqual([]);
  });

  it('emits AGENTS.md with status="created" when no existing file', async () => {
    const out = await generateCopilotGlobalExtras(
      makeCanonical({ rules: rules({ root: true, body: 'Body content' }) }),
      projectRoot,
      'global',
      new Set(['rules']),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.status).toBe('created');
    expect(out[0]!.content).toBe('Body content');
  });

  it('emits status="unchanged" when existing file has identical content', async () => {
    mkdirSync(join(projectRoot, '.copilot'), { recursive: true });
    writeFileSync(join(projectRoot, '.copilot/AGENTS.md'), 'B');
    const out = await generateCopilotGlobalExtras(
      makeCanonical({ rules: rules({ root: true, body: 'B' }) }),
      projectRoot,
      'global',
      new Set(['rules']),
    );
    expect(out[0]!.status).toBe('unchanged');
  });

  it('emits status="updated" when existing file differs', async () => {
    mkdirSync(join(projectRoot, '.copilot'), { recursive: true });
    writeFileSync(join(projectRoot, '.copilot/AGENTS.md'), 'old');
    const out = await generateCopilotGlobalExtras(
      makeCanonical({ rules: rules({ root: true, body: 'new' }) }),
      projectRoot,
      'global',
      new Set(['rules']),
    );
    expect(out[0]!.status).toBe('updated');
  });
});

describe('generateContinueScopeExtras', () => {
  it('returns config results only when scope=project', async () => {
    const out = await generateContinueScopeExtras(
      makeCanonical({ rules: rules({ root: true, body: 'B' }) }),
      projectRoot,
      'project',
      new Set(['rules']),
    );
    // Only config-related entries — no AGENTS.md mirror
    expect(out.every((r) => !r.path.endsWith('AGENTS.md'))).toBe(true);
  });

  it('returns config results when no root rule even in global scope', async () => {
    const out = await generateContinueScopeExtras(
      makeCanonical({ rules: [] }),
      projectRoot,
      'global',
      new Set(['rules']),
    );
    // Should not include AGENTS.md — no root rule
    expect(out.every((r) => !r.path.endsWith('AGENTS.md'))).toBe(true);
  });

  it('emits AGENTS.md mirror in global scope with rules feature', async () => {
    const out = await generateContinueScopeExtras(
      makeCanonical({ rules: rules({ root: true, body: 'Hello' }) }),
      projectRoot,
      'global',
      new Set(['rules']),
    );
    const mirror = out.find((r) => r.path.endsWith('AGENTS.md'));
    expect(mirror).toBeDefined();
    expect(mirror!.content).toBe('Hello');
    expect(mirror!.status).toBe('created');
  });
});
