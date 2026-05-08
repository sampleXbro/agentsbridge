import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { McpContext } from '../../../../src/mcp/context.js';
import type { GenerateResult, ImportResult } from '../../../../src/core/types.js';
import type { LockSyncReport } from '../../../../src/core/check/lock-sync.js';
import type { ComputeDiffResult } from '../../../../src/core/differ.js';

// ─── mock public API ───────────────────────────────────────────────────────────

const mockGenerate = vi.fn<[unknown], Promise<GenerateResult[]>>();
const mockLint = vi.fn();
const mockCheck = vi.fn<[unknown], Promise<LockSyncReport>>();
const mockDiff = vi.fn<[unknown], Promise<ComputeDiffResult & { results: GenerateResult[] }>>();
const mockImportFrom = vi.fn<[string, unknown], Promise<ImportResult[]>>();
const mockLoadProjectContext = vi.fn();

vi.mock('../../../../src/public/index.js', () => ({
  generate: mockGenerate,
  lint: mockLint,
  check: mockCheck,
  diff: mockDiff,
  importFrom: mockImportFrom,
  loadProjectContext: mockLoadProjectContext,
  TargetNotFoundError: class TargetNotFoundError extends Error {
    code = 'AM_TARGET_NOT_FOUND';
    target: string;
    constructor(target: string, opts?: { supported?: string[] }) {
      const suffix = opts?.supported ? ` Supported: ${opts.supported.join(', ')}.` : '';
      super(`Unknown target "${target}".${suffix}`);
      this.target = target;
      this.name = 'TargetNotFoundError';
    }
  },
}));

// ─── mock convert ─────────────────────────────────────────────────────────────

const mockRunConvert = vi.fn();

vi.mock('../../../../src/cli/commands/convert.js', () => ({
  runConvert: mockRunConvert,
}));

// ─── mock writeFileAtomic ─────────────────────────────────────────────────────

vi.mock('../../../../src/utils/filesystem/fs.js', () => ({
  writeFileAtomic: vi.fn().mockResolvedValue(undefined),
}));

// ─── import handler after mocks ───────────────────────────────────────────────

const { orchestrateHandlers } = await import('../../../../src/mcp/handlers/orchestrate.js');

// ─── helpers ──────────────────────────────────────────────────────────────────

const ctx: McpContext = {
  projectRoot: '/project',
  loadCanonical: vi.fn(),
};

const baseProjectContext = {
  config: { targets: ['claude-code'], features: ['rules'], pluginTargets: [] },
  canonical: {},
  projectRoot: '/project',
  scope: 'project' as const,
  configDir: '/project',
  canonicalDir: '/project/.agentsmesh',
};

function makeGenerateResults(overrides: Partial<GenerateResult>[] = []): GenerateResult[] {
  return overrides.map((o) => ({
    target: 'claude-code',
    path: '.claude/CLAUDE.md',
    content: '# rules',
    status: 'created' as const,
    ...o,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadProjectContext.mockResolvedValue(baseProjectContext);
});

// ─── tests ────────────────────────────────────────────────────────────────────

describe('orchestrateHandlers.generate', () => {
  it('returns summary shape without files when verbose is false', async () => {
    const results = makeGenerateResults([
      { status: 'created', path: 'a.md', target: 'claude-code' },
      { status: 'updated', path: 'b.md', target: 'cursor' },
    ]);
    mockGenerate.mockResolvedValue(results);

    const out = await orchestrateHandlers.generate(ctx, { dry_run: true });

    expect(out.filesWritten).toBe(2);
    expect(out.byTarget['claude-code'].filesWritten).toBe(1);
    expect(out.byTarget['cursor'].filesWritten).toBe(1);
    expect(out.lockfileUpdated).toBe(false);
    expect(out.errors).toEqual([]);
    expect(out.warnings).toEqual([]);
    expect('files' in out).toBe(false);
  });

  it('includes files array when verbose is true', async () => {
    const results = makeGenerateResults([
      { status: 'created', path: 'x.md', target: 'claude-code' },
    ]);
    mockGenerate.mockResolvedValue(results);

    const out = await orchestrateHandlers.generate(ctx, { verbose: true, dry_run: true });

    expect(out.files).toEqual(['x.md']);
  });

  it('throws IO_ERROR when engine throws a generic error', async () => {
    mockGenerate.mockRejectedValue(new Error('some io failure'));

    await expect(orchestrateHandlers.generate(ctx, {})).rejects.toMatchObject({
      code: 'IO_ERROR',
    });
  });

  it('throws LOCK_HELD when engine error message contains "lock"', async () => {
    mockGenerate.mockRejectedValue(new Error('cannot acquire lock file'));

    await expect(orchestrateHandlers.generate(ctx, {})).rejects.toMatchObject({
      code: 'LOCK_HELD',
    });
  });

  it('writes files via writeFileAtomic when dry_run is false', async () => {
    const fsMod = await import('../../../../src/utils/filesystem/fs.js');
    const writeMock = fsMod.writeFileAtomic as unknown as ReturnType<typeof vi.fn>;
    const results = makeGenerateResults([
      { status: 'created', path: 'a.md', target: 'claude-code' },
      { status: 'updated', path: 'b.md', target: 'claude-code' },
      { status: 'skipped', path: 'c.md', target: 'cursor' },
    ]);
    mockGenerate.mockResolvedValue(results);

    const out = await orchestrateHandlers.generate(ctx, {});

    expect(out.filesWritten).toBe(2);
    expect(out.lockfileUpdated).toBe(true);
    expect(writeMock).toHaveBeenCalledTimes(2);
  });

  it('applies the targets filter (input.targets non-empty)', async () => {
    mockGenerate.mockResolvedValue([]);
    await orchestrateHandlers.generate(ctx, { targets: ['claude-code'], dry_run: true });
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ targetFilter: ['claude-code'] }),
    );
  });

  it('omits the targets filter when input.targets is empty', async () => {
    mockGenerate.mockResolvedValue([]);
    await orchestrateHandlers.generate(ctx, { targets: [], dry_run: true });
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ targetFilter: undefined }));
  });
});

