import { describe, expect, it } from 'vitest';
import {
  mergeDeepagentsHooks,
  mergeDeepagentsHooksJson,
} from '../../../../src/targets/deepagents-cli/hooks-merge.js';
import { DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE } from '../../../../src/targets/deepagents-cli/constants.js';

const GENERATED = JSON.stringify({
  hooks: [{ command: ['bash', '-c', 'echo hi'], events: ['session.start'] }],
});

describe('mergeDeepagentsHooks', () => {
  it('returns the generated content when there is no parsable base', () => {
    expect(mergeDeepagentsHooks(null, GENERATED)).toBe(GENERATED);
    expect(mergeDeepagentsHooks('[]', GENERATED)).toBe(GENERATED);
    expect(mergeDeepagentsHooks('not json', GENERATED)).toBe(GENERATED);
  });

  it('returns the base untouched when the generated content is not an object', () => {
    expect(mergeDeepagentsHooks('{"hooks":[]}', '[]')).toBe('{"hooks":[]}');
  });

  it('keeps entries on events agentsmesh does not map, and every other key', () => {
    const base = JSON.stringify({
      version: 2,
      hooks: [
        { command: ['notify'], events: ['tool.error'] },
        { command: ['gate'], events: ['permission.request'] },
        { command: ['bash', '-c', 'old'], events: ['session.start'] },
      ],
    });
    expect(mergeDeepagentsHooks(base, GENERATED)).toBe(
      JSON.stringify(
        {
          version: 2,
          hooks: [
            { command: ['notify'], events: ['tool.error'] },
            { command: ['gate'], events: ['permission.request'] },
            { command: ['bash', '-c', 'echo hi'], events: ['session.start'] },
          ],
        },
        null,
        2,
      ),
    );
  });

  it('keeps an entry that also binds an unmapped event, and one with no events', () => {
    const base = JSON.stringify({
      hooks: [
        { command: ['both'], events: ['session.start', 'tool.error'] },
        { command: ['all'], events: [] },
        { command: ['shapeless'] },
      ],
    });
    const merged = JSON.parse(mergeDeepagentsHooks(base, GENERATED)) as {
      hooks: Array<Record<string, unknown>>;
    };
    expect(merged.hooks.map((h) => h.command)).toEqual([
      ['both'],
      ['all'],
      ['shapeless'],
      ['bash', '-c', 'echo hi'],
    ]);
  });

  it('drops every managed entry when canonical hooks emit none', () => {
    const base = JSON.stringify({
      hooks: [{ command: ['bash', '-c', 'old'], events: ['session.end'] }],
    });
    expect(mergeDeepagentsHooks(base, '{"hooks":[]}')).toBe(JSON.stringify({ hooks: [] }, null, 2));
  });

  it('treats a base without a hooks array as having no entries to keep', () => {
    expect(mergeDeepagentsHooks('{"version":1}', GENERATED)).toBe(
      JSON.stringify(
        { version: 1, hooks: [{ command: ['bash', '-c', 'echo hi'], events: ['session.start'] }] },
        null,
        2,
      ),
    );
  });
});

describe('mergeDeepagentsHooksJson', () => {
  it('declines a path it does not own', () => {
    expect(mergeDeepagentsHooksJson('{}', undefined, GENERATED, '.mcp.json')).toBeNull();
  });

  it('prefers a pending result over the on-disk file as merge base', () => {
    const pending = { content: JSON.stringify({ version: 9, hooks: [] }) };
    expect(
      mergeDeepagentsHooksJson(
        '{"version":1}',
        pending,
        GENERATED,
        DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE,
      ),
    ).toBe(
      JSON.stringify(
        { version: 9, hooks: [{ command: ['bash', '-c', 'echo hi'], events: ['session.start'] }] },
        null,
        2,
      ),
    );
  });
});
