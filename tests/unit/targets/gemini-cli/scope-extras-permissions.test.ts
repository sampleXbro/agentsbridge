/**
 * Gemini CLI permissions are global-only.
 *
 * Upstream the Workspace policy tier (`<repo>/.gemini/policies/`) is documented as
 * non-functional, so emitting the file at project scope writes a policy the tool
 * never reads. Permissions must therefore be emitted from `globalSupport.scopeExtras`
 * (gated to global scope) and warned about at project scope.
 *
 * Source: https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/policy-engine.md
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { descriptor } from '../../../../src/targets/gemini-cli/index.js';
import { generateGeminiScopeExtras } from '../../../../src/targets/gemini-cli/scope-extras.js';
import { lintPermissions } from '../../../../src/targets/gemini-cli/lint.js';
import { GEMINI_GLOBAL_POLICIES_FILE } from '../../../../src/targets/gemini-cli/constants.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

const ALL_FEATURES: ReadonlySet<string> = new Set(['permissions']);

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

function tempRoot(): string {
  dir = mkdtempSync(join(tmpdir(), 'am-gemini-scope-'));
  return dir;
}

describe('gemini-cli permissions are global-only', () => {
  it('exposes no plain generatePermissions generator (would leak into project scope)', () => {
    expect(descriptor.generators.generatePermissions).toBeUndefined();
  });

  it('emits nothing at project scope even when canonical permissions exist', async () => {
    const canonical = makeCanonical({ permissions: { allow: ['Read'], deny: ['WebFetch'] } });
    const results = await generateGeminiScopeExtras(canonical, tempRoot(), 'project', ALL_FEATURES);
    expect(results).toEqual([]);
  });

  it('emits the user-tier policies file at global scope', async () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Read', 'Bash(curl:*)'], deny: ['WebFetch'] },
    });
    const results = await generateGeminiScopeExtras(canonical, tempRoot(), 'global', ALL_FEATURES);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(GEMINI_GLOBAL_POLICIES_FILE);
    expect(results[0]!.target).toBe('gemini-cli');
    expect(results[0]!.status).toBe('created');
    expect(results[0]!.content).toContain('toolName = "read_file"');
    expect(results[0]!.content).toContain('commandPrefix = "curl"');
    expect(results[0]!.content).toContain('decision = "deny"');
  });

  it('emits nothing at global scope when the permissions feature is disabled', async () => {
    const canonical = makeCanonical({ permissions: { allow: ['Read'], deny: [] } });
    const results = await generateGeminiScopeExtras(canonical, tempRoot(), 'global', new Set());
    expect(results).toEqual([]);
  });

  it('reports unchanged then updated against an existing policies file', async () => {
    const canonical = makeCanonical({ permissions: { allow: ['Read'], deny: [] } });
    const root = tempRoot();
    const first = await generateGeminiScopeExtras(canonical, root, 'global', ALL_FEATURES);
    mkdirSync(join(root, '.gemini', 'policies'), { recursive: true });
    writeFileSync(join(root, GEMINI_GLOBAL_POLICIES_FILE), first[0]!.content);

    const second = await generateGeminiScopeExtras(canonical, root, 'global', ALL_FEATURES);
    expect(second[0]!.status).toBe('unchanged');
    expect(second[0]!.currentContent).toBe(first[0]!.content);

    const changed = await generateGeminiScopeExtras(
      makeCanonical({ permissions: { allow: ['Read', 'Grep'], deny: [] } }),
      root,
      'global',
      ALL_FEATURES,
    );
    expect(changed[0]!.status).toBe('updated');
  });

  it('emits nothing at global scope when canonical permissions are empty', async () => {
    const results = await generateGeminiScopeExtras(
      makeCanonical({ permissions: { allow: [], deny: [] } }),
      tempRoot(),
      'global',
      ALL_FEATURES,
    );
    expect(results).toEqual([]);
  });
});

describe('gemini-cli lintPermissions', () => {
  it('warns at project scope that workspace-tier policies are not loaded', () => {
    const diagnostics = lintPermissions(
      makeCanonical({ permissions: { allow: ['Read'], deny: [] } }),
      { scope: 'project' },
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.level).toBe('warning');
    expect(diagnostics[0]!.target).toBe('gemini-cli');
    expect(diagnostics[0]!.file).toBe('.agentsmesh/permissions.yaml');
    expect(diagnostics[0]!.message).toContain('~/.gemini/policies');
  });

  it('does not warn at global scope for allow/deny, which map to policy rules', () => {
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: ['Read'], deny: [] } }), {
        scope: 'global',
      }),
    ).toEqual([]);
  });

  it('warns at global scope that ask entries are not projected', () => {
    const diagnostics = lintPermissions(
      makeCanonical({ permissions: { allow: ['Read'], deny: [], ask: ['Bash(rm:*)'] } }),
      { scope: 'global' },
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('ask entries are not projected');
  });

  it('does not warn when canonical permissions are absent or empty', () => {
    expect(lintPermissions(makeCanonical(), { scope: 'project' })).toEqual([]);
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: [], deny: [] } }), {
        scope: 'project',
      }),
    ).toEqual([]);
  });
});
