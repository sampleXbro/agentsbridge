import { describe, it, expect } from 'vitest';
import { normalizeHooksRecord } from '../../../../src/mcp/writers/normalize-hooks.js';

describe('normalizeHooksRecord', () => {
  it('passes an already-flat entry through unchanged', () => {
    const flat = { PreToolUse: [{ matcher: 'Bash', type: 'command', command: 'echo a' }] };
    expect(normalizeHooksRecord(flat)).toEqual(flat);
  });

  it('flattens a nested entry into one flat entry per callable, preserving every field', () => {
    const nested = {
      PostToolUse: [
        {
          matcher: 'Write',
          hooks: [
            { type: 'command', command: 'echo a' },
            { type: 'prompt', prompt: 'note', timeout: 5000 },
          ],
        },
      ],
    };
    expect(normalizeHooksRecord(nested)).toEqual({
      PostToolUse: [
        { matcher: 'Write', type: 'command', command: 'echo a' },
        { matcher: 'Write', type: 'prompt', prompt: 'note', timeout: 5000 },
      ],
    });
  });

  it('tolerates a non-object callable inside a nested entry (defensive)', () => {
    const nested = { Stop: [{ matcher: '*', hooks: [null] }] };
    expect(normalizeHooksRecord(nested)).toEqual({ Stop: [{ matcher: '*' }] });
  });

  it('returns a non-object entry verbatim (defensive)', () => {
    const weird = { Stop: [null as unknown as Record<string, unknown>] };
    expect(normalizeHooksRecord(weird)).toEqual({ Stop: [null] });
  });

  it('leaves a non-array event value untouched (defensive)', () => {
    const weird = { Stop: 'oops' as unknown as unknown[] };
    expect(normalizeHooksRecord(weird)).toEqual({ Stop: 'oops' });
  });
});
