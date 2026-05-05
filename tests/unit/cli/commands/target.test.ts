import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTarget } from '../../../../src/cli/commands/target.js';

let tmpDir: string;
const originalNoColor = process.env.NO_COLOR;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agentsmesh-target-cmd-'));
  process.env.NO_COLOR = '1';
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  if (originalNoColor === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = originalNoColor;
  vi.restoreAllMocks();
});

describe('runTarget', () => {
  it('returns showHelp and exitCode 0 when no subcommand is given', async () => {
    const result = await runTarget({}, [], tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.showHelp).toBe(true);
    expect(result.data.id).toBe('');
  });

  it('returns showHelp when subcommand is empty string', async () => {
    const result = await runTarget({}, [''], tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.showHelp).toBe(true);
  });

  it('returns exit code 2 with error on unknown subcommand', async () => {
    const result = await runTarget({}, ['bogus'], tmpDir);
    expect(result.exitCode).toBe(2);
    expect(result.error).toBe('Unknown target subcommand: bogus');
    expect(result.showHelp).toBe(true);
  });

  it('throws when scaffold has no id', async () => {
    await expect(runTarget({}, ['scaffold'], tmpDir)).rejects.toThrow(
      'Usage: agentsmesh target scaffold',
    );
  });

  it('returns exitCode 0 and written files for fresh id', async () => {
    const result = await runTarget({}, ['scaffold', 'foo-bar'], tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.data.id).toBe('foo-bar');
    expect(result.data.written.length).toBeGreaterThan(0);
    expect(result.data.written).toContain('src/targets/foo-bar/constants.ts');
    expect(result.data.postSteps.length).toBeGreaterThan(0);
  });

  it('honors --name and --force flags', async () => {
    // Pre-create one of the files so force matters
    const targetDir = join(tmpDir, 'src/targets/named-tool');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, 'constants.ts'), '// existing');

    const result = await runTarget(
      { name: 'Named Tool', force: true },
      ['scaffold', 'named-tool'],
      tmpDir,
    );
    expect(result.exitCode).toBe(0);
    expect(result.data.written).toContain('src/targets/named-tool/constants.ts');
    expect(result.data.skipped).toHaveLength(0);
  });

  it('reports skipped files (no force) when files exist', async () => {
    const id = 'skip-only';
    const expectedRels = [
      `src/targets/${id}/constants.ts`,
      `src/targets/${id}/index.ts`,
      `src/targets/${id}/generator.ts`,
      `src/targets/${id}/importer.ts`,
      `src/targets/${id}/linter.ts`,
      `src/targets/${id}/lint.ts`,
      `src/core/reference/import-maps/${id}.ts`,
      `tests/unit/targets/${id}/generator.test.ts`,
      `tests/unit/targets/${id}/importer.test.ts`,
      `tests/e2e/fixtures/${id}-project/AGENTS.md`,
    ];
    for (const rel of expectedRels) {
      const full = join(tmpDir, rel);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, '// pre-existing');
    }

    const result = await runTarget({}, ['scaffold', id], tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.data.written).toHaveLength(0);
    expect(result.data.skipped.length).toBeGreaterThan(0);
    expect(result.data.postSteps.length).toBeGreaterThan(0);
  });

  it('returns exitCode 1 with error when scaffold rejects an invalid id', async () => {
    const result = await runTarget({}, ['scaffold', 'INVALID_ID'], tmpDir);
    expect(result.exitCode).toBe(1);
    expect(result.error).toMatch(/Invalid target id/);
  });

  it('returns exitCode 1 with error when id matches an existing built-in', async () => {
    const result = await runTarget({}, ['scaffold', 'cursor'], tmpDir);
    expect(result.exitCode).toBe(1);
    expect(result.error).toMatch(/already exists as a built-in/);
  });

  it('treats a non-string flag.name as undefined display name', async () => {
    // Pass boolean for `name` — should be treated as undefined
    const result = await runTarget({ name: true }, ['scaffold', 'name-not-string'], tmpDir);
    expect(result.exitCode).toBe(0);
  });

  it('returns relative forward-slash paths in written array', async () => {
    const result = await runTarget({}, ['scaffold', 'rel-test'], tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.data.written).toContain('src/targets/rel-test/constants.ts');
    // Should not contain absolute path
    for (const p of result.data.written) {
      expect(p).not.toContain(tmpDir);
      expect(p).not.toContain('\\');
    }
  });
});
