/**
 * `.roomodes` is Roo Code's PROJECT custom-modes store — Roo writes it itself
 * whenever the user creates a mode at Project scope, exactly as it writes
 * `~/.roo/settings/custom_modes.yaml` at Global scope.
 *
 * `generateAgents` emits the whole file from canonical, and the merger claimed
 * only the global twin, so every user-authored project mode was replaced and
 * surviving modes lost `whenToUse`, `customInstructions`, `iconName` and the
 * tuple group form. The file was also on the stale-cleanup delete list.
 */
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  ROO_MODE_MARKER,
  mergeRooCustomModesYaml,
} from '../../../../src/targets/roo-code/modes-merge.js';
import {
  ROO_CODE_MODES_FILE,
  ROO_CODE_GLOBAL_MODES_FILE,
} from '../../../../src/targets/roo-code/constants.js';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';

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

describe('mergeRooCustomModesYaml claims the project modes file', () => {
  it('claims .roomodes as well as the global custom_modes.yaml', () => {
    expect(mergeRooCustomModesYaml(null, undefined, GENERATED, ROO_CODE_MODES_FILE)).not.toBeNull();
    expect(
      mergeRooCustomModesYaml(null, undefined, GENERATED, ROO_CODE_GLOBAL_MODES_FILE),
    ).not.toBeNull();
  });

  it('returns null for any other path', () => {
    expect(mergeRooCustomModesYaml(null, undefined, GENERATED, '.roo/mcp.json')).toBeNull();
  });

  it('keeps a mode the user authored in .roomodes', () => {
    const base = [
      'customModes:',
      '  - slug: my-mode',
      '    name: Mine',
      '    roleDefinition: Hand written.',
      '    groups:',
      '      - read',
      '',
    ].join('\n');

    const merged = mergeRooCustomModesYaml(base, undefined, GENERATED, ROO_CODE_MODES_FILE);

    expect(modes(merged as string).map((m) => m.slug)).toEqual(['my-mode', 'reviewer']);
    expect(merged).toContain(`#${ROO_MODE_MARKER}`);
  });

  it('carries over per-mode fields canonical cannot express', () => {
    const base = [
      'customModes:',
      `  #${ROO_MODE_MARKER}`,
      '  - slug: reviewer',
      '    name: reviewer',
      '    roleDefinition: Stale.',
      '    whenToUse: Use for reviews.',
      '    customInstructions: Be terse.',
      '    iconName: eye',
      '    groups:',
      '      - read',
      '',
    ].join('\n');

    const merged = mergeRooCustomModesYaml(base, undefined, GENERATED, ROO_CODE_MODES_FILE);
    const [reviewer] = modes(merged as string);

    expect(reviewer!.whenToUse).toBe('Use for reviews.');
    expect(reviewer!.customInstructions).toBe('Be terse.');
    expect(reviewer!.iconName).toBe('eye');
    // Canonical still wins for the fields it does own.
    expect(reviewer!.roleDefinition).toBe('You review code.');
  });

  it('revokes a marked mode whose canonical agent is gone', () => {
    // The base is what a previous run wrote, so the ownership markers are the
    // emitter's own rather than hand-written ones.
    const previous = mergeRooCustomModesYaml(
      null,
      undefined,
      [
        'customModes:',
        '  - slug: reviewer',
        '    name: reviewer',
        '  - slug: deleted-agent',
        '    name: deleted-agent',
        '',
      ].join('\n'),
      ROO_CODE_MODES_FILE,
    );

    const merged = mergeRooCustomModesYaml(
      previous as string,
      undefined,
      GENERATED,
      ROO_CODE_MODES_FILE,
    );
    expect(modes(merged as string).map((m) => m.slug)).toEqual(['reviewer']);
  });

  it('reaches the merger through the descriptor hook', () => {
    const descriptor = getBuiltinTargetDefinition('roo-code');
    const merged = descriptor?.mergeGeneratedOutputContent?.(
      'customModes:\n  - slug: mine\n    name: Mine\n',
      undefined,
      GENERATED,
      ROO_CODE_MODES_FILE,
    );
    expect(modes(merged as string).map((m) => m.slug)).toEqual(['mine', 'reviewer']);
  });
});

describe('.roomodes is co-owned, not a delete-list entry', () => {
  it('is declared in coOwnedFiles and absent from files', () => {
    const managed = getBuiltinTargetDefinition('roo-code')?.project.managedOutputs;
    expect(managed?.coOwnedFiles).toContain(ROO_CODE_MODES_FILE);
    expect(managed?.files).not.toContain(ROO_CODE_MODES_FILE);
  });
});
