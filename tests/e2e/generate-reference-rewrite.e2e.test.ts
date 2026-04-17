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
      join(dir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules, commands, agents, skills]
`,
    );
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsmesh', 'commands'), { recursive: true });
    mkdirSync(join(dir, '.agentsmesh', 'agents'), { recursive: true });
    mkdirSync(join(dir, '.agentsmesh', 'skills', 'api-gen', 'references'), {
      recursive: true,
    });
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root rule
	---
	See .agentsmesh/rules/typescript.md, .agentsmesh/commands/review.md, .agentsmesh/agents/reviewer.md, .agentsmesh/skills/api-gen/references/checklist.md, and ../../docs/some-doc.md.
	`,
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', 'typescript.md'),
      `---
description: TypeScript rule
globs: [src/**/*.ts]
---
Prefer strict mode.
`,
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'commands', 'review.md'),
      `---
description: Review
	---
	Load .agentsmesh/skills/api-gen/SKILL.md and ../docs/some-doc.md.
	`,
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'agents', 'reviewer.md'),
      `---
name: reviewer
description: Reviews code
tools: [Read]
	---
	Use .agentsmesh/skills/api-gen/SKILL.md and ../docs/some-doc.md.
	`,
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
      '# API Gen\n\nChecklist: .agentsmesh/skills/api-gen/references/checklist.md. Docs: ../../../docs/some-doc.md.\n',
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'skills', 'api-gen', 'references', 'checklist.md'),
      '# Checklist\n',
    );
    writeFileSync(join(dir, 'docs', 'some-doc.md'), '# Some Doc\n');

    const result = await runCli('generate', dir);
    expect(result.exitCode).toBe(0);

    const claudeRoot = readFileSync(join(dir, '.claude', 'CLAUDE.md'), 'utf-8');
    const cursorRoot = readFileSync(join(dir, '.cursor', 'rules', 'general.mdc'), 'utf-8');
    const secondRun = await runCli('generate', dir);

    expect(claudeRoot).toContain('rules/typescript.md');
    expect(claudeRoot).toContain('commands/review.md');
    expect(claudeRoot).toContain('agents/reviewer.md');
    expect(claudeRoot).toContain('skills/api-gen/references/checklist.md');
    expect(claudeRoot).toContain('../docs/some-doc.md');
    expect(cursorRoot).toContain('typescript.mdc');
    expect(cursorRoot).toContain('../commands/review.md');
    expect(cursorRoot).toContain('../agents/reviewer.md');
    expect(cursorRoot).toContain('../skills/api-gen/references/checklist.md');
    expect(cursorRoot).toContain('../../docs/some-doc.md');
    expect(readFileSync(join(dir, '.claude', 'commands', 'review.md'), 'utf-8')).toContain(
      '../../docs/some-doc.md',
    );
    expect(readFileSync(join(dir, '.claude', 'agents', 'reviewer.md'), 'utf-8')).toContain(
      '../../docs/some-doc.md',
    );
    expect(readFileSync(join(dir, '.claude', 'skills', 'api-gen', 'SKILL.md'), 'utf-8')).toContain(
      '../../../docs/some-doc.md',
    );
    expect(secondRun.exitCode).toBe(0);
    expect(secondRun.stdout + secondRun.stderr).toMatch(/unchanged/);
  });

  it('preserves canonical references when the target has no valid mapping', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      `version: 1
targets: [codex-cli]
features: [rules]
`,
    );
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
Keep .agentsmesh/rules/typescript.md.
`,
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', 'typescript.md'),
      `---
description: TypeScript rule
---
Prefer strict mode.
`,
    );

    const result = await runCli('generate', dir);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain(
      '.codex/instructions/typescript.md',
    );
  });

  it('rewrites skill directory references across all generated root artifacts', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code, cursor, copilot, gemini-cli, cline, codex-cli]\nfeatures: [rules, skills]\n',
    );
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsmesh', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\ndescription: Root rule\n---\nUse .agentsmesh/skills/post-feature-qa/ and .agentsmesh/skills/post-feature-qa/references/.\n',
    );
    writeFileSync(join(dir, '.agentsmesh', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(dir, '.agentsmesh', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
      '# Checklist\n',
    );

    const result = await runCli('generate', dir);
    expect(result.exitCode).toBe(0);

    expect(readFileSync(join(dir, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      'skills/post-feature-qa/',
    );
    expect(readFileSync(join(dir, '.cursor', 'rules', 'general.mdc'), 'utf-8')).toContain(
      '../skills/post-feature-qa/',
    );
    expect(readFileSync(join(dir, '.github', 'copilot-instructions.md'), 'utf-8')).toContain(
      'skills/post-feature-qa/',
    );
    expect(readFileSync(join(dir, 'GEMINI.md'), 'utf-8')).toContain('skills/post-feature-qa/');
    // AGENTS.md: codex-cli wins (cline and cursor are filtered as equivalent)
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain(
      '.agents/skills/post-feature-qa/',
    );
  });

  it('rewrites skill directory references for windsurf root artifacts', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [windsurf]\nfeatures: [rules, skills]\n',
    );
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsmesh', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\ndescription: Root rule\n---\nUse .agentsmesh/skills/post-feature-qa/ and .agentsmesh/skills/post-feature-qa/references/.\n',
    );
    writeFileSync(join(dir, '.agentsmesh', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(dir, '.agentsmesh', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
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
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [copilot]\nfeatures: [rules]\n',
    );
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', 'typescript.md'),
      `---
description: TypeScript rule
globs: [src/**/*.ts]
---
See .agentsmesh/rules/typescript.md and ../../docs/roadmap.md.
`,
    );
    writeFileSync(join(dir, 'docs', 'roadmap.md'), '# Roadmap\n');

    const result = await runCli('generate', dir);
    expect(result.exitCode).toBe(0);

    const instructions = readFileSync(
      join(dir, '.github', 'instructions', 'typescript.instructions.md'),
      'utf-8',
    );
    expect(instructions).toContain('typescript.instructions.md');
    expect(instructions).toContain('../../docs/roadmap.md');
    expect(instructions).not.toContain('../../docs/roadmap.md');
  });
});
