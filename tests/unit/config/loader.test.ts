import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findConfigPath, loadConfig, loadConfigFromDir } from '../../../src/config/core/loader.js';
import { logger } from '../../../src/utils/output/logger.js';

const TEST_ROOT = join(tmpdir(), 'agentsmesh-config-test');

beforeEach(() => mkdirSync(TEST_ROOT, { recursive: true }));
afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

describe('findConfigPath', () => {
  it('returns path when agentsmesh.yaml exists in start dir', async () => {
    writeFileSync(join(TEST_ROOT, 'agentsmesh.yaml'), 'version: 1');
    const result = await findConfigPath(TEST_ROOT);
    expect(result).toBe(join(TEST_ROOT, 'agentsmesh.yaml'));
  });

  it('returns path when agentsmesh.yaml exists in parent dir', async () => {
    const subDir = join(TEST_ROOT, 'deep', 'nested', 'project');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(TEST_ROOT, 'agentsmesh.yaml'), 'version: 1');
    const result = await findConfigPath(subDir);
    expect(result).toBe(join(TEST_ROOT, 'agentsmesh.yaml'));
  });

  it('returns null when no config found', async () => {
    const result = await findConfigPath(TEST_ROOT);
    expect(result).toBeNull();
  });

  it('returns null when start dir has no config and no parents', async () => {
    const orphan = join(tmpdir(), 'agentsmesh-orphan-' + Date.now());
    mkdirSync(orphan, { recursive: true });
    try {
      const result = await findConfigPath(orphan);
      expect(result).toBeNull();
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });
});

describe('loadConfig', () => {
  it('loads and validates minimal config', async () => {
    const path = join(TEST_ROOT, 'agentsmesh.yaml');
    writeFileSync(path, 'version: 1');
    const config = await loadConfig(path);
    expect(config.version).toBe(1);
    expect(config.targets).toContain('claude-code');
    expect(config.features).toContain('rules');
  });

  it('loads full config', async () => {
    const path = join(TEST_ROOT, 'agentsmesh.yaml');
    writeFileSync(
      path,
      `
version: 1
targets: [claude-code, cursor]
features: [rules, mcp]
extends:
  - name: base
    source: ./shared/
    features: [rules]
overrides:
  cursor:
    extra_rules: [rules/cursor/*.md]
conversions:
  commands_to_skills:
    codex-cli: false
  agents_to_skills:
    gemini-cli: false
collaboration:
  strategy: merge
  lock_features: [mcp]
`,
    );
    const config = await loadConfig(path);
    expect(config.targets).toEqual(['claude-code', 'cursor']);
    expect(config.features).toEqual(['rules', 'mcp']);
    expect(config.extends).toHaveLength(1);
    expect(config.extends[0]?.name).toBe('base');
    expect(config.overrides?.cursor?.extra_rules).toEqual(['rules/cursor/*.md']);
    expect(config.conversions?.commands_to_skills?.['codex-cli']).toBe(false);
    expect(config.conversions?.agents_to_skills?.['gemini-cli']).toBe(false);
  });

  it('throws on invalid config', async () => {
    const path = join(TEST_ROOT, 'agentsmesh.yaml');
    writeFileSync(path, 'version: 2');
    await expect(loadConfig(path)).rejects.toThrow(/invalid|version/i);
  });

  it('throws on missing file', async () => {
    await expect(loadConfig(join(TEST_ROOT, 'nope.yaml'))).rejects.toThrow();
  });
});

