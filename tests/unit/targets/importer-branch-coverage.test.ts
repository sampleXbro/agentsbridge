/**
 * Branch-coverage tests for kiro and windsurf importers and kiro hook-format.
 *
 * These tests target specific branches not exercised by the default importer
 * tests: scope-driven candidate ordering, frontmatter inclusion mappings,
 * shorthand vs nested windsurf hook entries, MCP candidate fallback, and
 * the parseKiroHookFile / generateKiroHooks edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as yamlParse } from 'yaml';

import { importFromKiro } from '../../../src/targets/kiro/importer.js';
import {
  KIRO_AGENTS_MD,
  KIRO_GLOBAL_STEERING_AGENTS_MD,
  KIRO_STEERING_DIR,
  KIRO_HOOKS_DIR,
} from '../../../src/targets/kiro/constants.js';
import {
  importWindsurfHooks,
  importWindsurfMcp,
} from '../../../src/targets/windsurf/importer-hooks-mcp.js';
import {
  WINDSURF_HOOKS_FILE,
  WINDSURF_MCP_EXAMPLE_FILE,
  WINDSURF_MCP_CONFIG_FILE,
} from '../../../src/targets/windsurf/constants.js';
import {
  parseKiroHookFile,
  generateKiroHooks,
  serializeCanonicalHooks,
} from '../../../src/targets/kiro/hook-format.js';
import type { ImportResult, Hooks } from '../../../src/core/types.js';

let TEST_DIR: string;

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), 'am-importer-branch-'));
});
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

// ---------------------------------------------------------------------------
// importFromKiro — root rule scope ordering
// ---------------------------------------------------------------------------

describe('importFromKiro — root rule scope ordering', () => {
  it('project scope: imports project AGENTS.md when only project file exists', async () => {
    writeFileSync(join(TEST_DIR, KIRO_AGENTS_MD), '# Project Root\n');

    const results = await importFromKiro(TEST_DIR, { scope: 'project' });
    const root = results.find((r) => r.toPath === '.agentsmesh/rules/_root.md');

    expect(root).toBeDefined();
    expect(root!.fromPath).toBe(join(TEST_DIR, KIRO_AGENTS_MD));
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      '# Project Root',
    );
  });

  it('project scope: falls back to global steering AGENTS.md when project AGENTS.md absent', async () => {
    mkdirSync(join(TEST_DIR, '.kiro', 'steering'), { recursive: true });
    writeFileSync(join(TEST_DIR, KIRO_GLOBAL_STEERING_AGENTS_MD), '# Global Fallback\n');

    const results = await importFromKiro(TEST_DIR, { scope: 'project' });
    const root = results.find((r) => r.toPath === '.agentsmesh/rules/_root.md');

    expect(root).toBeDefined();
    expect(root!.fromPath).toBe(join(TEST_DIR, KIRO_GLOBAL_STEERING_AGENTS_MD));
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      '# Global Fallback',
    );
  });

  it('global scope: prefers global steering AGENTS.md when both exist', async () => {
    writeFileSync(join(TEST_DIR, KIRO_AGENTS_MD), '# Project Root\n');
    mkdirSync(join(TEST_DIR, '.kiro', 'steering'), { recursive: true });
    writeFileSync(join(TEST_DIR, KIRO_GLOBAL_STEERING_AGENTS_MD), '# Global Steering Root\n');

    const results = await importFromKiro(TEST_DIR, { scope: 'global' });
    const root = results.find((r) => r.toPath === '.agentsmesh/rules/_root.md');

    expect(root).toBeDefined();
    expect(root!.fromPath).toBe(join(TEST_DIR, KIRO_GLOBAL_STEERING_AGENTS_MD));
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('# Global Steering Root');
    expect(content).not.toContain('# Project Root');
  });

  it('global scope: skips hooks (only project scope imports hooks)', async () => {
    writeFileSync(join(TEST_DIR, KIRO_AGENTS_MD), '# Root\n');
    mkdirSync(join(TEST_DIR, KIRO_HOOKS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KIRO_HOOKS_DIR, 'lint.kiro.hook'),
      JSON.stringify({
        name: 'lint',
        version: '1',
        when: { type: 'preToolUse', tools: ['write'] },
        then: { type: 'shellCommand', command: 'lint' },
      }),
    );

    const projectResults = await importFromKiro(TEST_DIR, { scope: 'project' });
    expect(projectResults.find((r) => r.toPath === '.agentsmesh/hooks.yaml')).toBeDefined();

    rmSync(join(TEST_DIR, '.agentsmesh'), { recursive: true, force: true });

    const globalResults = await importFromKiro(TEST_DIR, { scope: 'global' });
    expect(globalResults.find((r) => r.feature === 'hooks')).toBeUndefined();
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// importFromKiro — non-root rules behavior
// ---------------------------------------------------------------------------

describe('importFromKiro — non-root rules', () => {
  it('skips files named AGENTS.md inside steering directory', async () => {
    mkdirSync(join(TEST_DIR, KIRO_STEERING_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, KIRO_STEERING_DIR, 'AGENTS.md'), '# Should be skipped\n');
    writeFileSync(join(TEST_DIR, KIRO_STEERING_DIR, 'real.md'), '# Real rule\n');

    const results = await importFromKiro(TEST_DIR, { scope: 'project' });
    const ruleResults = results.filter((r) => r.feature === 'rules');

    // No rule with toPath ending in /AGENTS.md from steering should be present.
    expect(ruleResults.find((r) => r.toPath === '.agentsmesh/rules/AGENTS.md')).toBeUndefined();
    expect(ruleResults.find((r) => r.toPath === '.agentsmesh/rules/real.md')).toBeDefined();
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'rules', 'AGENTS.md'))).toBe(false);
  });

  it("inclusion: 'manual' frontmatter -> trigger='manual'", async () => {
    mkdirSync(join(TEST_DIR, KIRO_STEERING_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KIRO_STEERING_DIR, 'manual-rule.md'),
      '---\ninclusion: manual\ndescription: Manual only\n---\n\nManual body.',
    );

    await importFromKiro(TEST_DIR, { scope: 'project' });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'manual-rule.md'), 'utf-8');

    expect(content).toContain('trigger: manual');
    expect(content).toContain('description: Manual only');
  });

  it("inclusion: 'auto' frontmatter -> trigger='model_decision'", async () => {
    mkdirSync(join(TEST_DIR, KIRO_STEERING_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KIRO_STEERING_DIR, 'auto-rule.md'),
      '---\ninclusion: auto\ndescription: AI decides\n---\n\nAuto body.',
    );

    await importFromKiro(TEST_DIR, { scope: 'project' });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'auto-rule.md'), 'utf-8');

    expect(content).toContain('trigger: model_decision');
  });

  it("inclusion: 'fileMatch' frontmatter -> trigger='glob'", async () => {
    mkdirSync(join(TEST_DIR, KIRO_STEERING_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KIRO_STEERING_DIR, 'fm-rule.md'),
      '---\ninclusion: fileMatch\nfileMatchPattern: src/**/*.ts\n---\n\nGlob body.',
    );

    await importFromKiro(TEST_DIR, { scope: 'project' });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'fm-rule.md'), 'utf-8');

    expect(content).toContain('trigger: glob');
    expect(content).toContain('src/**/*.ts');
  });

  it('hits canonicalRuleMeta description=undefined branch when frontmatter has no description', async () => {
    mkdirSync(join(TEST_DIR, KIRO_STEERING_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KIRO_STEERING_DIR, 'no-desc.md'),
      '---\ninclusion: manual\n---\n\nBody without description.',
    );

    await importFromKiro(TEST_DIR, { scope: 'project' });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'no-desc.md'), 'utf-8');

    // The undefined description path is exercised by the importer; downstream
    // serialization may render it as an empty string. We just assert the rule
    // imported cleanly with the manual trigger and body intact.
    expect(content).toContain('trigger: manual');
    expect(content).toContain('Body without description.');
  });
});

