/**
 * E2E tests for the rich plugin fixture — exercises ALL TargetDescriptor cases
 * with strict content/format verification and link-rebasing edge cases.
 *
 * Covers:
 * - All 8 feature generators with content verification
 * - Link rebasing: inline, reference-style, image, cross-feature, external, code spans
 * - Root instruction contract appended to ROOT.md
 * - generators.lint hook + generators.primaryRootInstructionPath
 * - Per-feature lint hooks (lint.commands, lint.mcp, lint.permissions, lint.hooks, lint.ignore)
 * - lintRules external function
 * - emitScopedSettings native settings sidecar
 * - postProcessHookOutputs async hook post-processing
 * - Conversion toggle: commands/agents skipped when supportsConversion disabled
 * - Idempotency and --check mode
 * - Plugin + built-in coexistence
 * - pluginTargets gate (no output when not listed)
 * - Schema validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { runCli } from './helpers/run-cli.js';

const RICH_PLUGIN_PATH = join(process.cwd(), 'tests/fixtures/plugins/rich-plugin/index.js');
const RICH_PLUGIN_URL = pathToFileURL(RICH_PLUGIN_PATH).href;

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'agentsmesh-rich-plugin-e2e-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function fileExists(p: string): Promise<boolean> {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

async function readText(p: string): Promise<string> {
  return readFile(p, 'utf8');
}

async function readJson(p: string): Promise<unknown> {
  return JSON.parse(await readText(p));
}

/**
 * Create canonical project with rich cross-referencing content.
 * Every .md file contains diverse link types for rebasing verification:
 *   - inline relative links: [text](./sibling.md)
 *   - parent-relative links: [text](../commands/deploy.md)
 *   - reference-style links: [text][ref] + [ref]: path
 *   - image links: ![alt](path)
 *   - external links: [text](https://...) — must stay unchanged
 *   - code spans: `path/to/file` — must stay unchanged
 *   - fenced code blocks with paths — must stay unchanged
 */
