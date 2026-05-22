/**
 * Branch coverage for src/canonical/extends/extend-load.ts lines 94-96:
 * the `err instanceof Error` ternary inside the catch block when loading
 * a canonical slice. Covers both true (real Error) and false (thrown
 * non-Error value) branches.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCanonicalForExtend } from '../../../src/canonical/extends/extend-load.js';
import { exists } from '../../../src/utils/filesystem/fs.js';
import { normalizeSlicePath } from '../../../src/canonical/load/load-canonical-slice.js';
import { loadCanonicalSliceAtPath } from '../../../src/canonical/load/load-canonical-slice.js';
import type { ResolvedExtend } from '../../../src/config/resolve/resolver.js';

vi.mock('../../../src/utils/filesystem/fs.js');
vi.mock('../../../src/canonical/load/load-canonical-slice.js');

const mockExists = vi.mocked(exists);
const mockNormalizeSlicePath = vi.mocked(normalizeSlicePath);
const mockLoadCanonicalSliceAtPath = vi.mocked(loadCanonicalSliceAtPath);

beforeEach(() => {
  vi.clearAllMocks();
  mockExists.mockResolvedValue(true);
  mockNormalizeSlicePath.mockResolvedValue({ sliceRoot: '/tmp/slice' });
});

describe('loadCanonicalForExtend — slice catch branch', () => {
  const ext: ResolvedExtend = {
    name: 'demo',
    resolvedPath: '/tmp/repo',
    path: 'subdir',
  };

  it('wraps a thrown Error with cause preserved (instanceof Error = true)', async () => {
    const inner = new Error('inner-msg');
    mockLoadCanonicalSliceAtPath.mockRejectedValue(inner);
    await expect(loadCanonicalForExtend(ext)).rejects.toMatchObject({
      message: 'Extend "demo": inner-msg',
      cause: inner,
    });
  });

  it('wraps a thrown non-Error value as string with no cause (instanceof Error = false)', async () => {
    mockLoadCanonicalSliceAtPath.mockRejectedValue('plain-string-failure');
    try {
      await loadCanonicalForExtend(ext);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toBe('Extend "demo": plain-string-failure');
      expect((e as Error).cause).toBeUndefined();
    }
  });
});
