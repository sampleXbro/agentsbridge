/**
 * Branch coverage for the human-readable renderers in
 * `src/cli/renderers/installs.ts` and `src/cli/renderers/uninstall.ts`.
 * Both renderers are pure functions over a result object → logger; we
 * capture every log line and assert the visible output.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderInstalls } from '../../../../src/cli/renderers/installs.js';
import { renderUninstall } from '../../../../src/cli/renderers/uninstall.js';
import { logger } from '../../../../src/utils/output/logger.js';
import type { InstallsCommandResult } from '../../../../src/cli/commands/installs.js';
import type { UninstallCommandResult } from '../../../../src/cli/commands/uninstall.js';

let infoLines: string[];
let errorLines: string[];
let warnLines: string[];
let successLines: string[];

beforeEach(() => {
  infoLines = [];
  errorLines = [];
  warnLines = [];
  successLines = [];
  vi.spyOn(logger, 'info').mockImplementation((m: string) => infoLines.push(m));
  vi.spyOn(logger, 'error').mockImplementation((m: string) => errorLines.push(m));
  vi.spyOn(logger, 'warn').mockImplementation((m: string) => warnLines.push(m));
  vi.spyOn(logger, 'success').mockImplementation((m: string) => successLines.push(m));
});

describe('renderInstalls', () => {
  it('prints the canonical help banner from help-data when result.showHelp is set', () => {
    const result: InstallsCommandResult = {
      exitCode: 0,
      showHelp: true,
      data: { scope: 'project', subcommand: 'list', installs: [] },
    };
    renderInstalls(result);
    // `printCommandHelp('installs')` emits one multi-line info entry. Assert
    // the exact usage line and the documented flag set so the renderer cannot
    // silently drift from `help-data.ts` again.
    expect(infoLines).toHaveLength(1);
    const banner = infoLines[0]!;
    expect(banner).toContain('agentsmesh installs <subcommand> [flags]');
    expect(banner).toContain('Read-only inventory of installed packs');
    expect(banner).toContain('list');
    expect(banner).toContain('--global');
  });

  it('prints the error message when result.error is set', () => {
    const result: InstallsCommandResult = {
      exitCode: 2,
      error: 'Unknown installs subcommand: "x".',
      showHelp: true,
      data: { scope: 'project', subcommand: 'list', installs: [] },
    };
    renderInstalls(result);
    expect(errorLines).toEqual(['Unknown installs subcommand: "x".']);
  });

  it('prints "No installed packs" when list is empty and no help requested', () => {
    const result: InstallsCommandResult = {
      exitCode: 0,
      data: { scope: 'project', subcommand: 'list', installs: [] },
    };
    renderInstalls(result);
    expect(infoLines).toEqual(['No installed packs.']);
  });

  it('renders a column-aligned table when there are installs', () => {
    const result: InstallsCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        subcommand: 'list',
        installs: [
          {
            name: 'demo-pack',
            source: 'github:acme/demo',
            source_kind: 'github',
            source_type: 'canonical-agentsmesh',
            version: 'sha',
            features: ['rules', 'skills'],
            target: null,
            installed_at: '2026-05-20T12:34:56Z',
            pack_path: '.agentsmesh/packs/demo-pack',
            license: 'MIT',
          },
        ],
      },
    };
    renderInstalls(result);
    expect(infoLines).toHaveLength(2); // header + one row
    expect(infoLines[0]).toContain('NAME');
    expect(infoLines[0]).toContain('LICENSE');
    expect(infoLines[1]).toContain('demo-pack');
    expect(infoLines[1]).toContain('rules, skills');
    expect(infoLines[1]).toContain('MIT');
    expect(infoLines[1]).toContain('2026-05-20');
  });

  it('falls back to "-" when installed_at and license are null', () => {
    const result: InstallsCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        subcommand: 'list',
        installs: [
          {
            name: 'p',
            source: 's',
            source_kind: 'local',
            source_type: null,
            version: null,
            features: ['rules'],
            target: null,
            installed_at: null,
            pack_path: '.agentsmesh/packs/p',
            license: null,
          },
        ],
      },
    };
    renderInstalls(result);
    expect(infoLines[1]).toContain('-');
  });
});

describe('renderUninstall', () => {
  it('dry-run with no removals prints the empty message', () => {
    const result: UninstallCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'uninstall',
        removed: [],
        skipped: [],
        failed: [],
        dryRun: true,
      },
    };
    renderUninstall(result);
    expect(infoLines).toEqual(['[dry-run] No installs matched.']);
  });

  it('dry-run with removals lists each pack and its location', () => {
    const result: UninstallCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'uninstall',
        removed: [
          { name: 'pack-a', pack_path: '.agentsmesh/packs/pack-a', manifest_entry_removed: true },
          { name: 'pack-b', pack_path: null, manifest_entry_removed: true },
        ],
        skipped: [],
        failed: [],
        dryRun: true,
      },
    };
    renderUninstall(result);
    expect(infoLines[0]).toContain('Would uninstall 2 pack(s)');
    expect(infoLines).toContain('  - pack-a (.agentsmesh/packs/pack-a)');
    expect(infoLines).toContain('  - pack-b (extends-only)');
  });

  it('non-dry-run with removals prints a success line', () => {
    const result: UninstallCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'uninstall',
        removed: [
          { name: 'pack-a', pack_path: '.agentsmesh/packs/pack-a', manifest_entry_removed: true },
        ],
        skipped: [],
        failed: [],
        dryRun: false,
      },
    };
    renderUninstall(result);
    expect(successLines).toEqual(['Uninstalled 1 pack(s): "pack-a".']);
  });

  it('emits one warning per skipped pack', () => {
    const result: UninstallCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'uninstall',
        removed: [],
        skipped: [
          { name: 'gone', reason: 'No such pack' },
          { name: 'pinned', reason: 'Protected by lock' },
        ],
        failed: [],
        dryRun: false,
      },
    };
    renderUninstall(result);
    expect(warnLines).toEqual([
      'Skipped "gone": No such pack',
      'Skipped "pinned": Protected by lock',
    ]);
    expect(successLines).toEqual([]);
  });

  it('emits one error per failed pack and includes the reason', () => {
    const result: UninstallCommandResult = {
      exitCode: 1,
      data: {
        scope: 'project',
        mode: 'uninstall',
        removed: [{ name: 'ok', pack_path: '.agentsmesh/packs/ok', manifest_entry_removed: true }],
        skipped: [],
        failed: [
          { name: 'broken', reason: 'EACCES: permission denied' },
          { name: 'crashed', reason: 'Disk full' },
        ],
        dryRun: false,
      },
    };
    renderUninstall(result);
    expect(successLines).toEqual(['Uninstalled 1 pack(s): "ok".']);
    expect(errorLines).toEqual([
      'Failed "broken": EACCES: permission denied',
      'Failed "crashed": Disk full',
    ]);
  });
});
