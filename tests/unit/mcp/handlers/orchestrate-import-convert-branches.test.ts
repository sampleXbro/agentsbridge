/**
 * Branch coverage for `importFromTarget` and `convert` in
 * `src/mcp/handlers/orchestrate-import-convert.ts`. Covers:
 *   - import: dry_run=true → VALIDATION_FAILED
 *   - import: TargetNotFoundError → VALIDATION_FAILED with "unknown target" msg
 *   - import: error msg matches /unknown target/i → VALIDATION_FAILED
 *   - import: other engine errors → IO_ERROR via wrapEngineError
 *   - import: happy path returns mapped files
 *   - convert: error msg matches /unknown.*--from/ → VALIDATION_FAILED
 *   - convert: other errors → IO_ERROR via wrapEngineError
 *   - convert: happy path counts created + updated
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { McpContext } from '../../../../src/mcp/context.js';

const mocks = vi.hoisted(() => ({
  importFromMock: vi.fn(),
  runConvertMock: vi.fn(),
}));

vi.mock('../../../../src/public/index.js', () => ({
  importFrom: mocks.importFromMock,
  TargetNotFoundError: class TargetNotFoundError extends Error {
    code = 'AM_TARGET_NOT_FOUND';
    constructor(target: string) {
      super(`Unknown target "${target}".`);
      this.name = 'TargetNotFoundError';
    }
  },
}));

vi.mock('../../../../src/cli/commands/convert.js', () => ({
  runConvert: mocks.runConvertMock,
}));

const { importFromTarget, convert } =
  await import('../../../../src/mcp/handlers/orchestrate-import-convert.js');

const ctx: McpContext = { projectRoot: '/project', loadCanonical: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('importFromTarget branches', () => {
  it('throws VALIDATION_FAILED when dry_run is true', async () => {
    await expect(
      importFromTarget(ctx, { from: 'claude-code', dry_run: true }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('maps TargetNotFoundError to VALIDATION_FAILED with unknown-target message', async () => {
    const { TargetNotFoundError } = await import('../../../../src/public/index.js');
    mocks.importFromMock.mockRejectedValue(new TargetNotFoundError('xyz'));
    await expect(importFromTarget(ctx, { from: 'xyz' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      message: expect.stringMatching(/unknown target "xyz"/),
    });
  });

  it('maps generic "unknown target" message to VALIDATION_FAILED', async () => {
    mocks.importFromMock.mockRejectedValue(new Error('unknown target shrug'));
    await expect(importFromTarget(ctx, { from: 'shrug' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('maps unrelated engine errors to IO_ERROR via wrapEngineError', async () => {
    mocks.importFromMock.mockRejectedValue(new Error('disk on fire'));
    await expect(importFromTarget(ctx, { from: 'claude-code' })).rejects.toMatchObject({
      code: 'IO_ERROR',
    });
  });

  it('returns mapped files on the happy path', async () => {
    mocks.importFromMock.mockResolvedValue([
      { fromPath: '/p/CLAUDE.md', toPath: '.agentsmesh/rules/_root.md', feature: 'rules' },
    ]);
    const out = await importFromTarget(ctx, { from: 'claude-code' });
    expect(out).toEqual({
      imported: 1,
      files: [{ fromPath: '/p/CLAUDE.md', toPath: '.agentsmesh/rules/_root.md', feature: 'rules' }],
      warnings: [],
      errors: [],
    });
  });
});

describe('convert branches', () => {
  it('maps "unknown --from" errors to VALIDATION_FAILED', async () => {
    mocks.runConvertMock.mockRejectedValue(new Error('unknown --from "nope"'));
    await expect(convert(ctx, { from: 'nope', to: 'claude-code' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('maps unrelated errors to IO_ERROR', async () => {
    mocks.runConvertMock.mockRejectedValue(new Error('disk on fire'));
    await expect(convert(ctx, { from: 'claude-code', to: 'cursor' })).rejects.toMatchObject({
      code: 'IO_ERROR',
    });
  });

  it('counts created + updated files on the happy path and propagates dryRun', async () => {
    mocks.runConvertMock.mockResolvedValue({
      data: { summary: { created: 2, updated: 3 } },
    });
    const out = await convert(ctx, { from: 'claude-code', to: 'cursor', dry_run: true });
    expect(out).toEqual({ filesAffected: 5, dryRun: true, warnings: [], errors: [] });
  });
});