describe('loadConfigFromDir', () => {
  it('finds and loads config from start dir', async () => {
    writeFileSync(join(TEST_ROOT, 'agentsmesh.yaml'), 'version: 1');
    const result = await loadConfigFromDir(TEST_ROOT);
    expect(result.config.version).toBe(1);
    expect(result.configDir).toBe(TEST_ROOT);
  });

  it('merges local overrides on top of main config', async () => {
    writeFileSync(
      join(TEST_ROOT, 'agentsmesh.yaml'),
      `
version: 1
targets: [claude-code, cursor]
`,
    );
    writeFileSync(
      join(TEST_ROOT, 'agentsmesh.local.yaml'),
      `
targets: [claude-code]
overrides:
  claude-code:
    model: opus
`,
    );
    const result = await loadConfigFromDir(TEST_ROOT);
    expect(result.config.targets).toEqual(['claude-code']);
    expect(result.config.overrides?.['claude-code']).toEqual({ model: 'opus' });
  });

  it('throws when no config found', async () => {
    await expect(loadConfigFromDir(TEST_ROOT)).rejects.toThrow(/agentsmesh\.yaml not found/i);
  });

  it('appends local extends after project extends (merge strategy)', async () => {
    writeFileSync(
      join(TEST_ROOT, 'agentsmesh.yaml'),
      `
version: 1
extends:
  - name: company-base
    source: ./shared/
    features: [rules]
`,
    );
    writeFileSync(
      join(TEST_ROOT, 'agentsmesh.local.yaml'),
      `
extends:
  - name: personal
    source: ./my-rules/
    features: [rules, mcp]
`,
    );
    const result = await loadConfigFromDir(TEST_ROOT);
    expect(result.config.extends).toHaveLength(2);
    expect(result.config.extends[0]?.name).toBe('company-base');
    expect(result.config.extends[1]?.name).toBe('personal');
  });

  it('deep merges overrides (local adds to project overrides)', async () => {
    writeFileSync(
      join(TEST_ROOT, 'agentsmesh.yaml'),
      `
version: 1
overrides:
  claude-code:
    extra_rules: [rules/shared/*.md]
`,
    );
    writeFileSync(
      join(TEST_ROOT, 'agentsmesh.local.yaml'),
      `
overrides:
  claude-code:
    model: opus
`,
    );
    const result = await loadConfigFromDir(TEST_ROOT);
    expect(result.config.overrides?.['claude-code']).toEqual({
      extra_rules: ['rules/shared/*.md'],
      model: 'opus',
    });
  });

  it('deep merges local conversion overrides', async () => {
    writeFileSync(
      join(TEST_ROOT, 'agentsmesh.yaml'),
      `
version: 1
conversions:
  commands_to_skills:
    codex-cli: true
  agents_to_skills:
    gemini-cli: true
    cline: true
`,
    );
    writeFileSync(
      join(TEST_ROOT, 'agentsmesh.local.yaml'),
      `
conversions:
  agents_to_skills:
    cline: false
`,
    );
    const result = await loadConfigFromDir(TEST_ROOT);
    expect(result.config.conversions?.commands_to_skills?.['codex-cli']).toBe(true);
    expect(result.config.conversions?.agents_to_skills?.['gemini-cli']).toBe(true);
    expect(result.config.conversions?.agents_to_skills?.cline).toBe(false);
  });

  it('local features replace project features', async () => {
    writeFileSync(join(TEST_ROOT, 'agentsmesh.yaml'), 'version: 1\nfeatures: [rules, mcp, hooks]');
    writeFileSync(join(TEST_ROOT, 'agentsmesh.local.yaml'), 'features: [rules]');
    const result = await loadConfigFromDir(TEST_ROOT);
    expect(result.config.features).toEqual(['rules']);
  });

  it('warns when local config is invalid and falls back to project config', async () => {
    writeFileSync(join(TEST_ROOT, 'agentsmesh.yaml'), 'version: 1\ntargets: [cursor]');
    writeFileSync(join(TEST_ROOT, 'agentsmesh.local.yaml'), 'version: 2\ntargets: [invalid]');
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    try {
      const result = await loadConfigFromDir(TEST_ROOT);
      expect(result.config.targets).toEqual(['cursor']);
      expect(result.config.overrides).toEqual({});
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(join(TEST_ROOT, 'agentsmesh.local.yaml')),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
