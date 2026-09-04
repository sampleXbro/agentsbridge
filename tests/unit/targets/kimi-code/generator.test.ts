import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generatePermissions,
} from '../../../../src/targets/kimi-code/generator.js';
import {
  KIMI_CODE_ROOT_FILE,
  KIMI_CODE_AGENTS_DIR,
  KIMI_CODE_SKILLS_DIR,
  KIMI_CODE_MCP_FILE,
} from '../../../../src/targets/kimi-code/constants.js';
import {
  globalCtx,
  makeAgent,
  makeCanonical,
  makeCommand,
  makeRule,
  makeSkill,
  projectCtx,
} from './fixtures.js';

const rootRule = makeRule({
  source: '/proj/.agentsmesh/rules/_root.md',
  root: true,
  description: '',
  globs: [],
  body: '# Root\n\nUse TDD.',
});

describe('generateRules (kimi-code)', () => {
  it('writes the root rule to AGENTS.md at project scope', () => {
    const results = generateRules(makeCanonical({ rules: [rootRule] }), projectCtx());
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(KIMI_CODE_ROOT_FILE);
    expect(results[0]!.content).toBe('# Root\n\nUse TDD.');
  });

  it('embeds non-root rules into the same AGENTS.md', () => {
    const results = generateRules(makeCanonical({ rules: [rootRule, makeRule()] }), projectCtx());
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(KIMI_CODE_ROOT_FILE);
    expect(results[0]!.content).toContain('<!-- agentsmesh:embedded-rules:start -->');
    expect(results[0]!.content).toContain('No `any`.');
  });

  it('emits the same single path at global scope (rebased by the layout)', () => {
    const results = generateRules(makeCanonical({ rules: [rootRule, makeRule()] }), globalCtx());
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(KIMI_CODE_ROOT_FILE);
  });

  it('skips rules addressed to other targets', () => {
    const results = generateRules(
      makeCanonical({ rules: [rootRule, makeRule({ targets: ['warp'] })] }),
      projectCtx(),
    );
    expect(results[0]!.content).toBe('# Root\n\nUse TDD.');
  });

  it('returns nothing when there is no rule content', () => {
    expect(generateRules(makeCanonical(), projectCtx())).toHaveLength(0);
  });
});

describe('generateAgents (kimi-code)', () => {
  it('writes one native agent file per canonical agent', () => {
    const results = generateAgents(makeCanonical({ agents: [makeAgent()] }));
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(`${KIMI_CODE_AGENTS_DIR}/code-reviewer.md`);
    expect(results[0]!.content).toContain('name: code-reviewer');
    expect(results[0]!.content).toContain('description: Reviews diffs for defects');
    expect(results[0]!.content).toContain('Review the diff and report defects.');
  });

  it('emits disallowedTools when set and omits it otherwise', () => {
    const [withDeny] = generateAgents(
      makeCanonical({ agents: [makeAgent({ disallowedTools: ['Bash'] })] }),
    );
    expect(withDeny!.content).toContain('disallowedTools:');
    const [withoutDeny] = generateAgents(makeCanonical({ agents: [makeAgent()] }));
    expect(withoutDeny!.content).not.toContain('disallowedTools:');
  });

  it('omits an empty tool list and tolerates an empty body', () => {
    const [out] = generateAgents(
      makeCanonical({ agents: [makeAgent({ tools: [], body: '   ' })] }),
    );
    expect(out!.content).not.toContain('tools:');
    expect(out!.content.trimEnd()).toBe(
      '---\nname: code-reviewer\ndescription: Reviews diffs for defects\n---',
    );
  });

  it('never emits keys Kimi Code agent frontmatter does not define', () => {
    const [out] = generateAgents(
      makeCanonical({
        agents: [makeAgent({ model: 'kimi-k2', maxTurns: 4, memory: 'notes.md' })],
      }),
    );
    expect(out!.content).not.toContain('model:');
    expect(out!.content).not.toContain('maxTurns:');
    expect(out!.content).not.toContain('memory:');
  });
});

describe('generateSkills / generateCommands (kimi-code)', () => {
  it('writes skill bundles under .kimi-code/skills', () => {
    const results = generateSkills(
      makeCanonical({
        skills: [
          makeSkill({
            supportingFiles: [{ relativePath: 'references/checklist.md', content: '- one' }],
          }),
        ],
      }),
    );
    expect(results.map((r) => r.path)).toEqual([
      `${KIMI_CODE_SKILLS_DIR}/api-generator/SKILL.md`,
      `${KIMI_CODE_SKILLS_DIR}/api-generator/references/checklist.md`,
    ]);
  });

  it('projects commands as skills using the shared serializer', () => {
    const results = generateCommands(makeCanonical({ commands: [makeCommand()] }));
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(`${KIMI_CODE_SKILLS_DIR}/am-command-review/SKILL.md`);
    expect(results[0]!.content).toContain('x-agentsmesh-kind: command');
  });
});

describe('generateMcp (kimi-code)', () => {
  it('writes mcpServers to .kimi-code/mcp.json in both scopes', () => {
    const canonical = makeCanonical({
      mcp: { mcpServers: { context7: { type: 'stdio', command: 'npx', args: [], env: {} } } },
    });
    for (const ctx of [projectCtx(), globalCtx()]) {
      const results = generateMcp(canonical, ctx);
      expect(results).toHaveLength(1);
      expect(results[0]!.path).toBe(KIMI_CODE_MCP_FILE);
      expect(JSON.parse(results[0]!.content)).toEqual({
        mcpServers: {
          context7: { transport: 'stdio', type: 'stdio', command: 'npx', args: [], env: {} },
        },
      });
    }
  });

  it('writes nothing when there are no servers', () => {
    expect(generateMcp(makeCanonical({ mcp: { mcpServers: {} } }), projectCtx())).toHaveLength(0);
    expect(generateMcp(makeCanonical(), projectCtx())).toHaveLength(0);
  });
});

describe('hook and permission stubs (kimi-code)', () => {
  it('emit nothing: there is no project-level config.toml', () => {
    const canonical = makeCanonical({
      hooks: { PostToolUse: [{ matcher: 'Write', command: 'fmt' }] },
      permissions: { allow: ['Read'], deny: [], ask: [] },
    });
    expect(generateHooks(canonical)).toEqual([]);
    expect(generatePermissions(canonical)).toEqual([]);
  });
});
