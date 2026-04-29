/**
 * Branch coverage tests for src/targets/continue/global-config.ts.
 *
 * Targets the conditional gates inside generateContinueGlobalConfig:
 *   - scope === 'project' early-return
 *   - hasData composite (rules ∨ commands ∨ mcp) → individually
 *   - rule.description vs basename(rule.source, '.md') name fallback
 *   - command.description present vs absent
 *   - mcp servers populated vs empty (servers.length > 0)
 *   - computeStatus: created (existing===null), unchanged (existing===content), updated
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { generateContinueGlobalConfig } from '../../../../src/targets/continue/global-config.js';
import { CONTINUE_GLOBAL_CONFIG } from '../../../../src/targets/continue/constants.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

let TEST_DIR: string;

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), 'am-continue-cfg-branches-'));
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

describe('generateContinueGlobalConfig — gating branches', () => {
  const features = new Set(['rules', 'commands', 'mcp']);

  it('returns [] for scope=project even when data exists', async () => {
    const canonical = makeCanonical({
      rules: [{ source: 'r.md', root: false, targets: [], description: 'r', globs: [], body: 'r' }],
    });
    const out = await generateContinueGlobalConfig(canonical, TEST_DIR, 'project', features);
    expect(out).toEqual([]);
  });

  it('returns [] when none of rules / commands / mcp produce data', async () => {
    const canonical = makeCanonical({
      // mcp present but empty servers → counts as "no data"
      mcp: { mcpServers: {} },
    });
    const out = await generateContinueGlobalConfig(canonical, TEST_DIR, 'global', features);
    expect(out).toEqual([]);
  });

  it('returns [] when feature flag for category is disabled despite data being present', async () => {
    const featuresOnlyMcp = new Set(['mcp']);
    const canonical = makeCanonical({
      rules: [{ source: 'r.md', root: false, targets: [], description: 'r', globs: [], body: 'r' }],
    });
    const out = await generateContinueGlobalConfig(canonical, TEST_DIR, 'global', featuresOnlyMcp);
    expect(out).toEqual([]);
  });
});

describe('generateContinueGlobalConfig — content branches', () => {
  const features = new Set(['rules', 'commands', 'mcp']);

  it('uses basename(rule.source, ".md") as name when description is empty', async () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: 'use TS',
        },
      ],
    });
    const out = await generateContinueGlobalConfig(canonical, TEST_DIR, 'global', features);
    expect(out).toHaveLength(1);
    const parsed = yamlParse(out[0]!.content) as Record<string, unknown>;
    const rules = parsed.rules as Array<{ name: string; rule: string }>;
    expect(rules[0]!.name).toBe('typescript');
    expect(rules[0]!.rule).toBe('use TS');
  });

  it('omits description from prompts entry when command.description is empty', async () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/p/.agentsmesh/commands/c.md',
          name: 'c',
          description: '',
          allowedTools: [],
          body: 'do',
        },
      ],
    });
    const out = await generateContinueGlobalConfig(canonical, TEST_DIR, 'global', features);
    const parsed = yamlParse(out[0]!.content) as Record<string, unknown>;
    const prompts = parsed.prompts as Array<Record<string, unknown>>;
    expect(prompts[0]!.name).toBe('c');
    expect(prompts[0]!.description).toBeUndefined();
    expect(prompts[0]!.prompt).toBe('do');
  });

  it('skips mcpServers section when feature is enabled but no servers entries', async () => {
    const canonical = makeCanonical({
      // commands gives us hasData=true, mcp present but empty → mcpServers omitted
      mcp: { mcpServers: {} },
      commands: [
        {
          source: 'c',
          name: 'c',
          description: 'd',
          allowedTools: [],
          body: 'b',
        },
      ],
    });
    const out = await generateContinueGlobalConfig(canonical, TEST_DIR, 'global', features);
    expect(out).toHaveLength(1);
    const parsed = yamlParse(out[0]!.content) as Record<string, unknown>;
    expect(parsed.mcpServers).toBeUndefined();
  });
});

describe('generateContinueGlobalConfig — computeStatus branches', () => {
  const features = new Set(['rules', 'commands', 'mcp']);

  function ruleCanonical(): CanonicalFiles {
    return makeCanonical({
      rules: [
        {
          source: '/p/rules/x.md',
          root: false,
          targets: [],
          description: 'X',
          globs: [],
          body: 'use X',
        },
      ],
    });
  }

  it('returns status="created" when target file does not yet exist', async () => {
    const out = await generateContinueGlobalConfig(ruleCanonical(), TEST_DIR, 'global', features);
    expect(out[0]!.status).toBe('created');
    expect(out[0]!.currentContent).toBeUndefined();
  });

  it('returns status="unchanged" when existing file content matches generated content', async () => {
    const first = await generateContinueGlobalConfig(ruleCanonical(), TEST_DIR, 'global', features);
    mkdirSync(join(TEST_DIR, '.continue'), { recursive: true });
    writeFileSync(join(TEST_DIR, CONTINUE_GLOBAL_CONFIG), first[0]!.content);

    const second = await generateContinueGlobalConfig(
      ruleCanonical(),
      TEST_DIR,
      'global',
      features,
    );
    expect(second[0]!.status).toBe('unchanged');
    expect(second[0]!.currentContent).toBe(first[0]!.content);
  });

  it('returns status="updated" when existing file differs from generated', async () => {
    mkdirSync(join(TEST_DIR, '.continue'), { recursive: true });
    writeFileSync(join(TEST_DIR, CONTINUE_GLOBAL_CONFIG), 'old:\n  content: 1\n');

    const out = await generateContinueGlobalConfig(ruleCanonical(), TEST_DIR, 'global', features);
    expect(out[0]!.status).toBe('updated');
    expect(out[0]!.currentContent).toBe('old:\n  content: 1\n');
    expect(out[0]!.target).toBe('continue');
  });
});
