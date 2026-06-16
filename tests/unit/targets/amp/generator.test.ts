import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateSkills,
  generateCommands,
  generateAgents,
} from '../../../../src/targets/amp/generator.js';
import { descriptor } from '../../../../src/targets/amp/index.js';
import {
  AMP_ROOT_FILE,
  AMP_SKILLS_DIR,
  AMP_MCP_FILE,
} from '../../../../src/targets/amp/constants.js';

const ALL_FEATURES = new Set(['rules', 'mcp', 'hooks', 'ignore', 'permissions', 'agents']);

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

describe('generateRules (amp)', () => {
  it('generates AGENTS.md for the root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root\n\nUse TDD and strict TypeScript.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(AMP_ROOT_FILE);
    expect(results[0].content).toContain('Use TDD and strict TypeScript.');
    expect(results[0].content).not.toMatch(/^---\n/);
  });

  it('embeds non-root rules in AGENTS.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root instructions',
        },
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TypeScript standards',
          globs: ['src/**/*.ts'],
          body: 'Use strict mode.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(AMP_ROOT_FILE);
    expect(results[0].content).toContain('# Root instructions');
    expect(results[0].content).toContain('Use strict mode.');
  });

  it('filters rules targeted to other tools', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
        {
          source: '/proj/.agentsmesh/rules/cursor-only.md',
          root: false,
          targets: ['cursor'],
          description: 'Cursor-specific',
          globs: [],
          body: 'Only for Cursor.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].content).not.toContain('Only for Cursor.');
  });

  it('returns empty when no rules exist', () => {
    const canonical = makeCanonical({ rules: [] });
    const results = generateRules(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateSkills (amp)', () => {
  it('generates skills to .agents/skills/', () => {
    const canonical = makeCanonical({
      skills: [
        {
          name: 'debugging',
          source: '/proj/.agentsmesh/skills/debugging/SKILL.md',
          description: 'Debug workflow',
          body: '# Debugging\n\nReproduce first.',
          supportingFiles: [
            {
              relativePath: 'references/checklist.md',
              content: '# Checklist\n\n- Reproduce issue',
            },
          ],
        },
      ],
    });

    const results = generateSkills(canonical);

    expect(results.length).toBeGreaterThanOrEqual(2);
    const skillFile = results.find((r) => r.path === `${AMP_SKILLS_DIR}/debugging/SKILL.md`);
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain('name: debugging');
    expect(skillFile!.content).toContain('description: Debug workflow');
    const refFile = results.find(
      (r) => r.path === `${AMP_SKILLS_DIR}/debugging/references/checklist.md`,
    );
    expect(refFile).toBeDefined();
    expect(refFile!.content).toContain('Reproduce issue');
  });

  it('returns empty when no skills exist', () => {
    const canonical = makeCanonical({ skills: [] });
    const results = generateSkills(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateCommands (amp)', () => {
  it('projects commands as skills', () => {
    const canonical = makeCanonical({
      commands: [
        {
          name: 'review',
          source: '/proj/.agentsmesh/commands/review.md',
          description: 'Review code changes',
          body: 'Run code review.',
          allowedTools: ['Bash', 'Read'],
        },
      ],
    });

    const results = generateCommands(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toContain(`${AMP_SKILLS_DIR}/`);
    expect(results[0].path).toContain('SKILL.md');
    expect(results[0].content).toContain('review');
    const cmd = results.find((r) => r.path.endsWith('SKILL.md'));
    expect(cmd!.content).toContain('x-agentsmesh-kind: command');
    expect(cmd!.content).toContain('x-agentsmesh-name: review');
    expect(cmd!.content).toContain('name: am-command-review');
    expect(cmd!.content).toContain('description: Review code changes');
    expect(cmd!.content).toContain('x-agentsmesh-allowed-tools:');
    expect(cmd!.content).toContain('- Read');
  });
});

describe('generateAgents (amp)', () => {
  it('projects agents as skills', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'researcher',
          source: '/proj/.agentsmesh/agents/researcher.md',
          description: 'Research agent',
          body: 'Research topics thoroughly.',
          tools: ['WebSearch'],
          disallowedTools: [],
          model: 'claude-sonnet',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
        },
      ],
    });

    const results = generateAgents(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toContain(`${AMP_SKILLS_DIR}/`);
    expect(results[0].path).toContain('SKILL.md');
    expect(results[0].content).toContain('researcher');
    const agent = results.find((r) => r.path.endsWith('SKILL.md'));
    expect(agent!.content).toContain('x-agentsmesh-kind: agent');
    expect(agent!.content).toContain('x-agentsmesh-name: researcher');
    expect(agent!.content).toContain('name: am-agent-researcher');
    expect(agent!.content).toContain('description: Research agent');
    expect(agent!.content).toContain('x-agentsmesh-tools:');
    expect(agent!.content).toContain('x-agentsmesh-model: claude-sonnet');
  });
});

describe('emitScopedSettings — MCP format (amp)', () => {
  it('emits .amp/settings.json with amp.mcpServers key', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          context7: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
            env: {},
          },
        },
      },
    });
    const results = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(AMP_MCP_FILE);
    const parsed = JSON.parse(results[0].content);
    expect(parsed).toEqual({
      'amp.mcpServers': {
        context7: { type: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'], env: {} },
      },
    });
  });

  it('returns empty array when mcp is null', () => {
    const canonical = makeCanonical({ mcp: null });
    const results = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(results).toEqual([]);
  });

  it('returns empty array when mcpServers is empty', () => {
    const canonical = makeCanonical({ mcp: { mcpServers: {} } });
    const results = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(results).toEqual([]);
  });
});

