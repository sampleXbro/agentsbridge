import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  ROO_MODE_MARKER,
  mergeRooCustomModes,
  mergeRooCustomModesYaml,
} from '../../../../src/targets/roo-code/modes-merge.js';
import { ROO_CODE_GLOBAL_MODES_FILE } from '../../../../src/targets/roo-code/constants.js';

const GENERATED = [
  'customModes:',
  '  - slug: reviewer',
  '    name: reviewer',
  '    roleDefinition: You review code.',
  '    groups:',
  '      - read',
  '',
].join('\n');

function modes(content: string): Array<Record<string, unknown>> {
  return (parseYaml(content) as { customModes: Array<Record<string, unknown>> }).customModes;
}

describe('mergeRooCustomModes', () => {
  it('marks every mode it writes even when the file does not exist yet', () => {
    const merged = mergeRooCustomModes(null, GENERATED);
    expect(merged).toContain(`#${ROO_MODE_MARKER}`);
    expect(modes(merged).map((m) => m.slug)).toEqual(['reviewer']);
  });

  it('keeps user modes and carries over fields agentsmesh does not write', () => {
    const base = [
      'customModes:',
      '  - slug: my-mode',
      '    name: Mine',
      '    roleDefinition: Do my thing',
      '    groups:',
      '      - read',
      '  - slug: reviewer',
      '    name: Old',
      '    roleDefinition: stale',
      '    whenToUse: When reviewing',
      '    iconName: eye',
      '    groups:',
      '      - read',
      '',
    ].join('\n');

    const merged = modes(mergeRooCustomModes(base, GENERATED));
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual({
      slug: 'my-mode',
      name: 'Mine',
      roleDefinition: 'Do my thing',
      groups: ['read'],
    });
    expect(merged[1]).toEqual({
      slug: 'reviewer',
      name: 'reviewer',
      roleDefinition: 'You review code.',
      whenToUse: 'When reviewing',
      iconName: 'eye',
      groups: ['read'],
    });
  });

  it('drops a marked mode whose canonical agent is gone', () => {
    const previous = mergeRooCustomModes(
      null,
      [
        'customModes:',
        '  - slug: reviewer',
        '    name: reviewer',
        '  - slug: tester',
        '    name: tester',
        '',
      ].join('\n'),
    );
    expect(modes(mergeRooCustomModes(previous, GENERATED)).map((m) => m.slug)).toEqual([
      'reviewer',
    ]);
  });

  // On re-parse, YAML reattaches the comment above the FIRST sequence item to
  // the sequence node itself, so the first generated mode used to come back
  // unmarked and was never revoked — it silently became "the user's" forever.
  it('drops the FIRST marked mode too when its canonical agent is gone', () => {
    const previous = mergeRooCustomModes(
      null,
      [
        'customModes:',
        '  - slug: beta',
        '    name: beta',
        '  - slug: gamma',
        '    name: gamma',
        '',
      ].join('\n'),
    );
    const merged = mergeRooCustomModes(
      previous,
      ['customModes:', '  - slug: gamma', '    name: gamma', ''].join('\n'),
    );
    expect(modes(merged).map((m) => m.slug)).toEqual(['gamma']);
  });

  it('returns the base verbatim when the generated content is not a modes document', () => {
    expect(mergeRooCustomModes('customModes: []\n', 'just a string\n')).toBe('customModes: []\n');
    expect(mergeRooCustomModes('customModes: []\n', 'a: [unclosed\n')).toBe('customModes: []\n');
  });

  it('returns the generated content when there is no base and nothing to parse', () => {
    expect(mergeRooCustomModes(null, 'just a string\n')).toBe('just a string\n');
  });

  it('keeps a malformed list entry rather than dropping what it cannot read', () => {
    const merged = mergeRooCustomModes('customModes:\n  - just-a-string\n', GENERATED);
    expect(parseYaml(merged)).toEqual({
      customModes: [
        'just-a-string',
        {
          slug: 'reviewer',
          name: 'reviewer',
          roleDefinition: 'You review code.',
          groups: ['read'],
        },
      ],
    });
  });

  it('replaces a customModes key that is not a list', () => {
    expect(parseYaml(mergeRooCustomModes('customModes: nonsense\n', GENERATED))).toEqual({
      customModes: [
        {
          slug: 'reviewer',
          name: 'reviewer',
          roleDefinition: 'You review code.',
          groups: ['read'],
        },
      ],
    });
  });

  it('returns a base that is not a YAML mapping verbatim', () => {
    expect(mergeRooCustomModes('- a\n- b\n', GENERATED)).toBe('- a\n- b\n');
    expect(mergeRooCustomModes('customModes: [unclosed\n', GENERATED)).toBe(
      'customModes: [unclosed\n',
    );
  });

  it('keeps other top-level keys of the file', () => {
    const merged = mergeRooCustomModes('someOtherKey: 1\n', GENERATED);
    expect(parseYaml(merged)).toEqual({
      someOtherKey: 1,
      customModes: [
        {
          slug: 'reviewer',
          name: 'reviewer',
          roleDefinition: 'You review code.',
          groups: ['read'],
        },
      ],
    });
  });
});

describe('mergeRooCustomModesYaml', () => {
  // `.roomodes` is owned too — it is the project twin of this file. See
  // tests/unit/targets/roo-code/project-modes-merge.test.ts.
  it('declines a path it does not own', () => {
    expect(mergeRooCustomModesYaml(null, undefined, GENERATED, '.roo/mcp.json')).toBeNull();
  });

  it('prefers a pending result over the on-disk file as merge base', () => {
    const pending = { content: 'someOtherKey: from-pending\n' };
    const merged = mergeRooCustomModesYaml(
      'someOtherKey: from-disk\n',
      pending,
      GENERATED,
      ROO_CODE_GLOBAL_MODES_FILE,
    );
    expect((parseYaml(merged!) as Record<string, unknown>).someOtherKey).toBe('from-pending');
  });
});
