import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  claudeHooksToCanonical,
  importClaudeHooksJson,
  importMcpJson,
  importSettings,
} from '../../../../src/targets/claude-code/settings-helpers.js';
import { generateClaudeGlobalExtras } from '../../../../src/targets/claude-code/global-extras.js';
import { renderClaudeGlobalPrimaryInstructions } from '../../../../src/targets/claude-code/global-instructions.js';
import type {
  CanonicalAgent,
  CanonicalCommand,
  CanonicalFiles,
  CanonicalRule,
  ImportResult,
} from '../../../../src/core/types.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'amesh-cc-cov-'));
  tempDirs.push(dir);
  return dir;
}

function makeAgent(partial: Partial<CanonicalAgent> & { name: string }): CanonicalAgent {
  return {
    source: `${partial.name}.md`,
    name: partial.name,
    description: '',
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: '',
    ...partial,
  };
}

function makeCommand(partial: Partial<CanonicalCommand> & { name: string }): CanonicalCommand {
  return {
    source: `${partial.name}.md`,
    name: partial.name,
    description: '',
    allowedTools: [],
    body: '',
    ...partial,
  };
}

function makeRule(partial: Partial<CanonicalRule> & { source: string }): CanonicalRule {
  return {
    source: partial.source,
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: '',
    ...partial,
  };
}

function makeCanonical(partial: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...partial,
  };
}

describe('claudeHooksToCanonical — extra branch coverage', () => {
  it('skips non-object/null entries and entries with non-array hooks', () => {
    const out = claudeHooksToCanonical({
      PreToolUse: [
        null,
        'string-entry',
        42,
        { matcher: 'a', hooks: 'not-an-array' },
        { matcher: 'b', hooks: [{ type: 'command', command: 'ok' }] },
      ],
    });
    expect(out).toEqual({
      PreToolUse: [{ matcher: 'b', type: 'command', command: 'ok' }],
    });
  });

  it('falls back to command when type=prompt has empty prompt', () => {
    const out = claudeHooksToCanonical({
      PostToolUse: [
        {
          matcher: '*',
          hooks: [{ type: 'prompt', command: 'fallback-cmd' }],
        },
      ],
    });
    expect(out.PostToolUse).toEqual([{ matcher: '*', type: 'prompt', command: 'fallback-cmd' }]);
  });

  it('falls back to prompt when type=command has empty command', () => {
    const out = claudeHooksToCanonical({
      PostToolUse: [
        {
          matcher: '*',
          hooks: [{ type: 'command', prompt: 'fallback-prompt' }],
        },
      ],
    });
    expect(out.PostToolUse).toEqual([
      { matcher: '*', type: 'command', command: 'fallback-prompt' },
    ]);
  });

  it('omits timeout when not a number', () => {
    const out = claudeHooksToCanonical({
      PostToolUse: [
        {
          matcher: '*',
          hooks: [{ type: 'command', command: 'go', timeout: 'soon' }],
        },
      ],
    });
    expect(out.PostToolUse).toEqual([{ matcher: '*', type: 'command', command: 'go' }]);
    expect(out.PostToolUse[0]).not.toHaveProperty('timeout');
  });
});

describe('importClaudeHooksJson — branch coverage', () => {
  it('returns false when hooks.json is missing', async () => {
    const dir = createTempDir();
    const results: ImportResult[] = [];
    const ok = await importClaudeHooksJson(dir, results);
    expect(ok).toBe(false);
    expect(results).toEqual([]);
  });

  it('returns false on invalid JSON', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'hooks.json'), '{not-json');
    const results: ImportResult[] = [];
    const ok = await importClaudeHooksJson(dir, results);
    expect(ok).toBe(false);
    expect(results).toEqual([]);
  });

  it('returns false when parsed payload is not a plain object', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'hooks.json'), JSON.stringify(['array', 'top-level']));
    const results: ImportResult[] = [];
    const ok = await importClaudeHooksJson(dir, results);
    expect(ok).toBe(false);
    expect(results).toEqual([]);
  });

  it('returns false when canonical hooks is empty', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    // No matcher → entry skipped → canonical stays empty
    writeFileSync(
      join(dir, '.claude', 'hooks.json'),
      JSON.stringify({ PreToolUse: [{ hooks: [{ type: 'command', command: 'x' }] }] }),
    );
    const results: ImportResult[] = [];
    const ok = await importClaudeHooksJson(dir, results);
    expect(ok).toBe(false);
    expect(results).toEqual([]);
  });

  it('writes hooks.yaml and pushes a result on a valid hooks file', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'hooks.json'),
      JSON.stringify({
        PreToolUse: [
          { matcher: '*', hooks: [{ type: 'command', command: 'pnpm lint', timeout: 5 }] },
        ],
      }),
    );
    const results: ImportResult[] = [];
    const ok = await importClaudeHooksJson(dir, results);
    expect(ok).toBe(true);
    expect(results).toEqual([
      {
        fromTool: 'claude-code',
        fromPath: join(dir, '.claude', 'hooks.json'),
        toPath: '.agentsmesh/hooks.yaml',
        feature: 'hooks',
      },
    ]);
    const written = readFileSync(join(dir, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(written).toContain('pnpm lint');
    expect(written).toContain('timeout: 5');
  });
});

