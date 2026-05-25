/**
 * `existsWithExactCase` defends the link rebaser against macOS / Windows
 * case-insensitive filesystems silently resolving `SPEC.md` to `spec.md`.
 * Without this guard, the resolver commits a savedFallback (canonical path)
 * for any case-mismatched bare token whose case-folded file exists on disk
 * — emitting `../../.agentsmesh/.../SPEC.md` into generated artifacts.
 *
 * Verified against the real filesystem: write `spec.md` then ask whether
 * `SPEC.md` exists. Plain `existsSync` returns true on macOS and false on
 * Linux; `existsWithExactCase` returns false uniformly so the rebaser's
 * "leave bare tokens alone when the target doesn't really exist" rule
 * holds on every platform.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsWithExactCase } from '../../../src/core/path-helpers.js';

const ROOT = join(tmpdir(), 'am-exists-exact-case');

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('existsWithExactCase', () => {
  it('returns true when basename case matches on disk', () => {
    writeFileSync(join(ROOT, 'spec.md'), '# spec');
    expect(existsWithExactCase(join(ROOT, 'spec.md'))).toBe(true);
  });

  it('returns false when basename case differs (macOS / Windows quirk)', () => {
    writeFileSync(join(ROOT, 'spec.md'), '# spec');
    // The file is `spec.md`; plain `existsSync` would return true on
    // case-insensitive filesystems. `existsWithExactCase` rejects this
    // so the link rebaser doesn't treat `SPEC.md` as a real link target.
    expect(existsWithExactCase(join(ROOT, 'SPEC.md'))).toBe(false);
  });

  it('returns false for a missing file', () => {
    expect(existsWithExactCase(join(ROOT, 'absent.md'))).toBe(false);
  });

  it('returns true for an existing directory with exact case', () => {
    mkdirSync(join(ROOT, 'commands'), { recursive: true });
    expect(existsWithExactCase(join(ROOT, 'commands'))).toBe(true);
  });

  it('returns false for a directory referenced with wrong case', () => {
    mkdirSync(join(ROOT, 'commands'), { recursive: true });
    expect(existsWithExactCase(join(ROOT, 'Commands'))).toBe(false);
  });
});
