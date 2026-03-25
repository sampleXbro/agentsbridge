/**
 * Unit tests for agentsbridge import command.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runImport } from '../../../../src/cli/commands/import.js';

const TEST_DIR = join(tmpdir(), 'ab-import-cmd-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('runImport', () => {
  it('throws when --from is missing', async () => {
    await expect(runImport({}, TEST_DIR)).rejects.toThrow(/required/i);
  });

  it('throws when --from is unknown', async () => {
    await expect(runImport({ from: 'unknown-tool' }, TEST_DIR)).rejects.toThrow(/unknown.*from/i);
  });

  it('imports from claude-code when CLAUDE.md exists', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n');
    await runImport({ from: 'claude-code' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Root');
  });

  it('imports from claude-code when .claude/rules exist', async () => {
    mkdirSync(join(TEST_DIR, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'rules', 'ts.md'), '# TS\n');
    await runImport({ from: 'claude-code' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', 'ts.md'), 'utf-8');
    expect(content).toContain('# TS');
  });

  it('succeeds with no files when nothing to import', async () => {
    await runImport({ from: 'claude-code' }, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.agentsbridge'))).toBe(false);
  });

  it('imports from cursor when AGENTS.md exists', async () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Root\n');
    await runImport({ from: 'cursor' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Root');
  });

  it('imports from cursor when .cursor/rules/*.mdc exist', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'rules', 'ts.mdc'),
      '---\nalwaysApply: false\n---\n\n# TS\n',
    );
    await runImport({ from: 'cursor' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', 'ts.md'), 'utf-8');
    expect(content).toContain('# TS');
  });

  it('succeeds with no files when nothing to import (cursor)', async () => {
    await runImport({ from: 'cursor' }, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.agentsbridge'))).toBe(false);
  });

  it('imports from codex-cli when codex.md exists', async () => {
    writeFileSync(join(TEST_DIR, 'codex.md'), '# Codex Rules\n');
    await runImport({ from: 'codex-cli' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Codex Rules');
  });

  it('imports from codex-cli when AGENTS.md exists (no codex.md)', async () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Agents\n');
    await runImport({ from: 'codex-cli' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('# Agents');
  });

  it('prefers AGENTS.md over codex.md when both exist (official Codex path)', async () => {
    writeFileSync(join(TEST_DIR, 'codex.md'), '# From codex\n');
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# From agents\n');
    await runImport({ from: 'codex-cli' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('# From agents');
  });

  it('succeeds with no files when nothing to import (codex-cli)', async () => {
    await runImport({ from: 'codex-cli' }, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.agentsbridge'))).toBe(false);
  });

  it('imports from windsurf when .windsurfrules exists', async () => {
    writeFileSync(join(TEST_DIR, '.windsurfrules'), '# Windsurf Rules\n\nUse TDD.');
    await runImport({ from: 'windsurf' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Windsurf Rules');
    expect(content).toContain('Use TDD.');
  });

  it('succeeds with no files when nothing to import (windsurf)', async () => {
    await runImport({ from: 'windsurf' }, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.agentsbridge'))).toBe(false);
  });

  it('imports from copilot when .github/copilot-instructions.md exists', async () => {
    mkdirSync(join(TEST_DIR, '.github'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.github', 'copilot-instructions.md'),
      '# Copilot Global Rules\n- Use TDD',
    );
    await runImport({ from: 'copilot' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Copilot Global Rules');
    expect(content).toContain('Use TDD');
  });

  it('imports from copilot when .github/copilot/*.instructions.md exist', async () => {
    mkdirSync(join(TEST_DIR, '.github', 'copilot'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.github', 'copilot', 'review.instructions.md'),
      '---\ndescription: Review\n---\n\nReview body',
    );
    await runImport({ from: 'copilot' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', 'review.md'), 'utf-8');
    expect(content).toContain('description: Review');
    expect(content).toContain('Review body');
  });

  it('imports from copilot when .github/prompts/*.prompt.md exist', async () => {
    mkdirSync(join(TEST_DIR, '.github', 'prompts'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.github', 'prompts', 'review.prompt.md'),
      '---\nagent: agent\ndescription: Review changes\n---\n\nReview body',
    );
    await runImport({ from: 'copilot' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('description: Review changes');
    expect(content).toContain('Review body');
  });

  it('succeeds with no files when nothing to import (copilot)', async () => {
    await runImport({ from: 'copilot' }, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.agentsbridge'))).toBe(false);
  });

  it('imports from gemini-cli when GEMINI.md exists', async () => {
    writeFileSync(join(TEST_DIR, 'GEMINI.md'), '# Gemini Rules\n- Use TDD');
    await runImport({ from: 'gemini-cli' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Gemini Rules');
    expect(content).toContain('Use TDD');
  });

  it('imports from gemini-cli when .gemini/commands exist', async () => {
    mkdirSync(join(TEST_DIR, '.gemini', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.gemini', 'commands', 'lint.md'),
      '---\ndescription: Lint code\n---\n\nRun pnpm lint',
    );
    await runImport({ from: 'gemini-cli' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'commands', 'lint.md'), 'utf-8');
    expect(content).toContain('description: Lint code');
    expect(content).toContain('Run pnpm lint');
  });

  it('succeeds with no files when nothing to import (gemini-cli)', async () => {
    await runImport({ from: 'gemini-cli' }, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.agentsbridge'))).toBe(false);
  });

  it('imports from cline when .clinerules/_root.md exists', async () => {
    mkdirSync(join(TEST_DIR, '.clinerules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.clinerules', '_root.md'), '# Cline Rules\n\nUse TDD.');
    await runImport({ from: 'cline' }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Cline Rules');
    expect(content).toContain('Use TDD.');
  });

  it('imports from cline when .cline/skills exist', async () => {
    mkdirSync(join(TEST_DIR, '.cline', 'skills', 'review'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cline', 'skills', 'review', 'SKILL.md'),
      '---\ndescription: Code review skill\n---\n\nRun code review.',
    );
    await runImport({ from: 'cline' }, TEST_DIR);
    const content = readFileSync(
      join(TEST_DIR, '.agentsbridge', 'skills', 'review', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('description: Code review skill');
    expect(content).toContain('Run code review.');
  });

  it('succeeds with no files when nothing to import (cline)', async () => {
    await runImport({ from: 'cline' }, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.agentsbridge'))).toBe(false);
  });
});
