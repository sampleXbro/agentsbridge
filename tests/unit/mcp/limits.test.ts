import { describe, it, expect } from 'vitest';
import { MAX_FILE_SIZE_BYTES, MAX_DIR_ENTRIES } from '../../../src/mcp/limits.js';

describe('limits', () => {
  it('caps file size at 1 MiB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(1_048_576);
  });
  it('caps directory entries at 1000', () => {
    expect(MAX_DIR_ENTRIES).toBe(1000);
  });
});
