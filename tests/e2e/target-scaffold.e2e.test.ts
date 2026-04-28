import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, access, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from './helpers/run-cli.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'agentsmesh-scaffold-e2e-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

describe('agentsmesh target scaffold (e2e)', () => {
  it('creates the expected files in a temp directory', async () => {
    const result = await runCli('target scaffold e2e-target', tmpDir);
    expect(result.exitCode).toBe(0);

    const expectedPaths = [
      `src/targets/e2e-target/constants.ts`,
      `src/targets/e2e-target/index.ts`,
      `src/targets/e2e-target/generator.ts`,
      `src/targets/e2e-target/importer.ts`,
      `src/targets/e2e-target/linter.ts`,
      `src/targets/e2e-target/lint.ts`,
      `src/core/reference/import-maps/e2e-target.ts`,
      `tests/unit/targets/e2e-target/generator.test.ts`,
      `tests/unit/targets/e2e-target/importer.test.ts`,
      `tests/e2e/fixtures/e2e-target-project/AGENTS.md`,
    ];

    for (const rel of expectedPaths) {
      const exists = await fileExists(join(tmpDir, rel));
      expect(exists, `Expected file to exist: ${rel}`).toBe(true);
    }
  });

  it('prints next steps after scaffolding', async () => {
    const result = await runCli('target scaffold e2e-steps', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('catalog:generate');
    expect(result.stdout).not.toContain('TARGET_IDS');
  });

  it('fails with exit code 1 on invalid id', async () => {
    const result = await runCli('target scaffold BadId', tmpDir);
    expect(result.exitCode).toBe(1);
  });

  it('fails with exit code 1 on existing built-in id', async () => {
    const result = await runCli('target scaffold kiro', tmpDir);
    expect(result.exitCode).toBe(1);
  });

  it('--force overwrites existing files', async () => {
    // Scaffold once
    await runCli('target scaffold e2e-force', tmpDir);
    // Scaffold again without --force should warn about skipped files
    const second = await runCli('target scaffold e2e-force', tmpDir);
    expect(second.exitCode).toBe(0);
    expect(second.stderr).toContain('skipped');

    // With --force should succeed cleanly
    const forced = await runCli('target scaffold e2e-force --force', tmpDir);
    expect(forced.exitCode).toBe(0);
    expect(forced.stdout).not.toContain('skipped');
  });

  it('--name flag sets display name in generated fixture file', async () => {
    // Use a single-token name (runCli splits on whitespace, so no spaces in the arg)
    const result = await runCli('target scaffold name-test --name FancyIDE', tmpDir);
    expect(result.exitCode).toBe(0);
    const fixture = await readFile(
      join(tmpDir, 'tests/e2e/fixtures/name-test-project/AGENTS.md'),
      'utf8',
    );
    expect(fixture).toContain('FancyIDE');
  });

  it('exits 2 when no id is given to scaffold', async () => {
    const result = await runCli('target scaffold', tmpDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Usage:');
  });

  it('exits 2 for an unknown target subcommand', async () => {
    const result = await runCli('target unknown-subcmd', tmpDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Unknown target subcommand');
  });

  it('exits 0 with help when no subcommand is given', async () => {
    const result = await runCli('target', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('scaffold');
  });

  it('multi-segment id (my-ai-tool) generates correct structure', async () => {
    const result = await runCli('target scaffold my-ai-tool', tmpDir);
    expect(result.exitCode).toBe(0);
    // constants.ts should export the id as a string literal
    const constants = await readFile(join(tmpDir, 'src/targets/my-ai-tool/constants.ts'), 'utf8');
    expect(constants).toContain("'my-ai-tool'");
    expect(constants).toContain('.my-ai-tool');
  });

  it('partial re-scaffold: only missing files are written, existing ones skipped', async () => {
    // First scaffold
    await runCli('target scaffold partial-test', tmpDir);

    // Delete 3 files to simulate partial state
    const toDelete = [
      'src/targets/partial-test/generator.ts',
      'tests/unit/targets/partial-test/generator.test.ts',
      'tests/e2e/fixtures/partial-test-project/AGENTS.md',
    ];
    for (const rel of toDelete) {
      await unlink(join(tmpDir, rel));
    }

    // Re-scaffold without --force
    const result = await runCli('target scaffold partial-test', tmpDir);
    expect(result.exitCode).toBe(0);

    // Deleted files should now be recreated
    for (const rel of toDelete) {
      const exists = await fileExists(join(tmpDir, rel));
      expect(exists, `Expected recreated: ${rel}`).toBe(true);
    }

    // Other 7 files should have been skipped (warned in stderr)
    expect(result.stderr).toContain('skipped');
    // stdout should report 3 created
    expect((result.stdout.match(/created/g) ?? []).length).toBe(toDelete.length);
  });
});
