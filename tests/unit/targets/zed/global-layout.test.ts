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

  it('globalSupport.capabilities differ from project capabilities only for permissions', () => {
    expect(descriptor.globalSupport!.capabilities.rules).toBe('native');
    expect(descriptor.globalSupport!.capabilities.additionalRules).toBe('embedded');
    expect(descriptor.globalSupport!.capabilities.commands).toBe('embedded');
    expect(descriptor.globalSupport!.capabilities.skills).toBe('native');
    expect(descriptor.globalSupport!.capabilities.mcp).toBe('native');
    expect(descriptor.globalSupport!.capabilities.ignore).toBe('embedded');
    // agent.tool_permissions is a user-settings field; project scope discards it.
    expect(descriptor.globalSupport!.capabilities.permissions).toBe('native');
    expect(descriptor.capabilities.permissions).toBe('none');
  });

  it('global hooks capability is none — Zed has no lifecycle hook system', () => {
    expect(descriptor.globalSupport!.capabilities.hooks).toBe('none');
  });

  it('project hooks capability is none — Zed has no lifecycle hook system', () => {
    expect(descriptor.capabilities.hooks).toBe('none');
  });

  it('descriptor.lint has no hooks entry — hooks=none defers to silent-drop-guard', () => {
    expect((descriptor.lint as Record<string, unknown>)['hooks']).toBeUndefined();
  });

  it('global layout has a skillDir for ~/.agents/skills/', () => {
    expect(descriptor.globalSupport!.layout.skillDir).toBe('.agents/skills');
  });

  it('global layout managedOutputs.dirs includes .agents/skills', () => {
    expect(descriptor.globalSupport!.layout.managedOutputs.dirs).toContain('.agents/skills');
  });

  it('detects only Zed-specific config paths, never the shared skills dir', () => {
    expect([...descriptor.globalSupport!.detectionPaths]).toEqual([
      '.config/zed/AGENTS.md',
      ZED_GLOBAL_SETTINGS_FILE,
    ]);
    expect(descriptor.globalSupport!.detectionPaths).not.toContain('.agents/skills');
    expect(descriptor.detectionPaths).not.toContain('.agents/skills');
  });

  it('project capabilities have native rules and mcp', () => {
    expect(descriptor.capabilities.rules).toBe('native');
    expect(descriptor.capabilities.additionalRules).toBe('embedded');
    expect(descriptor.capabilities.mcp).toBe('native');
  });

  it('declares the commands-as-skills conversion, the only command surface Zed has', () => {
    expect(descriptor.supportsConversion).toEqual({ commands: true });
  });

  it('declares sharedArtifacts as consumer for .agents/skills/', () => {
    expect(descriptor.sharedArtifacts).toEqual({ '.agents/skills/': 'consumer' });
  });

  it('project capabilities have native skills', () => {
    expect(descriptor.capabilities.skills).toBe('native');
  });

  it('global capabilities keep skills as native', () => {
    expect(descriptor.globalSupport!.capabilities.skills).toBe('native');
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