// ---------------------------------------------------------------------------
// importFromKiro — importHooks branch coverage
// ---------------------------------------------------------------------------

describe('importFromKiro — importHooks branches', () => {
  it('skips files in hooks dir without .kiro.hook extension', async () => {
    mkdirSync(join(TEST_DIR, KIRO_HOOKS_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, KIRO_HOOKS_DIR, 'README.md'), '# Notes\n');
    writeFileSync(join(TEST_DIR, KIRO_HOOKS_DIR, 'config.json'), '{}');

    const results = await importFromKiro(TEST_DIR, { scope: 'project' });

    expect(results.find((r) => r.toPath === '.agentsmesh/hooks.yaml')).toBeUndefined();
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'))).toBe(false);
  });

  it('mixes valid .kiro.hook with non-hook siblings (only valid imported)', async () => {
    mkdirSync(join(TEST_DIR, KIRO_HOOKS_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, KIRO_HOOKS_DIR, 'notes.txt'), 'ignored');
    writeFileSync(
      join(TEST_DIR, KIRO_HOOKS_DIR, 'review.kiro.hook'),
      JSON.stringify({
        name: 'review',
        version: '1',
        when: { type: 'postToolUse', tools: ['write'] },
        then: { type: 'shellCommand', command: 'review' },
      }),
    );

    const results = await importFromKiro(TEST_DIR, { scope: 'project' });

    expect(results.find((r) => r.toPath === '.agentsmesh/hooks.yaml')).toBeDefined();
    const hooksContent = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(hooksContent).toContain('PostToolUse');
    expect(hooksContent).toContain('command: review');
  });

  it('produces no hooks result when no hook files exist at all', async () => {
    writeFileSync(join(TEST_DIR, KIRO_AGENTS_MD), '# Root\n');

    const results = await importFromKiro(TEST_DIR, { scope: 'project' });

    expect(results.find((r) => r.feature === 'hooks')).toBeUndefined();
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// importWindsurfHooks branches
// ---------------------------------------------------------------------------

describe('importWindsurfHooks — guard branches', () => {
  it('returns silently when hooks file is missing', async () => {
    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('returns silently when hooks file is invalid JSON', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(join(TEST_DIR, WINDSURF_HOOKS_FILE), '{not valid json');

    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);

    expect(results).toEqual([]);
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'))).toBe(false);
  });

  it('returns when parsed.hooks is missing', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(join(TEST_DIR, WINDSURF_HOOKS_FILE), JSON.stringify({ other: 'data' }));

    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);

    expect(results).toEqual([]);
  });

  it('returns when parsed.hooks is an array', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(join(TEST_DIR, WINDSURF_HOOKS_FILE), JSON.stringify({ hooks: [] }));

    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);

    expect(results).toEqual([]);
  });

  it('returns when parsed.hooks is a non-object scalar', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(join(TEST_DIR, WINDSURF_HOOKS_FILE), JSON.stringify({ hooks: 'string' }));

    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);

    expect(results).toEqual([]);
  });

  it('returns when canonical mapping is empty (all events have non-array entries)', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_HOOKS_FILE),
      JSON.stringify({ hooks: { pre_tool_use: 'not-an-array' } }),
    );

    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);

    expect(results).toEqual([]);
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// windsurfHooksToCanonical (via importWindsurfHooks) — entry shapes
// ---------------------------------------------------------------------------

