import { describe, it, expect } from 'vitest';
import { McpError, ERROR_CODES } from '../../../src/mcp/errors.js';

describe('errors', () => {
  it('exposes stable codes', () => {
    expect(ERROR_CODES).toEqual({
      NOT_FOUND: 'NOT_FOUND',
      ALREADY_EXISTS: 'ALREADY_EXISTS',
      VALIDATION_FAILED: 'VALIDATION_FAILED',
      INVALID_NAME: 'INVALID_NAME',
      PATH_TRAVERSAL: 'PATH_TRAVERSAL',
      PROTECTED_FILE: 'PROTECTED_FILE',
      LOCK_HELD: 'LOCK_HELD',
      NO_PROJECT: 'NO_PROJECT',
      IO_ERROR: 'IO_ERROR',
      LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
    });
  });
  it('serializes to envelope with code/message/details', () => {
    const e = new McpError('NOT_FOUND', 'rule "auth" not found', { name: 'auth' });
    expect(e.toEnvelope()).toEqual({
      code: 'NOT_FOUND',
      message: 'rule "auth" not found',
      details: { name: 'auth' },
    });
  });
  it('refuses absolute fs paths in messages', () => {
    expect(() => new McpError('IO_ERROR', '/Users/x/y failed')).toThrow(/absolute fs path/);
  });
});
