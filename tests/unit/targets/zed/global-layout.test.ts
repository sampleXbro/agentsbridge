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

  it('does not declare sharedArtifacts', () => {
    expect(descriptor.sharedArtifacts).toBeUndefined();
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

  it('preserves MCP server configuration in global mode', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        mcp: {
          mcpServers: {
            'my-server': { type: 'stdio', command: 'node', args: ['server.js'], env: {} },
          },
        },
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const settings = results.find((r) => r.target === 'zed' && r.path === ZED_GLOBAL_SETTINGS_FILE);
    expect(settings).toBeDefined();
    expect(settings!.content).toContain('my-server');
    expect(settings!.content).toContain('context_servers');
  });
});
