import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { generate } from '../../../src/core/generate/engine.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';

function hasNameInFrontmatter(content: string): boolean {
  if (!content.startsWith('---\n')) return false;
  const lines = content.split('\n');
  const endIndex = lines.indexOf('---', 1);
  if (endIndex < 0) return false;
  return lines.slice(1, endIndex).some((line) => line.startsWith('name:'));
}

const projectRoot = '/tmp/agentsmesh-generated-skills-name-test';

const canonical: CanonicalFiles = {
  rules: [
    {
      source: join(projectRoot, '.agentsmesh/rules/_root.md'),
      root: true,
      targets: [],
      description: '',
      globs: [],
      body: '# Root rules',
    },
  ],
  commands: [
    {
      source: join(projectRoot, '.agentsmesh/commands/review.md'),
      name: 'review',
      description: 'Review command',
      allowedTools: ['Read'],
      body: 'Review code changes',
    },
  ],
  agents: [
    {
      source: join(projectRoot, '.agentsmesh/agents/reviewer.md'),
      name: 'reviewer',
      description: 'Reviewer agent',
      tools: ['Read'],
      disallowedTools: [],
      model: '',
      permissionMode: '',
      maxTurns: 0,
      mcpServers: [],
      hooks: {},
      skills: [],
      memory: '',
      body: 'Review pull requests',
    },
  ],
  skills: [
    {
      source: join(projectRoot, '.agentsmesh/skills/typescript-pro/SKILL.md'),
      name: 'typescript-pro',
      description: 'TypeScript skill',
      body: 'Use strict typing',
      supportingFiles: [],
    },
  ],
  mcp: null,
  permissions: null,
  hooks: null,
  ignore: [],
};

const config: ValidatedConfig = {
  version: 1,
  targets: ['claude-code', 'cursor', 'copilot', 'gemini-cli', 'cline', 'codex-cli', 'windsurf'],
  features: ['rules', 'commands', 'agents', 'skills'],
  extends: [],
  overrides: {},
  collaboration: { strategy: 'merge', lock_features: [] },
};

describe('generated skill frontmatter', () => {
  it('includes name field in every generated SKILL.md', async () => {
    const outputs = await generate({ config, canonical, projectRoot });
    const skillFiles = outputs.filter((output) => output.path.endsWith('/SKILL.md'));

    expect(skillFiles.length).toBeGreaterThan(0);
    for (const skillFile of skillFiles) {
      expect(hasNameInFrontmatter(skillFile.content), `missing name in ${skillFile.path}`).toBe(
        true,
      );
    }
  });
});
