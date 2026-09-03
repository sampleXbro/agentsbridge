/**
 * `managedOutputs` has two readers with opposite needs: stale cleanup must see
 * ONLY the files agentsmesh owns outright, while the reference rewriter, the
 * import map and native install-path picking must see every path agentsmesh
 * touches. `managedOutputPaths` is the single helper for the second group.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  managedOutputFiles,
  managedOutputPaths,
} from '../../../../src/targets/catalog/managed-outputs.js';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import {
  getDescriptor,
  registerTargetDescriptor,
  resetRegistry,
} from '../../../../src/targets/catalog/registry.js';
import type { TargetDescriptor } from '../../../../src/targets/catalog/target-descriptor.js';
import { targetHintFromNativePath } from '../../../../src/install/native/native-path-pick.js';
import { getLinkFormatRegistry } from '../../../../src/core/reference/link-format-registry.js';

afterEach(() => resetRegistry());

describe('managedOutputPaths', () => {
  it('returns dirs, owned files and co-owned files', () => {
    expect(
      managedOutputPaths({
        managedOutputs: {
          dirs: ['.x/rules'],
          files: ['.x/root.md'],
          coOwnedFiles: ['.x/settings.json'],
        },
        paths: { rulePath: () => null, commandPath: () => null, agentPath: () => null },
      }),
    ).toEqual(['.x/rules', '.x/root.md', '.x/settings.json']);
  });

  it('returns an empty list for a layout with no managed outputs', () => {
    expect(
      managedOutputPaths({
        paths: { rulePath: () => null, commandPath: () => null, agentPath: () => null },
      }),
    ).toEqual([]);
    expect(managedOutputPaths(undefined)).toEqual([]);
  });

  it('returns owned then co-owned files without dirs', () => {
    expect(
      managedOutputFiles({
        dirs: ['.x/rules'],
        files: ['.x/root.md'],
        coOwnedFiles: ['.x/settings.json'],
      }),
    ).toEqual(['.x/root.md', '.x/settings.json']);
    expect(managedOutputFiles(undefined)).toEqual([]);
  });

  it('resolves a registered plugin descriptor layout', async () => {
    const mod: { descriptor: unknown } =
      await import('../../../fixtures/plugins/rich-plugin/index.js');
    registerTargetDescriptor(mod.descriptor as TargetDescriptor);
    expect(getDescriptor('rich-plugin')).toBeDefined();
    expect(managedOutputPaths(getTargetLayout('rich-plugin', 'project'))).toContain(
      '.rich/mcp.json',
    );
    expect(managedOutputPaths(getTargetLayout('rich-plugin', 'global'))).toContain(
      '.rich/mcp.json',
    );
  });
});

describe('co-owned paths stay visible to the non-deleting consumers', () => {
  // `.vscode/` reaches both consumers ONLY through copilot's `.vscode/mcp.json`
  // and roo-code's `.vscode/settings.json` — both co-owned. Nothing else in any
  // descriptor mentions the directory, so these two assertions fail the moment a
  // consumer stops reading `coOwnedFiles`.
  it('keeps native install-path hints for a co-owned file', () => {
    expect(targetHintFromNativePath('.vscode/mcp.json')).toBe('copilot');
    expect(targetHintFromNativePath('.vscode/settings.json')).toBe('roo-code');
  });

  it('keeps root-relative link prefixes contributed by co-owned files', () => {
    expect(getLinkFormatRegistry().rootRelativePrefixes).toContain('.vscode/');
  });
});
