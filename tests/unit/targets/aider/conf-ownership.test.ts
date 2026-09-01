/**
 * Regressions for `.aider.conf.yml` ownership.
 *
 * `.aider.conf.yml` is the user's own aider config (model, API keys, editor
 * settings). agentsmesh writes a few keys into it, so every write has to be
 * key-scoped AND ownership-scoped: it may never delete a key the user wrote.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import { generate } from '../../../../src/core/generate/engine.js';
import { AIDER_CONF_FILE } from '../../../../src/targets/aider/constants.js';

function canonicalFiles(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

const ROOT_RULE = {
  source: '/proj/.agentsmesh/rules/_root.md',
  root: true,
  targets: [] as string[],
  description: '',
  globs: [] as string[],
  body: 'Use TDD.',
};

const CONFIG: ValidatedConfig = {
  version: 1,
  targets: ['aider'],
  features: ['rules', 'hooks'],
  extends: [],
  overrides: {},
  collaboration: { strategy: 'merge', lock_features: [] },
} as ValidatedConfig;

function makeProject(confContent: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'aider-conf-'));
  mkdirSync(join(dir, '.agentsmesh'), { recursive: true });
  if (confContent !== null) writeFileSync(join(dir, AIDER_CONF_FILE), confContent);
  return dir;
}

async function runGenerateInto(
  dir: string,
  canonical: CanonicalFiles,
  scope: 'project' | 'global' = 'project',
): Promise<string | null> {
  const results = await generate({ config: CONFIG, canonical, projectRoot: dir, scope });
  for (const result of results) {
    if (result.status === 'created' || result.status === 'updated') {
      writeFileSync(join(dir, result.path), result.content);
    }
  }
  const path = join(dir, AIDER_CONF_FILE);
  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
}

describe('.aider.conf.yml is never overwritten wholesale', () => {
  it('keeps the model, API key and comments when rules and hooks both write it', async () => {
    const existing = [
      '# personal aider config',
      'model: gpt-4o',
      'openai-api-key: sk-test-key',
      '',
    ].join('\n');
    const dir = makeProject(existing);
    try {
      const written = await runGenerateInto(
        dir,
        canonicalFiles({
          rules: [ROOT_RULE],
          hooks: { PostToolUse: [{ matcher: 'Write|Edit', command: 'ruff check' }] },
        }),
      );
      expect(written).not.toBeNull();
      expect(written).toContain('# personal aider config');
      const parsed = parseYaml(written!) as Record<string, unknown>;
      expect(parsed.model).toBe('gpt-4o');
      expect(parsed['openai-api-key']).toBe('sk-test-key');
      expect(parsed.read).toEqual(['CONVENTIONS.md']);
      expect(parsed['lint-cmd']).toEqual(['ruff check']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps hook keys the user wrote and never empties the file', async () => {
    const dir = makeProject('auto-lint: false\nlint-cmd:\n  - ruff check --fix\n');
    try {
      const written = await runGenerateInto(
        dir,
        canonicalFiles({ hooks: { PreToolUse: [{ matcher: '*', command: 'guard.sh' }] } }),
      );
      expect(written).not.toBe('');
      const parsed = parseYaml(written ?? '') as Record<string, unknown>;
      expect(parsed['auto-lint']).toBe(false);
      expect(parsed['lint-cmd']).toEqual(['ruff check --fix']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('takes over a lint-cmd canonical also defines, and marks it as generated', async () => {
    const dir = makeProject('lint-cmd:\n  - ruff check --fix\n');
    try {
      const written = await runGenerateInto(
        dir,
        canonicalFiles({
          hooks: { PostToolUse: [{ matcher: 'Write|Edit', command: 'ruff check' }] },
        }),
      );
      // Canonical is the source of truth for a key it defines, so the value is
      // replaced — but the key is marked, so the next run knows it is ours.
      expect(written).toContain('# agentsmesh:');
      expect((parseYaml(written!) as Record<string, unknown>)['lint-cmd']).toEqual(['ruff check']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not flip a deliberate auto-lint: false when it writes lint-cmd', async () => {
    const dir = makeProject('auto-lint: false\n');
    try {
      const written = await runGenerateInto(
        dir,
        canonicalFiles({
          hooks: { PostToolUse: [{ matcher: 'Write|Edit', command: 'ruff check' }] },
        }),
      );
      const parsed = parseYaml(written ?? '') as Record<string, unknown>;
      expect(parsed['auto-lint']).toBe(false);
      expect(parsed['lint-cmd']).toEqual(['ruff check']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('clears the hook keys it wrote once the canonical hook is revoked', async () => {
    const dir = makeProject(null);
    try {
      const first = await runGenerateInto(
        dir,
        canonicalFiles({
          rules: [ROOT_RULE],
          hooks: { PostToolUse: [{ matcher: 'Write|Edit', command: 'ruff check' }] },
        }),
      );
      expect((parseYaml(first!) as Record<string, unknown>)['lint-cmd']).toEqual(['ruff check']);

      const second = await runGenerateInto(dir, canonicalFiles({ rules: [ROOT_RULE], hooks: {} }));
      const parsed = parseYaml(second!) as Record<string, unknown>;
      expect(parsed['lint-cmd']).toBeUndefined();
      expect(parsed['auto-lint']).toBeUndefined();
      expect(parsed.read).toEqual(['CONVENTIONS.md']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('never creates an empty config file when no hook maps to aider', async () => {
    const dir = makeProject(null);
    try {
      const written = await runGenerateInto(
        dir,
        canonicalFiles({ hooks: { PreToolUse: [{ matcher: '*', command: 'guard.sh' }] } }),
      );
      expect(written).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes then revokes the hook keys in global scope without a stray file', async () => {
    const dir = makeProject(null);
    try {
      const none = await runGenerateInto(dir, canonicalFiles({ rules: [ROOT_RULE] }), 'global');
      expect(none).toBeNull();

      const first = await runGenerateInto(
        dir,
        canonicalFiles({ hooks: { Notification: [{ matcher: '*', command: 'notify' }] } }),
        'global',
      );
      const parsed = parseYaml(first!) as Record<string, unknown>;
      expect(parsed['notifications-command']).toBe('notify');
      expect(parsed.read).toBeUndefined();

      const second = await runGenerateInto(dir, canonicalFiles({ hooks: {} }), 'global');
      expect(second).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
