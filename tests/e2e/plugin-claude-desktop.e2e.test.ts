/**
 * E2E test for claude-desktop plugin — realistic usage scenario.
 * Tests that a user can add the plugin, configure rules and agents,
 * and generate Claude Desktop config.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { runCli } from './helpers/run-cli.js';

const PLUGIN_PATH = join(
  process.cwd(),
  'tests/fixtures/plugins/agentsmesh-target-claude-desktop/index.js',
);

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'agentsmesh-claude-desktop-e2e-'));
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

async function readYaml(p: string): Promise<unknown> {
  const content = await readFile(p, 'utf8');
  return parseYaml(content);
}

async function readJson(p: string): Promise<unknown> {
  const content = await readFile(p, 'utf8');
  return JSON.parse(content);
}

describe('claude-desktop plugin — realistic user workflow', () => {
  it('step 1: add plugin and configure target', async () => {
    // User initializes project
    let result = await runCli('init', tmpDir);
    expect(result.exitCode).toBe(0);

    // User adds the plugin
    result = await runCli(`plugin add file://${PLUGIN_PATH}`, tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('added');

    // Verify agentsmesh.yaml has the plugin entry
    const config = (await readYaml(join(tmpDir, 'agentsmesh.yaml'))) as Record<string, unknown>;
    expect(config.plugins).toBeDefined();
  });

  it('step 2: user creates rules and agents', async () => {
    // Initialize
    await runCli('init', tmpDir);

    // Create root rule
    const rulesDir = join(tmpDir, '.agentsmesh', 'rules');
    await mkdir(rulesDir, { recursive: true });
    await writeFile(
      join(rulesDir, '_root.md'),
      `---
root: true
description: Assistant rules
---

# Code Assistant

You are a helpful coding assistant. Always:
- Write clean, well-tested code
- Ask for clarification
- Suggest improvements
`,
    );

    // Create two agents
    const agentsDir = join(tmpDir, '.agentsmesh', 'agents');
    await mkdir(agentsDir, { recursive: true });

    await writeFile(
      join(agentsDir, 'reviewer.md'),
      `---
name: Code Reviewer
description: Reviews code
tools:
  - Read
  - Grep
---

You are a code reviewer. Focus on:
- Test coverage
- Performance
- Readability
`,
    );

    await writeFile(
      join(agentsDir, 'architect.md'),
      `---
name: Solutions Architect
description: Designs solutions
tools:
  - Read
  - Grep
  - Bash
---

You are a solutions architect. Help with:
- System design
- Architecture decisions
- Technology choices
`,
    );

    // Verify files exist
    expect(await fileExists(join(rulesDir, '_root.md'))).toBe(true);
    expect(await fileExists(join(agentsDir, 'reviewer.md'))).toBe(true);
    expect(await fileExists(join(agentsDir, 'architect.md'))).toBe(true);
  });

  it('step 3: add plugin to config and enable it', async () => {
    await runCli('init', tmpDir);

    // Add plugin
    await runCli(`plugin add file://${PLUGIN_PATH} --id claude-desktop`, tmpDir);

    // Update config to enable the plugin
    const configPath = join(tmpDir, 'agentsmesh.yaml');
    const config = (await readYaml(configPath)) as Record<string, unknown>;
    (config as { pluginTargets?: string[] }).pluginTargets = ['claude-desktop'];
    (config as { features?: string[] }).features = ['rules', 'agents'];
    await writeFile(configPath, stringifyYaml(config));

    // Verify it's in the config
    const updated = (await readYaml(configPath)) as Record<string, unknown>;
    expect((updated as { pluginTargets?: string[] }).pluginTargets).toContain('claude-desktop');
  });

  it('step 4: generate Claude Desktop config', async () => {
    // Full setup
    await runCli('init', tmpDir);

    const rulesDir = join(tmpDir, '.agentsmesh', 'rules');
    await mkdir(rulesDir, { recursive: true });
    await writeFile(
      join(rulesDir, '_root.md'),
      '---\nroot: true\ndescription: root\n---\n\n# My Rules\n',
    );

    const agentsDir = join(tmpDir, '.agentsmesh', 'agents');
    await mkdir(agentsDir, { recursive: true });
    await writeFile(
      join(agentsDir, 'helper.md'),
      '---\nname: Helper\ndescription: Helper agent\n---\n\nHelper body.\n',
    );

    // Add plugin and enable
    await runCli(`plugin add file://${PLUGIN_PATH} --id claude-desktop`, tmpDir);
    const configPath = join(tmpDir, 'agentsmesh.yaml');
    const config = (await readYaml(configPath)) as Record<string, unknown>;
    (config as { pluginTargets?: string[] }).pluginTargets = ['claude-desktop'];
    (config as { features?: string[] }).features = ['rules', 'agents'];
    await writeFile(configPath, stringifyYaml(config));

    // Generate
    const result = await runCli('generate', tmpDir);
    expect(result.exitCode).toBe(0);

    // Verify .claude/claude.json was created
    const claudeConfig = join(tmpDir, '.claude', 'claude.json');
    expect(await fileExists(claudeConfig)).toBe(true);

    // Verify structure
    const contents = (await readJson(claudeConfig)) as Record<string, unknown>;
    expect((contents as { profiles?: unknown }).profiles).toBeDefined();
    expect((contents as { currentProfile?: string }).currentProfile).toBe('default');

    // Verify profiles include default (root rule) and agent (name = filename basename)
    const profiles = (contents as { profiles?: Record<string, unknown> }).profiles;
    expect(profiles).toHaveProperty('default');
    expect(profiles).toHaveProperty('helper');
  });

  it('step 5: verify linting warns about missing root rule', async () => {
    // Setup without root rule (init creates _root.md, so delete it)
    await runCli('init', tmpDir);
    await rm(join(tmpDir, '.agentsmesh', 'rules', '_root.md'), { force: true });

    // Add plugin
    await runCli(`plugin add file://${PLUGIN_PATH} --id claude-desktop`, tmpDir);
    const configPath = join(tmpDir, 'agentsmesh.yaml');
    const config = (await readYaml(configPath)) as Record<string, unknown>;
    (config as { pluginTargets?: string[] }).pluginTargets = ['claude-desktop'];
    (config as { features?: string[] }).features = ['rules'];
    await writeFile(configPath, stringifyYaml(config));

    // Lint should warn
    const result = await runCli('lint', tmpDir);
    // Lint warnings don't fail the exit code
    expect(result.exitCode).toBe(0);
    // But the warning should be present (on stderr or stdout)
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/root|rule/i);
  });

  it('step 6: regenerate after updating rules updates config', async () => {
    // Initial setup
    await runCli('init', tmpDir);
    const rulesDir = join(tmpDir, '.agentsmesh', 'rules');
    await mkdir(rulesDir, { recursive: true });
    await writeFile(
      join(rulesDir, '_root.md'),
      '---\nroot: true\ndescription: root\n---\n\nOld rule.\n',
    );

    // Configure and generate
    await runCli(`plugin add file://${PLUGIN_PATH} --id claude-desktop`, tmpDir);
    const configPath = join(tmpDir, 'agentsmesh.yaml');
    const config = (await readYaml(configPath)) as Record<string, unknown>;
    (config as { pluginTargets?: string[] }).pluginTargets = ['claude-desktop'];
    (config as { features?: string[] }).features = ['rules'];
    await writeFile(configPath, stringifyYaml(config));
    await runCli('generate', tmpDir);

    // Verify initial content
    let claudeConfig = (await readJson(join(tmpDir, '.claude', 'claude.json'))) as Record<
      string,
      unknown
    >;
    const profiles1 = (claudeConfig as { profiles?: Record<string, unknown> }).profiles;
    expect((profiles1?.['default'] as Record<string, unknown>)?.system_prompt).toContain(
      'Old rule',
    );

    // Update root rule
    await writeFile(
      join(rulesDir, '_root.md'),
      '---\nroot: true\ndescription: root\n---\n\nNew rule with updates.\n',
    );

    // Regenerate
    const result = await runCli('generate', tmpDir);
    expect(result.exitCode).toBe(0);

    // Verify updated content
    claudeConfig = (await readJson(join(tmpDir, '.claude', 'claude.json'))) as Record<
      string,
      unknown
    >;
    const profiles2 = (claudeConfig as { profiles?: Record<string, unknown> }).profiles;
    expect((profiles2?.['default'] as Record<string, unknown>)?.system_prompt).toContain(
      'New rule',
    );
  });
});
