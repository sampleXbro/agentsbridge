/**
 * Branch coverage for src/mcp/errors.ts line 30:
 * - toEnvelope() ternary when `this.details === undefined` (was: only the
 *   "details defined" branch was exercised by existing tests).
 */

import { describe, it, expect } from 'vitest';
import { McpError } from '../../../src/mcp/errors.js';

describe('McpError.toEnvelope — undefined-details branch', () => {
  it('omits the details key entirely when constructed without details', () => {
    const e = new McpError('NOT_FOUND', 'rule "auth" not found');
    const env = e.toEnvelope();
    expect(env).toEqual({ code: 'NOT_FOUND', message: 'rule "auth" not found' });
    expect('details' in env).toBe(false);
  });

  it('omits details when explicit `undefined` is passed', () => {
    const e = new McpError('VALIDATION_FAILED', 'bad name', undefined);
    expect(e.toEnvelope()).toEqual({ code: 'VALIDATION_FAILED', message: 'bad name' });
  });

  it('preserves falsy non-undefined details (null, 0, empty string)', () => {
    const e = new McpError('IO_ERROR', 'something', null);
    expect(e.toEnvelope()).toEqual({
      code: 'IO_ERROR',
      message: 'something',
      details: null,
    });
  });
});
