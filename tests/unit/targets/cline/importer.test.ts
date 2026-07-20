/**
 * Cline importer tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromCline } from '../../../../src/targets/cline/importer.js';
import {
  CLINE_RULES_DIR,
  CLINE_IGNORE,
  CLINE_MCP_SETTINGS,
  CLINE_SKILLS_DIR,
  CLINE_WORKFLOWS_DIR,
  CLINE_AGENTS_FILE,
  CLINE_AGENTS_DIR,
} from '../../../../src/targets/cline/constants.js';

const TEST_DIR = join(tmpdir(), 'am-cline-importer-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromCline', () => {
  it('imports .cline/rules/_root.md into _root.md with root frontmatter', async () => {
    mkdirSync(join(TEST_DIR, CLINE_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, CLINE_RULES_DIR, '_root.md'), '# Cline Rules\n- Use TDD\n');
    const results = await importFromCline(TEST_DIR);
    expect(results.length).toBe(1);
    expect(results[0]!.fromTool).toBe('cline');
    expect(results[0]!.toPath).toBe('.agentsmesh/rules/_root.md');
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Cline Rules');
    expect(content).toContain('- Use TDD');
  });

  it('imports first .cline/rules/*.md as root when no _root.md', async () => {
    mkdirSync(join(TEST_DIR, CLINE_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, CLINE_RULES_DIR, 'first.md'), '# First Rule\n');
    const results = await importFromCline(TEST_DIR);
    expect(results.length).toBe(1);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# First Rule');
  });

  it('imports .cline/rules/*.md non-root rules with frontmatter', async () => {
    mkdirSync(join(TEST_DIR, CLINE_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, CLINE_RULES_DIR, '_root.md'), 'Root');
    writeFileSync(
      join(TEST_DIR, CLINE_RULES_DIR, 'typescript.md'),
      '---\ndescription: TS rules\nglobs: ["src/**/*.ts"]\n---\n\nUse strict TS.',
    );
    const results = await importFromCline(TEST_DIR);
    const ruleResult = results.find((r) => r.toPath === '.agentsmesh/rules/typescript.md');
    expect(ruleResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('root: false');
    expect(content).toContain('description: TS rules');
    expect(content).toContain('Use strict TS.');
  });

  it('imports .clineignore into .agentsmesh/ignore', async () => {
    writeFileSync(join(TEST_DIR, CLINE_IGNORE), 'node_modules/\ndist/\n.env\n');
    const results = await importFromCline(TEST_DIR);
    const ignoreResult = results.find((r) => r.toPath === '.agentsmesh/ignore');
    expect(ignoreResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('dist/');
    expect(content).toContain('.env');
  });

  it('imports .cline/mcp.json into .agentsmesh/mcp.json', async () => {
    mkdirSync(join(TEST_DIR, '.cline'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CLINE_MCP_SETTINGS),
      JSON.stringify({
        mcpServers: {
          fs: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] },
        },
      }),
    );
    const results = await importFromCline(TEST_DIR);
    const mcpResult = results.find((r) => r.toPath === '.agentsmesh/mcp.json');
    expect(mcpResult).toBeDefined();
    const mcp = JSON.parse(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, { command: string }>;
    };
    expect(mcp.mcpServers.fs).toBeDefined();
    expect(mcp.mcpServers.fs!.command).toBe('npx');
  });

  it('maps transportType to type when importing mcp.json', async () => {
    mkdirSync(join(TEST_DIR, '.cline'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CLINE_MCP_SETTINGS),
      JSON.stringify({
        mcpServers: {
          server: { transportType: 'stdio', command: 'echo' },
        },
      }),
    );
    const results = await importFromCline(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/mcp.json')).toBe(true);
    const mcp = JSON.parse(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, { type: string; command: string }>;
    };
    expect(mcp.mcpServers.server!.type).toBe('stdio');
  });

  it('imports .cline/skills/*/SKILL.md into .agentsmesh/skills/*/SKILL.md', async () => {
    const skillDir = join(TEST_DIR, CLINE_SKILLS_DIR, 'review');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\ndescription: Code review skill\n---\n\nRun code review.',
    );
    const results = await importFromCline(TEST_DIR);
    const skillResult = results.find((r) => r.toPath === '.agentsmesh/skills/review/SKILL.md');
    expect(skillResult).toBeDefined();
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'review', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('description: Code review skill');
    expect(content).toContain('Run code review');
  });

  it('imports projected agent skills back into canonical agents', async () => {
    const skillDir = join(TEST_DIR, CLINE_SKILLS_DIR, 'am-agent-reviewer');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'description: Review specialist',
        'x-agentsmesh-kind: agent',
        'x-agentsmesh-name: reviewer',
        'x-agentsmesh-tools:',
        '  - Read',
        '  - Grep',
        'x-agentsmesh-model: sonnet',
        'x-agentsmesh-permission-mode: ask',
        'x-agentsmesh-max-turns: 9',
        '---',
        '',
        'Review risky changes first.',
      ].join('\n'),
    );
    const results = await importFromCline(TEST_DIR);
    expect(results.find((r) => r.toPath === '.agentsmesh/agents/reviewer.md')).toBeDefined();
    expect(
      results.find((r) => r.toPath === '.agentsmesh/skills/am-agent-reviewer/SKILL.md'),
    ).toBeUndefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'agents', 'reviewer.md'), 'utf-8');
    expect(content).toContain('name: reviewer');
    expect(content).toContain('description: Review specialist');
    expect(content).toContain('Review risky changes first.');
  });

  it('imports agents from per-agent .cline/agents/<name>.md directory (fallback format) when agents.yaml absent', async () => {
    const agentsDir = join(TEST_DIR, CLINE_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(
      join(agentsDir, 'reviewer.md'),
      [
        '---',
        'name: reviewer',
        'description: Review specialist',
        'model: sonnet',
        'tools:',
        '  - Read',
        'disallowedTools:',
        '  - Bash(rm -rf *)',
        'permissionMode: ask',
        'maxTurns: 9',
        '---',
        '',
        'Review risky changes first.',
      ].join('\n'),
    );

    const results = await importFromCline(TEST_DIR);
    expect(results.find((r) => r.toPath === '.agentsmesh/agents/reviewer.md')).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'agents', 'reviewer.md'), 'utf-8');
    expect(content).toContain('name: reviewer');
    expect(content).toContain('description: Review specialist');
    expect(content).toContain('Review risky changes first.');
  });

  it('prefers .cline/agents.yaml over per-agent directory when both present', async () => {
    // Directory present (fallback format)
    const agentsDir = join(TEST_DIR, CLINE_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(agentsDir, 'from-dir.md'), '---\nname: from-dir\n---\n\nFrom directory.');
    // Primary format (YAML)
    mkdirSync(join(TEST_DIR, '.cline'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CLINE_AGENTS_FILE),
      ['agents:', '  - name: from-yaml', '    prompt: From YAML.'].join('\n'),
    );

    const results = await importFromCline(TEST_DIR);

    // Only the YAML-based agent is imported (primary wins)
    expect(results.some((r) => r.toPath === '.agentsmesh/agents/from-yaml.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/agents/from-dir.md')).toBe(false);
  });

  it('imports agents from the combined .cline/agents.yaml and restores agentsmesh extension metadata', async () => {
    mkdirSync(join(TEST_DIR, '.cline'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CLINE_AGENTS_FILE),
      [
        'agents:',
        '  - name: reviewer',
        '    description: Review specialist',
        '    tools:',
        '      - Read',
        '    model: sonnet',
        '    prompt: Review risky changes first.',
        '    x-agentsmesh-disallowed-tools:',
        '      - Bash(rm -rf *)',
        '    x-agentsmesh-permission-mode: ask',
        '    x-agentsmesh-max-turns: 9',
        '    x-agentsmesh-mcp-servers:',
        '      - context7',
        '    x-agentsmesh-skills:',
        '      - post-feature-qa',
        '    x-agentsmesh-memory: notes/reviewer.md',
      ].join('\n'),
    );

    const results = await importFromCline(TEST_DIR);

    expect(results.find((r) => r.toPath === '.agentsmesh/agents/reviewer.md')).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'agents', 'reviewer.md'), 'utf-8');
    expect(content).toContain('name: reviewer');
    expect(content).toContain('description: Review specialist');
    expect(content).toContain('disallowedTools:');
    expect(content).toContain('permissionMode: ask');
    expect(content).toContain('maxTurns: 9');
    expect(content).toContain('mcpServers:');
    expect(content).toContain('skills:');
    expect(content).toContain('memory: notes/reviewer.md');
    expect(content).toContain('Review risky changes first.');
  });

  it('imports multiple agents from a single .cline/agents.yaml', async () => {
    mkdirSync(join(TEST_DIR, '.cline'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CLINE_AGENTS_FILE),
      [
        'agents:',
        '  - name: reviewer',
        '    prompt: Review first.',
        '  - name: researcher',
        '    prompt: Research first.',
      ].join('\n'),
    );

    const results = await importFromCline(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/agents/reviewer.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/agents/researcher.md')).toBe(true);
  });

  it('imports skill supporting files', async () => {
    const skillDir = join(TEST_DIR, CLINE_SKILLS_DIR, 'review');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\n---\n\nSkill body');
    writeFileSync(join(skillDir, 'template.ts'), 'export function run() {}');
    const results = await importFromCline(TEST_DIR);
    const templateResult = results.find(
      (r) => r.toPath === '.agentsmesh/skills/review/template.ts',
    );
    expect(templateResult).toBeDefined();
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'review', 'template.ts'),
      'utf-8',
    );
    expect(content).toBe('export function run() {}');
  });

  it('imports all sources when all exist', async () => {
    mkdirSync(join(TEST_DIR, CLINE_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, CLINE_RULES_DIR, '_root.md'), 'Root');
    writeFileSync(join(TEST_DIR, CLINE_RULES_DIR, 'foo.md'), '---\n---\n\nFoo body');
    writeFileSync(join(TEST_DIR, CLINE_IGNORE), '*.log\n');
    mkdirSync(join(TEST_DIR, '.cline'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CLINE_MCP_SETTINGS),
      JSON.stringify({ mcpServers: { x: { command: 'echo' } } }),
    );
    const skillDir = join(TEST_DIR, CLINE_SKILLS_DIR, 'test');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'Skill');

    const results = await importFromCline(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/foo.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/ignore')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/mcp.json')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/skills/test/SKILL.md')).toBe(true);
  });

  it('imports .clinerules/workflows/*.md as canonical commands', async () => {
    const workflowsDir = join(TEST_DIR, CLINE_WORKFLOWS_DIR);
    mkdirSync(workflowsDir, { recursive: true });
    writeFileSync(
      join(workflowsDir, 'deploy.md'),
      '---\ndescription: Deploy workflow\n---\n\nRun deploy steps.',
    );
    const results = await importFromCline(TEST_DIR);
    const cmdResult = results.find((r) => r.toPath === '.agentsmesh/commands/deploy.md');
    expect(cmdResult).toBeDefined();
    expect(cmdResult?.fromTool).toBe('cline');
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'deploy.md'), 'utf-8');
    expect(content).toContain('description: Deploy workflow');
  });

  it('preserves existing canonical command metadata when importing body-only workflows', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'deploy.md'),
      '---\ndescription: Deploy workflow\nallowed-tools:\n  - Bash(pnpm deploy)\n---\n\nOld deploy body.',
    );
    const workflowsDir = join(TEST_DIR, CLINE_WORKFLOWS_DIR);
    mkdirSync(workflowsDir, { recursive: true });
    writeFileSync(join(workflowsDir, 'deploy.md'), 'New deploy body.\n');

    await importFromCline(TEST_DIR);

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'deploy.md'), 'utf-8');
    expect(content).toContain('description: Deploy workflow');
    expect(content).toContain('allowed-tools:');
    expect(content).toContain('Bash(pnpm deploy)');
    expect(content).toContain('New deploy body.');
    expect(content).not.toContain('Old deploy body.');
  });

  it('imports AGENTS.md as root when no .clinerules exists', async () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Project Instructions\n- Use TDD\n');
    const results = await importFromCline(TEST_DIR);
    expect(results.length).toBe(1);
    expect(results[0]!.fromTool).toBe('cline');
    expect(results[0]!.toPath).toBe('.agentsmesh/rules/_root.md');
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Project Instructions');
    expect(content).toContain('- Use TDD');
  });

  it('normalizes Cline-specific path references in AGENTS.md content', async () => {
    const skillDir = join(TEST_DIR, CLINE_SKILLS_DIR, 'review');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\ndescription: Review\n---\n\nReview code.');
    writeFileSync(
      join(TEST_DIR, 'AGENTS.md'),
      '# Project\nSee .cline/skills/review/SKILL.md for the review skill.\n',
    );
    await importFromCline(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('.agentsmesh/skills/review/SKILL.md');
    expect(content).not.toContain('.cline/skills/review/SKILL.md');
  });

  it('does not use AGENTS.md when .clinerules directory exists', async () => {
    mkdirSync(join(TEST_DIR, CLINE_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, CLINE_RULES_DIR, '_root.md'), '# Cline Root\n');
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Different AGENTS.md\n');
    await importFromCline(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('# Cline Root');
    expect(content).not.toContain('# Different AGENTS.md');
  });

  it('returns empty when no Cline config found', async () => {
    const results = await importFromCline(TEST_DIR);
    expect(results).toEqual([]);
  });

  it('skips malformed mcp.json without crash', async () => {
    mkdirSync(join(TEST_DIR, '.cline'), { recursive: true });
    writeFileSync(join(TEST_DIR, CLINE_MCP_SETTINGS), 'not json');
    mkdirSync(join(TEST_DIR, CLINE_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, CLINE_RULES_DIR, '_root.md'), 'Root');
    const results = await importFromCline(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/mcp.json')).toBe(false);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBe(true);
  });

  it('skips _root.md in rules when already set from _root.md', async () => {
    mkdirSync(join(TEST_DIR, CLINE_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, CLINE_RULES_DIR, '_root.md'), 'From _root');
    writeFileSync(join(TEST_DIR, CLINE_RULES_DIR, 'other.md'), '---\nroot: true\n---\n\nOther');
    const results = await importFromCline(TEST_DIR);
    const rootContent = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(rootContent).toContain('From _root');
    expect(results.filter((r) => r.toPath === '.agentsmesh/rules/_root.md')).toHaveLength(1);
  });
});
