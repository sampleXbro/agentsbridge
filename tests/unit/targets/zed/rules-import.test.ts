/**
 * `additionalRules: 'embedded'` needs both halves.
 *
 * `generateRules` folds every non-root rule into a managed block inside `.rules`
 * (`~/.config/zed/AGENTS.md` globally). Import has to split that block back out;
 * copying the whole body into `_root.md` loses each rule's identity, and the next
 * generate — which strips the managed block before rebuilding it — deletes the
 * text for good.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { importFromZed } from '../../../../src/targets/zed/importer.js';
import { generateRules } from '../../../../src/targets/zed/generator.js';
import { loadCanonicalFiles } from '../../../../src/canonical/load/loader.js';
import { ZED_ROOT_FILE, ZED_GLOBAL_ROOT_FILE } from '../../../../src/targets/zed/constants.js';

let root = '';

function write(relPath: string, content: string): void {
  mkdirSync(dirname(join(root, relPath)), { recursive: true });
  writeFileSync(join(root, relPath), content);
}

function read(relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-zed-rules-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function seed(): void {
  write('.agentsmesh/rules/_root.md', '---\nroot: true\n---\n# Root\n\nAlways run tests.\n');
  write(
    '.agentsmesh/rules/style.md',
    '---\nroot: false\ndescription: Style rules\nglobs: ["src/**/*.ts"]\n---\n# Style\n\nUse tabs, never spaces.\n',
  );
}

describe('zed rules import', () => {
  it('splits the embedded block back into canonical non-root rules', async () => {
    seed();
    const [output] = generateRules(await loadCanonicalFiles(root));
    write(ZED_ROOT_FILE, output!.content);
    rmSync(join(root, '.agentsmesh'), { recursive: true, force: true });

    const results = await importFromZed(root);

    expect(results.map((r) => r.toPath).sort()).toEqual([
      '.agentsmesh/rules/_root.md',
      '.agentsmesh/rules/style.md',
    ]);
    const style = read('.agentsmesh/rules/style.md');
    expect(style).toContain('Use tabs, never spaces.');
    expect(style).toContain('src/**/*.ts');
    expect(read('.agentsmesh/rules/_root.md')).not.toContain('Use tabs, never spaces.');
  });

  it('is a fixed point: generate -> import -> generate keeps every rule', async () => {
    seed();
    const first = generateRules(await loadCanonicalFiles(root))[0]!;
    write(ZED_ROOT_FILE, first.content);
    rmSync(join(root, '.agentsmesh'), { recursive: true, force: true });

    await importFromZed(root);
    const second = generateRules(await loadCanonicalFiles(root))[0]!;

    expect(second.content).toContain('Use tabs, never spaces.');
    expect(second.content).toBe(first.content);
  });

  it('splits the global root file too', async () => {
    seed();
    const [output] = generateRules(await loadCanonicalFiles(root));
    write(ZED_GLOBAL_ROOT_FILE, output!.content);
    rmSync(join(root, '.agentsmesh'), { recursive: true, force: true });

    await importFromZed(root, { scope: 'global' });

    expect(existsSync(join(root, '.agentsmesh/rules/style.md'))).toBe(true);
  });

  it('imports a plain .rules file with no managed block as the root rule alone', async () => {
    write(ZED_ROOT_FILE, '# Project Instructions\n\nUse TDD.\n');

    const results = await importFromZed(root);

    expect(results.map((r) => r.toPath)).toEqual(['.agentsmesh/rules/_root.md']);
    expect(read('.agentsmesh/rules/_root.md')).toContain('Use TDD.');
    expect(read('.agentsmesh/rules/_root.md')).toContain('root: true');
  });
});
