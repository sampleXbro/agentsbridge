import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CanonicalAgent } from '../../../../src/core/types.js';
import { importFromContinue } from '../../../../src/targets/continue/importer.js';
import { generateAgents } from '../../../../src/targets/continue/generator.js';
import { CONTINUE_AGENTS_DIR } from '../../../../src/targets/continue/constants.js';
import { parseFrontmatter } from '../../../../src/utils/text/markdown.js';

const TEST_DIR = join(tmpdir(), 'am-continue-agents-import-test');

beforeEach(() => mkdirSync(join(TEST_DIR, CONTINUE_AGENTS_DIR), { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

function makeAgent(overrides: Partial<CanonicalAgent> = {}): CanonicalAgent {
  return {
    source: '/proj/.agentsmesh/agents/reviewer.md',
    name: 'reviewer',
    description: 'Reviews code for quality',
    tools: ['Read', 'Grep'],
    disallowedTools: ['Bash'],
    model: 'sonnet',
    permissionMode: 'acceptEdits',
    maxTurns: 7,
    mcpServers: ['github'],
    hooks: {},
    skills: ['api-generator'],
    memory: 'notes.md',
    body: 'You review code.',
    ...overrides,
  };
}

function writeGenerated(scope: 'project' | 'global'): void {
  for (const out of generateAgents(
    {
      rules: [],
      commands: [],
      agents: [makeAgent()],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    },
    { capability: { level: 'native' }, scope },
  )) {
    writeFileSync(join(TEST_DIR, out.path), out.content);
  }
}

describe('importFromContinue — agents', () => {
  it('round-trips a generated markdown agent without losing metadata', async () => {
    writeGenerated('project');

    const results = await importFromContinue(TEST_DIR, { scope: 'project' });

    expect(results).toEqual([
      {
        fromTool: 'continue',
        fromPath: join(TEST_DIR, CONTINUE_AGENTS_DIR, 'reviewer.md'),
        toPath: '.agentsmesh/agents/reviewer.md',
        feature: 'agents',
      },
    ]);
    const { frontmatter, body } = parseFrontmatter(
      readFileSync(join(TEST_DIR, '.agentsmesh/agents/reviewer.md'), 'utf-8'),
    );
    expect(frontmatter).toEqual({
      name: 'reviewer',
      description: 'Reviews code for quality',
      tools: ['Read', 'Grep'],
      disallowedTools: ['Bash'],
      model: 'sonnet',
      permissionMode: 'acceptEdits',
      maxTurns: 7,
      mcpServers: ['github'],
      skills: ['api-generator'],
      memory: 'notes.md',
    });
    expect(body).toBe('You review code.');
  });

  it('round-trips the same markdown agent at global scope', async () => {
    writeGenerated('global');

    const results = await importFromContinue(TEST_DIR, { scope: 'global' });

    expect(results).toEqual([
      {
        fromTool: 'continue',
        fromPath: join(TEST_DIR, CONTINUE_AGENTS_DIR, 'reviewer.md'),
        toPath: '.agentsmesh/agents/reviewer.md',
        feature: 'agents',
      },
    ]);
  });

  it('imports a hand-written Continue agent file with a comma-separated tools string', async () => {
    writeFileSync(
      join(TEST_DIR, CONTINUE_AGENTS_DIR, 'helper.md'),
      '---\nname: helper\ndescription: Helps\ntools: Read, Grep\n---\nBe helpful.\n',
    );

    await importFromContinue(TEST_DIR, { scope: 'project' });

    const { frontmatter } = parseFrontmatter(
      readFileSync(join(TEST_DIR, '.agentsmesh/agents/helper.md'), 'utf-8'),
    );
    expect(frontmatter).toEqual({
      name: 'helper',
      description: 'Helps',
      tools: ['Read', 'Grep'],
    });
  });

  /**
   * `.continue/agents/*.yaml` is a Continue *assistant profile* (models, context,
   * docs) at both scopes — a different artifact class. Importing it as an agent
   * would keep only name/description/prompt and drop the rest, so it is skipped.
   */
  it('leaves user-owned YAML assistant profiles alone at both scopes', async () => {
    writeFileSync(
      join(TEST_DIR, CONTINUE_AGENTS_DIR, 'my-assistant.yaml'),
      'name: my-assistant\nversion: 1.0.0\nschema: v1\nmodels:\n  - uses: anthropic/claude\n',
    );
    writeFileSync(join(TEST_DIR, CONTINUE_AGENTS_DIR, 'legacy.yml'), 'name: legacy\n');

    for (const scope of ['project', 'global'] as const) {
      expect(await importFromContinue(TEST_DIR, { scope })).toEqual([]);
    }
    expect(existsSync(join(TEST_DIR, '.agentsmesh/agents/my-assistant.md'))).toBe(false);
    expect(existsSync(join(TEST_DIR, '.agentsmesh/agents/legacy.md'))).toBe(false);
  });
});
