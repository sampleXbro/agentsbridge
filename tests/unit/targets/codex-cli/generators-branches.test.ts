/**
 * Branch coverage tests for codex-cli/generator/rules.ts and generator/agents.ts.
 * Targets:
 *   - `looksLikeCodexRulesDsl` true/false branches and `toSafeCodexRulesContent` empty body.
 *   - `generateRules` with rule.targets including non-codex (skip), and renderCopilotGlobal*-like
 *     trim/empty cases handled via renderCodexGlobalInstructions.
 *   - serializeAgentToCodexToml: triple-quote escape branch when body contains `'''`.
 */

import { describe, expect, it } from 'vitest';
import {
  generateRules,
  renderCodexGlobalInstructions,
} from '../../../../src/targets/codex-cli/generator/rules.js';
import { generateAgents } from '../../../../src/targets/codex-cli/generator/agents.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  AGENTS_MD,
  CODEX_AGENTS_DIR,
  CODEX_RULES_DIR,
} from '../../../../src/targets/codex-cli/constants.js';

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

describe('generateRules (codex-cli) — branch coverage', () => {
  it('skips non-root rules whose targets exclude codex-cli', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root',
        },
        {
          source: '/p/.agentsmesh/rules/cursor-only.md',
          root: false,
          targets: ['cursor', 'windsurf'],
          description: '',
          globs: [],
          body: 'Cursor-only body',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results.find((r) => r.path.includes('cursor-only'))).toBeUndefined();
    expect(results.find((r) => r.path === AGENTS_MD)).toBeDefined();
  });

  it('keeps non-root rules whose targets explicitly include codex-cli', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/codex.md',
          root: false,
          targets: ['codex-cli'],
          description: 'Codex',
          globs: ['src/**'],
          body: 'For codex.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results.find((r) => r.path === '.codex/instructions/codex.md')).toBeDefined();
  });

  it('emits empty .rules content when execution rule body is whitespace-only', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/empty.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: '   \n  \n',
          codexEmit: 'execution',
        },
      ],
    });
    const results = generateRules(canonical);
    const exec = results.find((r) => r.path === `${CODEX_RULES_DIR}/empty.rules`);
    expect(exec).toBeDefined();
    expect(exec!.content).toBe('');
  });

  it('preserves DSL body verbatim with trailing newline (looksLikeCodexRulesDsl true)', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/dsl.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: 'prefix_rule(\n  pattern = ["git"],\n  decision = "allow",\n)',
          codexEmit: 'execution',
        },
      ],
    });
    const results = generateRules(canonical);
    const exec = results.find((r) => r.path === `${CODEX_RULES_DIR}/dsl.rules`);
    expect(exec).toBeDefined();
    expect(exec!.content.endsWith('\n')).toBe(true);
    expect(exec!.content).toContain('prefix_rule(');
    expect(exec!.content).not.toContain(
      '# agentsmesh: canonical execution rule body is not Codex DSL',
    );
  });
});

describe('renderCodexGlobalInstructions — branch coverage', () => {
  it('returns empty string when there is no root rule and no eligible non-root rules', () => {
    expect(renderCodexGlobalInstructions(makeCanonical())).toBe('');
  });

  it('omits non-root rules whose codexEmit is execution', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root',
        },
        {
          source: '/p/.agentsmesh/rules/exec.md',
          root: false,
          targets: [],
          description: 'Exec',
          globs: [],
          body: 'prefix_rule()',
          codexEmit: 'execution',
        },
        {
          source: '/p/.agentsmesh/rules/advisory.md',
          root: false,
          targets: [],
          description: 'Adv',
          globs: [],
          body: 'Advisory text.',
        },
      ],
    });
    const out = renderCodexGlobalInstructions(canonical);
    expect(out).toContain('Root');
    expect(out).toContain('Advisory text.');
    expect(out).not.toContain('prefix_rule()');
  });

  it('omits non-root rules whose targets exclude codex-cli', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/cursor.md',
          root: false,
          targets: ['cursor'],
          description: 'Cursor',
          globs: [],
          body: 'Cursor only body.',
        },
      ],
    });
    const out = renderCodexGlobalInstructions(canonical);
    expect(out).not.toContain('Cursor only body.');
  });
});

describe('generateAgents (codex-cli) — branch coverage', () => {
  function baseAgent(): CanonicalFiles['agents'][number] {
    return {
      source: '',
      name: 'a',
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
      body: '',
    };
  }

  it('omits description and model when empty', () => {
    const canonical = makeCanonical({ agents: [{ ...baseAgent(), name: 'minimal' }] });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(`${CODEX_AGENTS_DIR}/minimal.toml`);
    expect(results[0]!.content).toContain('name = "minimal"');
    expect(results[0]!.content).not.toContain('description');
    expect(results[0]!.content).not.toContain('model');
    // Empty body still produces developer_instructions block with empty content.
    expect(results[0]!.content).toContain("developer_instructions = '''");
  });

  it('maps permissionMode "deny" to sandbox_mode "read-only"', () => {
    const canonical = makeCanonical({
      agents: [{ ...baseAgent(), name: 'denied', permissionMode: 'deny' }],
    });
    const out = generateAgents(canonical)[0]!.content;
    expect(out).toContain('sandbox_mode = "read-only"');
  });

  it('maps permissionMode "allow" to sandbox_mode "workspace-write"', () => {
    const canonical = makeCanonical({
      agents: [{ ...baseAgent(), name: 'open', permissionMode: 'allow' }],
    });
    const out = generateAgents(canonical)[0]!.content;
    expect(out).toContain('sandbox_mode = "workspace-write"');
  });

  it('omits sandbox_mode for unknown permissionMode values', () => {
    const canonical = makeCanonical({
      agents: [{ ...baseAgent(), name: 'unset', permissionMode: 'ask' }],
    });
    const out = generateAgents(canonical)[0]!.content;
    expect(out).not.toContain('sandbox_mode');
  });

  it('uses triple-double-quote escape when body contains triple-single-quote literals', () => {
    const canonical = makeCanonical({
      agents: [
        {
          ...baseAgent(),
          name: 'escapes',
          body: "Use ''' triple quotes\nand \\backslashes\\.",
        },
      ],
    });
    const out = generateAgents(canonical)[0]!.content;
    expect(out).toContain('developer_instructions = """');
    // backslashes doubled, double-quotes escaped (no double-quotes in this body, so check escape rules ran)
    expect(out).toContain('\\\\backslashes\\\\');
  });
});
