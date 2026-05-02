import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { fileExists } from './helpers/assertions.js';
import { runCli } from './helpers/run-cli.js';

function seedReferenceProject(dir: string, config: string): void {
  writeFileSync(join(dir, 'agentsmesh.yaml'), config);
  mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
  mkdirSync(join(dir, '.agentsmesh', 'commands'), { recursive: true });
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
Self: .agentsmesh/rules/_root.md.
Rule: .agentsmesh/rules/typescript.md.
Command: .agentsmesh/commands/review.md.
Skill: .agentsmesh/skills/api-gen/SKILL.md.
Docs: ../../docs/some-doc.md.
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
description: Review command
---
Root: .agentsmesh/rules/_root.md.
Skill: .agentsmesh/skills/api-gen/SKILL.md.
Docs: ../../docs/some-doc.md.
`,
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
    '# API Gen\n\nChecklist: .agentsmesh/skills/api-gen/references/checklist.md.\n',
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'skills', 'api-gen', 'references', 'checklist.md'),
    '# Checklist\n',
  );
  writeFileSync(join(dir, 'docs', 'some-doc.md'), '# Some Doc\n');
}

describe('last target markdown reference round trips', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('Continue rewrites generated markdown refs and normalizes them back on import', async () => {
    dir = createTestProject();
    seedReferenceProject(
      dir,
      'version: 1\ntargets: [continue]\nfeatures: [rules, commands, skills]\n',
    );

    const generateResult = await runCli('generate --targets continue', dir);
    expect(generateResult.exitCode, generateResult.stderr).toBe(0);

    const rootPath = join(dir, '.continue', 'rules', 'general.md');
    const commandPath = join(dir, '.continue', 'prompts', 'review.md');
    const skillPath = join(dir, '.continue', 'skills', 'api-gen', 'SKILL.md');
    fileExists(rootPath);
    fileExists(commandPath);
    fileExists(skillPath);

    const generatedRoot = readFileSync(rootPath, 'utf-8');
    const generatedCommand = readFileSync(commandPath, 'utf-8');

    expect(generatedRoot).toContain('./general.md');
    expect(generatedRoot).toContain('./typescript.md');
    expect(generatedRoot).toContain('../prompts/review.md');
    expect(generatedRoot).toContain('../skills/api-gen/SKILL.md');
    expect(generatedRoot).toContain('docs/some-doc.md');

    expect(generatedCommand).toContain('../rules/general.md');
    expect(generatedCommand).toContain('../skills/api-gen/SKILL.md');
    expect(generatedCommand).toContain('docs/some-doc.md');

    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });

    const importResult = await runCli('import --from continue', dir);
    expect(importResult.exitCode, importResult.stderr).toBe(0);

    const importedRoot = readFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    const importedCommand = readFileSync(
      join(dir, '.agentsmesh', 'commands', 'review.md'),
      'utf-8',
    );

    expect(importedRoot).toMatch(/_root\.md/);
    expect(importedRoot).toMatch(/typescript\.md/);
    expect(importedRoot).toMatch(/commands\/review\.md/);
    expect(importedRoot).toMatch(/skills\/api-gen\/SKILL\.md/);
    expect(importedRoot).toMatch(/docs\/some-doc\.md/);
    expect(importedRoot).not.toContain('.continue/');

    expect(importedCommand).toMatch(/rules\/_root\.md/);
    expect(importedCommand).toMatch(/skills\/api-gen\/SKILL\.md/);
    expect(importedCommand).toMatch(/docs\/some-doc\.md/);
    expect(importedCommand).not.toContain('.continue/');
  });

  it('Junie rewrites supported generated refs and preserves canonical fallbacks through import', async () => {
    dir = createTestProject();
    seedReferenceProject(dir, 'version: 1\ntargets: [junie]\nfeatures: [rules, skills]\n');

    const generateResult = await runCli('generate --targets junie', dir);
    expect(generateResult.exitCode, generateResult.stderr).toBe(0);

    const agentsPath = join(dir, '.junie', 'AGENTS.md');
    const skillPath = join(dir, '.junie', 'skills', 'api-gen', 'SKILL.md');
    fileExists(agentsPath);
    fileExists(skillPath);

    const generatedAgents = readFileSync(agentsPath, 'utf-8');
    expect(generatedAgents).toContain('./AGENTS.md');
    expect(generatedAgents).toContain('./rules/typescript.md');
    expect(generatedAgents).toContain('./commands/review.md');
    expect(generatedAgents).toContain('./skills/api-gen/SKILL.md');
    expect(generatedAgents).toContain('docs/some-doc.md');

    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });

    const importResult = await runCli('import --from junie', dir);
    expect(importResult.exitCode, importResult.stderr).toBe(0);

    const importedRoot = readFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(importedRoot).toMatch(/_root\.md/);
    expect(importedRoot).toMatch(/typescript\.md/);
    expect(importedRoot).toMatch(/commands\/review\.md/);
    expect(importedRoot).toMatch(/skills\/api-gen\/SKILL\.md/);
    expect(importedRoot).toMatch(/docs\/some-doc\.md/);
  });
});
