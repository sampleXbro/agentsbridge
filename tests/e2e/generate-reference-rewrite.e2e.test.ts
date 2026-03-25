import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';

describe('generate reference rewriting', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('rewrites canonical references in generated markdown artifacts', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules, commands, agents, skills]
`,
    );
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsbridge', 'commands'), { recursive: true });
    mkdirSync(join(dir, '.agentsbridge', 'agents'), { recursive: true });
    mkdirSync(join(dir, '.agentsbridge', 'skills', 'api-gen', 'references'), {
      recursive: true,
    });
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
description: Root rule
	---
	See .agentsbridge/rules/typescript.md, .agentsbridge/commands/review.md, .agentsbridge/agents/reviewer.md, .agentsbridge/skills/api-gen/references/checklist.md, and ../../docs/some-doc.md.
	`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', 'typescript.md'),
      `---
description: TypeScript rule
globs: [src/**/*.ts]
---
Prefer strict mode.
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'commands', 'review.md'),
      `---
description: Review
	---
	Load .agentsbridge/skills/api-gen/SKILL.md and ../docs/some-doc.md.
	`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'agents', 'reviewer.md'),
      `---
name: reviewer
description: Reviews code
tools: [Read]
	---
	Use .agentsbridge/skills/api-gen/SKILL.md and ../docs/some-doc.md.
	`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'skills', 'api-gen', 'SKILL.md'),
      '# API Gen\n\nChecklist: .agentsbridge/skills/api-gen/references/checklist.md. Docs: ../../../docs/some-doc.md.\n',
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'skills', 'api-gen', 'references', 'checklist.md'),
      '# Checklist\n',
    );
    writeFileSync(join(dir, 'docs', 'some-doc.md'), '# Some Doc\n');

    const result = await runCli('generate', dir);
    expect(result.exitCode).toBe(0);

    const claudeRoot = readFileSync(join(dir, '.claude', 'CLAUDE.md'), 'utf-8');
    const cursorRoot = readFileSync(join(dir, '.cursor', 'rules', 'general.mdc'), 'utf-8');
    const secondRun = await runCli('generate', dir);

    expect(claudeRoot).toContain('.claude/rules/typescript.md');
    expect(claudeRoot).toContain('.claude/commands/review.md');
    expect(claudeRoot).toContain('.claude/agents/reviewer.md');
    expect(claudeRoot).toContain('.claude/skills/api-gen/references/checklist.md');
    expect(claudeRoot).toContain('docs/some-doc.md');
    expect(cursorRoot).toContain('.cursor/rules/typescript.mdc');
    expect(cursorRoot).toContain('.cursor/commands/review.md');
    expect(cursorRoot).toContain('.cursor/agents/reviewer.md');
    expect(cursorRoot).toContain('.cursor/skills/api-gen/references/checklist.md');
    expect(cursorRoot).toContain('docs/some-doc.md');
    expect(readFileSync(join(dir, '.claude', 'commands', 'review.md'), 'utf-8')).toContain(
      'docs/some-doc.md',
    );
    expect(readFileSync(join(dir, '.claude', 'agents', 'reviewer.md'), 'utf-8')).toContain(
      'docs/some-doc.md',
    );
    expect(readFileSync(join(dir, '.claude', 'skills', 'api-gen', 'SKILL.md'), 'utf-8')).toContain(
      'docs/some-doc.md',
    );
    expect(secondRun.exitCode).toBe(0);
    expect(secondRun.stdout + secondRun.stderr).toMatch(/unchanged/);
  });

  it('preserves canonical references when the target has no valid mapping', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      `version: 1
targets: [codex-cli]
features: [rules]
`,
    );
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
Keep .agentsbridge/rules/typescript.md.
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', 'typescript.md'),
      `---
description: TypeScript rule
---
Prefer strict mode.
`,
    );

    const result = await runCli('generate', dir);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain('typescript/AGENTS.md.');
  });

  it('rewrites skill directory references across all generated root artifacts', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      'version: 1\ntargets: [claude-code, cursor, copilot, gemini-cli, cline, codex-cli]\nfeatures: [rules, skills]\n',
    );
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\ndescription: Root rule\n---\nUse .agentsbridge/skills/post-feature-qa/ and .agentsbridge/skills/post-feature-qa/references/.\n',
    );
    writeFileSync(join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
      '# Checklist\n',
    );

    const result = await runCli('generate', dir);
    expect(result.exitCode).toBe(0);

    expect(readFileSync(join(dir, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      '.claude/skills/post-feature-qa/',
    );
    expect(readFileSync(join(dir, '.cursor', 'rules', 'general.mdc'), 'utf-8')).toContain(
      '.cursor/skills/post-feature-qa/',
    );
    expect(readFileSync(join(dir, '.github', 'copilot-instructions.md'), 'utf-8')).toContain(
      '.github/skills/post-feature-qa/',
    );
    expect(readFileSync(join(dir, 'GEMINI.md'), 'utf-8')).toContain(
      '.gemini/skills/post-feature-qa/',
    );
    // AGENTS.md: codex-cli wins (cline and cursor are filtered as equivalent)
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain(
      '.agents/skills/post-feature-qa/',
    );
  });

  it('rewrites skill directory references for windsurf root artifacts', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      'version: 1\ntargets: [windsurf]\nfeatures: [rules, skills]\n',
    );
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\ndescription: Root rule\n---\nUse .agentsbridge/skills/post-feature-qa/ and .agentsbridge/skills/post-feature-qa/references/.\n',
    );
    writeFileSync(join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
      '# Checklist\n',
    );

    const result = await runCli('generate', dir);
    expect(result.exitCode).toBe(0);

    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain(
      '.windsurf/skills/post-feature-qa/',
    );
  });

  it('rewrites Copilot .github/instructions rule outputs to root-relative links', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      'version: 1\ntargets: [copilot]\nfeatures: [rules]\n',
    );
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', 'typescript.md'),
      `---
description: TypeScript rule
globs: [src/**/*.ts]
---
See .agentsbridge/rules/typescript.md and ../../docs/roadmap.md.
`,
    );
    writeFileSync(join(dir, 'docs', 'roadmap.md'), '# Roadmap\n');

    const result = await runCli('generate', dir);
    expect(result.exitCode).toBe(0);

    const instructions = readFileSync(
      join(dir, '.github', 'instructions', 'typescript.instructions.md'),
      'utf-8',
    );
    expect(instructions).toContain('.github/instructions/typescript.instructions.md');
    expect(instructions).toContain('docs/roadmap.md');
    expect(instructions).not.toContain('../../docs/roadmap.md');
  });
});
