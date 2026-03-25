/**
 * Copilot importer tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromCopilot } from '../../../../src/targets/copilot/importer.js';
import {
  COPILOT_INSTRUCTIONS,
  COPILOT_CONTEXT_DIR,
  COPILOT_AGENTS_DIR,
  COPILOT_PROMPTS_DIR,
  COPILOT_SKILLS_DIR,
} from '../../../../src/targets/copilot/constants.js';
// COPILOT_INSTRUCTIONS_DIR is tested indirectly via importFromCopilot

const TEST_DIR = join(tmpdir(), 'ab-copilot-importer-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromCopilot', () => {
  it('imports copilot-instructions.md into _root.md with root frontmatter', async () => {
    const instructionsPath = join(TEST_DIR, COPILOT_INSTRUCTIONS);
    mkdirSync(join(TEST_DIR, '.github'), { recursive: true });
    writeFileSync(instructionsPath, '# Copilot Global Rules\n- Use TDD\n');
    const results = await importFromCopilot(TEST_DIR);
    expect(results.length).toBe(1);
    expect(results[0]!.fromTool).toBe('copilot');
    expect(results[0]!.toPath).toBe('.agentsbridge/rules/_root.md');
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Copilot Global Rules');
    expect(content).toContain('- Use TDD');
  });

  it('imports .github/copilot/*.instructions.md into canonical rules', async () => {
    const copilotDir = join(TEST_DIR, COPILOT_CONTEXT_DIR);
    mkdirSync(copilotDir, { recursive: true });
    writeFileSync(
      join(copilotDir, 'review.instructions.md'),
      '---\ndescription: Code review guidelines\nglobs: "**/*.ts"\n---\n\nWhen reviewing TypeScript code:\n- Check types.',
    );
    const results = await importFromCopilot(TEST_DIR);
    const ruleResult = results.find((r) => r.toPath === '.agentsbridge/rules/review.md');
    expect(ruleResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', 'review.md'), 'utf-8');
    expect(content).toContain('root: false');
    expect(content).toContain('description: Code review guidelines');
    expect(content).toContain('globs');
    expect(content).toContain('When reviewing TypeScript code');
    expect(content).toContain('- Check types');
  });

  it('strips .instructions suffix for slug', async () => {
    const copilotDir = join(TEST_DIR, COPILOT_CONTEXT_DIR);
    mkdirSync(copilotDir, { recursive: true });
    writeFileSync(join(copilotDir, 'testing.instructions.md'), '---\n---\n\nTest body');
    const results = await importFromCopilot(TEST_DIR);
    const ruleResult = results.find((r) => r.toPath === '.agentsbridge/rules/testing.md');
    expect(ruleResult).toBeDefined();
    expect(results.some((r) => r.toPath.endsWith('.instructions.md'))).toBe(false);
  });

  it('preserves globs as array when present', async () => {
    const copilotDir = join(TEST_DIR, COPILOT_CONTEXT_DIR);
    mkdirSync(copilotDir, { recursive: true });
    writeFileSync(
      join(copilotDir, 'ts.instructions.md'),
      '---\nglobs: ["src/**/*.ts", "tests/**/*.ts"]\n---\n\nTS rules',
    );
    const results = await importFromCopilot(TEST_DIR);
    expect(results.length).toBe(1);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', 'ts.md'), 'utf-8');
    expect(content).toContain('globs');
    expect(content).toContain('src/**/*.ts');
  });

  it('imports all sources when both exist', async () => {
    mkdirSync(join(TEST_DIR, '.github'), { recursive: true });
    writeFileSync(join(TEST_DIR, COPILOT_INSTRUCTIONS), 'Root instructions');
    const copilotDir = join(TEST_DIR, COPILOT_CONTEXT_DIR);
    mkdirSync(copilotDir, { recursive: true });
    writeFileSync(
      join(copilotDir, 'foo.instructions.md'),
      '---\ndescription: Foo\n---\n\nFoo body',
    );
    const results = await importFromCopilot(TEST_DIR);
    expect(results.length).toBe(2);
    expect(results.some((r) => r.toPath === '.agentsbridge/rules/_root.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsbridge/rules/foo.md')).toBe(true);
  });

  it('returns empty when no Copilot config found', async () => {
    const results = await importFromCopilot(TEST_DIR);
    expect(results).toEqual([]);
  });

  it('handles copilot-instructions.md with frontmatter', async () => {
    mkdirSync(join(TEST_DIR, '.github'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, COPILOT_INSTRUCTIONS),
      '---\ndescription: Global\n---\n\nRoot body',
    );
    const results = await importFromCopilot(TEST_DIR);
    expect(results.length).toBe(1);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('description: Global');
    expect(content).toContain('Root body');
  });

  it('preserves existing root: true in copilot-instructions.md frontmatter', async () => {
    mkdirSync(join(TEST_DIR, '.github'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, COPILOT_INSTRUCTIONS),
      '---\nroot: true\ndescription: Already has root\n---\n\nRoot content.',
    );
    await importFromCopilot(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('Already has root');
    expect(content).toContain('Root content.');
  });

  it('handles .instructions.md with empty string globs (returns [] for toGlobsArray)', async () => {
    const copilotDir = join(TEST_DIR, COPILOT_CONTEXT_DIR);
    mkdirSync(copilotDir, { recursive: true });
    writeFileSync(
      join(copilotDir, 'bare.instructions.md'),
      '---\ndescription: No globs\nglobs: ""\n---\n\nBare content.',
    );
    const results = await importFromCopilot(TEST_DIR);
    const ruleResult = results.find((r) => r.toPath === '.agentsbridge/rules/bare.md');
    expect(ruleResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', 'bare.md'), 'utf-8');
    expect(content).toContain('description: No globs');
    expect(content).not.toContain('globs:');
  });

  it('imports .github/prompts/*.prompt.md into canonical commands', async () => {
    const promptsDir = join(TEST_DIR, COPILOT_PROMPTS_DIR);
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(
      join(promptsDir, 'review.prompt.md'),
      [
        '---',
        'agent: agent',
        'description: Review changes',
        'x-agentsbridge-kind: command',
        'x-agentsbridge-name: review',
        'x-agentsbridge-allowed-tools:',
        '  - Read',
        '  - Bash(git diff)',
        '---',
        '',
        'Review the current pull request.',
      ].join('\n'),
    );
    const results = await importFromCopilot(TEST_DIR);
    const commandResult = results.find((r) => r.feature === 'commands');
    expect(commandResult).toBeDefined();
    expect(commandResult?.toPath).toBe('.agentsbridge/commands/review.md');
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('description: Review changes');
    expect(content).toContain('allowed-tools');
    expect(content).toContain('Bash(git diff)');
    expect(content).toContain('Review the current pull request.');
  });

  it('imports prompt files without agentsbridge metadata using the filename as command name', async () => {
    const promptsDir = join(TEST_DIR, COPILOT_PROMPTS_DIR);
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(
      join(promptsDir, 'explain.prompt.md'),
      '---\nagent: agent\ndescription: Explain code\n---\n\nExplain this module.',
    );
    await importFromCopilot(TEST_DIR);
    const content = readFileSync(
      join(TEST_DIR, '.agentsbridge', 'commands', 'explain.md'),
      'utf-8',
    );
    expect(content).toContain('description: Explain code');
    expect(content).toContain('Explain this module.');
    expect(content).not.toContain('allowed-tools');
  });
});

