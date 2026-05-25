/**
 * Branch coverage for src/public/engine.ts default-argument fallbacks:
 *   - importFrom: `opts.scope ?? 'project'` (line 60)
 *   - lint: `opts.targetFilter ? [...] : undefined` (line 155)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importFrom, lint } from '../../../src/public/engine.js';
import { TargetNotFoundError } from '../../../src/core/errors.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';

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

function minimalConfig(): ValidatedConfig {
  return {
    version: 1,
    targets: ['claude-code'],
    features: ['rules'],
    extends: [],
  } as unknown as ValidatedConfig;
}

describe('public/engine — default-argument branches', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'am-engine-defaults-'));
    mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('importFrom defaults scope to "project" when scope is omitted', async () => {
    const results = await importFrom('aider', { root });
    expect(Array.isArray(results)).toBe(true);
  });

  it('importFrom throws TargetNotFoundError when descriptor is missing', async () => {
    await expect(importFrom('not-a-real-target', { root })).rejects.toBeInstanceOf(
      TargetNotFoundError,
    );
  });

  it('lint() runs with no targetFilter (undefined branch)', async () => {
    // Write empty config so lint has something to read; use minimal canonical.
    writeFileSync(
      join(root, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    const result = await lint({
      config: minimalConfig(),
      canonical: emptyCanonical(),
      projectRoot: root,
    });
    expect(typeof result.hasErrors).toBe('boolean');
  });
});
