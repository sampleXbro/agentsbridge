import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeTargetScaffold } from '../../../../src/cli/commands/target-scaffold/writer.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'agentsmesh-scaffold-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

const EXPECTED_RELS = (id: string): string[] => [
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

describe('writeTargetScaffold', () => {
  it('emits all 10 expected file paths for a fresh id', async () => {
    const result = await writeTargetScaffold({ id: 'foo-bar', projectRoot: tmpDir });
    const expected = EXPECTED_RELS('foo-bar').map((r) => join(tmpDir, r));
    expect(result.written.sort()).toEqual(expected.sort());
    expect(result.skipped).toHaveLength(0);
  });

  it('all emitted files are non-empty and contain the id', async () => {
    await writeTargetScaffold({ id: 'my-tool', projectRoot: tmpDir });
    for (const rel of EXPECTED_RELS('my-tool')) {
      const content = await readFile(join(tmpDir, rel), 'utf8');
      expect(content.length).toBeGreaterThan(0);
      // Files should reference the id somewhere
      expect(content).toContain('my-tool');
    }
  });

  it('emitted TypeScript files import only from stable relative paths', async () => {
    await writeTargetScaffold({ id: 'check-imports', projectRoot: tmpDir });
    const tsFiles = EXPECTED_RELS('check-imports')
      .filter((r) => r.endsWith('.ts') && !r.endsWith('.test.ts'))
      .map((r) => join(tmpDir, r));

    for (const file of tsFiles) {
      const content = await readFile(file, 'utf8');
      // Should not contain absolute paths or 'agentsmesh' package imports
      expect(content).not.toMatch(/from 'agentsmesh/);
      // All imports should be relative
      const importLines = content
        .split('\n')
        .filter((l) => l.includes("from '") && !l.trim().startsWith('//'));
      for (const line of importLines) {
        const match = /from '([^']+)'/.exec(line);
        if (match && match[1] !== undefined) {
          const importPath = match[1];
          // Must be a relative import (starting with './' or '../') or a node: built-in
          expect(
            importPath.startsWith('./') ||
              importPath.startsWith('../') ||
              importPath.startsWith('node:'),
          ).toBe(true);
        }
      }
    }
  });

  it('returns skipped (not written) when file exists and !force', async () => {
    // Pre-create one of the files
    const targetDir = join(tmpDir, 'src/targets/pre-exists');
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, 'constants.ts'), '// existing');

    const result = await writeTargetScaffold({ id: 'pre-exists', projectRoot: tmpDir });
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toBe(join(tmpDir, 'src/targets/pre-exists/constants.ts'));
    expect(result.written).toHaveLength(9); // 10 - 1 skipped
  });

  it('overwrites when force: true', async () => {
    // Pre-create one of the files
    const targetDir = join(tmpDir, 'src/targets/force-test');
    await mkdir(targetDir, { recursive: true });
    const existingFile = join(targetDir, 'constants.ts');
    await writeFile(existingFile, '// existing');

    const result = await writeTargetScaffold({
      id: 'force-test',
      projectRoot: tmpDir,
      force: true,
    });
    expect(result.skipped).toHaveLength(0);
    expect(result.written).toHaveLength(10);

    // File should be overwritten
    const content = await readFile(existingFile, 'utf8');
    expect(content).not.toBe('// existing');
  });

  it('rejects invalid id: uppercase letters', async () => {
    await expect(writeTargetScaffold({ id: 'MyTarget', projectRoot: tmpDir })).rejects.toThrow(
      /Invalid target id/,
    );
  });

  it('rejects invalid id: underscore', async () => {
    await expect(writeTargetScaffold({ id: 'my_target', projectRoot: tmpDir })).rejects.toThrow(
      /Invalid target id/,
    );
  });

  it('rejects invalid id: starts with hyphen', async () => {
    await expect(writeTargetScaffold({ id: '-abc', projectRoot: tmpDir })).rejects.toThrow(
      /Invalid target id/,
    );
  });

  it('rejects empty id', async () => {
    await expect(writeTargetScaffold({ id: '', projectRoot: tmpDir })).rejects.toThrow(
      /Invalid target id/,
    );
  });

  it('rejects id that matches an existing built-in', async () => {
    await expect(writeTargetScaffold({ id: 'kiro', projectRoot: tmpDir })).rejects.toThrow(
      /already exists as a built-in/,
    );
  });

  it('rejects id that matches another built-in: cursor', async () => {
    await expect(writeTargetScaffold({ id: 'cursor', projectRoot: tmpDir })).rejects.toThrow(
      /already exists as a built-in/,
    );
  });

  it('postSteps contains the two manual edits + schemas:generate + matrix:generate', async () => {
    const result = await writeTargetScaffold({ id: 'ps-test', projectRoot: tmpDir });
    const steps = result.postSteps.join('\n');
    expect(steps).toContain('TARGET_IDS');
    expect(steps).toContain('builtin-targets.ts');
    expect(steps).toContain('schemas:generate');
    expect(steps).toContain('matrix:generate');
  });
});
