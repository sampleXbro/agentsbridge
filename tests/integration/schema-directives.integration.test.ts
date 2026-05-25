/**
 * IDE-recognizable schema directives must be present on every YAML / JSON
 * file the writers create. End-to-end check: run `init` and `install` in a
 * temp project, then assert every documented file carries either:
 *   - a `# yaml-language-server: $schema=...` first-line directive (YAML), or
 *   - a top-level `$schema` field (JSON).
 *
 * This is the regression-protection for the IDE-autoconfig feature. If
 * any writer drops the directive, this test fails on the exact path.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInit } from '../../src/cli/commands/init.js';
import { runInstall } from '../../src/install/run/run-install.js';

const SCHEMA_BASE = 'https://unpkg.com/agentsmesh';

function expectYamlDirective(content: string, schemaFile: string, path: string): void {
  const firstLine = content.split('\n')[0] ?? '';
  expect(firstLine, `${path} must start with the yaml-language-server directive`).toMatch(
    /^# yaml-language-server: \$schema=/,
  );
  expect(firstLine, `${path} directive must point at ${schemaFile}`).toContain(
    `/schemas/${schemaFile}`,
  );
  expect(firstLine, `${path} directive must point at the agentsmesh schemas namespace`).toContain(
    SCHEMA_BASE,
  );
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf-8')) as Record<string, unknown>;
}

let projectRoot = '';

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'am-schema-directive-'));
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('schema directives — fresh init', () => {
  it('stamps every YAML init artifact with its yaml-language-server directive', async () => {
    await runInit(projectRoot, { yes: true });

    const yamlPath = join(projectRoot, 'agentsmesh.yaml');
    const localPath = join(projectRoot, 'agentsmesh.local.yaml');
    const hooksPath = join(projectRoot, '.agentsmesh', 'hooks.yaml');
    const permsPath = join(projectRoot, '.agentsmesh', 'permissions.yaml');

    expectYamlDirective(await readFile(yamlPath, 'utf-8'), 'agentsmesh.json', 'agentsmesh.yaml');
    expectYamlDirective(
      await readFile(localPath, 'utf-8'),
      'agentsmesh.json',
      'agentsmesh.local.yaml',
    );
    expectYamlDirective(await readFile(hooksPath, 'utf-8'), 'hooks.json', '.agentsmesh/hooks.yaml');
    expectYamlDirective(
      await readFile(permsPath, 'utf-8'),
      'permissions.json',
      '.agentsmesh/permissions.yaml',
    );
  });
});

describe('schema directives — install pipeline', () => {
  async function buildLocalUpstream(upstream: string): Promise<void> {
    const can = join(upstream, '.agentsmesh');
    await mkdir(join(can, 'skills', 'demo'), { recursive: true });
    await mkdir(join(can, 'rules'), { recursive: true });
    await writeFile(
      join(can, 'skills', 'demo', 'SKILL.md'),
      '---\nname: demo\ndescription: body\n---\n# demo\n',
      'utf-8',
    );
    await writeFile(
      join(can, 'rules', 'security.md'),
      '---\ndescription: security\n---\nrule body\n',
      'utf-8',
    );
  }

  it('stamps installs.yaml, pack.yaml, and .agentsmesh-install-manifest.json on a real install', async () => {
    const upstream = join(projectRoot, 'upstream');
    const project = join(projectRoot, 'project');
    await buildLocalUpstream(upstream);
    await mkdir(join(project, '.agentsmesh', 'rules'), { recursive: true });
    await writeFile(
      join(project, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\nextends: []\n',
      'utf-8',
    );
    await writeFile(
      join(project, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
      'utf-8',
    );

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    // installs.yaml — newly written by upsertInstallManifestEntry
    const installsYaml = await readFile(join(project, '.agentsmesh', 'installs.yaml'), 'utf-8');
    expectYamlDirective(installsYaml, 'installs.json', '.agentsmesh/installs.yaml');

    // pack.yaml — written by pack-writer's materializePack path
    const packYaml = await readFile(
      join(project, '.agentsmesh', 'packs', 'demo-pack', 'pack.yaml'),
      'utf-8',
    );
    expectYamlDirective(packYaml, 'pack.json', 'demo-pack/pack.yaml');

    // .agentsmesh-install-manifest.json — JSON, stamped via $schema field
    const manifest = await readJson(
      join(project, '.agentsmesh', 'packs', 'demo-pack', '.agentsmesh-install-manifest.json'),
    );
    expect(manifest.$schema).toBeTypeOf('string');
    expect(manifest.$schema as string).toContain('/schemas/install-manifest.json');
    expect(manifest.$schema as string).toContain(SCHEMA_BASE);
    // The stamp must not displace the documented fields.
    expect(manifest.name).toBe('demo-pack');
    expect(manifest.files).toBeTypeOf('object');
  });
});
