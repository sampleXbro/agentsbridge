import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
      .filter((path) => path !== 'agentsbridge.yaml')
      .filter((path) => !path.startsWith('.agentsbridge/'))
      .filter((path) => !path.startsWith('.agentsbridgecache'))
      .sort();
    expect(generatedPaths).toEqual([
      '.cline/mcp_settings.json',
      '.cline/skills/ab-agent-code-reviewer/SKILL.md',
      '.cline/skills/ab-agent-researcher/SKILL.md',
      '.cline/skills/api-generator/SKILL.md',
      '.cline/skills/api-generator/references/route-checklist.md',
      '.cline/skills/api-generator/template.ts',
      '.clineignore',
      '.clinerules/hooks/posttooluse-0.sh',
      '.clinerules/typescript.md',
      '.clinerules/workflows/review.md',
      'AGENTS.md',
    ]);

    const agentsRoot = read(projectDir, 'AGENTS.md');
    expect(agentsRoot).toContain('# Standards');

    const scopedRule = read(projectDir, '.clinerules/typescript.md');
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

    const projectedReviewer = read(projectDir, '.cline/skills/ab-agent-code-reviewer/SKILL.md');
    expect(projectedReviewer).toContain('x-agentsbridge-kind: agent');
    expect(projectedReviewer).toContain('x-agentsbridge-name: code-reviewer');
    expect(projectedReviewer).toContain('You are a code reviewer.');
    const projectedResearcher = read(projectDir, '.cline/skills/ab-agent-researcher/SKILL.md');
    expect(projectedResearcher).toContain('x-agentsbridge-kind: agent');
    expect(projectedResearcher).toContain('x-agentsbridge-name: researcher');

    const hook = read(projectDir, '.clinerules/hooks/posttooluse-0.sh');
    expect(hook).toContain('#!/usr/bin/env bash');
    expect(hook).toContain('# agentsbridge-matcher: Write|Edit');
    expect(hook).toContain('# agentsbridge-command: prettier --write $FILE_PATH');
    expect(hook).toContain('set -e');

    const mcp = JSON.parse(read(projectDir, '.cline/mcp_settings.json')) as {
      mcpServers?: Record<string, unknown>;
    };
    expect(mcp.mcpServers).toBeDefined();
    expect(mcp.mcpServers?.context7).toBeDefined();

    const ignore = read(projectDir, '.clineignore');
    expect(ignore).toContain('node_modules');
    expect(ignore).toContain('dist');
  });
});
