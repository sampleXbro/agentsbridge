/**
 * Branch coverage for wrapEngineError — every path that translates an
 * engine-level exception into a typed McpError.
 */
import { describe, it, expect } from 'vitest';
import { wrapEngineError } from '../../../../src/mcp/handlers/orchestrate-types.js';
import { McpError } from '../../../../src/mcp/errors.js';
import { TargetNotFoundError } from '../../../../src/public/index.js';

describe('wrapEngineError', () => {
  it('rethrows an existing McpError unchanged', () => {
    const original = new McpError('NOT_FOUND', 'agent x not found');
    expect(() => wrapEngineError(original)).toThrow(original);
  });

  it('translates a TargetNotFoundError to VALIDATION_FAILED', () => {
    expect(() => wrapEngineError(new TargetNotFoundError('nope'))).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
  });

  it('translates a "unknown --from" string error to VALIDATION_FAILED', () => {
    expect(() => wrapEngineError(new Error('Unknown --from "x".'))).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
  });

  it('translates a "unknown --to" string error to VALIDATION_FAILED', () => {
    expect(() => wrapEngineError(new Error('Unknown --to "y".'))).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
  });

  it('translates a "unknown target" string error to VALIDATION_FAILED', () => {
    expect(() => wrapEngineError(new Error('unknown target "claude-code"'))).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
  });

  it('translates a non-Error value (string thrown) via String(e)', () => {
    // Some libraries throw plain strings; coverage path goes through `String(e)`.
    expect(() => wrapEngineError('lock contention please retry')).toThrow(
      expect.objectContaining({ code: 'LOCK_HELD' }),
    );
  });

  it('falls through to IO_ERROR for unrelated errors', () => {
    expect(() => wrapEngineError(new Error('disk full'))).toThrow(
      expect.objectContaining({ code: 'IO_ERROR' }),
    );
  });
});
