/**
 * Regressions found by adversarial review of the ignore -> permission mapping.
 *
 * Ignore rules and canonical permissions share one `permission` key in opencode.json,
 * which creates two failure modes the original implementation missed:
 *   D2 — a blanket action folded into the `{"*": ...}` catch-all was silently dropped
 *        on re-import, because the importer only read string values.
 *   D3 — emitting ignore alone replaced the whole `permission` key, wiping tool rules
 *        a user had written by hand.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from '../../../../src/core/generate/engine.js';
import { importFromOpenCode } from '../../../../src/targets/opencode/importer.js';
import { OPENCODE_CONFIG_FILE } from '../../../../src/targets/opencode/constants.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

function tempRoot(): string {
  dir = mkdtempSync(join(tmpdir(), 'am-oc-perm-'));
  return dir;
}

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

/** `generate()` returns results; writing to disk is the CLI layer's job. */
async function generatedConfig(
  root: string,
  canonical: CanonicalFiles,
): Promise<Record<string, unknown>> {
  const results = await generate({
    config: { version: 1, targets: ['opencode'], features: ['ignore'] } as never,
    canonical,
    projectRoot: root,
  });
  const config = results.find((r) => r.path === OPENCODE_CONFIG_FILE);
  if (!config) throw new Error('opencode.json was not generated');
  return JSON.parse(config.content) as Record<string, unknown>;
}

describe('opencode permission key: hand-written tool rules survive ignore emission (D3)', () => {
  it('keeps a user rule for a tool agentsmesh does not manage', async () => {
    const root = tempRoot();
    writeFileSync(
      join(root, OPENCODE_CONFIG_FILE),
      JSON.stringify({ model: 'anthropic/claude', permission: { bash: 'ask' } }, null, 2),
    );

    const config = await generatedConfig(root, makeCanonical({ ignore: ['.env', 'dist/'] }));
    const permission = config.permission as Record<string, unknown>;
    // The generated read/edit deny rules must not evict the user's bash rule.
    expect(permission.bash).toBe('ask');
    expect(permission.read).toBeDefined();
    expect(permission.edit).toBeDefined();
    expect(config.model).toBe('anthropic/claude');
  });

  it('lets a regenerated tool rule win over the previous value for that same tool', async () => {
    const root = tempRoot();
    writeFileSync(
      join(root, OPENCODE_CONFIG_FILE),
      JSON.stringify({ permission: { read: 'deny', bash: 'ask' } }, null, 2),
    );

    const config = await generatedConfig(root, makeCanonical({ ignore: ['.env'] }));
    const permission = config.permission as Record<string, unknown>;
    expect(typeof permission.read).toBe('object');
    expect(permission.bash).toBe('ask');
  });
});

describe('opencode permission import: object-form rules keep their blanket action (D2)', () => {
  it('reads the "*" catch-all as the tool-level permission', async () => {
    const root = tempRoot();
    mkdirSync(join(root, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(root, OPENCODE_CONFIG_FILE),
      JSON.stringify(
        {
          permission: {
            read: { '*': 'allow', '*.env': 'deny' },
            edit: { '*': 'ask', '*secret*': 'deny' },
            bash: 'deny',
          },
        },
        null,
        2,
      ),
    );

    await importFromOpenCode(root, { scope: 'project' });

    const yaml = readFileSync(join(root, '.agentsmesh', 'permissions.yaml'), 'utf-8');
    expect(yaml).toContain('read');
    expect(yaml).toContain('edit');
    expect(yaml).toContain('bash');
    // read's blanket is allow, edit's is ask, bash is a plain deny string.
    expect(/allow:[\s\S]*- read/.test(yaml)).toBe(true);
    expect(/ask:[\s\S]*- edit/.test(yaml)).toBe(true);
    expect(/deny:[\s\S]*- bash/.test(yaml)).toBe(true);
  });

  it('does not invent a permission when the object carries only ignore deny globs', async () => {
    const root = tempRoot();
    mkdirSync(join(root, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(root, OPENCODE_CONFIG_FILE),
      JSON.stringify({ permission: { read: { '*.env': 'deny' } } }, null, 2),
    );

    await importFromOpenCode(root, { scope: 'project' });

    // No `"*"` blanket means the tool itself carries no canonical permission, so no
    // permissions file is written at all — those globs belong to the ignore feature,
    // which imports them separately into `.agentsmesh/ignore`.
    expect(existsSync(join(root, '.agentsmesh', 'permissions.yaml'))).toBe(false);
    expect(existsSync(join(root, '.agentsmesh', 'ignore'))).toBe(true);
  });
});
