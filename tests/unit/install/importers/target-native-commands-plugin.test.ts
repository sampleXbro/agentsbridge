/**
 * Plugin-registered target descriptors with non-`.md` command mappers must
 * be enumerated by `readCommandsDirWithMappers` exactly like builtins.
 *
 * Regression for the install-paths-delegate-target-mappers refactor: the
 * initial implementation iterated `TARGET_IDS` (builtin-only), so a
 * plugin descriptor registered via `registerTargetDescriptor` was
 * invisible — the user's whole plugin-extension story for new command
 * formats would silently fall back to `.md`-only.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  registerTargetDescriptor,
  resetRegistry,
} from '../../../../src/targets/catalog/registry.js';
import {
  readAgentsDirWithMappers,
  readCommandsDirWithMappers,
  readRulesDirWithMappers,
} from '../../../../src/install/importers/target-native-commands.js';
import type {
  TargetDescriptor,
  TargetLayout,
} from '../../../../src/targets/catalog/target-descriptor.js';
import type { TargetGenerators } from '../../../../src/targets/catalog/target.interface.js';

const PLUGIN_ID = 'plugin-yaml-tool';
const ROOT = join(tmpdir(), 'am-target-native-commands-plugin');

const project: TargetLayout = {
  rootInstructionPath: `.${PLUGIN_ID}/rules/_root.md`,
  skillDir: `.${PLUGIN_ID}/skills`,
  rewriteGeneratedPath: (p) => p,
  paths: {
    rulePath: () => null,
    commandPath: () => null,
    agentPath: () => null,
  },
};

const pluginGenerators: TargetGenerators = {
  name: PLUGIN_ID,
  generateRules: () => [],
  generateCommands: () => [],
  generateAgents: () => [],
  importFrom: async () => [],
};

/**
 * Plugin descriptor that ships non-`.md` mappers for ALL three
 * directory-walked entity kinds. Proves the seam is symmetric — adding a
 * runtime plugin with custom rules/commands/agents formats lights them all
 * up on the install path without core changes.
 */
function makePluginDescriptor(): TargetDescriptor {
  const yamlMapper = (
    label: 'rule' | 'command' | 'agent',
  ): NonNullable<NonNullable<TargetDescriptor['importer']>['commands']>['map'] => {
    return ({ relativePath, content, destDir }) => {
      const name = relativePath.replace(/\.yaml$/i, '').replaceAll('/', '-');
      const description =
        (content.match(/^description:\s*(.+)$/m)?.[1] ?? '').trim() || `plugin ${label}`;
      return {
        destPath: join(destDir, `${name}.md`),
        content: `---\ndescription: ${description}\n---\n# ${name}\n\nFrom yaml plugin.\n`,
      };
    };
  };
  return {
    id: PLUGIN_ID,
    metadata: {
      displayName: PLUGIN_ID,
      category: 'cli',
      officialUrl: 'https://example.test/plugin',
      shortDescription: 'Plugin descriptor with .yaml mappers for rules/commands/agents',
    },
    generators: pluginGenerators,
    capabilities: {
      rules: { level: 'native' },
      additionalRules: { level: 'none' },
      commands: { level: 'native' },
      agents: { level: 'native' },
      skills: { level: 'none' },
      mcp: { level: 'none' },
      hooks: { level: 'none' },
      ignore: { level: 'none' },
      permissions: { level: 'none' },
    },
    emptyImportMessage: 'No plugin files.',
    lintRules: null,
    project,
    importer: {
      rules: {
        feature: 'rules',
        mode: 'directory',
        source: { project: [`.${PLUGIN_ID}/rules`] },
        canonicalDir: '.agentsmesh/rules',
        extensions: ['.yaml'],
        map: yamlMapper('rule'),
      },
      commands: {
        feature: 'commands',
        mode: 'directory',
        source: { project: [`.${PLUGIN_ID}/commands`] },
        canonicalDir: '.agentsmesh/commands',
        extensions: ['.yaml'],
        map: yamlMapper('command'),
      },
      agents: {
        feature: 'agents',
        mode: 'directory',
        source: { project: [`.${PLUGIN_ID}/agents`] },
        canonicalDir: '.agentsmesh/agents',
        extensions: ['.yaml'],
        map: yamlMapper('agent'),
      },
    },
    buildImportPaths: async () => {},
    detectionPaths: [`.${PLUGIN_ID}`],
  };
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
  resetRegistry();
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  resetRegistry();
});

describe('plugin descriptor enumeration in read*DirWithMappers', () => {
  it('commands: picks up files from a plugin target with .yaml extension', async () => {
    registerTargetDescriptor(makePluginDescriptor());

    const dir = join(ROOT, 'commands');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'plugin-cmd.yaml'), 'description: Hello from plugin\n');

    const { commands, cleanup } = await readCommandsDirWithMappers(dir);
    try {
      expect(commands).toHaveLength(1);
      expect(commands[0]!.name).toBe('plugin-cmd');
      expect(commands[0]!.description).toBe('Hello from plugin');
    } finally {
      await cleanup();
    }
  });

  it('rules: picks up files from a plugin target with .yaml extension', async () => {
    registerTargetDescriptor(makePluginDescriptor());

    const dir = join(ROOT, 'rules');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'plugin-rule.yaml'), 'description: A plugin rule\n');

    const { rules, cleanup } = await readRulesDirWithMappers(dir);
    try {
      expect(rules).toHaveLength(1);
      expect(rules[0]!.source.endsWith('plugin-rule.md')).toBe(true);
      expect(rules[0]!.description).toBe('A plugin rule');
    } finally {
      await cleanup();
    }
  });

  it('agents: picks up files from a plugin target with .yaml extension', async () => {
    registerTargetDescriptor(makePluginDescriptor());

    const dir = join(ROOT, 'agents');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'plugin-agent.yaml'), 'description: A plugin agent\n');

    const { agents, cleanup } = await readAgentsDirWithMappers(dir);
    try {
      expect(agents).toHaveLength(1);
      expect(agents[0]!.name).toBe('plugin-agent');
      expect(agents[0]!.description).toBe('A plugin agent');
    } finally {
      await cleanup();
    }
  });

  it('compound .md extensions (e.g. .agent.md) stay on the canonical reader — no double-counting', async () => {
    // Copilot's `agents` importer declares `extensions: ['.agent.md']`.
    // These files ARE Markdown — the canonical reader already picks them
    // up via `f.endsWith('.md')`. If the seam treated them as "non-`.md`"
    // and additionally routed them through the target mapper, we'd emit
    // two canonical agents per source file (one slugged `foo.agent`, one
    // slugged `foo`). Regression test for the 144 → 146 jump observed on
    // `VoltAgent/awesome-claude-code-subagents` during compatibility sweep.
    const dir = join(ROOT, 'agents');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'planner.agent.md'),
      '---\nname: planner.agent\ndescription: A planner agent\n---\n# planner\n',
    );

    // Copilot is a builtin; no plugin registration needed.
    const { agents, cleanup } = await readAgentsDirWithMappers(dir);
    try {
      // Canonical reader sees ONE file → ONE agent.
      expect(agents).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });
});