describe('emitScopedSettings — hooks (amp)', () => {
  it('returns [] when hooks is null', () => {
    const results = descriptor.emitScopedSettings!(makeCanonical({ hooks: null }), 'project', ALL_FEATURES);
    expect(results.filter((r) => JSON.parse(r.content)['amp.hooks'] !== undefined)).toHaveLength(0);
  });

  it('returns [] when hooks is empty', () => {
    const results = descriptor.emitScopedSettings!(
      makeCanonical({ hooks: { PreToolUse: [] } }),
      'project',
      ALL_FEATURES,
    );
    expect(results.filter((r) => JSON.parse(r.content)['amp.hooks'] !== undefined)).toHaveLength(0);
  });

  it('emits .amp/settings.json with amp.hooks key', () => {
    const result = descriptor.emitScopedSettings!(
      makeCanonical({
        hooks: { PreToolUse: [{ matcher: '*', command: 'echo hi', type: 'command' }] },
      }),
      'project',
      ALL_FEATURES,
    );
    const settings = result.find((r) => {
      const parsed = JSON.parse(r.content) as Record<string, unknown>;
      return parsed['amp.hooks'] !== undefined;
    });
    expect(settings).toBeDefined();
    expect(settings!.path).toBe(AMP_MCP_FILE);
    const parsed = JSON.parse(settings!.content) as Record<string, unknown>;
    expect(parsed['amp.hooks']).toBeDefined();
  });
});

describe('emitScopedSettings — permissions (amp)', () => {
  it('returns [] when permissions is null', () => {
    const results = descriptor.emitScopedSettings!(makeCanonical({ permissions: null }), 'project', ALL_FEATURES);
    expect(results.filter((r) => JSON.parse(r.content)['amp.permissions'] !== undefined)).toHaveLength(0);
  });

  it('returns [] when all permission lists are empty', () => {
    const results = descriptor.emitScopedSettings!(
      makeCanonical({ permissions: { allow: [], deny: [], ask: [] } }),
      'project',
      ALL_FEATURES,
    );
    expect(results.filter((r) => JSON.parse(r.content)['amp.permissions'] !== undefined)).toHaveLength(0);
  });

  it('emits .amp/settings.json with amp.permissions key', () => {
    const result = descriptor.emitScopedSettings!(
      makeCanonical({ permissions: { allow: ['npm run build'], deny: [], ask: [] } }),
      'project',
      ALL_FEATURES,
    );
    const settings = result.find((r) => {
      const parsed = JSON.parse(r.content) as Record<string, unknown>;
      return parsed['amp.permissions'] !== undefined;
    });
    expect(settings).toBeDefined();
    expect(settings!.path).toBe(AMP_MCP_FILE);
    const parsed = JSON.parse(settings!.content) as Record<string, unknown>;
    expect(parsed['amp.permissions']).toEqual({ allow: ['npm run build'] });
  });

  it('emits .amp/settings.json with amp.permissions.deny when deny-only', () => {
    const result = descriptor.emitScopedSettings!(
      makeCanonical({ permissions: { allow: [], deny: ['rm -rf'], ask: [] } }),
      'project',
      ALL_FEATURES,
    );
    const settings = result.find((r) => {
      const parsed = JSON.parse(r.content) as Record<string, unknown>;
      return parsed['amp.permissions'] !== undefined;
    });
    expect(settings).toBeDefined();
    expect(settings!.path).toBe(AMP_MCP_FILE);
    const parsed = JSON.parse(settings!.content) as Record<string, unknown>;
    expect(parsed['amp.permissions']).toEqual({ deny: ['rm -rf'] });
  });

  it('emits .amp/settings.json with amp.permissions.ask when ask-only', () => {
    const result = descriptor.emitScopedSettings!(
      makeCanonical({ permissions: { allow: [], deny: [], ask: ['Bash'] } }),
      'project',
      ALL_FEATURES,
    );
    const settings = result.find((r) => {
      const parsed = JSON.parse(r.content) as Record<string, unknown>;
      return parsed['amp.permissions'] !== undefined;
    });
    expect(settings).toBeDefined();
    expect(settings!.path).toBe(AMP_MCP_FILE);
    const parsed = JSON.parse(settings!.content) as Record<string, unknown>;
    expect(parsed['amp.permissions']).toEqual({ ask: ['Bash'] });
  });
});

describe('mergeGeneratedOutputContent — accumulates hooks, permissions, mcp (amp)', () => {
  it('merges amp.hooks and amp.permissions into existing amp.mcpServers without losing keys', () => {
    const existing = JSON.stringify({ 'amp.mcpServers': { ctx: {} } }, null, 2);
    const hooksContent = JSON.stringify({ 'amp.hooks': { PreToolUse: [] } }, null, 2);
    const permContent = JSON.stringify({ 'amp.permissions': { allow: ['Bash'] } }, null, 2);
    // Simulate two sequential merges (pending carries forward)
    const afterHooks = descriptor.mergeGeneratedOutputContent!(existing, undefined, hooksContent, AMP_MCP_FILE);
    expect(afterHooks).not.toBeNull();
    const afterPerm = descriptor.mergeGeneratedOutputContent!(
      existing,
      { target: 'amp', path: AMP_MCP_FILE, content: afterHooks! },
      permContent,
      AMP_MCP_FILE,
    );
    expect(afterPerm).not.toBeNull();
    const parsed = JSON.parse(afterPerm!) as Record<string, unknown>;
    expect(parsed['amp.mcpServers']).toBeDefined();
    expect(parsed['amp.hooks']).toBeDefined();
    expect(parsed['amp.permissions']).toEqual({ allow: ['Bash'] });
  });
});