describe('windsurfHooksToCanonical — entry shapes', () => {
  it("maps top-level shorthand command to matcher='.*' command entry", async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_HOOKS_FILE),
      JSON.stringify({
        hooks: { pre_tool_use: [{ command: 'echo top-level' }] },
      }),
    );

    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);

    expect(results.find((r) => r.toPath === '.agentsmesh/hooks.yaml')).toBeDefined();
    const yaml = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(yaml).toContain('PreToolUse');
    expect(yaml).toContain('matcher: .*');
    expect(yaml).toContain('command: echo top-level');
  });

  it('honors explicit matcher and nested hooks with prompt + command + invalid items', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_HOOKS_FILE),
      JSON.stringify({
        hooks: {
          post_tool_use: [
            {
              matcher: 'Edit',
              hooks: [
                { type: 'prompt', prompt: 'Review the change' },
                { type: 'command', command: 'echo done', timeout: 30 },
                null,
                'not-an-object',
                { type: 'command' /* missing command */ },
                { type: 'command', command: '   ' /* empty trimmed */ },
              ],
            },
          ],
        },
      }),
    );

    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);

    const yaml = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    const parsed = yamlParse(yaml) as Record<string, unknown[]>;
    const post = parsed.PostToolUse as Array<Record<string, unknown>>;

    expect(Array.isArray(post)).toBe(true);
    expect(post).toHaveLength(2);
    expect(post[0]).toEqual({
      matcher: 'Edit',
      type: 'prompt',
      command: 'Review the change',
    });
    expect(post[1]).toEqual({
      matcher: 'Edit',
      type: 'command',
      command: 'echo done',
      timeout: 30,
    });
  });

  it('skips entries that are null or non-object at the top level', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_HOOKS_FILE),
      JSON.stringify({
        hooks: {
          pre_tool_use: [null, 42, 'not-object', { command: 'echo ok' }],
        },
      }),
    );

    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);

    const yaml = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    const parsed = yamlParse(yaml) as Record<string, unknown[]>;
    expect(parsed.PreToolUse).toHaveLength(1);
  });

  it('passes through unmapped hook event names unchanged', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_HOOKS_FILE),
      JSON.stringify({
        hooks: { CustomEvent: [{ command: 'echo custom' }] },
      }),
    );

    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);

    const yaml = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(yaml).toContain('CustomEvent:');
    expect(yaml).toContain('command: echo custom');
  });

  it('maps notification, user_prompt_submit, subagent_start, subagent_stop event names', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_HOOKS_FILE),
      JSON.stringify({
        hooks: {
          notification: [{ command: 'echo notif' }],
          user_prompt_submit: [{ command: 'echo ups' }],
          subagent_start: [{ command: 'echo sa-start' }],
          subagent_stop: [{ command: 'echo sa-stop' }],
        },
      }),
    );

    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);

    const yaml = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    const parsed = yamlParse(yaml) as Record<string, unknown>;
    expect(parsed).toHaveProperty('Notification');
    expect(parsed).toHaveProperty('UserPromptSubmit');
    expect(parsed).toHaveProperty('SubagentStart');
    expect(parsed).toHaveProperty('SubagentStop');
  });

  it('falls back to matcher=.* when nested entry has no matcher and timeout is non-number', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_HOOKS_FILE),
      JSON.stringify({
        hooks: {
          pre_tool_use: [
            {
              hooks: [{ type: 'command', command: 'echo nested', timeout: '15' }],
            },
          ],
        },
      }),
    );

    const results: ImportResult[] = [];
    await importWindsurfHooks(TEST_DIR, results);

    const yaml = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    const parsed = yamlParse(yaml) as Record<string, Array<Record<string, unknown>>>;
    expect(parsed.PreToolUse[0]!.matcher).toBe('.*');
    expect(parsed.PreToolUse[0]!.command).toBe('echo nested');
    expect(parsed.PreToolUse[0]).not.toHaveProperty('timeout');
  });
});