describe('importMcpJson — branch coverage', () => {
  it('returns silently when global mcp file is missing', async () => {
    const dir = createTempDir();
    const results: ImportResult[] = [];
    await importMcpJson(dir, results, 'global');
    expect(results).toEqual([]);
    expect(existsSync(join(dir, '.agentsmesh', 'mcp.json'))).toBe(false);
  });

  it('reads global mcpServers from .claude.json under scope=global', async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, '.claude.json'),
      JSON.stringify({ mcpServers: { docs: { command: 'npx', args: ['-y'] } } }),
    );
    const results: ImportResult[] = [];
    await importMcpJson(dir, results, 'global');
    expect(results).toEqual([
      {
        fromTool: 'claude-code',
        fromPath: join(dir, '.claude.json'),
        toPath: '.agentsmesh/mcp.json',
        feature: 'mcp',
      },
    ]);
    const written = readFileSync(join(dir, '.agentsmesh', 'mcp.json'), 'utf-8');
    expect(written).toContain('"docs"');
  });

  it('does nothing when mcpServers field is missing or non-object', async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: 'not-an-object' }));
    const results: ImportResult[] = [];
    await importMcpJson(dir, results);
    expect(results).toEqual([]);
    expect(existsSync(join(dir, '.agentsmesh', 'mcp.json'))).toBe(false);
  });
});

describe('importSettings — branch coverage', () => {
  it('returns when settings.json is missing', async () => {
    const dir = createTempDir();
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results).toEqual([]);
  });

  it('returns when settings.json has invalid JSON', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'settings.json'), '{not-json');
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results).toEqual([]);
  });

  it('skips permissions when field is non-object/array', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.json'),
      JSON.stringify({ permissions: ['allow', 'this'] }),
    );
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results.find((r) => r.feature === 'permissions')).toBeUndefined();
    expect(existsSync(join(dir, '.agentsmesh', 'permissions.yaml'))).toBe(false);
  });

  it('emits no permissions result when allow/deny/ask are all empty', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: [], deny: [], ask: [] } }),
    );
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results.find((r) => r.feature === 'permissions')).toBeUndefined();
    expect(existsSync(join(dir, '.agentsmesh', 'permissions.yaml'))).toBe(false);
  });

  it('filters out non-string permission values and writes only string entries', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.json'),
      JSON.stringify({
        permissions: {
          allow: ['Read', 1, null, 'Grep'],
          deny: [false, 'Bash'],
          ask: [{}, 'Confirm'],
        },
      }),
    );
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    const permResult = results.find((r) => r.feature === 'permissions');
    expect(permResult).toMatchObject({ toPath: '.agentsmesh/permissions.yaml' });
    const written = readFileSync(join(dir, '.agentsmesh', 'permissions.yaml'), 'utf-8');
    expect(written).toContain('Read');
    expect(written).toContain('Grep');
    expect(written).toContain('Bash');
    expect(written).toContain('Confirm');
    expect(written).not.toContain('false');
    expect(written).not.toContain('null');
  });

  it('skips standalone hooks when already imported, and skips mcp when prior result exists', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.json'),
      JSON.stringify({
        mcpServers: { docs: { command: 'npx' } },
        hooks: {
          PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'pnpm test' }] }],
        },
      }),
    );

    const results: ImportResult[] = [
      {
        fromTool: 'claude-code',
        fromPath: join(dir, '.claude', 'hooks.json'),
        toPath: '.agentsmesh/hooks.yaml',
        feature: 'hooks',
      },
      {
        fromTool: 'claude-code',
        fromPath: join(dir, '.mcp.json'),
        toPath: '.agentsmesh/mcp.json',
        feature: 'mcp',
      },
    ];
    await importSettings(dir, results);
    // Should not add another mcp or hooks result.
    expect(results.filter((r) => r.feature === 'mcp')).toHaveLength(1);
    expect(results.filter((r) => r.feature === 'hooks')).toHaveLength(1);
    expect(existsSync(join(dir, '.agentsmesh', 'hooks.yaml'))).toBe(false);
  });

  it('skips writing hooks when canonical hooks is empty', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.json'),
      JSON.stringify({
        // hooks present but no valid matcher → canonical is {}
        hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'x' }] }] },
      }),
    );
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results.find((r) => r.feature === 'hooks')).toBeUndefined();
    expect(existsSync(join(dir, '.agentsmesh', 'hooks.yaml'))).toBe(false);
  });

  it('skips hooks block when settings.hooks is an array (non-object)', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify({ hooks: ['unexpected'] }));
    const results: ImportResult[] = [];
    await importSettings(dir, results);
    expect(results).toEqual([]);
    expect(existsSync(join(dir, '.agentsmesh', 'hooks.yaml'))).toBe(false);
  });
});