describe('orchestrateHandlers.lint', () => {
  it('returns issues from underlying lint result', async () => {
    mockLint.mockResolvedValue({
      diagnostics: [
        { level: 'error', file: 'rule.md', target: 'claude-code', message: 'missing heading' },
        { level: 'warning', file: 'cmd.md', target: 'cursor', message: 'long line' },
      ],
      hasErrors: true,
    });

    const out = await orchestrateHandlers.lint(ctx, {});

    expect(out.issues).toHaveLength(2);
    expect(out.issues[0]).toMatchObject({
      level: 'error',
      file: 'rule.md',
      target: 'claude-code',
      message: 'missing heading',
    });
  });

  it('filters by severity when input.severity is provided', async () => {
    mockLint.mockResolvedValue({
      diagnostics: [
        { level: 'error', file: 'a.md', target: 'claude-code', message: 'A' },
        { level: 'warning', file: 'b.md', target: 'claude-code', message: 'B' },
        { level: 'warning', file: 'c.md', target: 'cursor', message: 'C' },
      ],
      hasErrors: true,
    });

    const out = await orchestrateHandlers.lint(ctx, { severity: 'warning' });

    expect(out.issues).toHaveLength(2);
    expect(out.issues.every((i) => i.level === 'warning')).toBe(true);
  });

  it('wraps engine error via wrapEngineError', async () => {
    mockLint.mockRejectedValue(new Error('lint engine boom'));
    await expect(orchestrateHandlers.lint(ctx, {})).rejects.toMatchObject({ code: 'IO_ERROR' });
  });
});

describe('orchestrateHandlers.check', () => {
  it('returns drift/missing/extra/modified from LockSyncReport', async () => {
    mockCheck.mockResolvedValue({
      inSync: false,
      hasLock: true,
      modified: ['rules/foo.md'],
      added: ['rules/new.md'],
      removed: ['rules/old.md'],
      extendsModified: [],
      lockedViolations: [],
    } satisfies LockSyncReport);

    const out = await orchestrateHandlers.check(ctx);

    expect(out.drift).toBe(true);
    expect(out.missing).toEqual(['rules/old.md']);
    expect(out.extra).toEqual(['rules/new.md']);
    expect(out.modified).toEqual(['rules/foo.md']);
  });

  it('wraps engine error via wrapEngineError', async () => {
    mockCheck.mockRejectedValue(new Error('check boom'));
    await expect(orchestrateHandlers.check(ctx)).rejects.toMatchObject({ code: 'IO_ERROR' });
  });
});

describe('orchestrateHandlers.diff', () => {
  it('returns willCreate/willModify/willDelete from computeDiff result', async () => {
    mockDiff.mockResolvedValue({
      diffs: [],
      summary: { new: 3, updated: 1, unchanged: 5, deleted: 0 },
      results: [],
    });

    const out = await orchestrateHandlers.diff(ctx, {});

    expect(out.willCreate).toBe(3);
    expect(out.willModify).toBe(1);
    expect(out.willDelete).toBe(0);
  });

  it('forwards a non-empty targets filter', async () => {
    mockDiff.mockResolvedValue({
      diffs: [],
      summary: { new: 0, updated: 0, unchanged: 0, deleted: 0 },
      results: [],
    });
    await orchestrateHandlers.diff(ctx, { targets: ['cursor'] });
    expect(mockDiff).toHaveBeenCalledWith(expect.objectContaining({ targetFilter: ['cursor'] }));
  });

  it('wraps engine error via wrapEngineError', async () => {
    mockDiff.mockRejectedValue(new Error('diff boom'));
    await expect(orchestrateHandlers.diff(ctx, {})).rejects.toMatchObject({ code: 'IO_ERROR' });
  });
});