async function setupFullCanonical(): Promise<void> {
  const base = join(tmpDir, '.agentsmesh');
  await mkdir(join(base, 'rules'), { recursive: true });
  await mkdir(join(base, 'commands'), { recursive: true });
  await mkdir(join(base, 'agents'), { recursive: true });
  await mkdir(join(base, 'skills', 'code-review'), { recursive: true });
  await mkdir(join(base, 'skills', 'deploy-helper'), { recursive: true });

  // ── Rules ──────────────────────────────────────────────────────────────

  await writeFile(
    join(base, 'rules', '_root.md'),
    [
      '---',
      'root: true',
      'description: Root workspace rule with cross-feature links',
      '---',
      '',
      '# Workspace root',
      '',
      'See the [security rule](./security.md) and [conventions](./conventions.md).',
      '',
      'Run the [/deploy command](../commands/deploy.md) to ship.',
      'Delegate reviews to the [reviewer agent](../agents/reviewer.md).',
      'Use the [code-review skill](../skills/code-review/SKILL.md).',
      '',
      'Reference-style: see [the conventions rule][conv-ref].',
      '',
      '[conv-ref]: ./conventions.md',
      '',
      'External link: [CommonMark](https://commonmark.org/).',
      '',
      'Code span (unchanged): `.agentsmesh/rules/_root.md`.',
      '',
      '```bash',
      '# fenced block paths must NOT be rebased',
      'cat .agentsmesh/rules/security.md',
      '```',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(base, 'rules', 'security.md'),
    [
      '---',
      'description: Security rule with sibling and cross-feature links',
      '---',
      '',
      '# Security',
      '',
      'Sibling link: [conventions](./conventions.md).',
      'Cross-feature: [deploy command](../commands/deploy.md).',
      'Agent link: [reviewer](../agents/reviewer.md).',
      'Skill link: [deploy-helper](../skills/deploy-helper/SKILL.md).',
      '',
      'Reference-style: see [the deploy command][deploy-ref].',
      '',
      '[deploy-ref]: ../commands/deploy.md',
      '',
      'External (unchanged): [OWASP](https://owasp.org/).',
      'Code span (unchanged): `../commands/deploy.md`.',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(base, 'rules', 'conventions.md'),
    [
      '---',
      'description: Coding conventions',
      'globs: ["**/*.ts"]',
      '---',
      '',
      '# Conventions',
      '',
      'See [security](./security.md) for secrets policy.',
      'See the [reviewer agent](../agents/reviewer.md) for review guidance.',
      '',
    ].join('\n'),
  );

  // ── Commands ───────────────────────────────────────────────────────────

  await writeFile(
    join(base, 'commands', 'deploy.md'),
    [
      '---',
      'name: deploy',
      'description: Deploy the app',
      '---',
      '',
      'Deploy to staging. See [/review](./review.md) after deploy.',
      'Follows [conventions](../rules/conventions.md).',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(base, 'commands', 'review.md'),
    [
      '---',
      'name: review',
      'description: Run a code review',
      '---',
      '',
      'Check [security rule](../rules/security.md) first.',
      'Delegate to the [reviewer agent](../agents/reviewer.md).',
      'Use [code-review skill](../skills/code-review/SKILL.md).',
      '',
    ].join('\n'),
  );

  // ── Agents ─────────────────────────────────────────────────────────────

  await writeFile(
    join(base, 'agents', 'reviewer.md'),
    [
      '---',
      'name: reviewer',
      'description: Senior code reviewer',
      'tools: [Read, Grep, Glob]',
      'model: sonnet',
      '---',
      '',
      'Cross-check the [security rule](../rules/security.md).',
      'Style guide: [conventions](../rules/conventions.md).',
      'See [code-review skill](../skills/code-review/SKILL.md).',
      '',
      'Sibling: [debugger agent](./debugger.md).',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(base, 'agents', 'debugger.md'),
    [
      '---',
      'name: debugger',
      'description: Bug investigator',
      'tools: [Read, Bash]',
      'model: sonnet',
      '---',
      '',
      'Escalate to the [reviewer](./reviewer.md).',
      '',
    ].join('\n'),
  );

  // ── Skills ─────────────────────────────────────────────────────────────

  await writeFile(
    join(base, 'skills', 'code-review', 'SKILL.md'),
    [
      '---',
      'name: code-review',
      'description: Code review workflow',
      '---',
      '',
      '# Code review',
      '',
      'Deep relative to rules: [conventions](../../rules/conventions.md).',
      'Deep relative to agents: [reviewer](../../agents/reviewer.md).',
      'Deep relative to commands: [/review](../../commands/review.md).',
      'Sibling skill: [deploy-helper](../deploy-helper/SKILL.md).',
      '',
      'External (unchanged): [GitHub](https://github.com).',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(base, 'skills', 'deploy-helper', 'SKILL.md'),
    [
      '---',
      'name: deploy-helper',
      'description: Deployment automation skill',
      '---',
      '',
      '# Deploy helper',
      '',
      'Uses the [deploy command](../../commands/deploy.md).',
      'Sibling: [code-review](../code-review/SKILL.md).',
      '',
    ].join('\n'),
  );

  // ── MCP ────────────────────────────────────────────────────────────────

  await writeFile(
    join(base, 'mcp.json'),
    JSON.stringify(
      {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
          remote: {
            url: 'https://example.com/mcp',
            headers: { Authorization: 'Bearer ${API_TOKEN}' },
          },
        },
      },
      null,
      2,
    ),
  );

  // ── Permissions ────────────────────────────────────────────────────────

  await writeFile(
    join(base, 'permissions.yaml'),
    [
      'allow:',
      '  - Bash(pnpm test:*)',
      '  - Bash(git status)',
      '  - Read(**)',
      'deny:',
      '  - Bash(rm -rf /:*)',
      '  - Write(.env*)',
      '',
    ].join('\n'),
  );

  // ── Hooks ──────────────────────────────────────────────────────────────

  await writeFile(
    join(base, 'hooks.yaml'),
    [
      'PreToolUse:',
      '  - matcher: Bash',
      '    command: \'echo "pre-hook: $(jq -r .tool_input.command < /dev/stdin)"\'',
      '    type: command',
      'PostToolUse:',
      '  - matcher: Edit|Write',
      '    command: jq -r .tool_input.file_path | xargs -r eslint --fix',
      '    type: command',
      '',
    ].join('\n'),
  );

  // ── Ignore ─────────────────────────────────────────────────────────────

  await writeFile(
    join(base, 'ignore'),
    ['node_modules', 'dist', 'coverage', '.env', '*.log', ''].join('\n'),
  );
}

async function writeConfig(features: string[], extra: Record<string, unknown> = {}): Promise<void> {
  await writeFile(
    join(tmpDir, 'agentsmesh.yaml'),
    stringifyYaml({
      version: 1,
      targets: [],
      features,
      plugins: [{ id: 'rich-plugin', source: RICH_PLUGIN_URL }],
      pluginTargets: ['rich-plugin'],
      ...extra,
    }),
  );
}

const ALL_FEATURES = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'permissions',
  'ignore',
];

// ─── Full generation with content + link verification ──────────────────────

describe('rich-plugin — full generation with content verification', () => {
  it('generates all features with correct file format and link rebasing', async () => {
    await setupFullCanonical();
    await writeConfig(ALL_FEATURES);

    const result = await runCli('generate', tmpDir);
    expect(result.exitCode).toBe(0);

    // ── ROOT.md ──────────────────────────────────────────────────────────
    const rootMd = await readText(join(tmpDir, '.rich', 'ROOT.md'));
    // Format: rich-plugin prepends "# Rich Plugin Root\n\n" to body
    expect(rootMd).toContain('# Rich Plugin Root');
    expect(rootMd).toContain('# Workspace root');

    // Link rebasing: root rule moved from .agentsmesh/rules/_root.md → .rich/ROOT.md
    // so sibling links like ./security.md must become ./rules/security.md
    expect(rootMd).toContain('[security rule](./rules/security.md)');
    expect(rootMd).toContain('[conventions](./rules/conventions.md)');
    // Parent-relative links rebased: ../commands/deploy.md → ./commands/deploy.md
    expect(rootMd).toContain('[/deploy command](./commands/deploy.md)');
    expect(rootMd).toContain('[reviewer agent](./agents/reviewer.md)');
    expect(rootMd).toContain('[code-review skill](./skills/code-review/SKILL.md)');
    // Reference-style link rebased
    expect(rootMd).toContain('[conv-ref]: ./rules/conventions.md');
    // External link unchanged
    expect(rootMd).toContain('[CommonMark](https://commonmark.org/)');
    // Code span unchanged
    expect(rootMd).toContain('`.agentsmesh/rules/_root.md`');
    // Fenced code block paths unchanged
    expect(rootMd).toContain('cat .agentsmesh/rules/security.md');
    // Root generation contract appended
    expect(rootMd).toContain('agentsmesh:root-generation-contract:start');
    expect(rootMd).toContain('AgentsMesh Generation Contract');

    // ── rules/security.md ────────────────────────────────────────────────
    const securityMd = await readText(join(tmpDir, '.rich', 'rules', 'security.md'));
    // Format: "# {description}\n\n{body}"
    expect(securityMd).toMatch(/^# Security rule/);
    expect(securityMd).toContain('# Security');
    // Sibling link stays relative (same directory)
    expect(securityMd).toContain('[conventions](./conventions.md)');
    // Cross-feature links stay correct (same relative depth)
    expect(securityMd).toContain('[deploy command](../commands/deploy.md)');
    expect(securityMd).toContain('[reviewer](../agents/reviewer.md)');
    expect(securityMd).toContain('[deploy-helper](../skills/deploy-helper/SKILL.md)');
    // Reference-style
    expect(securityMd).toContain('[deploy-ref]: ../commands/deploy.md');
    // External unchanged
    expect(securityMd).toContain('[OWASP](https://owasp.org/)');
    // Code span unchanged
    expect(securityMd).toContain('`../commands/deploy.md`');

    // ── rules/conventions.md ─────────────────────────────────────────────
    const conventionsMd = await readText(join(tmpDir, '.rich', 'rules', 'conventions.md'));
    expect(conventionsMd).toContain('[security](./security.md)');
    expect(conventionsMd).toContain('[reviewer agent](../agents/reviewer.md)');

    // ── commands/deploy.md ───────────────────────────────────────────────
    const deployMd = await readText(join(tmpDir, '.rich', 'commands', 'deploy.md'));
    // Format: "# Command: deploy\n\n{description}\n\n{body}"
    expect(deployMd).toContain('# Command: deploy');
    expect(deployMd).toContain('Deploy the app');
    expect(deployMd).toContain('[/review](./review.md)');
    expect(deployMd).toContain('[conventions](../rules/conventions.md)');

    // ── commands/review.md ───────────────────────────────────────────────
    const reviewMd = await readText(join(tmpDir, '.rich', 'commands', 'review.md'));
    expect(reviewMd).toContain('# Command: review');
    expect(reviewMd).toContain('[security rule](../rules/security.md)');
    expect(reviewMd).toContain('[reviewer agent](../agents/reviewer.md)');
    expect(reviewMd).toContain('[code-review skill](../skills/code-review/SKILL.md)');

    // ── agents/reviewer.md ───────────────────────────────────────────────
    const reviewerMd = await readText(join(tmpDir, '.rich', 'agents', 'reviewer.md'));
    expect(reviewerMd).toContain('# Agent: reviewer');
    expect(reviewerMd).toContain('[security rule](../rules/security.md)');
    expect(reviewerMd).toContain('[conventions](../rules/conventions.md)');
    expect(reviewerMd).toContain('[code-review skill](../skills/code-review/SKILL.md)');
    expect(reviewerMd).toContain('[debugger agent](./debugger.md)');

    // ── agents/debugger.md ───────────────────────────────────────────────
    const debuggerMd = await readText(join(tmpDir, '.rich', 'agents', 'debugger.md'));
    expect(debuggerMd).toContain('# Agent: debugger');
    expect(debuggerMd).toContain('[reviewer](./reviewer.md)');

    // ── skills/code-review/SKILL.md ──────────────────────────────────────
    const crSkill = await readText(join(tmpDir, '.rich', 'skills', 'code-review', 'SKILL.md'));
    expect(crSkill).toContain('# Skill: code-review');
    // Deep relative links rebased
    expect(crSkill).toContain('[conventions](../../rules/conventions.md)');
    expect(crSkill).toContain('[reviewer](../../agents/reviewer.md)');
    expect(crSkill).toContain('[/review](../../commands/review.md)');
    expect(crSkill).toContain('[deploy-helper](../deploy-helper/SKILL.md)');
    // External unchanged
    expect(crSkill).toContain('[GitHub](https://github.com)');

    // ── skills/deploy-helper/SKILL.md ────────────────────────────────────
    const dhSkill = await readText(join(tmpDir, '.rich', 'skills', 'deploy-helper', 'SKILL.md'));
    expect(dhSkill).toContain('# Skill: deploy-helper');
    expect(dhSkill).toContain('[deploy command](../../commands/deploy.md)');
    expect(dhSkill).toContain('[code-review](../code-review/SKILL.md)');

    // ── mcp.json ─────────────────────────────────────────────────────────
    const mcp = (await readJson(join(tmpDir, '.rich', 'mcp.json'))) as {
      mcpServers: Record<string, { command?: string; url?: string }>;
    };
    expect(Object.keys(mcp.mcpServers)).toEqual(['filesystem', 'remote']);
    expect(mcp.mcpServers.filesystem.command).toBe('npx');
    expect(mcp.mcpServers.remote.url).toBe('https://example.com/mcp');

    // ── permissions.json ─────────────────────────────────────────────────
    const perms = (await readJson(join(tmpDir, '.rich', 'permissions.json'))) as {
      allow: string[];
      deny: string[];
    };
    expect(perms.allow).toContain('Bash(pnpm test:*)');
    expect(perms.allow).toContain('Read(**)');
    expect(perms.deny).toContain('Bash(rm -rf /:*)');
    expect(perms.deny).toContain('Write(.env*)');

    // ── hooks.json ───────────────────────────────────────────────────────
    const hooks = (await readJson(join(tmpDir, '.rich', 'hooks.json'))) as Record<
      string,
      Array<{ matcher: string; command: string; type: string }>
    >;
    expect(hooks.PreToolUse).toHaveLength(1);
    expect(hooks.PreToolUse[0].matcher).toBe('Bash');
    expect(hooks.PreToolUse[0].type).toBe('command');
    expect(hooks.PostToolUse).toHaveLength(1);
    expect(hooks.PostToolUse[0].matcher).toBe('Edit|Write');
    expect(hooks.PostToolUse[0].command).toContain('eslint --fix');

    // ── hooks.wrapper.sh (postProcessHookOutputs) ────────────────────────
    const wrapper = await readText(join(tmpDir, '.rich', 'hooks.wrapper.sh'));
    expect(wrapper).toContain('#!/bin/sh');
    expect(wrapper).toContain('exec "$@"');

    // ── .richignore ──────────────────────────────────────────────────────
    const ignore = await readText(join(tmpDir, '.richignore'));
    expect(ignore).toContain('node_modules');
    expect(ignore).toContain('dist');
    expect(ignore).toContain('coverage');
    expect(ignore).toContain('.env');
    expect(ignore).toContain('*.log');

    // ── settings.json (emitScopedSettings) ───────────────────────────────
    const settings = (await readJson(join(tmpDir, '.rich', 'settings.json'))) as {
      version: number;
      scope: string;
      featureCount: number;
    };
    expect(settings.version).toBe(1);
    expect(settings.scope).toBe('project');
    expect(settings.featureCount).toBeGreaterThan(0);
  });

  it('exact file count matches expected output', async () => {
    await setupFullCanonical();
    await writeConfig(ALL_FEATURES);
    await runCli('generate', tmpDir);

    const expectedPaths = [
      '.rich/ROOT.md',
      '.rich/rules/security.md',
      '.rich/rules/conventions.md',
      '.rich/commands/deploy.md',
      '.rich/commands/review.md',
      '.rich/agents/reviewer.md',
      '.rich/agents/debugger.md',
      '.rich/skills/code-review/SKILL.md',
      '.rich/skills/deploy-helper/SKILL.md',
      '.rich/mcp.json',
      '.rich/permissions.json',
      '.rich/hooks.json',
      '.rich/hooks.wrapper.sh',
      '.rich/settings.json',
      '.richignore',
    ];

    for (const rel of expectedPaths) {
      expect(await fileExists(join(tmpDir, rel)), `Expected: ${rel}`).toBe(true);
    }
    expect(expectedPaths).toHaveLength(15);
  });
});

// ─── Conversion toggle ──────────────────────────────────────────────────────

describe('rich-plugin — conversion toggle (supportsConversion)', () => {
  it('commands are generated when conversion is enabled (default)', async () => {
    await setupFullCanonical();
    await writeConfig(ALL_FEATURES);
    await runCli('generate', tmpDir);
    expect(await fileExists(join(tmpDir, '.rich', 'commands', 'deploy.md'))).toBe(true);
  });

  it('commands are skipped when conversion is disabled via config', async () => {
    await setupFullCanonical();
    await writeConfig(ALL_FEATURES, {
      conversions: { commands_to_skills: { 'rich-plugin': false } },
    });
    await runCli('generate', tmpDir);
    expect(await fileExists(join(tmpDir, '.rich', 'commands', 'deploy.md'))).toBe(false);
    expect(await fileExists(join(tmpDir, '.rich', 'commands', 'review.md'))).toBe(false);
  });

  it('agents are skipped when conversion is disabled via config', async () => {
    await setupFullCanonical();
    await writeConfig(ALL_FEATURES, {
      conversions: { agents_to_skills: { 'rich-plugin': false } },
    });
    await runCli('generate', tmpDir);
    expect(await fileExists(join(tmpDir, '.rich', 'agents', 'reviewer.md'))).toBe(false);
    expect(await fileExists(join(tmpDir, '.rich', 'agents', 'debugger.md'))).toBe(false);
  });

  it('per-scope conversion: project enabled, global disabled', async () => {
    await setupFullCanonical();
    await writeConfig(ALL_FEATURES, {
      conversions: {
        commands_to_skills: { 'rich-plugin': { project: true, global: false } },
      },
    });
    await runCli('generate', tmpDir);
    expect(await fileExists(join(tmpDir, '.rich', 'commands', 'deploy.md'))).toBe(true);
  });
});

// ─── Idempotency and check mode ──────────────────────────────────────────────

describe('rich-plugin — idempotency', () => {
  it('second generate run reports unchanged', async () => {
    await setupFullCanonical();
    await writeConfig(ALL_FEATURES);

    await runCli('generate', tmpDir);
    const second = await runCli('generate', tmpDir);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain('unchanged');
  });

  it('generate --check detects missing rich plugin output', async () => {
    await setupFullCanonical();
    await writeConfig(ALL_FEATURES);

    await runCli('generate', tmpDir);
    await rm(join(tmpDir, '.rich', 'ROOT.md'));

    const check = await runCli('generate --check', tmpDir);
    expect(check.exitCode).not.toBe(0);
  });
});

// ─── Lint hooks ──────────────────────────────────────────────────────────────

describe('rich-plugin — lint diagnostics', () => {
  it('generators.lint flags non-root rules missing a description', async () => {
    const base = join(tmpDir, '.agentsmesh');
    await mkdir(join(base, 'rules'), { recursive: true });
    await writeFile(
      join(base, 'rules', '_root.md'),
      '---\nroot: true\ndescription: root\n---\n\nRoot body.\n',
    );
    await writeFile(
      join(base, 'rules', 'nodesc.md'),
      '---\n---\n\nThis rule has no description.\n',
    );
    await writeConfig(['rules']);

    const result = await runCli('lint', tmpDir);
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/description|Non-root rule/i);
  });

  it('lintRules warns when a rule has an empty body', async () => {
    const base = join(tmpDir, '.agentsmesh');
    await mkdir(join(base, 'rules'), { recursive: true });
    await writeFile(
      join(base, 'rules', '_root.md'),
      '---\nroot: true\ndescription: root\n---\n\nRoot body.\n',
    );
    await writeFile(join(base, 'rules', 'empty.md'), '---\ndescription: empty rule\n---\n\n');
    await writeConfig(['rules']);

    const result = await runCli('lint', tmpDir);
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/empty body|empty/i);
  });

  it('lint.commands warns when a command lacks a description', async () => {
    const base = join(tmpDir, '.agentsmesh');
    await mkdir(join(base, 'rules'), { recursive: true });
    await writeFile(
      join(base, 'rules', '_root.md'),
      '---\nroot: true\ndescription: root\n---\n\nRoot body.\n',
    );
    await mkdir(join(base, 'commands'), { recursive: true });
    await writeFile(
      join(base, 'commands', 'nodesc.md'),
      '---\nname: nodesc\n---\n\nCommand without description.\n',
    );
    await writeConfig(['rules', 'commands']);

    const result = await runCli('lint', tmpDir);
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/missing a description|nodesc/i);
  });

  it('lint.permissions errors when a permission is both allowed and denied', async () => {
    const base = join(tmpDir, '.agentsmesh');
    await mkdir(join(base, 'rules'), { recursive: true });
    await writeFile(
      join(base, 'rules', '_root.md'),
      '---\nroot: true\ndescription: root\n---\n\nRoot body.\n',
    );
    await writeFile(
      join(base, 'permissions.yaml'),
      'allow:\n  - Read\n  - WebFetch\ndeny:\n  - WebFetch\n',
    );
    await writeConfig(['rules', 'permissions']);

    const result = await runCli('lint', tmpDir);
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/both allowed and denied|WebFetch/i);
  });
});