describe('generateClaudeGlobalExtras — branch coverage', () => {
  it('returns [] when scope is project', async () => {
    const dir = createTempDir();
    const out = await generateClaudeGlobalExtras(
      makeCanonical({ agents: [makeAgent({ name: 'a', outputStyle: true })] }),
      dir,
      'project',
      new Set(['agents', 'commands']),
    );
    expect(out).toEqual([]);
  });

  it('returns [] when neither agents nor commands are enabled', async () => {
    const dir = createTempDir();
    const out = await generateClaudeGlobalExtras(
      makeCanonical({ agents: [makeAgent({ name: 'a', outputStyle: true })] }),
      dir,
      'global',
      new Set(['rules']),
    );
    expect(out).toEqual([]);
  });

  it('skips agents/commands without outputStyle', async () => {
    const dir = createTempDir();
    const out = await generateClaudeGlobalExtras(
      makeCanonical({
        agents: [makeAgent({ name: 'no-style' })],
        commands: [makeCommand({ name: 'plain' })],
      }),
      dir,
      'global',
      new Set(['agents', 'commands']),
    );
    expect(out).toEqual([]);
  });

  it('emits agent output-style with description when outputStyle=true', async () => {
    const dir = createTempDir();
    const agent = makeAgent({
      name: 'reviewer',
      description: 'Code reviewer',
      body: 'Body for reviewer.',
      outputStyle: true,
    });
    const out = await generateClaudeGlobalExtras(
      makeCanonical({ agents: [agent] }),
      dir,
      'global',
      new Set(['agents']),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      target: 'claude-code',
      path: '.claude/output-styles/reviewer.md',
      status: 'created',
    });
    expect(out[0].content).toContain('name: reviewer');
    expect(out[0].content).toContain('description: Code reviewer');
    expect(out[0].content).toContain('Body for reviewer.');
    expect(out[0].currentContent).toBeUndefined();
  });

  it('omits description when agent description is empty', async () => {
    const dir = createTempDir();
    const agent = makeAgent({
      name: 'plain-agent',
      description: '',
      body: 'Plain body.',
      outputStyle: true,
    });
    const out = await generateClaudeGlobalExtras(
      makeCanonical({ agents: [agent] }),
      dir,
      'global',
      new Set(['agents']),
    );
    expect(out).toHaveLength(1);
    expect(out[0].content).toContain('name: plain-agent');
    expect(out[0].content).not.toContain('description:');
  });

  it('emits command output-style and yields status=unchanged when on-disk content matches', async () => {
    const dir = createTempDir();
    const cmd = makeCommand({
      name: 'deploy',
      description: 'Deploy command',
      body: 'Run the deploy.',
      outputStyle: true,
    });
    // First pass: create.
    const firstPass = await generateClaudeGlobalExtras(
      makeCanonical({ commands: [cmd] }),
      dir,
      'global',
      new Set(['commands']),
    );
    expect(firstPass).toHaveLength(1);
    expect(firstPass[0].status).toBe('created');

    // Persist to disk and re-run; should be unchanged.
    const targetPath = join(dir, '.claude', 'output-styles');
    mkdirSync(targetPath, { recursive: true });
    writeFileSync(join(targetPath, 'deploy.md'), firstPass[0].content);

    const secondPass = await generateClaudeGlobalExtras(
      makeCanonical({ commands: [cmd] }),
      dir,
      'global',
      new Set(['commands']),
    );
    expect(secondPass).toHaveLength(1);
    expect(secondPass[0].status).toBe('unchanged');
    expect(secondPass[0].currentContent).toBe(firstPass[0].content);
  });

  it('returns status=updated when on-disk content differs', async () => {
    const dir = createTempDir();
    const cmd = makeCommand({
      name: 'deploy',
      description: 'New description',
      body: 'New body.',
      outputStyle: true,
    });
    const targetPath = join(dir, '.claude', 'output-styles');
    mkdirSync(targetPath, { recursive: true });
    writeFileSync(join(targetPath, 'deploy.md'), 'stale content\n');
    const out = await generateClaudeGlobalExtras(
      makeCanonical({ commands: [cmd] }),
      dir,
      'global',
      new Set(['commands']),
    );
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('updated');
    expect(out[0].currentContent).toBe('stale content\n');
  });

  it('omits description for commands when description is empty', async () => {
    const dir = createTempDir();
    const cmd = makeCommand({
      name: 'bare',
      description: '',
      body: 'No description body.',
      outputStyle: true,
    });
    const out = await generateClaudeGlobalExtras(
      makeCanonical({ commands: [cmd] }),
      dir,
      'global',
      new Set(['commands']),
    );
    expect(out).toHaveLength(1);
    expect(out[0].content).toContain('name: bare');
    expect(out[0].content).not.toContain('description:');
  });
});