// ---------------------------------------------------------------------------
// importWindsurfMcp branches
// ---------------------------------------------------------------------------

describe('importWindsurfMcp — candidate fallback', () => {
  it('returns no result when neither candidate file exists', async () => {
    const results: ImportResult[] = [];
    await importWindsurfMcp(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('imports from example file first when present', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_MCP_EXAMPLE_FILE),
      JSON.stringify({ mcpServers: { ex: { command: 'a' } } }),
    );
    writeFileSync(
      join(TEST_DIR, WINDSURF_MCP_CONFIG_FILE),
      JSON.stringify({ mcpServers: { cfg: { command: 'b' } } }),
    );

    const results: ImportResult[] = [];
    await importWindsurfMcp(TEST_DIR, results);

    expect(results).toHaveLength(1);
    expect(results[0]!.fromPath).toBe(join(TEST_DIR, WINDSURF_MCP_EXAMPLE_FILE));
    const mcp = readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8');
    expect(mcp).toContain('"ex"');
    expect(mcp).not.toContain('"cfg"');
  });

  it('skips invalid JSON candidate and continues to next candidate', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(join(TEST_DIR, WINDSURF_MCP_EXAMPLE_FILE), '{ broken json');
    writeFileSync(
      join(TEST_DIR, WINDSURF_MCP_CONFIG_FILE),
      JSON.stringify({ mcpServers: { cfg: { command: 'b' } } }),
    );

    const results: ImportResult[] = [];
    await importWindsurfMcp(TEST_DIR, results);

    expect(results).toHaveLength(1);
    expect(results[0]!.fromPath).toBe(join(TEST_DIR, WINDSURF_MCP_CONFIG_FILE));
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')).toContain('"cfg"');
  });

  it('skips candidate without mcpServers and continues to next candidate', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(join(TEST_DIR, WINDSURF_MCP_EXAMPLE_FILE), JSON.stringify({ other: 'value' }));
    writeFileSync(
      join(TEST_DIR, WINDSURF_MCP_CONFIG_FILE),
      JSON.stringify({ mcpServers: { srv: { command: 'c' } } }),
    );

    const results: ImportResult[] = [];
    await importWindsurfMcp(TEST_DIR, results);

    expect(results).toHaveLength(1);
    expect(results[0]!.fromPath).toBe(join(TEST_DIR, WINDSURF_MCP_CONFIG_FILE));
  });

  it('skips candidate where mcpServers is non-object', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_MCP_EXAMPLE_FILE),
      JSON.stringify({ mcpServers: 'not-object' }),
    );

    const results: ImportResult[] = [];
    await importWindsurfMcp(TEST_DIR, results);

    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// kiro/hook-format.ts — parseKiroHookFile branch coverage
