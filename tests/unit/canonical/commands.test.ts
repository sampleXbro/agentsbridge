import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseCommands } from '../../../src/canonical/features/commands.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-commands-test');
const COMMANDS_DIR = join(TEST_DIR, '.agentsmesh', 'commands');

beforeEach(() => {
  mkdirSync(COMMANDS_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function writeCommand(filename: string, content: string): void {
  writeFileSync(join(COMMANDS_DIR, filename), content);
}

describe('parseCommands', () => {
  it('parses single command with frontmatter', async () => {
    writeCommand(
      'review.md',
      `---
description: Run thorough code review on current changes
allowed-tools: Read, Grep, Glob, Bash(git diff)
---

Review the current git diff and provide feedback.`,
    );
    const commands = await parseCommands(COMMANDS_DIR);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      source: expect.stringContaining('review.md'),
      name: 'review',
      description: 'Run thorough code review on current changes',
      allowedTools: ['Read', 'Grep', 'Glob', 'Bash(git diff)'],
      body: expect.stringContaining('Review the current git diff'),
    });
  });

  it('derives command name from filename', async () => {
    writeCommand(
      'deploy.md',
      `---
description: Deploy to staging
---
Deploy steps.`,
    );
    const commands = await parseCommands(COMMANDS_DIR);
    expect(commands[0]?.name).toBe('deploy');
  });

  it('parses allowedTools as YAML array', async () => {
    writeCommand(
      'lint.md',
      `---
description: Lint code
allowedTools: [Read, Grep, Glob]
---
Run linter.`,
    );
    const commands = await parseCommands(COMMANDS_DIR);
    expect(commands[0]?.allowedTools).toEqual(['Read', 'Grep', 'Glob']);
  });

  it('handles allowed-tools kebam-case', async () => {
    writeCommand(
      'fix.md',
      `---
description: Auto-fix
allowed-tools: Read, Write
---
Fix issues.`,
    );
    const commands = await parseCommands(COMMANDS_DIR);
    expect(commands[0]?.allowedTools).toEqual(['Read', 'Write']);
  });

  it('parses multiple commands', async () => {
    writeCommand(
      'review.md',
      `---
description: Review
allowed-tools: Read
---
Review body.`,
    );
    writeCommand(
      'deploy.md',
      `---
description: Deploy
---
Deploy body.`,
    );
    const commands = await parseCommands(COMMANDS_DIR);
    expect(commands).toHaveLength(2);
    const review = commands.find((c) => c.name === 'review');
    const deploy = commands.find((c) => c.name === 'deploy');
    expect(review?.body).toContain('Review body');
    expect(deploy?.body).toContain('Deploy body');
  });

  it('returns empty allowedTools when not specified', async () => {
    writeCommand(
      'simple.md',
      `---
description: Simple
---
Body only.`,
    );
    const commands = await parseCommands(COMMANDS_DIR);
    expect(commands[0]?.allowedTools).toEqual([]);
  });

  it('returns empty array for non-existent directory', async () => {
    const commands = await parseCommands(join(TEST_DIR, 'nope'));
    expect(commands).toEqual([]);
  });

  it('returns empty array for empty commands directory', async () => {
    const commands = await parseCommands(COMMANDS_DIR);
    expect(commands).toEqual([]);
  });

  it('uses defaults when frontmatter minimal', async () => {
    writeCommand('minimal.md', `# Just body`);
    const commands = await parseCommands(COMMANDS_DIR);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      name: 'minimal',
      description: '',
      allowedTools: [],
      body: expect.stringContaining('Just body'),
    });
  });

  it('skips _example.md and other underscore-prefixed files', async () => {
    writeCommand('_example.md', `---\ndescription: Example command\n---\n\nDo not generate.`);
    writeCommand('real.md', `---\ndescription: Real command\n---\n\nGenerate this.`);
    const commands = await parseCommands(COMMANDS_DIR);
    expect(commands).toHaveLength(1);
    expect(commands[0]?.description).toBe('Real command');
  });

  it('ignores non-.md files', async () => {
    writeCommand(
      'review.md',
      `---
description: Review
---
Body`,
    );
    writeFileSync(join(COMMANDS_DIR, 'readme.txt'), 'not a command');
    const commands = await parseCommands(COMMANDS_DIR);
    expect(commands).toHaveLength(1);
  });
});
