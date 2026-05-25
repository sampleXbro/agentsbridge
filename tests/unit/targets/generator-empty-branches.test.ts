/**
 * Branch coverage for empty/fallback paths across multiple target generators.
 * Each target's generator has several `value || undefined` / `value.length > 0 ? ...`
 * branches that the happy-path fixtures don't reach with empty values.
 */

import { describe, it, expect } from 'vitest';
import {
  generateAgents as qwenAgents,
  generateCommands as qwenCommands,
  generateRules as qwenRules,
  generateSkills as qwenSkills,
  generateMcp as qwenMcp,
  generateIgnore as qwenIgnore,
} from '../../../src/targets/qwen-code/generator.js';
import {
  generateRules as rooRules,
  generateCommands as rooCommands,
  generateMcp as rooMcp,
  generateIgnore as rooIgnore,
  generateAgents as rooAgents,
} from '../../../src/targets/roo-code/generator.js';
import {
  generateRules as kiloRules,
  generateCommands as kiloCommands,
  generateAgents as kiloAgents,
  generateMcp as kiloMcp,
  generateIgnore as kiloIgnore,
} from '../../../src/targets/kilo-code/generator.js';
import {
  generateRules as ocRules,
  generateCommands as ocCommands,
  generateAgents as ocAgents,
  generateSkills as ocSkills,
} from '../../../src/targets/opencode/generator.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

function baseCanonical(): CanonicalFiles {
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

describe('per-target generators — empty/fallback branches', () => {
  it('qwen-code: empty canonical produces zero outputs from each generator', () => {
    const c = baseCanonical();
    expect(qwenAgents(c)).toEqual([]);
    expect(qwenCommands(c)).toEqual([]);
    expect(qwenRules(c)).toEqual([]);
    expect(qwenSkills(c)).toEqual([]);
    expect(qwenMcp(c)).toEqual([]);
    expect(qwenIgnore(c)).toEqual([]);
  });

  it('qwen-code: root rule with empty body emits empty content', () => {
    const c: CanonicalFiles = {
      ...baseCanonical(),
      rules: [
        {
          source: '/x/rules/_root.md',
          name: '_root',
          root: true,
          description: '',
          globs: [],
          targets: [],
          body: '   ',
        },
      ],
    };
    const out = qwenRules(c);
    expect(out).toEqual([{ path: 'QWEN.md', content: '' }]);
  });

  it('qwen-code: non-root rule respects targets[] filter (excluded when not listed)', () => {
    const c: CanonicalFiles = {
      ...baseCanonical(),
      rules: [
        {
          source: '/x/rules/extra.md',
          name: 'extra',
          root: false,
          description: '',
          globs: [],
          targets: ['claude-code'],
          body: 'body',
        },
      ],
    };
    expect(qwenRules(c)).toEqual([]);
  });

  it('roo-code: empty canonical produces zero outputs', () => {
    const c = baseCanonical();
    expect(rooRules(c)).toEqual([]);
    expect(rooCommands(c)).toEqual([]);
    expect(rooMcp(c)).toEqual([]);
    expect(rooIgnore(c)).toEqual([]);
    expect(rooAgents(c)).toEqual([]);
  });

  it('roo-code: command without description omits description from frontmatter', () => {
    const c: CanonicalFiles = {
      ...baseCanonical(),
      commands: [
        {
          source: '/x/commands/build.md',
          name: 'build',
          description: '',
          argumentHint: '',
          allowedTools: [],
          body: 'body',
        },
      ],
    };
    const out = rooCommands(c);
    expect(out).toHaveLength(1);
    expect(out[0]!.content).not.toContain('description:');
  });

  it('roo-code: agent without description/body omits both keys', () => {
    const c: CanonicalFiles = {
      ...baseCanonical(),
      agents: [
        {
          source: '/x/agents/r.md',
          name: 'r',
          description: '',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: '   ',
        },
      ],
    };
    const out = rooAgents(c);
    expect(out).toHaveLength(1);
    expect(out[0]!.content).not.toContain('description:');
    expect(out[0]!.content).not.toContain('roleDefinition:');
  });

  it('kilo-code: empty canonical produces zero outputs', () => {
    const c = baseCanonical();
    expect(kiloRules(c)).toEqual([]);
    expect(kiloCommands(c)).toEqual([]);
    expect(kiloAgents(c)).toEqual([]);
    expect(kiloMcp(c)).toEqual([]);
    expect(kiloIgnore(c)).toEqual([]);
  });

  it('opencode: empty canonical produces zero outputs', () => {
    const c = baseCanonical();
    expect(ocRules(c)).toEqual([]);
    expect(ocCommands(c)).toEqual([]);
    expect(ocAgents(c)).toEqual([]);
    expect(ocSkills(c)).toEqual([]);
  });
});
