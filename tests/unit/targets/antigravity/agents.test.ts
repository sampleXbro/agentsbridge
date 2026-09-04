/**
 * Native Antigravity subagents (GAP 2+3).
 *   project: `.agents/agents/<name>.md`
 *   global:  `.gemini/config/agents/<name>/agent.md`
 * Source: antigravity.google/docs/subagents/
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CanonicalAgent, CanonicalFiles } from '../../../../src/core/types.js';
import { generateAgents } from '../../../../src/targets/antigravity/generator.js';
import { importFromAntigravity } from '../../../../src/targets/antigravity/importer.js';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { parseFrontmatter } from '../../../../src/utils/text/markdown.js';
import {
  ANTIGRAVITY_AGENTS_DIR,
  ANTIGRAVITY_GLOBAL_AGENTS_DIR,
} from '../../../../src/targets/antigravity/constants.js';

const TEST_DIR = join(tmpdir(), 'am-antigravity-agents-test');

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

function makeAgent(overrides: Partial<CanonicalAgent> = {}): CanonicalAgent {
  return {
    source: '/proj/.agentsmesh/agents/code-reviewer.md',
    name: 'code-reviewer',
    description: 'Reviews code for quality',
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: 'You review code.',
    ...overrides,
  };
}

describe('generateAgents (antigravity) — native subagent files', () => {
  it('writes .agents/agents/<name>.md with required name and description', () => {
    const results = generateAgents(makeCanonical({ agents: [makeAgent()] }));

    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe('.agents/agents/code-reviewer.md');
    const { frontmatter, body } = parseFrontmatter(results[0]!.content);
    expect(frontmatter.name).toBe('code-reviewer');
    expect(frontmatter.description).toBe('Reviews code for quality');
    expect(body.trim()).toBe('You review code.');
  });

  it('projects the native optional keys tools, model and skills', () => {
    const results = generateAgents(
      makeCanonical({
        agents: [
          makeAgent({ tools: ['Read', 'Grep'], model: 'gemini-3-pro', skills: ['debugging'] }),
        ],
      }),
    );

    const { frontmatter } = parseFrontmatter(results[0]!.content);
    expect(frontmatter.tools).toEqual(['Read', 'Grep']);
    expect(frontmatter.model).toBe('gemini-3-pro');
    expect(frontmatter.skills).toEqual(['debugging']);
  });

  it('omits every optional key that canonical leaves empty', () => {
    const results = generateAgents(makeCanonical({ agents: [makeAgent()] }));
    const { frontmatter } = parseFrontmatter(results[0]!.content);
    expect(Object.keys(frontmatter)).toEqual(['name', 'description']);
  });

  it('keeps canonical-only fields as inert frontmatter so import round-trips', () => {
    const results = generateAgents(
      makeCanonical({
        agents: [
          makeAgent({
            disallowedTools: ['Bash'],
            permissionMode: 'acceptEdits',
            maxTurns: 7,
            mcpServers: ['github'],
            memory: 'notes.md',
          }),
        ],
      }),
    );

    const { frontmatter } = parseFrontmatter(results[0]!.content);
    expect(frontmatter.disallowedTools).toEqual(['Bash']);
    expect(frontmatter.permissionMode).toBe('acceptEdits');
    expect(frontmatter.maxTurns).toBe(7);
    expect(frontmatter.mcpServers).toEqual(['github']);
    expect(frontmatter.memory).toBe('notes.md');
  });

  it('returns [] when there are no agents', () => {
    expect(generateAgents(makeCanonical())).toEqual([]);
  });
});

describe('antigravity agent layout paths', () => {
  it('project agentPath resolves to .agents/agents/<name>.md', () => {
    const layout = getTargetLayout('antigravity', 'project')!;
    expect(layout.paths.agentPath('code-reviewer', {} as never)).toBe(
      '.agents/agents/code-reviewer.md',
    );
  });

  it('global agentPath resolves to the per-agent directory shape', () => {
    const layout = getTargetLayout('antigravity', 'global')!;
    expect(layout.paths.agentPath('code-reviewer', {} as never)).toBe(
      '.gemini/config/agents/code-reviewer/agent.md',
    );
  });

  it('global rewriteGeneratedPath maps the project agent file into the global dir', () => {
    const layout = getTargetLayout('antigravity', 'global')!;
    expect(layout.rewriteGeneratedPath!('.agents/agents/code-reviewer.md')).toBe(
      '.gemini/config/agents/code-reviewer/agent.md',
    );
  });
});

describe('importFromAntigravity — agents', () => {
  beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  it('imports .agents/agents/<name>.md into .agentsmesh/agents/<name>.md', async () => {
    mkdirSync(join(TEST_DIR, ANTIGRAVITY_AGENTS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_AGENTS_DIR, 'code-reviewer.md'),
      '---\nname: code-reviewer\ndescription: Reviews code\ntools: [Read]\n---\n\nReview it.',
    );

    const results = await importFromAntigravity(TEST_DIR);
    const agents = results.filter((r) => r.feature === 'agents');
    expect(agents).toHaveLength(1);
    expect(agents[0]!.toPath).toBe('.agentsmesh/agents/code-reviewer.md');
    const written = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'),
      'utf-8',
    );
    expect(written).toContain('name: code-reviewer');
    expect(written).toContain('Review it.');
  });

  it('flattens the global <name>/agent.md shape to .agentsmesh/agents/<name>.md', async () => {
    mkdirSync(join(TEST_DIR, ANTIGRAVITY_GLOBAL_AGENTS_DIR, 'code-reviewer'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_GLOBAL_AGENTS_DIR, 'code-reviewer', 'agent.md'),
      '---\nname: code-reviewer\ndescription: Reviews code\n---\n\nReview it.',
    );

    const results = await importFromAntigravity(TEST_DIR, { scope: 'global' });
    const agents = results.filter((r) => r.feature === 'agents');
    expect(agents).toHaveLength(1);
    expect(agents[0]!.toPath).toBe('.agentsmesh/agents/code-reviewer.md');
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'))).toBe(true);
  });

  it('also accepts the documented flat global <name>.md shape', async () => {
    mkdirSync(join(TEST_DIR, ANTIGRAVITY_GLOBAL_AGENTS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_GLOBAL_AGENTS_DIR, 'researcher.md'),
      '---\nname: researcher\ndescription: Researches\n---\n\nResearch it.',
    );

    const results = await importFromAntigravity(TEST_DIR, { scope: 'global' });
    expect(results.filter((r) => r.feature === 'agents')[0]!.toPath).toBe(
      '.agentsmesh/agents/researcher.md',
    );
  });

  it('skips non-agent.md files nested inside a global agent directory', async () => {
    mkdirSync(join(TEST_DIR, ANTIGRAVITY_GLOBAL_AGENTS_DIR, 'code-reviewer'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_GLOBAL_AGENTS_DIR, 'code-reviewer', 'agent.md'),
      '---\nname: code-reviewer\ndescription: Reviews code\n---\n\nReview it.',
    );
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_GLOBAL_AGENTS_DIR, 'code-reviewer', 'checklist.md'),
      '# Checklist\n',
    );

    const results = await importFromAntigravity(TEST_DIR, { scope: 'global' });
    expect(results.filter((r) => r.feature === 'agents').map((r) => r.toPath)).toEqual([
      '.agentsmesh/agents/code-reviewer.md',
    ]);
  });

  it('preserves canonical fields Antigravity cannot express (round-trip guard)', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'),
      '---\nname: code-reviewer\ndescription: Reviews code\nmaxTurns: 9\nmcpServers:\n  - github\n---\n\nOld body.',
    );
    mkdirSync(join(TEST_DIR, ANTIGRAVITY_AGENTS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_AGENTS_DIR, 'code-reviewer.md'),
      '---\nname: code-reviewer\ndescription: Reviews code\n---\n\nNew body.',
    );

    await importFromAntigravity(TEST_DIR);
    const written = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'),
      'utf-8',
    );
    expect(written).toContain('maxTurns: 9');
    expect(written).toContain('github');
    expect(written).toContain('New body.');
  });
});