// ---------------------------------------------------------------------------

describe('parseKiroHookFile — guard branches', () => {
  it('returns null for invalid JSON', () => {
    expect(parseKiroHookFile('{not json')).toBeNull();
  });

  it('returns null for non-object JSON value', () => {
    expect(parseKiroHookFile('"a string"')).toBeNull();
    expect(parseKiroHookFile('null')).toBeNull();
    expect(parseKiroHookFile('42')).toBeNull();
  });

  it('returns null for array JSON value', () => {
    expect(parseKiroHookFile('[1,2,3]')).toBeNull();
  });

  it('returns null when when block is missing', () => {
    expect(
      parseKiroHookFile(JSON.stringify({ then: { type: 'shellCommand', command: 'x' } })),
    ).toBeNull();
  });

  it('returns null when then block is missing', () => {
    expect(parseKiroHookFile(JSON.stringify({ when: { type: 'preToolUse' } }))).toBeNull();
  });

  it('returns null when when.type is not a string', () => {
    expect(
      parseKiroHookFile(
        JSON.stringify({
          when: { type: 42 },
          then: { type: 'shellCommand', command: 'x' },
        }),
      ),
    ).toBeNull();
  });

  it('returns null for unknown when.type', () => {
    expect(
      parseKiroHookFile(
        JSON.stringify({
          when: { type: 'unknownEvent' },
          then: { type: 'shellCommand', command: 'x' },
        }),
      ),
    ).toBeNull();
  });

  it("returns null when then.type='askAgent' but prompt is not a string", () => {
    expect(
      parseKiroHookFile(
        JSON.stringify({
          when: { type: 'preToolUse', tools: ['write'] },
          then: { type: 'askAgent' },
        }),
      ),
    ).toBeNull();
  });

  it("returns null when then.type='shellCommand' but command is not a string", () => {
    expect(
      parseKiroHookFile(
        JSON.stringify({
          when: { type: 'preToolUse', tools: ['write'] },
          then: { type: 'shellCommand' },
        }),
      ),
    ).toBeNull();
  });

  it('returns null when then.type is neither askAgent nor shellCommand', () => {
    expect(
      parseKiroHookFile(
        JSON.stringify({
          when: { type: 'preToolUse', tools: ['write'] },
          then: { type: 'unknown', command: 'x' },
        }),
      ),
    ).toBeNull();
  });

  it('falls back matcher to patterns[0] when tools is absent', () => {
    const result = parseKiroHookFile(
      JSON.stringify({
        when: { type: 'promptSubmit', patterns: ['*.md'] },
        then: { type: 'askAgent', prompt: 'hi' },
      }),
    );
    expect(result).toEqual({
      event: 'UserPromptSubmit',
      entry: { matcher: '*.md', command: 'hi', prompt: 'hi', type: 'prompt' },
    });
  });

  it("falls back matcher to '*' when tools and patterns are both absent", () => {
    const result = parseKiroHookFile(
      JSON.stringify({
        when: { type: 'agentStop' },
        then: { type: 'shellCommand', command: 'cleanup' },
      }),
    );
    expect(result).toEqual({
      event: 'SubagentStop',
      entry: { matcher: '*', command: 'cleanup', type: 'command' },
    });
  });

  it('parses askAgent prompt entry into prompt-type canonical entry', () => {
    const result = parseKiroHookFile(
      JSON.stringify({
        when: { type: 'preToolUse', tools: ['Write'] },
        then: { type: 'askAgent', prompt: 'review' },
      }),
    );
    expect(result?.event).toBe('PreToolUse');
    expect(result?.entry.type).toBe('prompt');
    expect(result?.entry.matcher).toBe('Write');
  });

  it('parses shellCommand entry into command-type canonical entry', () => {
    const result = parseKiroHookFile(
      JSON.stringify({
        when: { type: 'postToolUse', tools: ['Edit'] },
        then: { type: 'shellCommand', command: 'fmt' },
      }),
    );
    expect(result?.event).toBe('PostToolUse');
    expect(result?.entry.type).toBe('command');
    expect(result?.entry.command).toBe('fmt');
    expect(result?.entry.matcher).toBe('Edit');
  });
});

