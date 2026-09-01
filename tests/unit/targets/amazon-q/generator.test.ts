import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateMcp,
  generateAgents,
  generateHooks,
  generatePermissions,
} from '../../../../src/targets/amazon-q/generator.js';
import { emitAmazonQAgentSettings } from '../../../../src/targets/amazon-q/agent-outputs.js';
import type { FeatureGeneratorOutput } from '../../../../src/targets/catalog/target.interface.js';
import {
  AMAZON_Q_RULES_DIR,
  AMAZON_Q_MCP_FILE,
  AMAZON_Q_AGENTS_DIR,
} from '../../../../src/targets/amazon-q/constants.js';

/** Embedded extras are written by the feature-gated scoped-settings emitter. */
const EMBEDDED_FEATURES: ReadonlySet<string> = new Set([
  'agents',
  'hooks',
  'permissions',
  'ignore',
]);

function emitAgentFiles(canonical: CanonicalFiles): readonly FeatureGeneratorOutput[] {
  return emitAmazonQAgentSettings(canonical, 'project', EMBEDDED_FEATURES);
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

describe('generateRules (amazon-q)', () => {
  it('generates _root.md for the root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'Project standards',
          globs: [],
          body: '# Standards\n\nUse TDD.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AMAZON_Q_RULES_DIR}/_root.md`);
    expect(results[0].content).toContain('Use TDD.');
    expect(results[0].content).not.toMatch(/^---/);
  });

  it('generates non-root rules in .amazonq/rules/<slug>.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TypeScript rules',
          globs: ['src/**/*.ts'],
          body: 'Use strict TypeScript.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AMAZON_Q_RULES_DIR}/typescript.md`);
    expect(results[0].content).toContain('Use strict TypeScript.');
    expect(results[0].content).not.toMatch(/^---/);
  });

  it('generates both root and non-root rules', () => {
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
          source: '/proj/.agentsmesh/rules/security.md',
          root: false,
          targets: [],
          description: 'Security guidelines',
          globs: [],
          body: 'Never expose secrets.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(2);
    expect(results[0].path).toBe(`${AMAZON_Q_RULES_DIR}/_root.md`);
    expect(results[1].path).toBe(`${AMAZON_Q_RULES_DIR}/security.md`);
  });

  it('skips rules filtered to other targets', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/claude-only.md',
          root: false,
          targets: ['claude-code'],
          description: '',
          globs: [],
          body: 'Claude only.',
        },
      ],
    });

    expect(generateRules(canonical)).toHaveLength(0);
  });

  it('includes rules explicitly targeting amazon-q', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/aws.md',
          root: false,
          targets: ['amazon-q'],
          description: 'AWS-specific rules',
          globs: [],
          body: 'Use AWS SDK v3.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AMAZON_Q_RULES_DIR}/aws.md`);
  });

  it('returns empty array when no rules', () => {
    expect(generateRules(makeCanonical())).toHaveLength(0);
  });

  it('trims rule body whitespace', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/trim.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: '  \n# Rule\n\nContent.\n  ',
        },
      ],
    });

    const results = generateRules(canonical);
    expect(results[0].content).toBe('# Rule\n\nContent.');
  });
});