describe('importFromCopilot — hooks', () => {
  it('imports .github/copilot-hooks/*.sh to .agentsbridge/hooks.yaml', async () => {
    const hooksDir = join(TEST_DIR, '.github', 'copilot-hooks');
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'PostToolUse-0.sh'), '#!/bin/bash\nprettier --write "$FILE_PATH"');
    const results = await importFromCopilot(TEST_DIR);
    const hookResult = results.find((r) => r.feature === 'hooks');
    expect(hookResult).toBeDefined();
    expect(hookResult?.toPath).toBe('.agentsbridge/hooks.yaml');
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'hooks.yaml'), 'utf-8');
    expect(content).toContain('PostToolUse');
    expect(content).toContain('prettier');
  });

  it('parses phase and index from hook filename', async () => {
    const hooksDir = join(TEST_DIR, '.github', 'copilot-hooks');
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'PreToolUse-0.sh'), '#!/bin/bash\necho pre');
    writeFileSync(join(hooksDir, 'PostToolUse-0.sh'), '#!/bin/bash\necho post');
    const results = await importFromCopilot(TEST_DIR);
    const hookResult = results.find((r) => r.feature === 'hooks');
    expect(hookResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'hooks.yaml'), 'utf-8');
    expect(content).toContain('PreToolUse');
    expect(content).toContain('PostToolUse');
  });

  it('ignores copied nested hook assets when importing hook definitions', async () => {
    const hooksDir = join(TEST_DIR, '.github', 'copilot-hooks');
    mkdirSync(join(hooksDir, 'scripts'), { recursive: true });
    writeFileSync(join(hooksDir, 'PostToolUse-0.sh'), '#!/bin/bash\necho post');
    writeFileSync(join(hooksDir, 'scripts', 'validate.sh'), '#!/bin/bash\necho asset');

    await importFromCopilot(TEST_DIR);

    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'hooks.yaml'), 'utf-8');
    expect(content).toContain('PostToolUse');
    expect(content).toContain('echo post');
    expect(content).not.toContain('echo asset');
  });
});

