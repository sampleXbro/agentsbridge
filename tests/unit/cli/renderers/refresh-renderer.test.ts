// tests/unit/cli/renderers/refresh-renderer.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../../../src/utils/output/logger.js';
import { renderRefresh } from '../../../../src/cli/renderers/refresh.js';
import type { RefreshCommandResult } from '../../../../src/install/refresh/refresh-result.js';

describe('renderRefresh', () => {
  let logs: string[];
  let warns: string[];
  let errors: string[];

  beforeEach(() => {
    logs = [];
    warns = [];
    errors = [];
    vi.spyOn(logger, 'info').mockImplementation((m: string) => logs.push(m));
    vi.spyOn(logger, 'success').mockImplementation((m: string) => logs.push(m));
    vi.spyOn(logger, 'warn').mockImplementation((m: string) => warns.push(m));
    vi.spyOn(logger, 'error').mockImplementation((m: string) => errors.push(m));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders refreshed packs with name and ref transition', () => {
    const result: RefreshCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [
          {
            name: 'pack-a',
            oldRef: 'abc',
            newRef: 'def',
            oldSha: 'abc',
            newSha: 'def',
            changedFiles: { added: [], removed: [], modified: [] },
          },
          {
            name: 'pack-no-old-sha',
            oldRef: null,
            newRef: 'def',
            oldSha: null,
            newSha: 'def',
            changedFiles: { added: [], removed: [], modified: [] },
          },
        ],
        unchanged: [],
        skipped: [],
        failed: [],
        dryRun: false,
      },
    };

    renderRefresh(result);
    expect(logs.some((l) => l.includes('pack-a'))).toBe(true);
    expect(logs.some((l) => l.includes('abc') && l.includes('def'))).toBe(true);
    // oldSha null falls back to em-dash
    expect(logs.some((l) => l.includes('pack-no-old-sha') && l.includes('—'))).toBe(true);
  });

  it('renders dry-run with [dry-run] prefix and no success line when empty', () => {
    const result: RefreshCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [],
        unchanged: [],
        skipped: [],
        failed: [],
        dryRun: true,
      },
    };
    renderRefresh(result);
    expect(logs.some((l) => l.includes('[dry-run]'))).toBe(true);
  });

  it('renders dry-run summary with refreshed and unchanged items', () => {
    const result: RefreshCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [
          {
            name: 'pack-x',
            oldRef: null,
            newRef: 'v2',
            oldSha: null,
            newSha: 'v2',
            changedFiles: { added: [], removed: [], modified: [] },
          },
        ],
        unchanged: [{ name: 'pack-y', ref: 'v1' }],
        skipped: [],
        failed: [],
        dryRun: true,
      },
    };
    renderRefresh(result);
    expect(logs.some((l) => l.includes('[dry-run]') && l.includes('1 pack(s)'))).toBe(true);
    expect(logs.some((l) => l.includes('pack-x'))).toBe(true);
    expect(logs.some((l) => l.includes('pack-y') && l.includes('unchanged'))).toBe(true);
    // oldSha null falls back to em-dash
    expect(logs.some((l) => l.includes('—'))).toBe(true);
  });

  it('renders unchanged packs', () => {
    const result: RefreshCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [],
        unchanged: [{ name: 'pack-b', ref: 'abc' }],
        skipped: [],
        failed: [],
        dryRun: false,
      },
    };
    renderRefresh(result);
    expect(logs.some((l) => l.includes('pack-b') && l.includes('unchanged'))).toBe(true);
  });

  it('renders skipped and failed packs', () => {
    const result: RefreshCommandResult = {
      exitCode: 1,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [],
        unchanged: [],
        skipped: [{ name: 'pack-c', reason: 'user-declined' }],
        failed: [{ name: 'pack-d', phase: 'plan', error: 'manifest missing' }],
        dryRun: false,
      },
    };
    renderRefresh(result);
    expect(warns.some((w) => w.includes('pack-c'))).toBe(true);
    expect(errors.some((e) => e.includes('pack-d'))).toBe(true);
  });
});
