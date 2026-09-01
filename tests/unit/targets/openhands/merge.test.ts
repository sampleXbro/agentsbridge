import { describe, it, expect } from 'vitest';
import type { GenerateResult } from '../../../../src/core/types.js';
import { mergeOpenhandsOutput } from '../../../../src/targets/openhands/merge.js';
import {
  OPENHANDS_HOOKS_FILE,
  OPENHANDS_MCP_FILE,
} from '../../../../src/targets/openhands/constants.js';

function pending(content: string): GenerateResult {
  return { target: 'openhands', path: OPENHANDS_HOOKS_FILE, content, status: 'updated' };
}

const generated = JSON.stringify(
  { post_tool_use: [{ matcher: 'write', hooks: [{ type: 'command', command: 'fmt.sh' }] }] },
  null,
  2,
);

describe('mergeOpenhandsOutput (hooks)', () => {
  it('carries over an agent handler canonical cannot represent', () => {
    const existing = JSON.stringify({
      post_tool_use: [
        { matcher: 'write', hooks: [{ command: 'fmt.sh' }] },
        {
          matcher: '*',
          hooks: [{ type: 'agent', system_prompt: 'Check the diff', tools: ['read'] }],
        },
      ],
    });
    const merged = JSON.parse(
      mergeOpenhandsOutput(existing, undefined, generated, OPENHANDS_HOOKS_FILE)!,
    );
    expect(merged).toEqual({
      post_tool_use: [
        { matcher: 'write', hooks: [{ type: 'command', command: 'fmt.sh' }] },
        {
          matcher: '*',
          hooks: [{ type: 'agent', system_prompt: 'Check the diff', tools: ['read'] }],
        },
      ],
    });
  });

  it('keeps an event that only exists on disk as agent handlers', () => {
    const existing = JSON.stringify({
      stop: [{ matcher: '*', hooks: [{ type: 'agent', system_prompt: 'Summarise' }] }],
    });
    const merged = JSON.parse(
      mergeOpenhandsOutput(existing, undefined, generated, OPENHANDS_HOOKS_FILE)!,
    );
    expect(Object.keys(merged)).toEqual(['post_tool_use', 'stop']);
    expect(merged.stop).toEqual([
      { matcher: '*', hooks: [{ type: 'agent', system_prompt: 'Summarise' }] },
    ]);
  });

  it('carries over handler keys canonical has no home for', () => {
    const existing = JSON.stringify({
      post_tool_use: [
        {
          matcher: 'write',
          hooks: [{ command: 'fmt.sh', name: 'formatter', async: true, max_iterations: 2 }],
        },
      ],
    });
    const merged = JSON.parse(
      mergeOpenhandsOutput(existing, undefined, generated, OPENHANDS_HOOKS_FILE)!,
    );
    expect(merged.post_tool_use[0].hooks[0]).toEqual({
      type: 'command',
      command: 'fmt.sh',
      name: 'formatter',
      async: true,
      max_iterations: 2,
    });
  });

  it('reads the documented wrapper and PascalCase shapes and rewrites them normalised', () => {
    const existing = JSON.stringify({
      hooks: {
        PostToolUse: [{ matcher: 'write', hooks: [{ command: 'fmt.sh', name: 'formatter' }] }],
        SessionEnd: [{ matcher: '*', hooks: [{ type: 'agent', system_prompt: 'Wrap up' }] }],
      },
    });
    const merged = JSON.parse(
      mergeOpenhandsOutput(existing, undefined, generated, OPENHANDS_HOOKS_FILE)!,
    );
    expect(Object.keys(merged)).toEqual(['post_tool_use', 'session_end']);
    expect(merged.post_tool_use[0].hooks[0].name).toBe('formatter');
  });

  it('still revokes a command handler that canonical no longer has', () => {
    const existing = JSON.stringify({
      post_tool_use: [
        { matcher: 'write', hooks: [{ command: 'fmt.sh' }] },
        { matcher: '*', hooks: [{ command: 'stale.sh' }] },
      ],
      stop: [{ matcher: '*', hooks: [{ command: 'gone.sh' }] }],
    });
    const merged = JSON.parse(
      mergeOpenhandsOutput(existing, undefined, generated, OPENHANDS_HOOKS_FILE)!,
    );
    expect(merged).toEqual({
      post_tool_use: [{ matcher: 'write', hooks: [{ type: 'command', command: 'fmt.sh' }] }],
    });
  });

  it('merges onto the pending content of this run, not the file on disk', () => {
    const merged = JSON.parse(
      mergeOpenhandsOutput(
        JSON.stringify({ stop: [{ matcher: '*', hooks: [{ type: 'agent', prompt: 'disk' }] }] }),
        pending(
          JSON.stringify({
            session_end: [{ matcher: '*', hooks: [{ type: 'agent', system_prompt: 'pending' }] }],
          }),
        ),
        generated,
        OPENHANDS_HOOKS_FILE,
      )!,
    );
    expect(Object.keys(merged)).toEqual(['post_tool_use', 'session_end']);
  });

  it('carries over the keys of a prompt handler too', () => {
    const existing = JSON.stringify({
      stop: [{ matcher: '*', hooks: [{ type: 'prompt', prompt: 'Tests?', name: 'test-gate' }] }],
    });
    const next = JSON.stringify({
      stop: [{ matcher: '*', hooks: [{ type: 'prompt', prompt: 'Tests?' }] }],
    });
    const merged = JSON.parse(
      mergeOpenhandsOutput(existing, undefined, next, OPENHANDS_HOOKS_FILE)!,
    );
    expect(merged.stop[0].hooks[0]).toEqual({
      type: 'prompt',
      prompt: 'Tests?',
      name: 'test-gate',
    });
  });

  it('keeps the carried handlers even when the generated document is unreadable', () => {
    const existing = JSON.stringify({
      stop: [{ matcher: '*', hooks: [{ type: 'agent', system_prompt: 'Audit' }] }],
    });
    expect(
      JSON.parse(mergeOpenhandsOutput(existing, undefined, 'not json', OPENHANDS_HOOKS_FILE)!),
    ).toEqual({
      stop: [{ matcher: '*', hooks: [{ type: 'agent', system_prompt: 'Audit' }] }],
    });
  });

  it('writes the generated document when nothing usable is on disk', () => {
    expect(mergeOpenhandsOutput(null, undefined, generated, OPENHANDS_HOOKS_FILE)).toBe(generated);
    expect(mergeOpenhandsOutput('{ broken', undefined, generated, OPENHANDS_HOOKS_FILE)).toBe(
      generated,
    );
    expect(mergeOpenhandsOutput('[]', undefined, generated, OPENHANDS_HOOKS_FILE)).toBe(generated);
  });

  it('ignores malformed groups and handlers on disk', () => {
    const existing = JSON.stringify({
      post_tool_use: ['nope', { matcher: 'write', hooks: 'nope' }, { hooks: ['nope', 7] }],
    });
    expect(
      JSON.parse(mergeOpenhandsOutput(existing, undefined, generated, OPENHANDS_HOOKS_FILE)!),
    ).toEqual(JSON.parse(generated));
  });
});

describe('mergeOpenhandsOutput (other paths)', () => {
  it('delegates the shared plugin .mcp.json to goose, preserving cwd', () => {
    const merged = JSON.parse(
      mergeOpenhandsOutput(
        JSON.stringify({ mcpServers: { docs: { command: 'npx', cwd: '/srv' } } }),
        undefined,
        JSON.stringify({ mcpServers: { docs: { command: 'npx', args: [] } } }),
        OPENHANDS_MCP_FILE,
      )!,
    );
    expect(merged.mcpServers.docs.cwd).toBe('/srv');
  });

  it('leaves every other generated output to the default writer', () => {
    expect(mergeOpenhandsOutput('a', undefined, 'b', 'AGENTS.md')).toBeNull();
  });
});
