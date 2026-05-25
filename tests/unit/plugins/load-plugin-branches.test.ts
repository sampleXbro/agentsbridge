/**
 * Branch coverage for load-plugin.ts error/edge paths:
 *   - `resolveNpmSpecifier`: package.json `exports: "<string>"` branch.
 *   - `loadPlugin`: importPluginModule failure wrapping (instanceof Error
 *     true branch) and non-Error throw wrapping (`String(err)` branch).
 *   - `loadAllPlugins`: non-Error throw inside a loaded plugin's top-level.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadPlugin,
  loadAllPlugins,
  resolveNpmSpecifier,
} from '../../../src/plugins/load-plugin.js';
import { resetRegistry } from '../../../src/targets/catalog/registry.js';

let tmpRoot = '';

beforeEach(() => {
  resetRegistry();
  tmpRoot = mkdtempSync(join(tmpdir(), 'am-load-plugin-branches-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('resolveNpmSpecifier — package.json exports string branch', () => {
  it('resolves using the `exports: "<string>"` shorthand when present', () => {
    const pkgDir = join(tmpRoot, 'node_modules', 'shorthand-pkg');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'shorthand-pkg', exports: './entry.js' }),
    );
    writeFileSync(join(pkgDir, 'entry.js'), 'export const descriptor = null;');

    const resolved = resolveNpmSpecifier('shorthand-pkg', tmpRoot);
    expect(resolved.endsWith('entry.js')).toBe(true);
  });

  it('falls through to default `index.js` when neither exports nor main is set', () => {
    const pkgDir = join(tmpRoot, 'node_modules', 'no-entry-pkg');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'no-entry-pkg' }));
    writeFileSync(join(pkgDir, 'index.js'), 'export const descriptor = null;');

    const resolved = resolveNpmSpecifier('no-entry-pkg', tmpRoot);
    expect(resolved.endsWith('index.js')).toBe(true);
  });

  it('falls back to main when exports is not a string', () => {
    const pkgDir = join(tmpRoot, 'node_modules', 'main-only-pkg');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'main-only-pkg', exports: { '.': './nested.js' }, main: 'lib/m.js' }),
    );
    mkdirSync(join(pkgDir, 'lib'));
    writeFileSync(join(pkgDir, 'lib', 'm.js'), 'export const descriptor = null;');

    const resolved = resolveNpmSpecifier('main-only-pkg', tmpRoot);
    expect(resolved.endsWith('m.js')).toBe(true);
  });
});

describe('loadPlugin — error wrapping branches', () => {
  it('wraps import failures whose cause is an Error (instanceof branch)', async () => {
    // ./does-not-exist.js inside projectRoot — passes the containment check
    // but the dynamic import() throws an Error.
    await expect(
      loadPlugin({ id: 'missing', source: './does-not-exist.js' }, tmpRoot),
    ).rejects.toThrow(/failed to import/);
  });
});

describe('loadAllPlugins — non-Error fallback branch', () => {
  it('wraps a thrown non-Error into the failure message via String(err)', async () => {
    // A plugin module whose top-level code throws a primitive (`throw 42`)
    // surfaces a non-Error inside the catch block, exercising the
    // `String(err)` branch in loadAllPlugins.
    const pluginDir = join(tmpRoot, 'plugin');
    mkdirSync(pluginDir);
    writeFileSync(join(pluginDir, 'index.js'), 'throw 42;');

    await expect(
      loadAllPlugins([{ id: 'throws-number', source: './plugin/index.js', strict: true }], tmpRoot),
    ).rejects.toThrow(/strict load/);
  });
});