// ---------------------------------------------------------------------------
// kiro/hook-format.ts — generateKiroHooks branch coverage
// ---------------------------------------------------------------------------

describe('generateKiroHooks — branches', () => {
  it('skips events not present in the canonical mapping', () => {
    const hooks = {
      UnknownEvent: [{ matcher: '*', command: 'x', type: 'command' }],
    } as unknown as Hooks;
    expect(generateKiroHooks(hooks)).toEqual([]);
  });

  it('skips events whose entries value is not an array', () => {
    const hooks = { PreToolUse: 'not-array' } as unknown as Hooks;
    expect(generateKiroHooks(hooks)).toEqual([]);
  });

  it('skips entries lacking text (prompt or command)', () => {
    const hooks: Hooks = {
      PreToolUse: [{ matcher: 'Write', type: 'command' } as never],
    };
    expect(generateKiroHooks(hooks)).toEqual([]);
  });

  it('emits non-tool events without tools field', () => {
    const hooks: Hooks = {
      UserPromptSubmit: [{ matcher: '*', prompt: 'hi', type: 'prompt' }],
    };
    const out = generateKiroHooks(hooks);
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]!.content) as { when: { type: string; tools?: string[] } };
    expect(parsed.when.type).toBe('promptSubmit');
    expect(parsed.when).not.toHaveProperty('tools');
  });

  it("emits tool events with tools=['*'] when matcher is empty", () => {
    const hooks: Hooks = {
      PreToolUse: [{ matcher: '', command: 'echo hi', type: 'command' }],
    };
    const out = generateKiroHooks(hooks);
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]!.content) as { when: { tools: string[] } };
    expect(parsed.when.tools).toEqual(['*']);
  });

  it('serializeCanonicalHooks returns trimmed YAML', () => {
    const hooks: Hooks = {
      PreToolUse: [{ matcher: 'Write', command: 'echo hi', type: 'command' }],
    };
    const yaml = serializeCanonicalHooks(hooks);
    expect(yaml.endsWith('\n')).toBe(false);
    expect(yaml).toContain('PreToolUse');
  });
});
