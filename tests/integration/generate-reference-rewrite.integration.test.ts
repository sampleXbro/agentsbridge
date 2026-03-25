import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

describe('generate reference rewriting (integration)', () => {
  let testDir = '';

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'ab-integration-reference-rewrite-'));
  });

  afterEach(() => {
    if (testDir) rmSync(testDir, { recursive: true, force: true });
  });

  it('rewrites canonical rule, command, agent, and skill references for claude-code and cursor', () => {
    writeFileSync(
      join(testDir, 'agentsbridge.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules, commands, agents, skills]
`,
    );
    mkdirSync(join(testDir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(testDir, '.agentsbridge', 'commands'), { recursive: true });
    mkdirSync(join(testDir, '.agentsbridge', 'agents'), { recursive: true });
    mkdirSync(join(testDir, '.agentsbridge', 'skills', 'api-gen', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(testDir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
See .agentsbridge/rules/typescript.md, .agentsbridge/commands/review.md, .agentsbridge/agents/reviewer.md, and .agentsbridge/skills/api-gen/references/checklist.md.
`,
    );
    writeFileSync(
      join(testDir, '.agentsbridge', 'rules', 'typescript.md'),
      `---
description: TypeScript rule
globs: [src/**/*.ts]
---
Prefer strict mode.
`,
    );
    writeFileSync(
      join(testDir, '.agentsbridge', 'commands', 'review.md'),
      `---
description: Review
---
Load .agentsbridge/skills/api-gen/SKILL.md.
`,
    );
    writeFileSync(
      join(testDir, '.agentsbridge', 'agents', 'reviewer.md'),
      `---
name: reviewer
description: Reviews code
tools: [Read]
---
Use .agentsbridge/skills/api-gen/SKILL.md.
`,
    );
    writeFileSync(
      join(testDir, '.agentsbridge', 'skills', 'api-gen', 'SKILL.md'),
      '# API Gen\n\nChecklist: .agentsbridge/skills/api-gen/references/checklist.md.\n',
    );
    writeFileSync(
      join(testDir, '.agentsbridge', 'skills', 'api-gen', 'references', 'checklist.md'),
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
    expect(claudeRoot).not.toContain('.agentsbridge/');
  });

  it('rewrites codex rule references to typescript/AGENTS.md', () => {
    writeFileSync(
      join(testDir, 'agentsbridge.yaml'),
      `version: 1
targets: [codex-cli]
features: [rules]
`,
    );
    mkdirSync(join(testDir, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(testDir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
Keep .agentsbridge/rules/typescript.md.
`,
    );
    writeFileSync(
      join(testDir, '.agentsbridge', 'rules', 'typescript.md'),
      `---
description: TypeScript rule
globs:
  - "**/*.ts"
---
Prefer strict mode.
`,
    );

    execSync(`node ${CLI_PATH} generate`, { cwd: testDir });

    expect(readFileSync(join(testDir, 'AGENTS.md'), 'utf-8')).toContain('typescript/AGENTS.md');
  });

  it('rewrites skill directory references for every target root artifact', () => {
    writeFileSync(
      join(testDir, 'agentsbridge.yaml'),
      `version: 1
targets: [claude-code, cursor, copilot, gemini-cli, cline, codex-cli]
features: [rules, skills]
`,
    );
    mkdirSync(join(testDir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(testDir, '.agentsbridge', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(testDir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
Use .agentsbridge/skills/post-feature-qa/ and .agentsbridge/skills/post-feature-qa/references/.
`,
    );
    writeFileSync(
      join(testDir, '.agentsbridge', 'skills', 'post-feature-qa', 'SKILL.md'),
      '# QA\n',
    );
    writeFileSync(
      join(testDir, '.agentsbridge', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
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
      join(testDir, 'agentsbridge.yaml'),
      `version: 1
targets: [cline]
features: [rules, skills]
`,
    );
    mkdirSync(join(testDir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(testDir, '.agentsbridge', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(testDir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
Use .agentsbridge/skills/post-feature-qa/ and .agentsbridge/skills/post-feature-qa/references/.
`,
    );
    writeFileSync(
      join(testDir, '.agentsbridge', 'skills', 'post-feature-qa', 'SKILL.md'),
      '# QA\n',
    );
    writeFileSync(
      join(testDir, '.agentsbridge', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
      '# Checklist\n',
    );

    execSync(`node ${CLI_PATH} generate`, { cwd: testDir });

    expect(readFileSync(join(testDir, 'AGENTS.md'), 'utf-8')).toContain(
      '.cline/skills/post-feature-qa/',
    );
  });
});
