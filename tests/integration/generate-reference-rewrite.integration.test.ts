import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

describe('generate reference rewriting (integration)', () => {
  let testDir = '';

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'am-integration-reference-rewrite-'));
  });

  afterEach(() => {
    if (testDir) rmSync(testDir, { recursive: true, force: true });
  });

  it('rewrites canonical rule, command, agent, and skill references for claude-code and cursor', () => {
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules, commands, agents, skills]
`,
    );
    mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(testDir, '.agentsmesh', 'commands'), { recursive: true });
    mkdirSync(join(testDir, '.agentsmesh', 'agents'), { recursive: true });
    mkdirSync(join(testDir, '.agentsmesh', 'skills', 'api-gen', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
See .agentsmesh/rules/typescript.md, .agentsmesh/commands/review.md, .agentsmesh/agents/reviewer.md, and .agentsmesh/skills/api-gen/references/checklist.md.
`,
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', 'typescript.md'),
      `---
description: TypeScript rule
globs: [src/**/*.ts]
---
Prefer strict mode.
`,
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'commands', 'review.md'),
      `---
description: Review
---
Load .agentsmesh/skills/api-gen/SKILL.md.
`,
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'agents', 'reviewer.md'),
      `---
name: reviewer
description: Reviews code
tools: [Read]
---
Use .agentsmesh/skills/api-gen/SKILL.md.
`,
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
      '# API Gen\n\nChecklist: .agentsmesh/skills/api-gen/references/checklist.md.\n',
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'skills', 'api-gen', 'references', 'checklist.md'),
      '# Checklist\n',
    );

    execSync(`node ${CLI_PATH} generate`, { cwd: testDir });

    const claudeRoot = readFileSync(join(testDir, '.claude', 'CLAUDE.md'), 'utf-8');
    const cursorRoot = readFileSync(join(testDir, '.cursor', 'rules', 'general.mdc'), 'utf-8');
    const claudeCommand = readFileSync(join(testDir, '.claude', 'commands', 'review.md'), 'utf-8');
    const claudeAgent = readFileSync(join(testDir, '.claude', 'agents', 'reviewer.md'), 'utf-8');
    const claudeSkill = readFileSync(
      join(testDir, '.claude', 'skills', 'api-gen', 'SKILL.md'),
      'utf-8',
    );

    expect(claudeRoot).toContain('.claude/rules/typescript.md');
    expect(claudeRoot).toContain('.claude/commands/review.md');
    expect(claudeRoot).toContain('.claude/agents/reviewer.md');
    expect(claudeRoot).toContain('.claude/skills/api-gen/references/checklist.md');
    expect(cursorRoot).toContain('.cursor/rules/typescript.mdc');
    expect(cursorRoot).toContain('.cursor/commands/review.md');
    expect(cursorRoot).toContain('.cursor/agents/reviewer.md');
    expect(cursorRoot).toContain('.cursor/skills/api-gen/references/checklist.md');
    expect(claudeCommand).toContain('.claude/skills/api-gen/SKILL.md');
    expect(claudeAgent).toContain('.claude/skills/api-gen/SKILL.md');
    expect(claudeSkill).toContain('.claude/skills/api-gen/references/checklist.md');
    expect(claudeRoot).not.toContain('.agentsmesh/rules/');
    expect(claudeRoot).not.toContain('.agentsmesh/commands/');
    expect(claudeRoot).not.toContain('.agentsmesh/agents/');
    expect(claudeRoot).not.toContain('.agentsmesh/skills/api-gen/');
  });

  it('rewrites codex rule references to .codex/instructions/typescript.md', () => {
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [codex-cli]
features: [rules]
`,
    );
    mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
Keep .agentsmesh/rules/typescript.md.
`,
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', 'typescript.md'),
      `---
description: TypeScript rule
globs:
  - "**/*.ts"
---
Prefer strict mode.
`,
    );

    execSync(`node ${CLI_PATH} generate`, { cwd: testDir });

    expect(readFileSync(join(testDir, 'AGENTS.md'), 'utf-8')).toContain(
      '.codex/instructions/typescript.md',
    );
  });

  it('rewrites skill directory references for every target root artifact', () => {
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor, copilot, gemini-cli, cline, codex-cli]
features: [rules, skills]
`,
    );
    mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(testDir, '.agentsmesh', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
Use .agentsmesh/skills/post-feature-qa/ and .agentsmesh/skills/post-feature-qa/references/.
`,
    );
    writeFileSync(join(testDir, '.agentsmesh', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(testDir, '.agentsmesh', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
      '# Checklist\n',
    );

    execSync(`node ${CLI_PATH} generate`, { cwd: testDir });

    expect(readFileSync(join(testDir, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      '.claude/skills/post-feature-qa/',
    );
    expect(readFileSync(join(testDir, '.cursor', 'rules', 'general.mdc'), 'utf-8')).toContain(
      '.cursor/skills/post-feature-qa/',
    );
    expect(readFileSync(join(testDir, '.github', 'copilot-instructions.md'), 'utf-8')).toContain(
      '.github/skills/post-feature-qa/',
    );
    expect(readFileSync(join(testDir, 'GEMINI.md'), 'utf-8')).toContain(
      '.gemini/skills/post-feature-qa/',
    );
    expect(readFileSync(join(testDir, 'AGENTS.md'), 'utf-8')).toContain(
      '.agents/skills/post-feature-qa/',
    );
  });

  it('rewrites skill directory references in cline AGENTS.md root artifact', () => {
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [cline]
features: [rules, skills]
`,
    );
    mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(testDir, '.agentsmesh', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
Use .agentsmesh/skills/post-feature-qa/ and .agentsmesh/skills/post-feature-qa/references/.
`,
    );
    writeFileSync(join(testDir, '.agentsmesh', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(testDir, '.agentsmesh', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
      '# Checklist\n',
    );

    execSync(`node ${CLI_PATH} generate`, { cwd: testDir });

    expect(readFileSync(join(testDir, 'AGENTS.md'), 'utf-8')).toContain(
      '.cline/skills/post-feature-qa/',
    );
  });
});
