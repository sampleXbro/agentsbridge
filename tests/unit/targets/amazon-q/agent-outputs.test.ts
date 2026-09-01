import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { TargetLayoutScope } from '../../../../src/targets/catalog/target-descriptor.js';
import { emitAmazonQAgentSettings } from '../../../../src/targets/amazon-q/agent-outputs.js';
import { generateAgents } from '../../../../src/targets/amazon-q/generator.js';
import {
  AMAZON_Q_PROJECT_RULES_RESOURCE,
  AMAZON_Q_DEFAULT_AGENT_RESOURCES,
} from '../../../../src/targets/amazon-q/constants.js';

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

function makeAgent(name: string): CanonicalFiles['agents'][number] {
  return {
    source: `/proj/.agentsmesh/agents/${name}.md`,
    name,
    description: '',
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: 'default',
    maxTurns: 0,
    mcpServers: [],
    hooks: {} as import('../../../../src/core/hook-types.js').Hooks,
    skills: [],
    memory: '',
    body: 'Agent body.',
  };
}

const ALL_FEATURES: ReadonlySet<string> = new Set([
  'rules',
  'commands',
  'agents',
  'mcp',
  'hooks',
  'ignore',
  'permissions',
]);

const PROJECT_RESOURCES = [...AMAZON_Q_DEFAULT_AGENT_RESOURCES, AMAZON_Q_PROJECT_RULES_RESOURCE];

function parseFirstEmitted(
  canonical: CanonicalFiles,
  scope: TargetLayoutScope = 'project',
  features: ReadonlySet<string> = ALL_FEATURES,
): Record<string, unknown> {
  const [output] = emitAmazonQAgentSettings(canonical, scope, features);
  return JSON.parse(output.content) as Record<string, unknown>;
}

describe('emitAmazonQAgentSettings (amazon-q) — embedded ignore as toolsSettings', () => {
  it('writes canonical ignore patterns to fs_read and fs_write deniedPaths', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      ignore: ['node_modules', 'dist', '.env'],
    });
    expect(parseFirstEmitted(canonical).toolsSettings).toEqual({
      fs_read: { deniedPaths: ['node_modules', 'dist', '.env'] },
      fs_write: { deniedPaths: ['node_modules', 'dist', '.env'] },
    });
  });

  it('keeps patterns verbatim so import round-trips them unchanged', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      ignore: ['src/**/*.gen.ts', '/build', '~/secrets'],
    });
    const toolsSettings = parseFirstEmitted(canonical).toolsSettings as Record<
      string,
      { deniedPaths: string[] }
    >;
    expect(toolsSettings.fs_read.deniedPaths).toEqual(['src/**/*.gen.ts', '/build', '~/secrets']);
  });

  it('drops gitignore negation patterns Amazon Q cannot express', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      ignore: ['build', '!build/keep.txt'],
    });
    const toolsSettings = parseFirstEmitted(canonical).toolsSettings as Record<
      string,
      { deniedPaths: string[] }
    >;
    expect(toolsSettings.fs_read.deniedPaths).toEqual(['build']);
    expect(toolsSettings.fs_write.deniedPaths).toEqual(['build']);
  });

  it('omits toolsSettings when every pattern is a negation', () => {
    const canonical = makeCanonical({ agents: [makeAgent('coder')], ignore: ['!keep'] });
    expect(parseFirstEmitted(canonical)).not.toHaveProperty('toolsSettings');
  });

  it('omits toolsSettings when there are no ignore patterns', () => {
    const canonical = makeCanonical({ agents: [makeAgent('coder')] });
    expect(parseFirstEmitted(canonical)).not.toHaveProperty('toolsSettings');
  });

  it('embeds toolsSettings in global scope too', () => {
    const canonical = makeCanonical({ agents: [makeAgent('coder')], ignore: ['dist'] });
    expect(parseFirstEmitted(canonical, 'global').toolsSettings).toEqual({
      fs_read: { deniedPaths: ['dist'] },
      fs_write: { deniedPaths: ['dist'] },
    });
  });

  it('keeps allowedTools and toolsSettings as separate keys', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      permissions: { allow: ['fs_read'], deny: [], ask: [] },
      ignore: ['dist'],
    });
    const parsed = parseFirstEmitted(canonical);
    expect(parsed.allowedTools).toEqual(['fs_read']);
    expect(parsed.toolsSettings).toHaveProperty('fs_read.deniedPaths');
  });

  it('emits no agent JSON at all when there are no canonical agents', () => {
    const canonical = makeCanonical({ ignore: ['dist'] });
    expect(generateAgents(canonical)).toHaveLength(0);
    expect(emitAmazonQAgentSettings(canonical, 'project', ALL_FEATURES)).toHaveLength(0);
  });
});

describe('emitAmazonQAgentSettings (amazon-q) — feature gating', () => {
  const canonical = makeCanonical({
    agents: [{ ...makeAgent('coder'), tools: ['fs_read'] }],
    ignore: ['dist'],
    permissions: { allow: ['fs_write'], deny: [], ask: [] },
    hooks: { PreToolUse: [{ matcher: 'fs_write', command: 'echo hi' }] },
  });

  it('drops toolsSettings when the ignore feature is disabled', () => {
    const features = new Set(['rules', 'agents', 'hooks', 'permissions']);
    expect(parseFirstEmitted(canonical, 'project', features)).not.toHaveProperty('toolsSettings');
  });

  it('drops hooks when the hooks feature is disabled', () => {
    const features = new Set(['rules', 'agents', 'ignore', 'permissions']);
    expect(parseFirstEmitted(canonical, 'project', features)).not.toHaveProperty('hooks');
  });

  it('drops canonical permissions.allow when the permissions feature is disabled', () => {
    const features = new Set(['rules', 'agents', 'ignore', 'hooks']);
    expect(parseFirstEmitted(canonical, 'project', features).allowedTools).toEqual(['fs_read']);
    expect(parseFirstEmitted(canonical).allowedTools).toEqual(['fs_read', 'fs_write']);
  });

  it('keeps the rules resources glob regardless of which features are enabled', () => {
    const features = new Set(['agents']);
    expect(parseFirstEmitted(canonical, 'project', features).resources).toEqual(PROJECT_RESOURCES);
  });

  it('emits nothing when the agents feature is disabled', () => {
    const features = new Set(['rules', 'ignore', 'hooks', 'permissions']);
    expect(emitAmazonQAgentSettings(canonical, 'project', features)).toEqual([]);
  });

  it('writes to the project agent path so the global layout can rewrite it', () => {
    expect(emitAmazonQAgentSettings(canonical, 'global', ALL_FEATURES).map((o) => o.path)).toEqual([
      '.amazonq/cli-agents/coder.json',
    ]);
  });
});