describe('generateAgents (amazon-q)', () => {
  it('returns empty when no agents', () => {
    expect(generateAgents(makeCanonical())).toHaveLength(0);
  });

  it('generates .amazonq/cli-agents/{name}.json with the official prompt key', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/reviewer.md',
          name: 'reviewer',
          description: 'Reviews code',
          tools: ['Read', 'Grep'],
          disallowedTools: [],
          model: '',
          permissionMode: 'default',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'You review code carefully.',
        },
      ],
    });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AMAZON_Q_AGENTS_DIR}/reviewer.json`);
    const parsed = JSON.parse(results[0].content) as {
      name: string;
      description: string;
      prompt: string;
      allowedTools: string[];
    };
    expect(parsed.name).toBe('reviewer');
    expect(parsed.description).toBe('Reviews code');
    expect(parsed.prompt).toContain('You review code carefully');
    // The AWS agent-v1.json schema uses `prompt`, not `systemPrompt` — guard against regression.
    expect(parsed).not.toHaveProperty('systemPrompt');
    expect(parsed.allowedTools).toEqual(['Read', 'Grep']);
  });

  it('omits description when empty', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/helper.md',
          name: 'helper',
          description: '',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: 'default',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'You help.',
        },
      ],
    });
    const results = generateAgents(canonical);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('description');
    expect(parsed).not.toHaveProperty('allowedTools');
  });

  it('generates multiple agents', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/a.md',
          name: 'a',
          description: '',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: 'default',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'Agent A.',
        },
        {
          source: '/proj/.agentsmesh/agents/b.md',
          name: 'b',
          description: 'Agent B',
          tools: ['Write'],
          disallowedTools: [],
          model: '',
          permissionMode: 'default',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'Agent B.',
        },
      ],
    });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(2);
    expect(results[0].path).toBe(`${AMAZON_Q_AGENTS_DIR}/a.json`);
    expect(results[1].path).toBe(`${AMAZON_Q_AGENTS_DIR}/b.json`);
  });
});

describe('generateMcp (amazon-q)', () => {
  it('generates .amazonq/mcp.json', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          context7: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp@latest'],
            env: {},
          },
        },
      },
    });

    const results = generateMcp(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(AMAZON_Q_MCP_FILE);
    expect(JSON.parse(results[0].content)).toHaveProperty('mcpServers.context7.command', 'npx');
  });

  it('returns empty array when mcp is null', () => {
    expect(generateMcp(makeCanonical())).toHaveLength(0);
  });

  it('returns empty array when mcpServers is empty', () => {
    const canonical = makeCanonical({ mcp: { mcpServers: {} } });
    expect(generateMcp(canonical)).toHaveLength(0);
  });
});

describe('emitAmazonQAgentSettings (amazon-q) — embedded hooks', () => {
  function makeAgent(
    name: string,
    opts: { tools?: string[]; hooks?: Record<string, unknown> } = {},
  ): CanonicalFiles['agents'][number] {
    return {
      source: `/proj/.agentsmesh/agents/${name}.md`,
      name,
      description: '',
      tools: opts.tools ?? [],
      disallowedTools: [],
      model: '',
      permissionMode: 'default',
      maxTurns: 0,
      mcpServers: [],
      hooks: (opts.hooks ?? {}) as import('../../../../src/core/hook-types.js').Hooks,
      skills: [],
      memory: '',
      body: 'Agent body.',
    };
  }

  it('embeds canonical PreToolUse hooks into agent JSON as preToolUse', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      hooks: {
        PreToolUse: [{ matcher: 'fs_write', command: 'lint.sh' }],
      },
    });
    const results = emitAgentFiles(canonical);
    expect(results).toHaveLength(1);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    const hooks = parsed.hooks as Record<string, unknown>;
    expect(hooks).toBeDefined();
    const preToolUse = hooks.preToolUse as Array<{ matcher: string; command: string }>;
    expect(preToolUse).toHaveLength(1);
    expect(preToolUse[0].matcher).toBe('fs_write');
    expect(preToolUse[0].command).toBe('lint.sh');
  });

  it('embeds canonical PostToolUse hooks into agent JSON as postToolUse', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      hooks: {
        PostToolUse: [{ matcher: '**', command: 'echo done' }],
      },
    });
    const [result] = emitAgentFiles(canonical);
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    const hooks = parsed.hooks as Record<string, unknown>;
    const postToolUse = hooks.postToolUse as Array<{ matcher: string; command: string }>;
    expect(postToolUse).toHaveLength(1);
    expect(postToolUse[0].command).toBe('echo done');
  });

  it('embeds canonical UserPromptSubmit hooks into agent JSON as userPromptSubmit', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      hooks: {
        UserPromptSubmit: [{ matcher: '**', command: 'recall.sh' }],
      },
    });
    const [result] = emitAgentFiles(canonical);
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    const hooks = parsed.hooks as Record<string, unknown>;
    const userPromptSubmit = hooks.userPromptSubmit as Array<{ command: string }>;
    expect(userPromptSubmit).toHaveLength(1);
    expect(userPromptSubmit[0].command).toBe('recall.sh');
  });

  it('omits hooks key from agent JSON when no canonical hooks are mappable', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      hooks: {
        Notification: [{ matcher: '**', command: 'notify.sh' }],
      },
    });
    const [result] = emitAgentFiles(canonical);
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('hooks');
  });

  it('omits hooks key from agent JSON when canonical hooks is null', () => {
    const canonical = makeCanonical({ agents: [makeAgent('coder')], hooks: null });
    const [result] = emitAgentFiles(canonical);
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('hooks');
  });

  it('embeds hooks into each agent when multiple agents are present', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('a'), makeAgent('b')],
      hooks: {
        PreToolUse: [{ matcher: 'fs_write', command: 'lint.sh' }],
      },
    });
    const results = emitAgentFiles(canonical);
    expect(results).toHaveLength(2);
    for (const r of results) {
      const parsed = JSON.parse(r.content) as Record<string, unknown>;
      expect(parsed).toHaveProperty('hooks');
    }
  });

  it('leaves hooks out of the ungated base file generateAgents writes', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      hooks: { PreToolUse: [{ matcher: 'fs_write', command: 'lint.sh' }] },
    });
    const [result] = generateAgents(canonical);
    expect(JSON.parse(result.content)).not.toHaveProperty('hooks');
  });
});

describe('emitAmazonQAgentSettings (amazon-q) — embedded permissions', () => {
  function makeAgent(name: string, tools: string[] = []): CanonicalFiles['agents'][number] {
    return {
      source: `/proj/.agentsmesh/agents/${name}.md`,
      name,
      description: '',
      tools,
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

  it('embeds canonical permissions.allow into allowedTools (merged with agent.tools)', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder', ['Read'])],
      permissions: { allow: ['Bash(git:*)'], deny: [], ask: [] },
    });
    const [result] = emitAgentFiles(canonical);
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    const allowedTools = parsed.allowedTools as string[];
    // Both agent tools and canonical allow list should be present, deduplicated
    expect(allowedTools).toContain('Read');
    expect(allowedTools).toContain('Bash(git:*)');
    expect(new Set(allowedTools).size).toBe(allowedTools.length); // no duplicates
  });

  it('deduplicates when agent.tools and permissions.allow overlap', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder', ['Read', 'Bash(git:*)'])],
      permissions: { allow: ['Bash(git:*)'], deny: [], ask: [] },
    });
    const [result] = emitAgentFiles(canonical);
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    const allowedTools = parsed.allowedTools as string[];
    expect(allowedTools.filter((t) => t === 'Bash(git:*)')).toHaveLength(1);
  });

  it('omits allowedTools when agent.tools is empty and permissions.allow is empty', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      permissions: null,
    });
    const [result] = emitAgentFiles(canonical);
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('allowedTools');
  });

  it('includes allowedTools from permissions.allow even when agent.tools is empty', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      permissions: { allow: ['Bash(git:*)'], deny: [], ask: [] },
    });
    const [result] = emitAgentFiles(canonical);
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    const allowedTools = parsed.allowedTools as string[];
    expect(allowedTools).toEqual(['Bash(git:*)']);
  });

  it('leaves canonical permissions.allow out of the base file generateAgents writes', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder', ['Read'])],
      permissions: { allow: ['Bash(git:*)'], deny: [], ask: [] },
    });
    const [result] = generateAgents(canonical);
    expect((JSON.parse(result.content) as { allowedTools: string[] }).allowedTools).toEqual([
      'Read',
    ]);
  });
});

describe('generateHooks (amazon-q) — no-op stub', () => {
  it('returns empty array (hooks are embedded in generateAgents)', () => {
    const canonical = makeCanonical({
      hooks: { PreToolUse: [{ matcher: '**', command: 'lint.sh' }] },
    });
    expect(generateHooks(canonical)).toHaveLength(0);
  });

  it('returns empty array when hooks is null', () => {
    expect(generateHooks(makeCanonical({ hooks: null }))).toHaveLength(0);
  });
});

describe('generatePermissions (amazon-q) — no-op stub', () => {
  it('returns empty array (permissions are embedded in generateAgents)', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash(git:*)'], deny: [], ask: [] },
    });
    expect(generatePermissions(canonical)).toHaveLength(0);
  });

  it('returns empty array when permissions is null', () => {
    expect(generatePermissions(makeCanonical({ permissions: null }))).toHaveLength(0);
  });
});
