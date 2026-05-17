import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importNativeToCanonical } from '../../../src/canonical/extends/native-extends-importer.js';
import { BUILTIN_TARGETS } from '../../../src/targets/catalog/builtin-targets.js';

/**
 * `importNativeToCanonical` is a single-line dispatcher: it must invoke each
 * descriptor's own `generators.importFrom` rather than maintain its own
 * registry. The previous hardcoded `NATIVE_IMPORTERS` record listed only 11
 * of 30 targets — installing or extending from any of the other 19
 * (aider, amp, opencode, zed, etc.) threw "No importer registered" even
 * though every descriptor declares an importer.
 *
 * These tests assert the dispatcher reaches every builtin descriptor's
 * importer and returns an array, without making behavioral claims about the
 * importer outputs (which have their own per-target test suites).
 */
describe('importNativeToCanonical', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'am-native-import-'));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  describe('every builtin descriptor is dispatchable', () => {
    for (const descriptor of BUILTIN_TARGETS) {
      it(`${descriptor.id}`, async () => {
        const results = await importNativeToCanonical(tmp, descriptor.id);
        expect(Array.isArray(results)).toBe(true);
      });
    }
  });

  it('throws for unknown target name', async () => {
    await expect(importNativeToCanonical(tmp, 'unknown-tool')).rejects.toThrow(
      /No importer registered for native target: unknown-tool/,
    );
  });
});
