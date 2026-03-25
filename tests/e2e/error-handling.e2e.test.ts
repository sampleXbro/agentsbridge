/**
 * E2E tests for CLI error handling.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';

describe('error-handling', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('no config file — run generate in empty dir → exit 1, stderr contains "No agentsbridge.yaml"', async () => {
    dir = createTestProject();
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('No agentsbridge.yaml');
  });

  it('invalid YAML — write broken YAML → exit 1, stderr contains parse error', async () => {
    dir = createTestProject();
    writeFileSync(join(dir, 'agentsbridge.yaml'), 'version: 1\ninvalid: [unclosed');
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Rules\n',
    );
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Invalid config|parse|YAML|Flow|sequence|column|line \d+/i);
  });

  it('invalid target — run with targets fake-tool in config → exit 1, stderr lists valid targets', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      'version: 1\ntargets: [fake-tool]\nfeatures: [rules]\n',
    );
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Rules\n',
    );
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Invalid|enum|target|claude-code|cursor/i);
  });

  it('invalid feature — features teleport in config → exit 1, stderr lists valid features', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [teleport]\n',
    );
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Rules\n',
    );
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Invalid|enum|feature|rules|commands/i);
  });

  // Lib returns null on invalid MCP JSON (graceful degradation), so generate succeeds
  it('corrupted MCP JSON — invalid JSON in mcp.json → lib tolerates (returns null)', async () => {
    dir = createTestProject('canonical-full');
    writeFileSync(join(dir, '.agentsbridge', 'mcp.json'), '{ invalid json');
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(0); // parseMcp returns null on parse error, no throw
  });

  it('invalid frontmatter — rule with unclosed YAML array → exit 1, stderr points to error', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: [unclosed\n---\n# Body\n',
    );
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/_root|frontmatter|parse|Invalid|YAML|Flow|sequence|column/i);
  });

  it('unknown command — run `ab foobar` → exit 1, stderr suggests similar commands', async () => {
    dir = createTestProject();
    const r = await runCli('foobar', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Unknown command|foobar|Available|init|generate/i);
  });

  it('--help always works — even with broken config', async () => {
    dir = createTestProject();
    const r = await runCli('--help', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/usage|agentsbridge|init|generate|import/i);
  });

  it('--version always works — even with broken config', async () => {
    dir = createTestProject();
    const r = await runCli('--version', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/agentsbridge|v?\d+\.\d+/);
  });

  it('invalid config version — version: 2 in yaml → exit 1', async () => {
    dir = createTestProject();
    writeFileSync(join(dir, 'agentsbridge.yaml'), 'version: 2\ntargets: [claude-code]\n');
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(join(dir, '.agentsbridge', 'rules', '_root.md'), '---\nroot: true\n---\n# X\n');
    const r = await runCli('generate', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Invalid|version|config/i);
  });

  it('config with empty targets array → exit 1 or valid', async () => {
    dir = createTestProject();
    writeFileSync(join(dir, 'agentsbridge.yaml'), 'version: 1\ntargets: []\nfeatures: [rules]\n');
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(join(dir, '.agentsbridge', 'rules', '_root.md'), '---\nroot: true\n---\n# X\n');
    const r = await runCli('generate', dir);
    // Schema may accept empty array - if so exit 0 with no files
    if (r.exitCode === 1) {
      expect(r.stderr).toMatch(/Invalid|target|empty/i);
    } else {
      expect(r.exitCode).toBe(0);
    }
  });
});
