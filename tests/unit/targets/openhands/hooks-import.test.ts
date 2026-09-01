import { describe, it, expect } from 'vitest';
import { buildOpenhandsHooks } from '../../../../src/targets/openhands/hooks-format.js';
import { parseOpenhandsHooks } from '../../../../src/targets/openhands/hooks-import.js';

describe('parseOpenhandsHooks', () => {
  it('round-trips a generated document back to canonical event names', () => {
    const built = buildOpenhandsHooks({
      PostToolUse: [{ matcher: 'Write|Edit', command: 'prettier --write .' }],
    });
    expect(parseOpenhandsHooks(JSON.stringify(built))).toEqual({
      PostToolUse: [{ matcher: 'Write|Edit', command: 'prettier --write .', type: 'command' }],
    });
  });

  // DEFECT 1: HookDefinition.type defaults to HookType.COMMAND (hooks/config.py),
  // and every hooks.json example in the OpenHands docs omits it.
  it('treats a handler with no type as a command handler', () => {
    expect(
      parseOpenhandsHooks(
        JSON.stringify({
          pre_tool_use: [
            {
              matcher: 'execute_bash',
              hooks: [{ command: '.openhands/hooks/block_dangerous.sh', timeout: 10 }],
            },
          ],
        }),
      ),
    ).toEqual({
      PreToolUse: [
        {
          matcher: 'execute_bash',
          command: '.openhands/hooks/block_dangerous.sh',
          type: 'command',
          timeout: 10,
        },
      ],
    });
  });

  // DEFECT 2a: `_normalize_hooks_input` converts PascalCase keys to snake_case.
  it('accepts PascalCase event keys', () => {
    expect(
      parseOpenhandsHooks(
        JSON.stringify({ PreToolUse: [{ matcher: '*', hooks: [{ command: 'x.sh' }] }] }),
      ),
    ).toEqual({ PreToolUse: [{ matcher: '*', command: 'x.sh', type: 'command' }] });
  });

  // DEFECT 2b: `_normalize_hooks_input` unwraps the `{"hooks": {…}}` wrapper.
  it('unwraps the legacy hooks wrapper', () => {
    expect(
      parseOpenhandsHooks(
        JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ command: 'setup.sh' }] }] } }),
      ),
    ).toEqual({ SessionStart: [{ matcher: '*', command: 'setup.sh', type: 'command' }] });
  });

  it('ignores extra top-level keys alongside the legacy wrapper, as the SDK does', () => {
    expect(
      parseOpenhandsHooks(
        JSON.stringify({
          hooks: { Stop: [{ hooks: [{ command: 'bye.sh' }] }] },
          $schema: 'https://example.com/hooks.json',
        }),
      ),
    ).toEqual({ Stop: [{ matcher: '*', command: 'bye.sh', type: 'command' }] });
  });

  it('merges a duplicated event given in both casings instead of losing one', () => {
    expect(
      parseOpenhandsHooks(
        JSON.stringify({
          PreToolUse: [{ matcher: 'a', hooks: [{ command: 'a.sh' }] }],
          pre_tool_use: [{ matcher: 'b', hooks: [{ command: 'b.sh' }] }],
        }),
      ),
    ).toEqual({
      PreToolUse: [
        { matcher: 'a', command: 'a.sh', type: 'command' },
        { matcher: 'b', command: 'b.sh', type: 'command' },
      ],
    });
  });

  it('imports a prompt handler with its prompt text', () => {
    expect(
      parseOpenhandsHooks(
        JSON.stringify({
          stop: [{ matcher: '*', hooks: [{ type: 'prompt', prompt: 'Did you run the tests?' }] }],
        }),
      ),
    ).toEqual({
      Stop: [{ matcher: '*', command: '', type: 'prompt', prompt: 'Did you run the tests?' }],
    });
  });

  it('keeps a numeric timeout on the way back', () => {
    const parsed = parseOpenhandsHooks(
      JSON.stringify({
        pre_tool_use: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'x', timeout: 5 }] }],
      }),
    );
    expect(parsed).toEqual({
      PreToolUse: [{ matcher: 'Bash', command: 'x', type: 'command', timeout: 5 }],
    });
  });

  it('defaults a missing matcher to *', () => {
    const parsed = parseOpenhandsHooks(
      JSON.stringify({ stop: [{ hooks: [{ type: 'command', command: 'x' }] }] }),
    );
    expect(parsed).toEqual({ Stop: [{ matcher: '*', command: 'x', type: 'command' }] });
  });

  it('returns null for unparsable, non-object, and empty documents', () => {
    expect(parseOpenhandsHooks('not json')).toBeNull();
    expect(parseOpenhandsHooks('[]')).toBeNull();
    expect(parseOpenhandsHooks('null')).toBeNull();
    expect(parseOpenhandsHooks('{}')).toBeNull();
    expect(parseOpenhandsHooks(JSON.stringify({ hooks: 'not-an-object' }))).toBeNull();
  });

  it('ignores unknown event keys, agent handlers and malformed entries', () => {
    expect(
      parseOpenhandsHooks(
        JSON.stringify({
          unknown_event: [{ matcher: '*', hooks: [{ command: 'x' }] }],
          stop: [
            'not-an-object',
            { matcher: '*', hooks: 'not-an-array' },
            {
              matcher: '*',
              hooks: [
                'not-an-object',
                { type: 'agent', system_prompt: 'review it' },
                { type: 'prompt' },
                { type: 'command' },
                { command: 42 },
              ],
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('ignores a non-array event value', () => {
    expect(parseOpenhandsHooks(JSON.stringify({ stop: { matcher: '*' } }))).toBeNull();
  });
});