describe('importFromCopilot — .github/instructions/*.md', () => {
  it('imports .github/instructions/*.md into canonical rules', async () => {
    const instDir = join(TEST_DIR, '.github', 'instructions');
    mkdirSync(instDir, { recursive: true });
    writeFileSync(
      join(instDir, 'react.md'),
      '---\napplyTo: "src/**/*.tsx"\ndescription: React rules\n---\n\nUse functional components.',
    );
    const results = await importFromCopilot(TEST_DIR);
    const ruleResult = results.find((r) => r.toPath === '.agentsbridge/rules/react.md');
    expect(ruleResult).toBeDefined();
    expect(ruleResult?.fromTool).toBe('copilot');
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', 'react.md'), 'utf-8');
    expect(content).toContain('description: React rules');
    expect(content).toContain('src/**/*.tsx');
    expect(content).toContain('Use functional components.');
  });

  it('maps applyTo frontmatter key to canonical globs', async () => {
    const instDir = join(TEST_DIR, '.github', 'instructions');
    mkdirSync(instDir, { recursive: true });
    writeFileSync(
      join(instDir, 'ts.md'),
      '---\napplyTo: ["src/**/*.ts", "tests/**/*.ts"]\n---\n\nTS body.',
    );
    await importFromCopilot(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', 'ts.md'), 'utf-8');
    expect(content).toContain('globs');
    expect(content).toContain('src/**/*.ts');
  });

  it('imports both .github/copilot/*.instructions.md and .github/instructions/*.md', async () => {
    const copilotDir = join(TEST_DIR, '.github', 'copilot');
    mkdirSync(copilotDir, { recursive: true });
    writeFileSync(join(copilotDir, 'review.instructions.md'), '---\n---\n\nOld path rule.');
    const instDir = join(TEST_DIR, '.github', 'instructions');
    mkdirSync(instDir, { recursive: true });
    writeFileSync(join(instDir, 'new-rule.md'), '---\napplyTo: "*.ts"\n---\n\nNew path rule.');
    const results = await importFromCopilot(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsbridge/rules/review.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsbridge/rules/new-rule.md')).toBe(true);
  });

  it('handles .github/instructions/*.md with no applyTo (no globs in output)', async () => {
    const instDir = join(TEST_DIR, '.github', 'instructions');
    mkdirSync(instDir, { recursive: true });
    writeFileSync(join(instDir, 'bare.md'), '---\ndescription: No globs\n---\n\nBody.');
    await importFromCopilot(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', 'bare.md'), 'utf-8');
    expect(content).toContain('description: No globs');
    expect(content).not.toContain('globs:');
  });
});

describe('importFromCopilot — agents', () => {
  it('imports .github/agents/*.agent.md into .agentsbridge/agents/*.md', async () => {
    const agentsDir = join(TEST_DIR, COPILOT_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(
      join(agentsDir, 'reviewer.agent.md'),
      '---\nname: reviewer\ndescription: Code reviewer\n---\n\nYou review code.',
    );
    const results = await importFromCopilot(TEST_DIR);
    const agentResult = results.find(
      (r) => r.feature === 'agents' && r.toPath?.includes('reviewer'),
    );
    expect(agentResult).toBeDefined();
    expect(agentResult?.toPath).toBe('.agentsbridge/agents/reviewer.md');
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'agents', 'reviewer.md'), 'utf-8');
    expect(content).toContain('name: reviewer');
    expect(content).toContain('description: Code reviewer');
    expect(content).toContain('You review code.');
  });

  it('strips .agent suffix from filename', async () => {
    const agentsDir = join(TEST_DIR, COPILOT_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(agentsDir, 'helper.agent.md'), '---\n---\n\nHelper body.');
    const results = await importFromCopilot(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsbridge/agents/helper.md')).toBe(true);
    expect(results.some((r) => r.toPath?.endsWith('.agent.md'))).toBe(false);
  });

  it('maps mcp-servers to mcpServers in canonical output', async () => {
    const agentsDir = join(TEST_DIR, COPILOT_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(
      join(agentsDir, 'ctx.agent.md'),
      '---\nmcp-servers: [prisma, figma]\n---\n\nUse MCP.',
    );
    await importFromCopilot(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'agents', 'ctx.md'), 'utf-8');
    expect(content).toContain('mcpServers');
    expect(content).toContain('prisma');
    expect(content).toContain('figma');
  });

  it('skips agents import when .github/agents does not exist', async () => {
    mkdirSync(join(TEST_DIR, '.github'), { recursive: true });
    writeFileSync(join(TEST_DIR, COPILOT_INSTRUCTIONS), 'Root\n');
    const results = await importFromCopilot(TEST_DIR);
    expect(results.filter((r) => r.feature === 'agents')).toEqual([]);
  });
});

describe('importFromCopilot — skills', () => {
  it('imports .github/skills/{name}/SKILL.md plus supporting files into canonical skills', async () => {
    mkdirSync(join(TEST_DIR, COPILOT_CONTEXT_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, COPILOT_CONTEXT_DIR, 'review.instructions.md'),
      '---\n---\n\nReview rule.',
    );
    mkdirSync(join(TEST_DIR, COPILOT_PROMPTS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, COPILOT_PROMPTS_DIR, 'review.prompt.md'),
      '---\nagent: agent\n---\n\nReview prompt.',
    );
    const skillsDir = join(TEST_DIR, COPILOT_SKILLS_DIR, 'qa', 'references');
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(
      join(TEST_DIR, COPILOT_SKILLS_DIR, 'qa', 'SKILL.md'),
      '---\nname: qa\ndescription: QA\n---\n\nFollow .github/copilot/review.instructions.md.',
    );
    writeFileSync(join(skillsDir, 'checklist.md'), 'See .github/prompts/review.prompt.md.');

    const results = await importFromCopilot(TEST_DIR);

    expect(results.some((r) => r.toPath === '.agentsbridge/skills/qa/SKILL.md')).toBe(true);
    expect(
      results.some((r) => r.toPath === '.agentsbridge/skills/qa/references/checklist.md'),
    ).toBe(true);

    const skillContent = readFileSync(
      join(TEST_DIR, '.agentsbridge', 'skills', 'qa', 'SKILL.md'),
      'utf-8',
    );
    const checklistContent = readFileSync(
      join(TEST_DIR, '.agentsbridge', 'skills', 'qa', 'references', 'checklist.md'),
      'utf-8',
    );

    expect(skillContent).toContain('.agentsbridge/rules/review.md');
    expect(checklistContent).toContain('.agentsbridge/commands/review.md');
  });
});
