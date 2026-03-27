import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCanonicalFiles } from '../../../src/canonical/load/loader.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-loader-test');
const AB_DIR = join(TEST_DIR, '.agentsmesh');

beforeEach(() => {
  mkdirSync(AB_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('loadCanonicalFiles', () => {
  it('returns empty canonical files when .agentsmesh is empty', async () => {
    const result = await loadCanonicalFiles(TEST_DIR);
    expect(result.rules).toEqual([]);
    expect(result.commands).toEqual([]);
    expect(result.agents).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.mcp).toBeNull();
    expect(result.permissions).toBeNull();
    expect(result.hooks).toBeNull();
    expect(result.ignore).toEqual([]);
  });

  it('loads rules from .agentsmesh/rules', async () => {
    mkdirSync(join(AB_DIR, 'rules'), { recursive: true });
    writeFileSync(
      join(AB_DIR, 'rules', '_root.md'),
      `---
root: true
---
# Root rule
`,
    );
    const result = await loadCanonicalFiles(TEST_DIR);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toMatchObject({
      root: true,
      body: expect.stringContaining('Root rule'),
    });
  });

  it('loads commands from .agentsmesh/commands', async () => {
    mkdirSync(join(AB_DIR, 'commands'), { recursive: true });
    writeFileSync(
      join(AB_DIR, 'commands', 'review.md'),
      `---
description: Run code review
allowed-tools: Read, Grep
---
Review changes.`,
    );
    const result = await loadCanonicalFiles(TEST_DIR);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]).toMatchObject({
      name: 'review',
      description: 'Run code review',
      allowedTools: ['Read', 'Grep'],
    });
  });

  it('loads agents from .agentsmesh/agents', async () => {
    mkdirSync(join(AB_DIR, 'agents'), { recursive: true });
    writeFileSync(
      join(AB_DIR, 'agents', 'reviewer.md'),
      `---
name: reviewer
description: Reviews code
---
System prompt`,
    );
    const result = await loadCanonicalFiles(TEST_DIR);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]).toMatchObject({
      name: 'reviewer',
      description: 'Reviews code',
    });
  });

  it('loads skills from .agentsmesh/skills', async () => {
    mkdirSync(join(AB_DIR, 'skills', 'api-gen'), { recursive: true });
    writeFileSync(
      join(AB_DIR, 'skills', 'api-gen', 'SKILL.md'),
      `---
description: Generate API code
---
# API Generator`,
    );
    const result = await loadCanonicalFiles(TEST_DIR);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]).toMatchObject({
      name: 'api-gen',
      description: 'Generate API code',
    });
  });

  it('loads mcp from .agentsmesh/mcp.json', async () => {
    writeFileSync(
      join(AB_DIR, 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          context7: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
          },
        },
      }),
    );
    const result = await loadCanonicalFiles(TEST_DIR);
    expect(result.mcp).not.toBeNull();
    expect(result.mcp?.mcpServers.context7).toMatchObject({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
    });
  });

  it('loads permissions from .agentsmesh/permissions.yaml', async () => {
    writeFileSync(
      join(AB_DIR, 'permissions.yaml'),
      'allow:\n  - Read\n  - Grep\ndeny:\n  - Bash\n',
    );
    const result = await loadCanonicalFiles(TEST_DIR);
    expect(result.permissions).not.toBeNull();
    expect(result.permissions?.allow).toEqual(['Read', 'Grep']);
    expect(result.permissions?.deny).toEqual(['Bash']);
  });

  it('loads hooks from .agentsmesh/hooks.yaml', async () => {
    writeFileSync(
      join(AB_DIR, 'hooks.yaml'),
      `PostToolUse:
  - matcher: Write
    type: command
    command: prettier --write
`,
    );
    const result = await loadCanonicalFiles(TEST_DIR);
    expect(result.hooks).not.toBeNull();
    expect(result.hooks?.PostToolUse).toHaveLength(1);
    expect(result.hooks?.PostToolUse?.[0]).toMatchObject({
      matcher: 'Write',
      type: 'command',
      command: 'prettier --write',
    });
  });

  it('loads ignore from .agentsmesh/ignore', async () => {
    writeFileSync(join(AB_DIR, 'ignore'), 'node_modules\n.env\n# comment\n\nsecrets/');
    const result = await loadCanonicalFiles(TEST_DIR);
    expect(result.ignore).toEqual(['node_modules', '.env', 'secrets/']);
  });

  it('loads all canonical files when fully populated', async () => {
    mkdirSync(join(AB_DIR, 'rules'), { recursive: true });
    mkdirSync(join(AB_DIR, 'commands'), { recursive: true });
    writeFileSync(join(AB_DIR, 'rules', '_root.md'), '---\nroot: true\n---\n# Root');
    writeFileSync(
      join(AB_DIR, 'commands', 'test.md'),
      '---\ndescription: Test\nallowed-tools: Read\n---\nBody',
    );
    writeFileSync(
      join(AB_DIR, 'mcp.json'),
      '{"mcpServers":{"x":{"type":"stdio","command":"echo"}}}',
    );
    writeFileSync(join(AB_DIR, 'permissions.yaml'), 'allow: [Read]\ndeny: []');
    writeFileSync(join(AB_DIR, 'hooks.yaml'), 'PreToolUse: []');
    writeFileSync(join(AB_DIR, 'ignore'), 'dist');

    const result = await loadCanonicalFiles(TEST_DIR);

    expect(result.rules).toHaveLength(1);
    expect(result.commands).toHaveLength(1);
    expect(result.agents).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.mcp).not.toBeNull();
    expect(result.permissions).not.toBeNull();
    expect(result.hooks).not.toBeNull();
    expect(result.ignore).toEqual(['dist']);
  });

  it('handles non-existent .agentsmesh directory', async () => {
    const emptyDir = join(tmpdir(), 'agentsmesh-loader-nonexistent');
    mkdirSync(emptyDir, { recursive: true });
    const result = await loadCanonicalFiles(emptyDir);
    expect(result.rules).toEqual([]);
    expect(result.commands).toEqual([]);
    expect(result.mcp).toBeNull();
    expect(result.ignore).toEqual([]);
    rmSync(emptyDir, { recursive: true, force: true });
  });
});
