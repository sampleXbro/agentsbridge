/**
 * Branch coverage for src/mcp/writers/safe-config-write.ts line 14-15:
 * the LIMIT_EXCEEDED guard when content exceeds the 1 MiB cap.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeConfigWrite } from '../../../../src/mcp/writers/safe-config-write.js';
import { MAX_FILE_SIZE_BYTES } from '../../../../src/mcp/limits.js';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'cfgwrite-limit-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('safeConfigWrite — LIMIT_EXCEEDED branch', () => {
  it('rejects content exceeding MAX_FILE_SIZE_BYTES with LIMIT_EXCEEDED', async () => {
    const oversize = 'a'.repeat(MAX_FILE_SIZE_BYTES + 1);
    await expect(safeConfigWrite({ projectRoot: root, content: oversize })).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
      message: /1 MiB/,
    });
  });

  it('accepts content exactly at the cap', async () => {
    const exact = 'a'.repeat(MAX_FILE_SIZE_BYTES);
    const target = await safeConfigWrite({ projectRoot: root, content: exact });
    expect(target.endsWith('agentsmesh.yaml')).toBe(true);
  });
});
