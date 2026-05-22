/**
 * Branch coverage for src/targets/continue/scope-extras.ts:
 * - computeStatus: existing===null → 'created' (line 9).
 * - computeStatus: existing!==content → 'updated' (line 10).
 * - computeStatus: equal → 'unchanged' (line 11).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateContinueScopeExtras } from '../../../../src/targets/continue/scope-extras.js';
import { CONTINUE_GLOBAL_AGENTS_MD } from '../../../../src/targets/continue/constants.js';
import type { CanonicalFiles, CanonicalRule } from '../../../../src/core/types.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-continue-extras-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function baseCanonical(): CanonicalFiles {
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

const rootRule: CanonicalRule = {
  source: '/x/_root.md',
  root: true,
  targets: [],
  description: '',
  globs: [],
  body: 'root body',
};

describe('generateContinueScopeExtras — branch coverage', () => {
  it('returns config-only outputs when scope is "project"', async () => {
    const out = await generateContinueScopeExtras(
      { ...baseCanonical(), rules: [rootRule] },
      projectRoot,
      'project',
      new Set(['rules']),
    );
    expect(out.find((r) => r.path === CONTINUE_GLOBAL_AGENTS_MD)).toBeUndefined();
  });

  it('returns config-only outputs when rules feature not enabled in global', async () => {
    const out = await generateContinueScopeExtras(
      { ...baseCanonical(), rules: [rootRule] },
      projectRoot,
      'global',
      new Set(),
    );
    expect(out.find((r) => r.path === CONTINUE_GLOBAL_AGENTS_MD)).toBeUndefined();
  });

  it('returns config-only outputs when no root rule present', async () => {
    const out = await generateContinueScopeExtras(
      baseCanonical(),
      projectRoot,
      'global',
      new Set(['rules']),
    );
    expect(out.find((r) => r.path === CONTINUE_GLOBAL_AGENTS_MD)).toBeUndefined();
  });

  it('emits AGENTS.md with status "created" when target file does not exist', async () => {
    const out = await generateContinueScopeExtras(
      { ...baseCanonical(), rules: [rootRule] },
      projectRoot,
      'global',
      new Set(['rules']),
    );
    const agentsMd = out.find((r) => r.path === CONTINUE_GLOBAL_AGENTS_MD);
    expect(agentsMd).toBeDefined();
    expect(agentsMd?.status).toBe('created');
  });

  it('emits AGENTS.md with status "unchanged" when content matches existing', async () => {
    mkdirSync(join(projectRoot, '.continue'), { recursive: true });
    writeFileSync(join(projectRoot, CONTINUE_GLOBAL_AGENTS_MD), 'root body');
    const out = await generateContinueScopeExtras(
      { ...baseCanonical(), rules: [rootRule] },
      projectRoot,
      'global',
      new Set(['rules']),
    );
    const agentsMd = out.find((r) => r.path === CONTINUE_GLOBAL_AGENTS_MD);
    expect(agentsMd?.status).toBe('unchanged');
  });

  it('emits AGENTS.md with status "updated" when existing content differs', async () => {
    mkdirSync(join(projectRoot, '.continue'), { recursive: true });
    writeFileSync(join(projectRoot, CONTINUE_GLOBAL_AGENTS_MD), 'older content');
    const out = await generateContinueScopeExtras(
      { ...baseCanonical(), rules: [rootRule] },
      projectRoot,
      'global',
      new Set(['rules']),
    );
    const agentsMd = out.find((r) => r.path === CONTINUE_GLOBAL_AGENTS_MD);
    expect(agentsMd?.status).toBe('updated');
  });
});