describe('renderClaudeGlobalPrimaryInstructions — branch coverage', () => {
  it('returns empty string when there is no root rule', () => {
    const result = renderClaudeGlobalPrimaryInstructions(makeCanonical());
    expect(result).toBe('');
  });

  it('returns empty string when root rule body is empty/whitespace', () => {
    const result = renderClaudeGlobalPrimaryInstructions(
      makeCanonical({ rules: [makeRule({ source: '_root.md', root: true, body: '   \n  ' })] }),
    );
    expect(result).toBe('');
  });

  it('uses description when present', () => {
    const out = renderClaudeGlobalPrimaryInstructions(
      makeCanonical({
        rules: [
          makeRule({
            source: '_root.md',
            root: true,
            description: 'Operational Guidelines',
            body: 'Body content.',
          }),
        ],
      }),
    );
    expect(out).toContain('# Global Instructions');
    expect(out).toContain('## Operational Guidelines');
    expect(out).toContain('Body content.');
  });

  it('falls back to filename when description is blank', () => {
    const out = renderClaudeGlobalPrimaryInstructions(
      makeCanonical({
        rules: [
          makeRule({
            source: 'rules/typescript.md',
            root: true,
            description: '   ',
            body: 'TS body.',
          }),
        ],
      }),
    );
    expect(out).toContain('## typescript');
    expect(out).toContain('TS body.');
  });

  it('falls back to "Rule" when basename strips to empty', () => {
    const out = renderClaudeGlobalPrimaryInstructions(
      makeCanonical({
        rules: [makeRule({ source: '.md', root: true, description: '', body: 'Edge body.' })],
      }),
    );
    expect(out).toContain('## Rule');
    expect(out).toContain('Edge body.');
  });

  it('falls back to "rule" when source has no basename', () => {
    const out = renderClaudeGlobalPrimaryInstructions(
      makeCanonical({
        rules: [makeRule({ source: '', root: true, description: '', body: 'Empty source.' })],
      }),
    );
    // basename('') === '' → 'rule' fallback before .md strip.
    expect(out).toContain('## rule');
    expect(out).toContain('Empty source.');
  });
});
