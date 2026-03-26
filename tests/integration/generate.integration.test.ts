/**
 * Integration test for agentsmesh generate.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'am-integration-generate');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsmesh.yaml'),
    `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
  );
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    `---
root: true
description: "Project rules"
---
# Rules
- Use TypeScript
`,
  );
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('agentsmesh generate (integration)', () => {
  it('generates .claude/CLAUDE.md from root rule', () => {
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const content = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('Use TypeScript');
  });

  it('generates .cursor/rules/general.mdc from root rule', () => {
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const content = readFileSync(join(TEST_DIR, '.cursor', 'rules', 'general.mdc'), 'utf-8');
    expect(content).toContain('Use TypeScript');
    expect(content).toContain('alwaysApply: true');
  });

  it('--dry-run does not write files', () => {
    execSync(`node ${CLI_PATH} generate --dry-run`, { cwd: TEST_DIR });
    expect(() => readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'))).toThrow();
  });

  it('no root rule produces no files', () => {
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'other.md'),
      `---
description: "Other rule"
---
# Other
`,
    );
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    expect(() => readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'))).toThrow();
  });

  it('--targets claude-code generates only .claude/CLAUDE.md', () => {
    execSync(`node ${CLI_PATH} generate --targets claude-code`, {
      cwd: TEST_DIR,
    });
    expect(readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      'Use TypeScript',
    );
    expect(() => readFileSync(join(TEST_DIR, '.cursor', 'rules', 'general.mdc'))).toThrow();
  });

  it('generates command files when commands feature enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules, commands]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'),
      `---
description: Run code review
allowed-tools: Read, Grep, Bash(git diff)
---
Review current changes for quality and security.`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const claudeCmd = readFileSync(join(TEST_DIR, '.claude', 'commands', 'review.md'), 'utf-8');
    const cursorCmd = readFileSync(join(TEST_DIR, '.cursor', 'commands', 'review.md'), 'utf-8');
    expect(claudeCmd).toContain('Run code review');
    expect(claudeCmd).toContain('allowed-tools');
    expect(claudeCmd).toContain('Review current changes');
    expect(cursorCmd).toBe('Review current changes for quality and security.');
  });

  it('generates agent files when agents feature enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules, agents]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'),
      `---
name: code-reviewer
description: Reviews code for quality
tools: Read, Grep, Glob
model: sonnet
permissionMode: default
maxTurns: 10
---
You are an expert code reviewer. Focus on security and performance.`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const claudeAgent = readFileSync(
      join(TEST_DIR, '.claude', 'agents', 'code-reviewer.md'),
      'utf-8',
    );
    const cursorAgent = readFileSync(
      join(TEST_DIR, '.cursor', 'agents', 'code-reviewer.md'),
      'utf-8',
    );
    expect(claudeAgent).toContain('name: code-reviewer');
    expect(claudeAgent).toContain('Reviews code for quality');
    expect(claudeAgent).toContain('expert code reviewer');
    expect(cursorAgent).toContain('name: code-reviewer');
    expect(cursorAgent).toContain('Reviews code for quality');
    expect(cursorAgent).toContain('expert code reviewer');
  });

  it('projects agents to native .gemini/agents/*.md for gemini-cli', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [gemini-cli]
features: [rules, agents]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'),
      `---
name: code-reviewer
description: Reviews code for quality
tools: Read, Grep, Glob
model: sonnet
permissionMode: ask
maxTurns: 10
---
You are an expert code reviewer. Focus on security and performance.`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const projected = readFileSync(
      join(TEST_DIR, '.gemini', 'agents', 'code-reviewer.md'),
      'utf-8',
    );
    expect(projected).toContain('name: code-reviewer');
    expect(projected).toContain('description: Reviews code for quality');
    expect(projected).toContain('expert code reviewer');
  });

  it.each([
    ['cline', '.cline/skills/am-agent-code-reviewer/SKILL.md', 'x-agentsmesh-kind: agent'],
    ['codex-cli', '.codex/agents/code-reviewer.toml', 'name = "code-reviewer"'],
    ['windsurf', '.windsurf/skills/am-agent-code-reviewer/SKILL.md', 'x-agentsmesh-kind: agent'],
  ] as const)('projects agents into skills for %s', (target, agentPath, contentCheck) => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [${target}]
features: [rules, agents]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'),
      `---
name: code-reviewer
description: Reviews code for quality
tools: Read, Grep, Glob
model: sonnet
permissionMode: ask
maxTurns: 10
---
You are an expert code reviewer. Focus on security and performance.`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const content = readFileSync(join(TEST_DIR, agentPath), 'utf-8');
    expect(content).toContain(contentCheck);
    expect(content).toContain('expert code reviewer');
  });

  it('agentsmesh.local.yaml can disable developer-local skill projections', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [codex-cli, windsurf]
features: [rules, commands, agents]
`,
    );
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.local.yaml'),
      `conversions:
  commands_to_skills:
    codex-cli: false
  agents_to_skills:
    windsurf: false
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'),
      `---
description: Run code review
---
Review the current diff.`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'),
      `---
name: code-reviewer
description: Reviews code for quality
tools: Read, Grep
---
You are an expert code reviewer.`,
    );

    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });

    expect(() =>
      readFileSync(join(TEST_DIR, '.agents', 'skills', 'am-command-review', 'SKILL.md')),
    ).toThrow();
    expect(() =>
      readFileSync(join(TEST_DIR, '.windsurf', 'skills', 'am-agent-code-reviewer', 'SKILL.md')),
    ).toThrow();
    expect(readFileSync(join(TEST_DIR, '.windsurf', 'workflows', 'review.md'), 'utf-8')).toContain(
      'Review the current diff.',
    );
    // codex-cli uses native .codex/agents/*.toml (not projected skills)
    expect(
      readFileSync(join(TEST_DIR, '.codex', 'agents', 'code-reviewer.toml'), 'utf-8'),
    ).toContain('name = "code-reviewer"');
  });

  it('generates MCP files when mcp feature enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules, mcp]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'mcp.json'),
      `{
  "mcpServers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {}
    }
  }
}`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const rootMcp = readFileSync(join(TEST_DIR, '.mcp.json'), 'utf-8');
    const cursorMcp = readFileSync(join(TEST_DIR, '.cursor', 'mcp.json'), 'utf-8');
    expect(rootMcp).toContain('context7');
    expect(rootMcp).toContain('stdio');
    expect(rootMcp).toContain('npx');
    expect(cursorMcp).toContain('context7');
    expect(cursorMcp).toContain('stdio');
    expect(cursorMcp).toContain('npx');
  });

  it('generates permissions files when permissions feature enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules, permissions]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'permissions.yaml'),
      `allow:
  - Read
  - Grep
  - Bash(npm run test:*)
deny:
  - WebFetch
  - Bash(rm -rf *)
  - Read(./.env)
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const claudeSettings = readFileSync(
      join(TEST_DIR, '.claude', 'settings.json'),
      'utf-8',
    ) as string;
    expect(claudeSettings).toContain('permissions');
    expect(claudeSettings).toContain('allow');
    expect(claudeSettings).toContain('deny');
    expect(claudeSettings).toContain('Read');
    expect(claudeSettings).toContain('WebFetch');
    // Cursor has no native tool-permission file — permissions not emitted
    expect(() => readFileSync(join(TEST_DIR, '.cursor', 'settings.json'))).toThrow();
  });

  it('generates hooks in .cursor/hooks.json when hooks feature enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules, hooks]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'hooks.yaml'),
      `PostToolUse:
  - matcher: "Write|Edit"
    command: "prettier --write $FILE_PATH"
PreToolUse:
  - matcher: "Bash"
    command: "./scripts/validate.sh $TOOL_INPUT"
    timeout: 30
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const claudeSettings = JSON.parse(
      readFileSync(join(TEST_DIR, '.claude', 'settings.json'), 'utf-8'),
    ) as { hooks?: Record<string, unknown> };
    expect(claudeSettings.hooks).toBeDefined();
    expect(claudeSettings.hooks!.PostToolUse).toBeDefined();
    expect(claudeSettings.hooks!.PreToolUse).toBeDefined();
    const cursorHooks = JSON.parse(
      readFileSync(join(TEST_DIR, '.cursor', 'hooks.json'), 'utf-8'),
    ) as { hooks?: Record<string, unknown> };
    expect(cursorHooks.hooks).toBeDefined();
    expect(cursorHooks.hooks!.PostToolUse).toBeDefined();
    expect(cursorHooks.hooks!.PreToolUse).toBeDefined();
  });

  it('generates skill files when skills feature enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules, skills]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'skills', 'api-gen'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
      `---
description: Generate REST API endpoints
---
When asked to create an API endpoint:
1. Check existing patterns in src/api/
2. Use the project's router framework
3. Include input validation`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'api-gen', 'template.ts'),
      'export const t = 1;',
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const claudeSkill = readFileSync(
      join(TEST_DIR, '.claude', 'skills', 'api-gen', 'SKILL.md'),
      'utf-8',
    );
    const claudeTemplate = readFileSync(
      join(TEST_DIR, '.claude', 'skills', 'api-gen', 'template.ts'),
      'utf-8',
    );
    const cursorSkill = readFileSync(
      join(TEST_DIR, '.cursor', 'skills', 'api-gen', 'SKILL.md'),
      'utf-8',
    );
    expect(claudeSkill).toContain('Generate REST API endpoints');
    expect(claudeSkill).toContain('existing patterns');
    expect(claudeTemplate).toBe('export const t = 1;');
    expect(cursorSkill).toContain('Generate REST API endpoints');
    expect(cursorSkill).toContain('existing patterns');
  });

  it('generates .github/copilot-instructions.md when copilot target enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor, copilot]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const copilot = readFileSync(join(TEST_DIR, '.github', 'copilot-instructions.md'), 'utf-8');
    expect(copilot).toContain('Use TypeScript');
    expect(copilot).toContain('# Rules');
  });

  it('generates .github/prompts/*.prompt.md when copilot commands are enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [copilot]
features: [rules, commands]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'),
      '---\ndescription: Review changes\nallowed-tools:\n  - Bash(git diff)\n---\n\nReview the current pull request.',
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const prompt = readFileSync(join(TEST_DIR, '.github', 'prompts', 'review.prompt.md'), 'utf-8');
    expect(prompt).toContain('x-agentsmesh-kind: command');
    expect(prompt).toContain('Review the current pull request.');
  });

  it('generates .github/copilot-instructions.md when copilot target enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor, copilot]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const copilot = readFileSync(join(TEST_DIR, '.github', 'copilot-instructions.md'), 'utf-8');
    expect(copilot).toContain('Use TypeScript');
  });

  it('generates ignore files when ignore feature enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules, ignore]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'ignore'),
      `node_modules
.env
dist
secrets/
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const claudeIgnore = readFileSync(join(TEST_DIR, '.claudeignore'), 'utf-8');
    const cursorIgnore = readFileSync(join(TEST_DIR, '.cursorignore'), 'utf-8');
    expect(claudeIgnore).toContain('node_modules');
    expect(claudeIgnore).toContain('.env');
    expect(claudeIgnore).toContain('dist');
    expect(claudeIgnore).toContain('secrets/');
    expect(cursorIgnore).toContain('node_modules');
    expect(cursorIgnore).toContain('.env');
    expect(cursorIgnore).toContain('dist');
    expect(cursorIgnore).toContain('secrets/');
  });

  it('generates .github/copilot-instructions.md when copilot target enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor, copilot]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const copilotInstructions = readFileSync(
      join(TEST_DIR, '.github', 'copilot-instructions.md'),
      'utf-8',
    );
    expect(copilotInstructions).toContain('Use TypeScript');
  });

  it('--targets copilot generates only Copilot files', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor, copilot]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate --targets copilot`, { cwd: TEST_DIR });
    expect(readFileSync(join(TEST_DIR, '.github', 'copilot-instructions.md'), 'utf-8')).toContain(
      'Use TypeScript',
    );
    expect(() => readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'))).toThrow();
    expect(() => readFileSync(join(TEST_DIR, '.cursor', 'rules', 'general.mdc'))).toThrow();
  });

  it('generates GEMINI.md when gemini-cli target enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [gemini-cli]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const gemini = readFileSync(join(TEST_DIR, 'GEMINI.md'), 'utf-8');
    expect(gemini).toContain('Use TypeScript');
    expect(gemini).toContain('# Rules');
  });

  it('generates AGENTS.md when cline target enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [cline]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const rootRule = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8');
    expect(rootRule).toContain('Use TypeScript');
    expect(rootRule).toContain('# Rules');
  });

  it('generates .gemini/settings.json when gemini-cli with mcp/ignore/hooks', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [gemini-cli]
features: [rules, mcp, ignore, hooks]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'mcp.json'),
      `{
  "mcpServers": {
    "fs": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "env": {}
    }
  }
}`,
    );
    writeFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'node_modules\ndist');
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'hooks.yaml'),
      `PostToolUse:
  - matcher: "Write"
    command: "prettier --write $FILE_PATH"
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const settings = JSON.parse(
      readFileSync(join(TEST_DIR, '.gemini', 'settings.json'), 'utf-8'),
    ) as { mcpServers?: unknown; hooks?: Record<string, unknown> };
    expect(settings.mcpServers).toBeDefined();
    expect(settings.hooks).toBeDefined();
    expect((settings.hooks as { AfterTool?: unknown[] }).AfterTool).toBeDefined();
    expect(readFileSync(join(TEST_DIR, '.geminiignore'), 'utf-8')).toBe('node_modules\ndist');
  });

  it('generates .clinerules/hooks/*.sh when cline hooks feature enabled', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [cline]
features: [rules, hooks]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'hooks.yaml'),
      `PostToolUse:
  - matcher: "Write|Edit"
    command: "prettier --write $FILE_PATH"
PreToolUse:
  - matcher: "Bash"
    command: "./scripts/validate.sh"
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const postHook = readFileSync(
      join(TEST_DIR, '.clinerules', 'hooks', 'posttooluse-0.sh'),
      'utf-8',
    );
    const preHook = readFileSync(
      join(TEST_DIR, '.clinerules', 'hooks', 'pretooluse-0.sh'),
      'utf-8',
    );
    expect(postHook).toContain('#!/usr/bin/env bash');
    expect(postHook).toContain('prettier --write $FILE_PATH');
    expect(postHook).toContain('Write|Edit');
    expect(preHook).toContain('./scripts/validate.sh');
    expect(preHook).toContain('Bash');
  });

  it('generates AGENTS.md when cline target enabled (second check)', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [cline]
features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const root = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8');
    expect(root).toContain('Use TypeScript');
    expect(root).toContain('# Rules');
  });

  it('merges extends: local overrides extend root rule', () => {
    mkdirSync(join(TEST_DIR, 'shared', '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, 'shared', '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
---
# From shared extend
`,
    );
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
extends:
  - name: base
    source: ./shared
    features: [rules]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
---
# From local (wins)
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const claude = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(claude).toContain('From local (wins)');
    expect(claude).not.toContain('From shared extend');
  });

  it('agentsmesh.local.yaml overrides targets (local config merge)', () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.local.yaml'),
      `targets: [claude-code]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    expect(readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      'Use TypeScript',
    );
    expect(() => readFileSync(join(TEST_DIR, '.cursor', 'rules', 'general.mdc'))).toThrow();
  });

  it('merges extends: extend provides root when local empty', () => {
    mkdirSync(join(TEST_DIR, 'shared', '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, 'shared', '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
---
# From shared extend only
`,
    );
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
extends:
  - name: base
    source: ./shared
    features: [rules]
`,
    );
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const claude = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(claude).toContain('From shared extend only');
  });

  it('merges extends: github: remote uses pre-cached tarball (no network)', () => {
    const cacheDir = join(TEST_DIR, '.am-cache');
    const cacheKey = 'org-repo-v1_0_0';
    const topDir = 'org-repo-v1.0.0';
    mkdirSync(join(cacheDir, cacheKey, topDir, '.agentsmesh', 'rules'), {
      recursive: true,
    });
    writeFileSync(
      join(cacheDir, cacheKey, topDir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
---
# From remote github extend (cached)
`,
    );
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
extends:
  - name: remote-base
    source: github:org/repo@v1.0.0
    features: [rules]
`,
    );
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));
    execSync(`node ${CLI_PATH} generate`, {
      cwd: TEST_DIR,
      env: { ...process.env, AGENTSMESH_CACHE: cacheDir },
    });
    const claude = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(claude).toContain('From remote github extend (cached)');
    const lock = readFileSync(join(TEST_DIR, '.agentsmesh', '.lock'), 'utf-8');
    expect(lock).toContain('remote-base');
    expect(lock).toContain('v1.0.0');
  });
});