// ─── Plugin + built-in coexistence ──────────────────────────────────────────

describe('rich-plugin — coexistence with built-in targets', () => {
  it('rich plugin and claude-code both produce output in the same run', async () => {
    await setupFullCanonical();
    await writeFile(
      join(tmpDir, 'agentsmesh.yaml'),
      stringifyYaml({
        version: 1,
        targets: ['claude-code'],
        features: ALL_FEATURES,
        plugins: [{ id: 'rich-plugin', source: RICH_PLUGIN_URL }],
        pluginTargets: ['rich-plugin'],
      }),
    );

    const result = await runCli('generate', tmpDir);
    expect(result.exitCode).toBe(0);

    expect(await fileExists(join(tmpDir, '.rich', 'ROOT.md'))).toBe(true);
    expect(await fileExists(join(tmpDir, '.rich', 'agents', 'reviewer.md'))).toBe(true);
    expect(await fileExists(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(true);
  });
});

// ─── pluginTargets gate ─────────────────────────────────────────────────────

describe('rich-plugin — pluginTargets gate', () => {
  it('does not generate when rich-plugin is not in pluginTargets', async () => {
    await setupFullCanonical();
    await writeFile(
      join(tmpDir, 'agentsmesh.yaml'),
      stringifyYaml({
        version: 1,
        targets: [],
        features: ['rules'],
        plugins: [{ id: 'rich-plugin', source: RICH_PLUGIN_URL }],
        pluginTargets: [],
      }),
    );

    const result = await runCli('generate', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(await fileExists(join(tmpDir, '.rich', 'ROOT.md'))).toBe(false);
    expect(await fileExists(join(tmpDir, '.rich', 'rules', 'standards.md'))).toBe(false);
    expect(await fileExists(join(tmpDir, '.richignore'))).toBe(false);
  });
});

// ─── Schema validation ────────────────────────────────────────────────────

describe('rich-plugin — descriptor validation', () => {
  it('plugin info loads successfully (descriptor passes schema)', async () => {
    await writeFile(
      join(tmpDir, 'agentsmesh.yaml'),
      stringifyYaml({
        version: 1,
        targets: [],
        plugins: [{ id: 'rich-plugin', source: RICH_PLUGIN_URL }],
      }),
    );
    const result = await runCli('plugin info rich-plugin', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('rich-plugin');
    expect(result.stdout).toContain('Descriptors: 1');
  });

  it('plugin list shows checkmark for rich-plugin', async () => {
    await writeFile(
      join(tmpDir, 'agentsmesh.yaml'),
      stringifyYaml({
        version: 1,
        targets: [],
        plugins: [{ id: 'rich-plugin', source: RICH_PLUGIN_URL }],
      }),
    );
    const result = await runCli('plugin list', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✓');
  });
});
