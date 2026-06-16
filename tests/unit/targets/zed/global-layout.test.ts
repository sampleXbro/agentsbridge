import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  ZED_SETTINGS_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/zed/constants.js';

describe('zed global layout', () => {
  const descriptor = getBuiltinTargetDefinition('zed')!;
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms .zed/settings.json to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(ZED_SETTINGS_FILE)).toBe(ZED_GLOBAL_SETTINGS_FILE);
  });

  it('rewriteGeneratedPath passes through unknown paths', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite('some/other/file.md')).toBe('some/other/file.md');
  });

  it('globalSupport.capabilities differs from project capabilities', () => {
    expect(descriptor.globalSupport!.capabilities.rules).toBe('none');
    expect(descriptor.globalSupport!.capabilities.mcp).toBe('native');
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths).toHaveLength(1);
    expect(descriptor.globalSupport!.detectionPaths).toContain(ZED_GLOBAL_SETTINGS_FILE);
  });

  it('project capabilities have native rules and mcp', () => {
    expect(descriptor.capabilities.rules).toBe('native');
    expect(descriptor.capabilities.additionalRules).toBe('embedded');
    expect(descriptor.capabilities.mcp).toBe('native');
  });

  it('does not declare supportsConversion', () => {
    expect(descriptor.supportsConversion).toBeUndefined();
  });

  it('declares sharedArtifacts as consumer for .agents/skills/', () => {
    expect(descriptor.sharedArtifacts).toEqual({ '.agents/skills/': 'consumer' });
  });

  it('project capabilities have native skills', () => {
    expect(descriptor.capabilities.skills).toBe('native');
  });

  it('global capabilities keep skills as none', () => {
    expect(descriptor.globalSupport!.capabilities.skills).toBe('none');
  });
});

describe('zed global MCP content preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-zed-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['zed'],
      features: ['mcp'],
      extends: [],
      overrides: {},
      collaboration: { strategy: 'merge', lock_features: [] },
    } as ValidatedConfig;
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

  it('preserves MCP content in global mode (written to .config/zed/settings.json with context_servers key)', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        mcp: {
          mcpServers: {
            'test-server': { type: 'stdio', command: 'npx', args: ['-y', '@test/mcp'], env: {} },
          },
        },
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const mcpFile = results.find((r) => r.target === 'zed' && r.path === ZED_GLOBAL_SETTINGS_FILE);
    expect(mcpFile).toBeDefined();
    const parsed = JSON.parse(mcpFile!.content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('context_servers');
    const servers = parsed.context_servers as Record<string, unknown>;
    expect(servers).toHaveProperty('test-server');
    const server = servers['test-server'] as Record<string, unknown>;
    expect(server.command).toBe('npx');
    expect(server.args).toEqual(['-y', '@test/mcp']);
  });
});
