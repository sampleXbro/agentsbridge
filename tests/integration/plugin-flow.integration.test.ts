/**
 * End-to-end integration test for the plugin flow.
 * - Writes a fixture plugin module in a temp dir
 * - Configures plugins: and pluginTargets: in a temp agentsmesh.yaml
 * - Calls runGenerate and asserts PLUGIN.md appears
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, access, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { resetRegistry } from '../../src/targets/catalog/registry.js';

let tmpDir: string;

const FIXTURE_PLUGIN_DIR = join(process.cwd(), 'tests/fixtures/plugins/simple-plugin');

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'agentsmesh-plugin-integration-'));
  resetRegistry();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  resetRegistry();
});

describe('plugin flow integration', () => {
  it('generate produces PLUGIN.md for a configured plugin', async () => {
    // Set up canonical files
    const canonicalDir = join(tmpDir, '.agentsmesh');
    const rulesDir = join(canonicalDir, 'rules');
    await mkdir(rulesDir, { recursive: true });
    await writeFile(
      join(rulesDir, '_root.md'),
      '---\nroot: true\ndescription: root\n---\n\n# Root\n',
    );

    // Copy the fixture plugin under projectRoot — load-plugin enforces that
    // plugin sources resolve inside the project root, matching real-world
    // node_modules/local-plugin layouts.
    const pluginDir = join(tmpDir, 'plugin');
    await cp(FIXTURE_PLUGIN_DIR, pluginDir, { recursive: true });
    const pluginSource = pathToFileURL(join(pluginDir, 'index.js')).href;
    const config = {
      version: 1,
      targets: [],
      features: ['rules'],
      plugins: [{ id: 'simple-plugin', source: pluginSource }],
      pluginTargets: ['simple-plugin'],
    };
    await writeFile(join(tmpDir, 'agentsmesh.yaml'), stringifyYaml(config));

    // Dynamically import runGenerate to avoid top-level side effects
    const { runGenerate } = await import('../../src/cli/commands/generate.js');
    const result = await runGenerate({}, tmpDir, { printMatrix: false });
    expect(result.exitCode).toBe(0);

    const pluginMdExists = await fileExists(join(tmpDir, 'PLUGIN.md'));
    expect(pluginMdExists).toBe(true);
  });
});
