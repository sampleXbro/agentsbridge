import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  findConfigPath,
  loadConfigFromDir,
  loadConfigFromExactDir,
} from '../../../src/config/core/loader.js';
import { logger } from '../../../src/utils/output/logger.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-cov-loader-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('loader — branch coverage', () => {
  it('ignores agentsmesh.local.yaml that is not an object', async () => {
    writeFileSync(join(dir, 'agentsmesh.yaml'), 'version: 1');
    writeFileSync(join(dir, 'agentsmesh.local.yaml'), '- list-not-object');
    const result = await loadConfigFromDir(dir);
    // not an object → ignored, project config is used
    expect(result.config.version).toBe(1);
  });

  it('skips empty arrays for targets/features in local config', async () => {
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]',
    );
    writeFileSync(join(dir, 'agentsmesh.local.yaml'), 'targets: []\nfeatures: []');
    const result = await loadConfigFromDir(dir);
    expect(result.config.targets).toEqual(['claude-code']);
    expect(result.config.features).toEqual(['rules']);
  });

  it('skips null/undefined values during deep merge', async () => {
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      `version: 1
overrides:
  claude-code:
    extra_rules: ["rules/shared/*.md"]
`,
    );
    writeFileSync(
      join(dir, 'agentsmesh.local.yaml'),
      `overrides:
  claude-code:
    model: ~
`,
    );
    const result = await loadConfigFromDir(dir);
    // null values are skipped, so original extra_rules is preserved
    expect(result.config.overrides?.['claude-code']).toEqual({
      extra_rules: ['rules/shared/*.md'],
    });
  });

  it('replaces array values rather than deep-merging', async () => {
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      `version: 1
overrides:
  claude-code:
    extra_rules: ["a"]
`,
    );
    writeFileSync(
      join(dir, 'agentsmesh.local.yaml'),
      `overrides:
  claude-code:
    extra_rules: ["b"]
`,
    );
    const result = await loadConfigFromDir(dir);
    expect(result.config.overrides?.['claude-code']?.extra_rules).toEqual(['b']);
  });

  it('throws when no config exists at start dir or any parent', async () => {
    await expect(findConfigPath(dir)).resolves.toBeNull();
  });

  it('loadConfigFromExactDir returns project config when local file missing', async () => {
    writeFileSync(join(dir, 'agentsmesh.yaml'), 'version: 1');
    const result = await loadConfigFromExactDir(dir);
    expect(result.config.version).toBe(1);
  });

  it('logs warning when local conversions are an array (not an object)', async () => {
    writeFileSync(join(dir, 'agentsmesh.yaml'), 'version: 1');
    writeFileSync(join(dir, 'agentsmesh.local.yaml'), 'conversions: [bad]');
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      const result = await loadConfigFromDir(dir);
      expect(result.config.version).toBe(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('handles local extends as not-array (skipped)', async () => {
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      `version: 1
extends:
  - name: a
    source: ./shared/
    features: [rules]
`,
    );
    writeFileSync(join(dir, 'agentsmesh.local.yaml'), 'extends: ~');
    const result = await loadConfigFromDir(dir);
    expect(result.config.extends).toHaveLength(1);
  });

  it('handles local conversions absent gracefully', async () => {
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      `version: 1
conversions:
  commands_to_skills:
    codex-cli: true
`,
    );
    writeFileSync(join(dir, 'agentsmesh.local.yaml'), 'targets: [claude-code]');
    const result = await loadConfigFromDir(dir);
    expect(result.config.conversions?.commands_to_skills?.['codex-cli']).toBe(true);
    expect(result.config.targets).toEqual(['claude-code']);
  });
});
