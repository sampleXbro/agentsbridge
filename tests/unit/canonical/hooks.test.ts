import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseHooks } from '../../../src/canonical/features/hooks.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-hooks-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('parseHooks', () => {
  it('parses PreToolUse and PostToolUse hooks', async () => {
    const path = join(TEST_DIR, 'hooks.yaml');
    writeFileSync(
      path,
      `
PreToolUse:
  - matcher: "Bash"
    command: "./scripts/validate.sh"
    timeout: 30
  - matcher: "Edit|Write"
    command: "eslint --fix"
PostToolUse:
  - matcher: "Write"
    command: "prettier --write $FILE_PATH"
`,
    );
    const result = await parseHooks(path);
    expect(result).not.toBeNull();
    expect(result?.PreToolUse).toHaveLength(2);
    expect(result?.PreToolUse?.[0]).toMatchObject({
      matcher: 'Bash',
      command: './scripts/validate.sh',
      timeout: 30,
    });
    expect(result?.PreToolUse?.[1]).toMatchObject({
      matcher: 'Edit|Write',
      command: 'eslint --fix',
    });
    expect(result?.PostToolUse).toHaveLength(1);
    expect(result?.PostToolUse?.[0]).toMatchObject({
      matcher: 'Write',
      command: 'prettier --write $FILE_PATH',
    });
  });

  it('parses type command and type prompt', async () => {
    const path = join(TEST_DIR, 'hooks.yaml');
    writeFileSync(
      path,
      `
PostToolUse:
  - matcher: "Write"
    type: command
    command: "prettier --write"
  - matcher: "Read"
    type: prompt
    prompt: "Review the file content"
`,
    );
    const result = await parseHooks(path);
    expect(result?.PostToolUse).toHaveLength(2);
    expect(result?.PostToolUse?.[0]).toMatchObject({
      matcher: 'Write',
      type: 'command',
      command: 'prettier --write',
    });
    expect(result?.PostToolUse?.[1]).toMatchObject({
      matcher: 'Read',
      type: 'prompt',
      prompt: 'Review the file content',
    });
  });

  it('returns empty object for empty file', async () => {
    const path = join(TEST_DIR, 'hooks.yaml');
    writeFileSync(path, '');
    const result = await parseHooks(path);
    expect(result).toEqual({});
  });

  it('returns null for non-existent file', async () => {
    const result = await parseHooks(join(TEST_DIR, 'nope.yaml'));
    expect(result).toBeNull();
  });

  it('returns null for malformed YAML', async () => {
    const path = join(TEST_DIR, 'hooks.yaml');
    writeFileSync(path, 'PreToolUse: [broken: yaml');
    const result = await parseHooks(path);
    expect(result).toBeNull();
  });

  it('filters entries without matcher', async () => {
    const path = join(TEST_DIR, 'hooks.yaml');
    writeFileSync(
      path,
      `
PostToolUse:
  - matcher: "Write"
    command: "prettier"
  - command: "missing matcher"
  - matcher: "Read"
    command: "read"
`,
    );
    const result = await parseHooks(path);
    expect(result?.PostToolUse).toHaveLength(2);
    expect(result?.PostToolUse?.map((e) => e.matcher)).toEqual(['Write', 'Read']);
  });

  it('filters entries where matcher is not a string', async () => {
    const path = join(TEST_DIR, 'hooks.yaml');
    writeFileSync(
      path,
      `
PostToolUse:
  - matcher: "Valid"
    command: "cmd"
  - matcher: 42
    command: "cmd2"
  - matcher: null
    command: "cmd3"
`,
    );
    const result = await parseHooks(path);
    expect(result?.PostToolUse).toHaveLength(1);
    expect(result?.PostToolUse?.[0]?.matcher).toBe('Valid');
  });

  it('filters entries whose command or prompt text is empty after trimming', async () => {
    const path = join(TEST_DIR, 'hooks.yaml');
    writeFileSync(
      path,
      `
Notification:
  - matcher: ".*"
    command: ""
    type: command
  - matcher: "Read"
    type: prompt
    prompt: "   "
  - matcher: "Write"
    command: "echo ok"
`,
    );
    const result = await parseHooks(path);
    expect(result?.Notification).toHaveLength(1);
    expect(result?.Notification?.[0]).toMatchObject({
      matcher: 'Write',
      command: 'echo ok',
    });
  });

  it('normalizes invalid type to undefined', async () => {
    const path = join(TEST_DIR, 'hooks.yaml');
    writeFileSync(
      path,
      `
PostToolUse:
  - matcher: "Write"
    command: "prettier"
    type: invalid
`,
    );
    const result = await parseHooks(path);
    expect(result?.PostToolUse?.[0]?.type).toBeUndefined();
  });

  it('parses kebam-case timeout', async () => {
    const path = join(TEST_DIR, 'hooks.yaml');
    writeFileSync(
      path,
      `
PostToolUse:
  - matcher: "Bash"
    command: "echo"
    timeout: 10
`,
    );
    const result = await parseHooks(path);
    expect(result?.PostToolUse?.[0]?.timeout).toBe(10);
  });

  it('skips top-level keys that are not arrays', async () => {
    const path = join(TEST_DIR, 'hooks.yaml');
    writeFileSync(
      path,
      `
PostToolUse:
  - matcher: "Write"
    command: "prettier"
meta:
  description: "not a hook"
`,
    );
    const result = await parseHooks(path);
    expect(result?.PostToolUse).toHaveLength(1);
    expect((result as Record<string, unknown>).meta).toBeUndefined();
  });
});
