/**
 * E2E tests for `agentsmesh plugin` — full CLI binary coverage of every subcommand
 * and edge case, plus a full generate flow through the fixture plugin.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { runCli } from './helpers/run-cli.js';

const FIXTURE_PLUGIN_PATH = join(process.cwd(), 'tests/fixtures/plugins/simple-plugin/index.js');
const FIXTURE_PLUGIN_URL = pathToFileURL(FIXTURE_PLUGIN_PATH).href;

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'agentsmesh-plugin-e2e-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeConfig(data: Record<string, unknown>): Promise<void> {
  await writeFile(join(tmpDir, 'agentsmesh.yaml'), stringifyYaml(data));
}

async function readConfigText(): Promise<string> {
  return readFile(join(tmpDir, 'agentsmesh.yaml'), 'utf8');
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

// ─── Routing ─────────────────────────────────────────────────────────────────

describe('agentsmesh plugin — routing', () => {
  it('no subcommand exits 0 and prints help', async () => {
    const result = await runCli('plugin', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Subcommands:');
    expect(result.stdout).toContain('add');
    expect(result.stdout).toContain('list');
    expect(result.stdout).toContain('remove');
    expect(result.stdout).toContain('info');
  });

  it('unknown subcommand exits 2', async () => {
    const result = await runCli('plugin frobnicate', tmpDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Unknown plugin subcommand');
  });
});

// ─── plugin list ─────────────────────────────────────────────────────────────

describe('agentsmesh plugin list', () => {
  it('no agentsmesh.yaml → exits 0 with "No plugins configured"', async () => {
    const result = await runCli('plugin list', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('No plugins configured');
  });

  it('empty plugins array → "No plugins configured"', async () => {
    await writeConfig({ version: 1, targets: [], plugins: [] });
    const result = await runCli('plugin list', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('No plugins configured');
  });

  it('shows ✓ for a loadable plugin', async () => {
    await writeConfig({
      version: 1,
      targets: [],
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
    });
    const result = await runCli('plugin list', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('simple-plugin');
    expect(result.stdout).toContain('✓');
  });

  it('shows ✗ for an unloadable plugin but still exits 0', async () => {
    await writeConfig({
      version: 1,
      targets: [],
      plugins: [{ id: 'bad-plugin', source: 'nonexistent-package-xyz-12345' }],
    });
    const result = await runCli('plugin list', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('bad-plugin');
    expect(result.stdout).toContain('✗');
  });

  it('lists multiple plugins and shows correct status per entry', async () => {
    await writeConfig({
      version: 1,
      targets: [],
      plugins: [
        { id: 'good-plugin', source: FIXTURE_PLUGIN_URL },
        { id: 'bad-plugin', source: 'nonexistent-package-xyz-99' },
      ],
    });
    const result = await runCli('plugin list', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('good-plugin');
    expect(result.stdout).toContain('bad-plugin');
    // Good plugin shows ✓, bad shows ✗
    expect(result.stdout).toMatch(/✓/);
    expect(result.stdout).toMatch(/✗/);
  });
});

// ─── plugin add ──────────────────────────────────────────────────────────────

describe('agentsmesh plugin add', () => {
  it('adds an entry to agentsmesh.yaml', async () => {
    await writeConfig({ version: 1, targets: [] });
    const result = await runCli('plugin add agentsmesh-target-foo', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('added');
    const yaml = await readConfigText();
    expect(yaml).toContain('agentsmesh-target-foo');
  });

  it('derives id from npm package name (strips agentsmesh-target- prefix)', async () => {
    await writeConfig({ version: 1, targets: [] });
    await runCli('plugin add agentsmesh-target-kilo-code', tmpDir);
    const yaml = await readConfigText();
    expect(yaml).toContain('id: kilo-code');
    expect(yaml).toContain('source: agentsmesh-target-kilo-code');
  });

  it('strips @scope/ from scoped npm package names', async () => {
    await writeConfig({ version: 1, targets: [] });
    await runCli('plugin add @my-org/agentsmesh-target-baz', tmpDir);
    const yaml = await readConfigText();
    expect(yaml).toContain('id: baz');
    expect(yaml).toContain('@my-org/agentsmesh-target-baz');
  });

  it('--id flag overrides the derived id', async () => {
    await writeConfig({ version: 1, targets: [] });
    const result = await runCli('plugin add agentsmesh-target-foo --id my-override', tmpDir);
    expect(result.exitCode).toBe(0);
    const yaml = await readConfigText();
    expect(yaml).toContain('id: my-override');
  });

  it('--version flag pins the version in the config', async () => {
    await writeConfig({ version: 1, targets: [] });
    const result = await runCli('plugin add agentsmesh-target-foo --version 1.2.3', tmpDir);
    expect(result.exitCode).toBe(0);
    const yaml = await readConfigText();
    expect(yaml).toContain('version: 1.2.3');
  });

  it('deduplication: second add with same id is a no-op', async () => {
    await writeConfig({ version: 1, targets: [] });
    await runCli('plugin add agentsmesh-target-foo', tmpDir);
    await runCli('plugin add agentsmesh-target-foo', tmpDir);
    const yaml = await readConfigText();
    // source should appear exactly once
    expect((yaml.match(/agentsmesh-target-foo/g) ?? []).length).toBe(1);
  });

  it('creates agentsmesh.yaml if it does not exist', async () => {
    const result = await runCli('plugin add agentsmesh-target-brand-new', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(await fileExists(join(tmpDir, 'agentsmesh.yaml'))).toBe(true);
    const yaml = await readConfigText();
    expect(yaml).toContain('agentsmesh-target-brand-new');
  });

  it('exits 2 when no source is given', async () => {
    const result = await runCli('plugin add', tmpDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Usage:');
  });
});

// ─── plugin remove ───────────────────────────────────────────────────────────

describe('agentsmesh plugin remove', () => {
  it('removes a plugin entry from agentsmesh.yaml', async () => {
    await writeConfig({
      version: 1,
      plugins: [
        { id: 'keep-me', source: 'pkg-a' },
        { id: 'remove-me', source: 'pkg-b' },
      ],
    });
    const result = await runCli('plugin remove remove-me', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('removed');
    const yaml = await readConfigText();
    expect(yaml).not.toContain('remove-me');
    expect(yaml).toContain('keep-me');
  });

  it('also removes the id from pluginTargets', async () => {
    await writeConfig({
      version: 1,
      plugins: [{ id: 'my-plugin', source: 'pkg' }],
      pluginTargets: ['my-plugin', 'other-target'],
    });
    await runCli('plugin remove my-plugin', tmpDir);
    const yaml = await readConfigText();
    expect(yaml).not.toContain('my-plugin');
    expect(yaml).toContain('other-target');
  });

  it('exits 0 with a warning when id is not found', async () => {
    await writeConfig({ version: 1, plugins: [] });
    const result = await runCli('plugin remove nonexistent-plugin', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('nonexistent-plugin');
  });

  it('exits 2 when no id is given', async () => {
    const result = await runCli('plugin remove', tmpDir);
    expect(result.exitCode).toBe(2);
  });
});

// ─── plugin info ─────────────────────────────────────────────────────────────

describe('agentsmesh plugin info', () => {
  it('exits 1 when id not found in agentsmesh.yaml', async () => {
    await writeConfig({ version: 1, plugins: [] });
    const result = await runCli('plugin info nonexistent', tmpDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  it('exits 1 when no agentsmesh.yaml exists and id not found', async () => {
    const result = await runCli('plugin info anything', tmpDir);
    expect(result.exitCode).toBe(1);
  });

  it('exits 2 when no id is given', async () => {
    const result = await runCli('plugin info', tmpDir);
    expect(result.exitCode).toBe(2);
  });

  it('shows descriptor details for a loadable plugin', async () => {
    await writeConfig({
      version: 1,
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
    });
    const result = await runCli('plugin info simple-plugin', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('simple-plugin');
    expect(result.stdout).toContain('Descriptors: 1');
  });

  it('exits 1 when the plugin source cannot be loaded', async () => {
    await writeConfig({
      version: 1,
      plugins: [{ id: 'broken', source: 'nonexistent-pkg-xyz-99999' }],
    });
    const result = await runCli('plugin info broken', tmpDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('broken');
  });
});

// ─── Full generate flow via CLI ───────────────────────────────────────────────

describe('agentsmesh plugin — full generate flow via CLI', () => {
  async function setupCanonical(): Promise<void> {
    const rulesDir = join(tmpDir, '.agentsmesh', 'rules');
    await mkdir(rulesDir, { recursive: true });
    await writeFile(
      join(rulesDir, '_root.md'),
      '---\nroot: true\ndescription: root\n---\n\n# Root\n',
    );
  }

  it('plugin-provided target generates output when configured in agentsmesh.yaml', async () => {
    await setupCanonical();
    await writeConfig({
      version: 1,
      targets: [],
      features: ['rules'],
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
      pluginTargets: ['simple-plugin'],
    });

    const result = await runCli('generate', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(await fileExists(join(tmpDir, 'PLUGIN.md'))).toBe(true);
  });

  it('plugin and built-in target both produce output in the same generate run', async () => {
    await setupCanonical();
    await writeConfig({
      version: 1,
      targets: ['claude-code'],
      features: ['rules'],
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
      pluginTargets: ['simple-plugin'],
    });

    const result = await runCli('generate', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(await fileExists(join(tmpDir, 'PLUGIN.md'))).toBe(true);
    expect(await fileExists(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(true);
  });

  it('generate --check detects plugin output is missing', async () => {
    await setupCanonical();
    await writeConfig({
      version: 1,
      targets: [],
      features: ['rules'],
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
      pluginTargets: ['simple-plugin'],
    });

    // First generate to create lock, then delete plugin output
    await runCli('generate', tmpDir);
    await rm(join(tmpDir, 'PLUGIN.md'));

    const check = await runCli('generate --check', tmpDir);
    expect(check.exitCode).not.toBe(0);
  });

  it('generate is idempotent: second run reports unchanged', async () => {
    await setupCanonical();
    await writeConfig({
      version: 1,
      targets: [],
      features: ['rules'],
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
      pluginTargets: ['simple-plugin'],
    });

    await runCli('generate', tmpDir);
    const second = await runCli('generate', tmpDir);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain('unchanged');
  });

  it('plugin with no pluginTargets entry does not generate output', async () => {
    await setupCanonical();
    await writeConfig({
      version: 1,
      targets: [],
      features: ['rules'],
      // plugin registered but NOT in pluginTargets
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
      pluginTargets: [],
    });

    const result = await runCli('generate', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(await fileExists(join(tmpDir, 'PLUGIN.md'))).toBe(false);
  });

  it('diff includes plugin target output', async () => {
    await setupCanonical();
    await writeConfig({
      version: 1,
      targets: [],
      features: ['rules'],
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
      pluginTargets: ['simple-plugin'],
    });

    const result = await runCli('diff', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('PLUGIN.md');
  });

  it('check detects drift in plugin-generated files', async () => {
    await setupCanonical();
    await writeConfig({
      version: 1,
      targets: [],
      features: ['rules'],
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
      pluginTargets: ['simple-plugin'],
    });

    await runCli('generate', tmpDir);
    const ok = await runCli('check', tmpDir);
    expect(ok.exitCode).toBe(0);

    // Tamper with a canonical file to produce drift
    await writeFile(
      join(tmpDir, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\ndescription: changed\n---\n\n# Changed\n',
    );
    const drift = await runCli('check', tmpDir);
    expect(drift.exitCode).toBe(1);
  });

  it('import --from rejects unknown plugin target with helpful message', async () => {
    await writeConfig({
      version: 1,
      targets: [],
      plugins: [],
      pluginTargets: [],
    });

    const result = await runCli('import --from nonexistent-target', tmpDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown --from');
  });

  it('matrix includes plugin target columns', async () => {
    await setupCanonical();
    await writeConfig({
      version: 1,
      targets: [],
      features: ['rules'],
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
      pluginTargets: ['simple-plugin'],
    });

    const result = await runCli('matrix', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('simple-plugin');
  });

  it('generate prints a matrix that includes plugin target columns', async () => {
    await setupCanonical();
    await writeConfig({
      version: 1,
      targets: [],
      features: ['rules'],
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
      pluginTargets: ['simple-plugin'],
    });

    const result = await runCli('generate', tmpDir);
    expect(result.exitCode).toBe(0);
    // After generation, runMatrix is invoked — plugin should appear as a column
    expect(result.stdout).toContain('simple-plugin');
  });

  it('import --from accepts a registered plugin target', async () => {
    await setupCanonical();
    await writeConfig({
      version: 1,
      targets: [],
      features: ['rules'],
      plugins: [{ id: 'simple-plugin', source: FIXTURE_PLUGIN_URL }],
      pluginTargets: ['simple-plugin'],
    });

    const result = await runCli('import --from simple-plugin', tmpDir);
    expect(result.exitCode).toBe(0);
    // simple-plugin's importFrom returns [] → empty import message
    expect(result.stdout).toContain('No');
  });
});
