import { describe, it, expect, afterEach } from 'vitest';
import { capabilitiesHandlers } from '../../../../src/mcp/handlers/capabilities.js';
import {
  registerTargetDescriptor,
  resetRegistry,
} from '../../../../src/targets/catalog/registry.js';
import type { TargetDescriptor } from '../../../../src/targets/catalog/target-descriptor.js';

function pluginDescriptor(id: string): TargetDescriptor {
  return {
    id,
    metadata: {
      displayName: id,
      category: 'cli',
      officialUrl: 'https://example.test/caps',
      shortDescription: `Capabilities-test plugin ${id}`,
    },
    generators: {
      name: id,
      generateRules: () => [],
      generateSkills: () => [],
      importFrom: async () => [],
    },
    capabilities: {
      rules: 'native',
      additionalRules: 'embedded',
      commands: 'none',
      agents: 'none',
      skills: 'partial',
      mcp: 'none',
      hooks: 'none',
      ignore: 'none',
      permissions: 'none',
    },
    emptyImportMessage: 'No plugin files.',
    lintRules: null,
    project: {
      paths: {
        rulePath: () => '.plugin/rules/root.md',
        commandPath: () => null,
        agentPath: () => null,
      },
    },
    buildImportPaths: async (refs) => {
      refs.set('.plugin/rules/root.md', '.agentsmesh/rules/_root.md');
    },
    detectionPaths: ['.plugin'],
  };
}

afterEach(() => resetRegistry());

describe('capabilitiesHandlers', () => {
  it('lists every builtin target with its nine feature cells', async () => {
    const all = await capabilitiesHandlers.list();
    expect(Object.keys(all).length).toBeGreaterThan(10);
    expect(Object.keys(all['claude-code']!).sort()).toEqual([
      'additionalRules',
      'agents',
      'commands',
      'hooks',
      'ignore',
      'mcp',
      'permissions',
      'rules',
      'skills',
    ]);
  });

  it('returns one target', async () => {
    const cc = await capabilitiesHandlers.get({ targetId: 'claude-code' });
    expect(cc.targetId).toBe('claude-code');
    expect(cc.capabilities.rules).toEqual({ level: 'native' });
  });

  it('throws NOT_FOUND for unknown', async () => {
    await expect(capabilitiesHandlers.get({ targetId: 'nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('includes a plugin descriptor registered after startup', async () => {
    registerTargetDescriptor(pluginDescriptor('plugin-caps'));
    const all = await capabilitiesHandlers.list();
    expect(all['plugin-caps']).toEqual({
      rules: { level: 'native' },
      additionalRules: { level: 'embedded' },
      commands: { level: 'none' },
      agents: { level: 'none' },
      skills: { level: 'partial' },
      mcp: { level: 'none' },
      hooks: { level: 'none' },
      ignore: { level: 'none' },
      permissions: { level: 'none' },
    });
    const one = await capabilitiesHandlers.get({ targetId: 'plugin-caps' });
    expect(one.capabilities.skills).toEqual({ level: 'partial' });
  });

  it('forgets a plugin once the registry is reset', async () => {
    registerTargetDescriptor(pluginDescriptor('plugin-gone'));
    resetRegistry();
    await expect(capabilitiesHandlers.get({ targetId: 'plugin-gone' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
