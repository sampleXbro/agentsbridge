import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanonicalProject } from './helpers/canonical.js';
import { runCli } from './helpers/run-cli.js';
import { cleanup } from './helpers/setup.js';
import { dirTreeExactly, fileContains, fileNotContains, readJson } from './helpers/assertions.js';

function read(projectDir: string, relativePath: string): string {
  return readFileSync(join(projectDir, relativePath), 'utf-8');
}

describe('continue content contract', () => {
  let projectDir = '';

  afterEach(() => {
    if (projectDir) cleanup(projectDir);
    projectDir = '';
  });

  it('generates continue files with documented content shapes', async () => {
    projectDir = createCanonicalProject(`version: 1
targets:
  - continue
features:
  - rules
  - commands
  - skills
  - mcp
`);

    const generateResult = await runCli('generate --targets continue', projectDir);
    expect(generateResult.exitCode, generateResult.stderr).toBe(0);

    dirTreeExactly(join(projectDir, '.continue'), [
      'mcpServers/',
      'mcpServers/agentsmesh.json',
      'prompts/',
      'prompts/review.md',
      'rules/',
      'rules/_root.md',
      'rules/typescript.md',
      'skills/',
      'skills/api-generator/',
      'skills/api-generator/SKILL.md',
      'skills/api-generator/references/',
      'skills/api-generator/references/route-checklist.md',
      'skills/api-generator/template.ts',
    ]);

    const rootRule = read(projectDir, '.continue/rules/_root.md');
    expect(rootRule).toContain('description: Project-wide coding standards');
    expect(rootRule).toContain('# Standards');
    expect(rootRule).not.toContain('root:');

    const scopedRule = read(projectDir, '.continue/rules/typescript.md');
    expect(scopedRule).toContain('description: TypeScript specific rules');
    expect(scopedRule).toContain('globs:');
    expect(scopedRule).toContain('src/**/*.ts');
    expect(scopedRule).toContain('# TypeScript');

    const prompt = read(projectDir, '.continue/prompts/review.md');
    expect(prompt).toContain('description: Code review');
    expect(prompt).toContain('x-agentsmesh-kind: command');
    expect(prompt).toContain('x-agentsmesh-name: review');
    expect(prompt).toContain('x-agentsmesh-allowed-tools:');
    expect(prompt).toContain('Bash(git diff)');
    expect(prompt).toContain('Review current changes for quality.');
    expect(prompt).not.toContain('\nname:');
    expect(prompt).not.toContain('invokable:');

    const skill = read(projectDir, '.continue/skills/api-generator/SKILL.md');
    expect(skill).toContain('description: Generate API endpoints');
    expect(skill).toContain('# API Generator');

    fileContains(
      join(projectDir, '.continue/skills/api-generator/references/route-checklist.md'),
      'response schema',
    );
    fileNotContains(join(projectDir, '.continue/skills/api-generator/template.ts'), '.agentsmesh/');
    fileContains(
      join(projectDir, '.continue/skills/api-generator/template.ts'),
      'createRouteSchema',
    );

    const mcp = readJson(join(projectDir, '.continue/mcpServers/agentsmesh.json'));
    expect(Array.isArray(mcp.mcpServers)).toBe(false);
    const servers = mcp.mcpServers as Record<string, unknown>;
    expect(Object.keys(servers)).toContain('context7');
  });
});
