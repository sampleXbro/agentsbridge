/**
 * Integration test for agentsmesh import.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'am-integration-import');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('agentsmesh import (integration)', () => {
  it('imports CLAUDE.md to .agentsmesh/rules/_root.md', () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Project Rules\n\nUse TypeScript.');
    execSync(`node ${CLI_PATH} import --from claude-code`, { cwd: TEST_DIR });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Project Rules');
    expect(content).toContain('Use TypeScript.');
  });

  it('imports .claude/rules/*.md to .agentsmesh/rules/', () => {
    mkdirSync(join(TEST_DIR, '.claude', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'rules', 'typescript.md'),
      '---\ndescription: TS rules\n---\n\nUse strict mode.',
    );
    execSync(`node ${CLI_PATH} import --from claude-code`, { cwd: TEST_DIR });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('description: TS rules');
    expect(content).toContain('Use strict mode.');
  });

  it('import then generate produces target files', () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n\nUse TDD.');
    execSync(`node ${CLI_PATH} import --from claude-code`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    expect(readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8')).toContain('Use TDD.');
    const cursorRule = readFileSync(join(TEST_DIR, '.cursor', 'rules', 'general.mdc'), 'utf-8');
    expect(cursorRule).toContain('Use TDD.');
  });

  it('fails when --from is missing', () => {
    expect(() => execSync(`node ${CLI_PATH} import`, { cwd: TEST_DIR })).toThrow();
  });

  it('fails when --from is unknown', () => {
    expect(() => execSync(`node ${CLI_PATH} import --from unknown`, { cwd: TEST_DIR })).toThrow();
  });

  it('imports AGENTS.md to .agentsmesh/rules/_root.md (cursor)', () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Cursor Rules\n\nUse TDD.');
    execSync(`node ${CLI_PATH} import --from cursor`, { cwd: TEST_DIR });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Cursor Rules');
    expect(content).toContain('Use TDD.');
  });

  it('imports .cursor/rules/*.mdc to .agentsmesh/rules/ (cursor)', () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'rules', 'typescript.mdc'),
      '---\ndescription: TS standards\nalwaysApply: false\n---\n\nUse strict mode.',
    );
    execSync(`node ${CLI_PATH} import --from cursor`, { cwd: TEST_DIR });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('description: TS standards');
    expect(content).toContain('Use strict mode.');
  });

  it('import from cursor then generate produces target files', () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Root\n\nUse TDD.');
    execSync(`node ${CLI_PATH} import --from cursor`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const claudeMd = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('Use TDD.');
    const cursorRule = readFileSync(join(TEST_DIR, '.cursor', 'rules', 'general.mdc'), 'utf-8');
    expect(cursorRule).toContain('Use TDD.');
  });

  it('imports Continue rules and regenerates Continue artifacts', () => {
    mkdirSync(join(TEST_DIR, '.continue', 'rules'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.continue', 'prompts'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.continue', 'mcpServers'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.continue', 'rules', '_root.md'),
      '---\nname: Project Rules\n---\n\nUse TDD.',
    );
    writeFileSync(
      join(TEST_DIR, '.continue', 'prompts', 'review.md'),
      [
        '---',
        'description: Review current changes',
        'x-agentsmesh-kind: command',
        'x-agentsmesh-name: review',
        'x-agentsmesh-allowed-tools:',
        '  - Read',
        '---',
        '',
        'Review the diff before merge.',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(TEST_DIR, '.continue', 'mcpServers', 'servers.json'),
      JSON.stringify(
        {
          mcpServers: {
            context7: {
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@upstash/context7-mcp'],
              env: {},
            },
          },
        },
        null,
        2,
      ),
    );

    execSync(`node ${CLI_PATH} import --from continue`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [continue]
features: [rules, commands, mcp]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });

    const rootRule = readFileSync(join(TEST_DIR, '.continue', 'rules', 'general.md'), 'utf-8');
    const promptFile = readFileSync(join(TEST_DIR, '.continue', 'prompts', 'review.md'), 'utf-8');
    const mcpJson = readFileSync(
      join(TEST_DIR, '.continue', 'mcpServers', 'agentsmesh.json'),
      'utf-8',
    );

    expect(rootRule).toContain('Use TDD.');
    expect(promptFile).toContain('x-agentsmesh-kind: command');
    expect(promptFile).toContain('Review the diff before merge.');
    expect(mcpJson).toContain('context7');
  });

  it('imports Junie guidelines, mcp, and .aiignore then regenerates Junie artifacts', () => {
    mkdirSync(join(TEST_DIR, '.junie', 'mcp'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.junie', 'AGENTS.md'), '# Junie Rules\n\nUse TDD.');
    writeFileSync(
      join(TEST_DIR, '.junie', 'mcp', 'mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'], env: {} },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(TEST_DIR, '.aiignore'), '.env\nnode_modules/\n');

    execSync(`node ${CLI_PATH} import --from junie`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [junie]
features: [rules, mcp, ignore]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });

    expect(readFileSync(join(TEST_DIR, '.junie', 'AGENTS.md'), 'utf-8')).toContain('Use TDD.');
    expect(readFileSync(join(TEST_DIR, '.junie', 'mcp', 'mcp.json'), 'utf-8')).toContain(
      'context7',
    );
    expect(readFileSync(join(TEST_DIR, '.aiignore'), 'utf-8')).toContain('node_modules/');
  });

  it('imports Kiro AGENTS, steering, hooks, mcp, and ignore then regenerates Kiro artifacts', () => {
    mkdirSync(join(TEST_DIR, '.kiro', 'steering'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.kiro', 'hooks'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.kiro', 'settings'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Kiro Rules\n\nUse TDD.');
    writeFileSync(
      join(TEST_DIR, '.kiro', 'steering', 'typescript.md'),
      '---\ninclusion: fileMatch\nfileMatchPattern: src/**/*.ts\n---\n\nUse strict TypeScript.\n',
    );
    writeFileSync(
      join(TEST_DIR, '.kiro', 'hooks', 'review-on-save.kiro.hook'),
      JSON.stringify({
        name: 'Review on save',
        version: '1',
        when: { type: 'preToolUse', tools: ['write'] },
        then: { type: 'askAgent', prompt: 'Review the latest changes.' },
      }),
    );
    writeFileSync(
      join(TEST_DIR, '.kiro', 'settings', 'mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'], env: {} },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(TEST_DIR, '.kiroignore'), '.env\nnode_modules/\n');

    execSync(`node ${CLI_PATH} import --from kiro`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [kiro]
features: [rules, skills, mcp, hooks, ignore]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });

    expect(readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8')).toContain('Use TDD.');
    expect(readFileSync(join(TEST_DIR, '.kiro', 'steering', 'typescript.md'), 'utf-8')).toContain(
      'fileMatchPattern: src/**/*.ts',
    );
    expect(
      readFileSync(join(TEST_DIR, '.kiro', 'hooks', 'pre-tool-use-1.kiro.hook'), 'utf-8'),
    ).toContain('Review the latest changes.');
    expect(readFileSync(join(TEST_DIR, '.kiro', 'settings', 'mcp.json'), 'utf-8')).toContain(
      'context7',
    );
    expect(readFileSync(join(TEST_DIR, '.kiroignore'), 'utf-8')).toContain('node_modules/');
  });

  it('import from codex-cli then generate produces only AGENTS.md', () => {
    writeFileSync(join(TEST_DIR, 'codex.md'), '# Codex Rules\n\nUse TDD.');
    execSync(`node ${CLI_PATH} import --from codex-cli`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [codex-cli]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const agents = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8');
    expect(agents).toContain('Use TDD.');
  });

  it('import from windsurf then generate produces AGENTS.md and .codeiumignore', () => {
    writeFileSync(join(TEST_DIR, '.windsurfrules'), '# Windsurf Rules\n\nUse TDD.');
    writeFileSync(join(TEST_DIR, '.windsurfignore'), 'node_modules/\n');
    execSync(`node ${CLI_PATH} import --from windsurf`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [windsurf]
features: [rules, ignore]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const agents = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8');
    const codeiumIgnore = readFileSync(join(TEST_DIR, '.codeiumignore'), 'utf-8');
    expect(agents).toContain('Use TDD.');
    expect(codeiumIgnore).toContain('node_modules/');
  });

  it('windsurf AGENTS.md fallback normalizes codex-style skill directory links back to canonical', () => {
    mkdirSync(join(TEST_DIR, '.agents', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(join(TEST_DIR, '.agents', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(
        TEST_DIR,
        '.agents',
        'skills',
        'post-feature-qa',
        'references',
        'edge-case-checklist.md',
      ),
      '# Edge Cases\n',
    );
    writeFileSync(
      join(TEST_DIR, 'AGENTS.md'),
      'Use `.agents/skills/post-feature-qa/` and `.agents/skills/post-feature-qa/references/edge-case-checklist.md`.\n',
    );

    execSync(`node ${CLI_PATH} import --from windsurf`, { cwd: TEST_DIR });

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('.agentsmesh/skills/post-feature-qa/');
    expect(content).toContain(
      '.agentsmesh/skills/post-feature-qa/references/edge-case-checklist.md',
    );
    expect(content).not.toContain('.agents/skills/post-feature-qa/');
  });

  it('cline root import normalizes codex-style skill directory links back to canonical', () => {
    mkdirSync(join(TEST_DIR, '.agents', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    mkdirSync(join(TEST_DIR, '.clinerules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.agents', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(
        TEST_DIR,
        '.agents',
        'skills',
        'post-feature-qa',
        'references',
        'edge-case-checklist.md',
      ),
      '# Edge Cases\n',
    );
    writeFileSync(
      join(TEST_DIR, '.clinerules', '_root.md'),
      'Use `.agents/skills/post-feature-qa/` and `.agents/skills/post-feature-qa/references/edge-case-checklist.md`.\n',
    );

    execSync(`node ${CLI_PATH} import --from cline`, { cwd: TEST_DIR });

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('.agentsmesh/skills/post-feature-qa/');
    expect(content).toContain(
      '.agentsmesh/skills/post-feature-qa/references/edge-case-checklist.md',
    );
    expect(content).not.toContain('.agents/skills/post-feature-qa/');
  });

  it('claude root import normalizes codex-style skill directory links back to canonical', () => {
    mkdirSync(join(TEST_DIR, '.agents', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(join(TEST_DIR, '.agents', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(
        TEST_DIR,
        '.agents',
        'skills',
        'post-feature-qa',
        'references',
        'edge-case-checklist.md',
      ),
      '# Edge Cases\n',
    );
    writeFileSync(
      join(TEST_DIR, 'CLAUDE.md'),
      'Use `.agents/skills/post-feature-qa/` and `.agents/skills/post-feature-qa/references/edge-case-checklist.md`.\n',
    );

    execSync(`node ${CLI_PATH} import --from claude-code`, { cwd: TEST_DIR });

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('.agentsmesh/skills/post-feature-qa/');
    expect(content).toContain(
      '.agentsmesh/skills/post-feature-qa/references/edge-case-checklist.md',
    );
    expect(content).not.toContain('.agents/skills/post-feature-qa/');
  });

  it('imports .github/copilot-instructions.md to .agentsmesh/rules/_root.md (copilot)', () => {
    mkdirSync(join(TEST_DIR, '.github'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.github', 'copilot-instructions.md'),
      '# Copilot Rules\n\nUse TDD.',
    );
    execSync(`node ${CLI_PATH} import --from copilot`, { cwd: TEST_DIR });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Copilot Rules');
    expect(content).toContain('Use TDD.');
  });

  it('import from copilot then generate produces .github/copilot-instructions.md', () => {
    mkdirSync(join(TEST_DIR, '.github'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.github', 'copilot-instructions.md'),
      '# Copilot Rules\n\nUse TDD.',
    );
    execSync(`node ${CLI_PATH} import --from copilot`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [copilot]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const copilotInstructions = readFileSync(
      join(TEST_DIR, '.github', 'copilot-instructions.md'),
      'utf-8',
    );
    expect(copilotInstructions).toContain('Use TDD.');
  });

  it('import from copilot prompt file then generate preserves .github/prompts/*.prompt.md', () => {
    mkdirSync(join(TEST_DIR, '.github', 'prompts'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.github', 'prompts', 'review.prompt.md'),
      '---\nagent: agent\ndescription: Review changes\n---\n\nReview the current pull request.',
    );
    execSync(`node ${CLI_PATH} import --from copilot`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [copilot]
features: [commands]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const prompt = readFileSync(join(TEST_DIR, '.github', 'prompts', 'review.prompt.md'), 'utf-8');
    expect(prompt).toContain('description: Review changes');
    expect(prompt).toContain('Review the current pull request.');
  });

  it('import copilot agents then generate produces .github/agents/*.agent.md (roundtrip)', () => {
    mkdirSync(join(TEST_DIR, '.github', 'agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.github', 'agents', 'reviewer.agent.md'),
      '---\nname: reviewer\ndescription: Reviews code\ntools: [read, search]\n---\n\nYou review code.',
    );
    execSync(`node ${CLI_PATH} import --from copilot`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [copilot]
features: [agents]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const agentContent = readFileSync(
      join(TEST_DIR, '.github', 'agents', 'reviewer.agent.md'),
      'utf-8',
    );
    expect(agentContent).toContain('name: reviewer');
    expect(agentContent).toContain('description: Reviews code');
    expect(agentContent).toContain('You review code.');
  });

  it.each([
    ['gemini-cli', '.gemini/skills/am-agent-reviewer/SKILL.md', '.gemini/agents/reviewer.md'],
    [
      'cline',
      '.cline/skills/am-agent-reviewer/SKILL.md',
      '.cline/skills/am-agent-reviewer/SKILL.md',
    ],
    ['codex-cli', '.agents/skills/am-agent-reviewer/SKILL.md', '.codex/agents/reviewer.toml'],
    [
      'windsurf',
      '.windsurf/skills/am-agent-reviewer/SKILL.md',
      '.windsurf/skills/am-agent-reviewer/SKILL.md',
    ],
  ] as const)(
    'import from %s projected agent skill then generate preserves agent projection',
    (target, projectedPath, generatedPath) => {
      mkdirSync(join(TEST_DIR, 'docs'), { recursive: true });
      const fullProjectedPath = join(TEST_DIR, projectedPath);
      mkdirSync(join(fullProjectedPath, '..'), { recursive: true });
      writeFileSync(
        fullProjectedPath,
        `---
description: Reviews code
x-agentsmesh-kind: agent
x-agentsmesh-name: reviewer
x-agentsmesh-tools:
  - Read
  - Grep
x-agentsmesh-model: sonnet
x-agentsmesh-permission-mode: ask
x-agentsmesh-max-turns: 10
---

You review code.`,
      );
      execSync(`node ${CLI_PATH} import --from ${target}`, { cwd: TEST_DIR });
      writeFileSync(
        join(TEST_DIR, 'agentsmesh.yaml'),
        `version: 1
targets: [${target}]
features: [agents]
`,
      );
      execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
      const canonicalAgent = readFileSync(
        join(TEST_DIR, '.agentsmesh', 'agents', 'reviewer.md'),
        'utf-8',
      );
      expect(canonicalAgent).toContain('name: reviewer');
      expect(canonicalAgent).toContain('Reviews code');
      const generated = readFileSync(join(TEST_DIR, generatedPath), 'utf-8');
      expect(generated).toContain('Reviews code');
      expect(generated).toContain('You review code.');
      if (generatedPath === projectedPath) {
        expect(generated).toContain('x-agentsmesh-kind: agent');
      } else {
        expect(existsSync(fullProjectedPath)).toBe(false);
      }
    },
  );

  it('imports GEMINI.md to .agentsmesh/rules/_root.md (gemini-cli)', () => {
    writeFileSync(join(TEST_DIR, 'GEMINI.md'), '# Gemini Rules\n\nUse TDD.');
    execSync(`node ${CLI_PATH} import --from gemini-cli`, { cwd: TEST_DIR });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Gemini Rules');
    expect(content).toContain('Use TDD.');
  });

  it('import from gemini-cli then generate produces GEMINI.md and .gemini/', () => {
    writeFileSync(join(TEST_DIR, 'GEMINI.md'), '# Gemini Rules\n\nUse TDD.');
    execSync(`node ${CLI_PATH} import --from gemini-cli`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [gemini-cli]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const geminiMd = readFileSync(join(TEST_DIR, 'GEMINI.md'), 'utf-8');
    expect(geminiMd).toContain('Use TDD.');
  });

  it('imports .clinerules/_root.md to .agentsmesh/rules/_root.md (cline)', () => {
    mkdirSync(join(TEST_DIR, '.clinerules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.clinerules', '_root.md'), '# Cline Rules\n\nUse TDD.');
    execSync(`node ${CLI_PATH} import --from cline`, { cwd: TEST_DIR });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Cline Rules');
    expect(content).toContain('Use TDD.');
  });

  it('import from cline then generate produces .clinerules and .clineignore', () => {
    mkdirSync(join(TEST_DIR, '.clinerules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.clinerules', '_root.md'), '# Cline Rules\n\nUse TDD.');
    writeFileSync(join(TEST_DIR, '.clineignore'), 'node_modules/\n');
    execSync(`node ${CLI_PATH} import --from cline`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [cline]
features: [rules, ignore]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    // Cline writes the root rule to AGENTS.md, not .clinerules/_root.md
    const rootContent = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8');
    expect(rootContent).toContain('Use TDD.');
    const ignoreContent = readFileSync(join(TEST_DIR, '.clineignore'), 'utf-8');
    expect(ignoreContent).toContain('node_modules/');
  });

  it('imports full claude-code config: commands, agents, skills, settings.json, .claudeignore', () => {
    // Set up full Claude Code project
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n\nUse TDD.');
    mkdirSync(join(TEST_DIR, '.claude', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'rules', 'typescript.md'),
      '---\ndescription: TS\n---\n\nTS rules.',
    );
    mkdirSync(join(TEST_DIR, '.claude', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'commands', 'review.md'),
      '---\ndescription: Review\n---\n\nReview code.',
    );
    mkdirSync(join(TEST_DIR, '.claude', 'agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'agents', 'reviewer.md'),
      '---\nname: reviewer\ndescription: Reviews\n---\n\nYou review.',
    );
    mkdirSync(join(TEST_DIR, '.claude', 'skills', 'api-gen'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'skills', 'api-gen', 'SKILL.md'),
      '---\ndescription: API gen\n---\n\nGenerate APIs.',
    );
    writeFileSync(join(TEST_DIR, '.claudeignore'), 'dist\nnode_modules\n');
    writeFileSync(
      join(TEST_DIR, '.claude', 'settings.json'),
      JSON.stringify({
        mcpServers: { ctx: { type: 'stdio', command: 'npx', args: [], env: {} } },
        permissions: { allow: ['Read'], deny: ['WebFetch'] },
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [{ type: 'command', command: 'prettier --write $FILE_PATH' }],
            },
          ],
        },
      }),
    );

    execSync(`node ${CLI_PATH} import --from claude-code`, { cwd: TEST_DIR });

    // Verify all canonical files were created
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      'root: true',
    );
    expect(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8'),
    ).toContain('TS rules.');
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8')).toContain(
      'Review code.',
    );
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'agents', 'reviewer.md'), 'utf-8')).toContain(
      'You review.',
    );
    expect(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'), 'utf-8'),
    ).toContain('Generate APIs.');
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8')).toContain('dist');
    const mcp = JSON.parse(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(mcp).toHaveProperty('mcpServers');
    const perms = readFileSync(join(TEST_DIR, '.agentsmesh', 'permissions.yaml'), 'utf-8');
    expect(perms).toContain('Read');
    expect(perms).toContain('WebFetch');
    const hooks = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(hooks).toContain('PostToolUse');
    expect(hooks).toContain('prettier');
  });

  it('full round-trip: claude-code import → generate → produces all target files', () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n\nUse TDD.');
    mkdirSync(join(TEST_DIR, '.claude', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'commands', 'review.md'),
      '---\ndescription: Review\n---\n\nReview code.',
    );
    mkdirSync(join(TEST_DIR, '.claude', 'agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'agents', 'reviewer.md'),
      '---\nname: reviewer\ndescription: Reviews\n---\n\nYou review.',
    );

    execSync(`node ${CLI_PATH} import --from claude-code`, { cwd: TEST_DIR });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1\ntargets: [claude-code, cursor]\nfeatures: [rules, commands, agents]\n`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });

    expect(readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8')).toContain('Use TDD.');
    expect(readFileSync(join(TEST_DIR, '.claude', 'commands', 'review.md'), 'utf-8')).toContain(
      'Review code.',
    );
    expect(readFileSync(join(TEST_DIR, '.claude', 'agents', 'reviewer.md'), 'utf-8')).toContain(
      'You review.',
    );
  });
});
