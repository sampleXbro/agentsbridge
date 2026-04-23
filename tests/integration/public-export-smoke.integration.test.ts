/**
 * Smoke-test package.json "exports" after `pnpm build` (P2-3 gate).
 */

import { describe, it, expect } from 'vitest';
import { generate, importFrom } from '../../dist/engine.js';
import { loadCanonical, loadCanonicalFiles } from '../../dist/canonical.js';
import { getTargetCatalog, registerTargetDescriptor, getDescriptor } from '../../dist/targets.js';

describe('public library exports (dist)', () => {
  it('exposes engine, canonical, and targets entry points', async () => {
    expect(typeof generate).toBe('function');
    expect(typeof importFrom).toBe('function');
    expect(typeof loadCanonical).toBe('function');
    expect(typeof loadCanonicalFiles).toBe('function');
    expect(getTargetCatalog().length).toBeGreaterThan(0);
    expect(getDescriptor('claude-code')).toBeDefined();
    expect(typeof registerTargetDescriptor).toBe('function');
    await expect(loadCanonicalFiles(process.cwd())).resolves.toBeDefined();
  });
});