describe('orchestrateHandlers.import', () => {
  it('calls importFrom and returns mapped result', async () => {
    const importResults: ImportResult[] = [
      {
        fromTool: 'cursor',
        fromPath: '.cursorrules',
        toPath: '.agentsmesh/rules/root.md',
        feature: 'rules',
      },
    ];
    mockImportFrom.mockResolvedValue(importResults);

    const out = await orchestrateHandlers.import(ctx, { from: 'cursor' });

    expect(mockImportFrom).toHaveBeenCalledWith('cursor', {
      root: '/project',
      scope: 'project',
    });
    expect(out.imported).toBe(1);
    expect(out.files[0]).toMatchObject({
      fromPath: '.cursorrules',
      toPath: '.agentsmesh/rules/root.md',
      feature: 'rules',
    });
    expect(out.errors).toEqual([]);
  });

  it('rejects dry_run with VALIDATION_FAILED', async () => {
    await expect(
      orchestrateHandlers.import(ctx, { from: 'cursor', dry_run: true }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      message: expect.stringContaining('dry_run is not supported for import'),
    });
    expect(mockImportFrom).not.toHaveBeenCalled();
  });

  it('throws VALIDATION_FAILED for unknown target', async () => {
    const { TargetNotFoundError } = await import('../../../../src/public/index.js');
    mockImportFrom.mockRejectedValue(new TargetNotFoundError('unknown-target'));

    await expect(orchestrateHandlers.import(ctx, { from: 'unknown-target' })).rejects.toMatchObject(
      { code: 'VALIDATION_FAILED' },
    );
  });

  it('translates a regex-matched "unknown target" string error to VALIDATION_FAILED', async () => {
    mockImportFrom.mockRejectedValue(new Error('unknown target "nope"'));
    await expect(orchestrateHandlers.import(ctx, { from: 'nope' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('translates a regex-matched "not found" error to VALIDATION_FAILED', async () => {
    mockImportFrom.mockRejectedValue(new Error('Target descriptor not found for "x"'));
    await expect(orchestrateHandlers.import(ctx, { from: 'x' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('falls through to wrapEngineError for unrelated failures', async () => {
    mockImportFrom.mockRejectedValue(new Error('disk full'));
    await expect(orchestrateHandlers.import(ctx, { from: 'cursor' })).rejects.toMatchObject({
      code: 'IO_ERROR',
    });
  });
});

describe('orchestrateHandlers.convert', () => {
  it('calls runConvert and returns written count', async () => {
    mockRunConvert.mockResolvedValue({
      exitCode: 0,
      data: {
        from: 'cursor',
        to: 'claude-code',
        mode: 'convert',
        files: [],
        summary: { created: 2, updated: 1, unchanged: 0 },
      },
    });

    const out = await orchestrateHandlers.convert(ctx, { from: 'cursor', to: 'claude-code' });

    expect(mockRunConvert).toHaveBeenCalledWith(
      { from: 'cursor', to: 'claude-code', 'dry-run': false },
      '/project',
    );
    expect(out.filesAffected).toBe(3);
    expect(out.dryRun).toBe(false);
    expect(out.errors).toEqual([]);
    expect(out.warnings).toEqual([]);
  });

  it('throws VALIDATION_FAILED when convert error mentions unknown target', async () => {
    mockRunConvert.mockRejectedValue(
      new Error('Unknown --from "nope". Supported: cursor, claude-code.'),
    );

    await expect(
      orchestrateHandlers.convert(ctx, { from: 'nope', to: 'claude-code' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('passes dry_run=true through to runConvert flags', async () => {
    mockRunConvert.mockResolvedValue({
      exitCode: 0,
      data: {
        from: 'cursor',
        to: 'claude-code',
        mode: 'convert',
        files: [],
        summary: { created: 0, updated: 0, unchanged: 0 },
      },
    });

    const out = await orchestrateHandlers.convert(ctx, {
      from: 'cursor',
      to: 'claude-code',
      dry_run: true,
    });

    expect(out.dryRun).toBe(true);
    expect(mockRunConvert).toHaveBeenCalledWith(
      { from: 'cursor', to: 'claude-code', 'dry-run': true },
      '/project',
    );
  });

  it('falls through to wrapEngineError when convert fails for unrelated reason', async () => {
    mockRunConvert.mockRejectedValue(new Error('disk full'));
    await expect(
      orchestrateHandlers.convert(ctx, { from: 'cursor', to: 'claude-code' }),
    ).rejects.toMatchObject({ code: 'IO_ERROR' });
  });
});
