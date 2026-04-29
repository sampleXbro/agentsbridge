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

function captureStreams(): { out: string[]; err: string[]; restore: () => void } {
  const out: string[] = [];
  const err: string[] = [];
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    out.push(typeof chunk === 'string' ? chunk : chunk.toString('utf-8'));
    return true;
  });
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    err.push(typeof chunk === 'string' ? chunk : chunk.toString('utf-8'));
    return true;
  });
  return {
    out,
    err,
    restore: () => {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    },
  };
}

describe('runTarget', () => {
  it('prints help and returns 0 when no subcommand is given', async () => {
    const { out, restore } = captureStreams();
    const code = await runTarget({}, [], tmpDir);
    restore();
    expect(code).toBe(0);
    const all = out.join('');
    expect(all).toContain('Usage: agentsmesh target');
    expect(all).toContain('scaffold');
  });

  it('prints help when subcommand is empty string', async () => {
    const { out, restore } = captureStreams();
    const code = await runTarget({}, [''], tmpDir);
    restore();
    expect(code).toBe(0);
    expect(out.join('')).toContain('Usage: agentsmesh target');
  });

  it('returns 2 and prints help on unknown subcommand', async () => {
    const { out, err, restore } = captureStreams();
    const code = await runTarget({}, ['bogus'], tmpDir);
    restore();
    expect(code).toBe(2);
    expect(err.join('')).toContain('Unknown target subcommand: bogus');
    expect(out.join('')).toContain('Usage: agentsmesh target');
  });

  it('returns 2 when scaffold has no id', async () => {
    const { err, restore } = captureStreams();
    const code = await runTarget({}, ['scaffold'], tmpDir);
    restore();
    expect(code).toBe(2);
    expect(err.join('')).toContain('Usage: agentsmesh target scaffold');
  });

  it('returns 0 and writes scaffold for fresh id', async () => {
    const { out, restore } = captureStreams();
    const code = await runTarget({}, ['scaffold', 'foo-bar'], tmpDir);
    restore();
    expect(code).toBe(0);
    const allOut = out.join('');
    expect(allOut).toContain('created src/targets/foo-bar/constants.ts');
    expect(allOut).toContain('Next steps:');
  });

  it('honors --name and --force flags', async () => {
    // Pre-create one of the files so force matters
    const targetDir = join(tmpDir, 'src/targets/named-tool');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, 'constants.ts'), '// existing');

    const { out, restore } = captureStreams();
    const code = await runTarget(
      { name: 'Named Tool', force: true },
      ['scaffold', 'named-tool'],
      tmpDir,
    );
    restore();
    expect(code).toBe(0);
    const allOut = out.join('');
    expect(allOut).toContain('created src/targets/named-tool/constants.ts');
    expect(allOut).not.toContain('skipped');
  });

  it('reports skipped files (no force) and omits Next steps when nothing was written', async () => {
    // Pre-create ALL the files so nothing is written
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

    const { out, err, restore } = captureStreams();
    const code = await runTarget({}, ['scaffold', id], tmpDir);
    restore();
    expect(code).toBe(0);
    const allErr = err.join('');
    expect(allErr).toContain('skipped');
    expect(out.join('')).not.toContain('Next steps:');
  });

  it('returns 1 and logs error when scaffold rejects an invalid id', async () => {
    const { err, restore } = captureStreams();
    const code = await runTarget({}, ['scaffold', 'INVALID_ID'], tmpDir);
    restore();
    expect(code).toBe(1);
    expect(err.join('')).toMatch(/Invalid target id/);
  });

  it('returns 1 and logs error when id matches an existing built-in', async () => {
    const { err, restore } = captureStreams();
    const code = await runTarget({}, ['scaffold', 'cursor'], tmpDir);
    restore();
    expect(code).toBe(1);
    expect(err.join('')).toMatch(/already exists as a built-in/);
  });

  it('treats a non-string flag.name as undefined display name', async () => {
    const { restore } = captureStreams();
    // Pass boolean for `name` — should be treated as undefined
    const code = await runTarget({ name: true }, ['scaffold', 'name-not-string'], tmpDir);
    restore();
    expect(code).toBe(0);
  });

  it('treats absolute returned paths (no projectRoot prefix) gracefully when reporting', async () => {
    // This exercises the rel branch where p.startsWith(projectRoot) is true.
    const { out, restore } = captureStreams();
    const code = await runTarget({}, ['scaffold', 'rel-test'], tmpDir);
    restore();
    expect(code).toBe(0);
    const allOut = out.join('');
    // Path should be relative to projectRoot — without leading slash
    expect(allOut).toMatch(/created src\/targets\/rel-test\/constants\.ts/);
    expect(allOut).not.toContain(`${tmpDir}/src/targets/rel-test/constants.ts`);
  });
});
