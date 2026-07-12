import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { createCanonicalProject } from './helpers/canonical.js';
import { runCli } from './helpers/run-cli.js';
import { cleanup } from './helpers/setup.js';

function read(projectDir: string, relativePath: string): string {
  return readFileSync(join(projectDir, relativePath), 'utf-8');
}

function listFiles(dir: string, base = ''): string[] {
  const root = base ? join(dir, base) : dir;
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listFiles(dir, rel);
    return [rel];
  });
}

describe('cline content contract', () => {
  let projectDir = '';

  afterEach(() => {
    if (projectDir) cleanup(projectDir);
    projectDir = '';
  });

  it('generates cline-native files with documented content shapes', async () => {
    projectDir = createCanonicalProject(`version: 1
targets:
  - cline
features:
  - rules
  - commands
  - agents
  - skills
  - mcp
  - hooks
  - ignore
`);

    const generateResult = await runCli('generate --targets cline', projectDir);
    expect(generateResult.exitCode, generateResult.stderr).toBe(0);
    const generatedPaths = listFiles(projectDir)
      .filter((path) => path !== 'agentsmesh.yaml')
      .filter((path) => !path.startsWith('.agentsmesh/'))
      .filter((path) => !path.startsWith('.agentsmeshcache'))
      .sort();
    expect(generatedPaths).toEqual([
      '.cline/agents.yaml',
      '.cline/hooks/posttooluse-0.sh',
      '.cline/mcp.json',
      '.cline/rules/typescript.md',
      '.cline/skills/api-generator/SKILL.md',
      '.cline/skills/api-generator/references/route-checklist.md',
      '.cline/skills/api-generator/template.ts',
      '.clineignore',
      '.clinerules/workflows/review.md',
      'AGENTS.md',
    ]);

    const agentsRoot = read(projectDir, 'AGENTS.md');
    expect(agentsRoot).toContain('# Standards');

    const scopedRule = read(projectDir, '.cline/rules/typescript.md');
    expect(scopedRule).toContain('description: TypeScript specific rules');
    expect(scopedRule).toContain('paths:');
    expect(scopedRule).toContain('src/**/*.ts');

    const workflow = read(projectDir, '.clinerules/workflows/review.md');
    expect(workflow).toContain('Code review');
    expect(workflow).toContain('Review current changes for quality.');

    const skill = read(projectDir, '.cline/skills/api-generator/SKILL.md');
    expect(skill).toContain('name: api-generator');
    expect(skill).toContain('description: Generate API endpoints');
    expect(skill).toContain('# API Generator');
    const skillReference = read(
      projectDir,
      '.cline/skills/api-generator/references/route-checklist.md',
    );
    expect(skillReference).toContain('# Route Checklist');
    const skillTemplate = read(projectDir, '.cline/skills/api-generator/template.ts');
    expect(skillTemplate).toContain("import { z } from 'zod';");
    expect(skillTemplate).toContain('export const createRouteSchema = z.object');

    const agentsYaml = yamlParse(read(projectDir, '.cline/agents.yaml')) as {
      agents: Array<Record<string, unknown>>;
    };
    expect(Array.isArray(agentsYaml.agents)).toBe(true);
    const reviewer = agentsYaml.agents.find((a) => a.name === 'code-reviewer');
    expect(reviewer).toBeDefined();
    expect(reviewer?.prompt).toContain('You are a code reviewer.');
    const researcher = agentsYaml.agents.find((a) => a.name === 'researcher');
    expect(researcher).toBeDefined();

    const hook = read(projectDir, '.cline/hooks/posttooluse-0.sh');
    expect(hook).toContain('#!/usr/bin/env bash');
    expect(hook).toContain('# agentsmesh-matcher: Write|Edit');
    expect(hook).toContain('# agentsmesh-command: prettier --write $FILE_PATH');
    expect(hook).toContain('set -e');

    const mcp = JSON.parse(read(projectDir, '.cline/mcp.json')) as {
      mcpServers?: Record<string, unknown>;
    };
    expect(mcp.mcpServers).toBeDefined();
    expect(mcp.mcpServers?.context7).toBeDefined();

    const ignore = read(projectDir, '.clineignore');
    expect(ignore).toContain('node_modules');
    expect(ignore).toContain('dist');
  });
});
