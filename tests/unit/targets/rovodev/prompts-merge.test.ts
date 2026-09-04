/**
 * `.rovodev/prompts.yml` is the saved-prompt manifest the USER hand-authors —
 * `src/targets/rovodev/importer.ts:39` reads it back, which is the proof the
 * file exists independently of agentsmesh.
 *
 * It was replaced wholesale from canonical and delete-listed at both scopes, so
 * every prompt the user saved was lost on the first generate and the whole file
 * disappeared when `commands` stopped emitting.
 */
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  ROVODEV_PROMPT_MARKER,
  mergeRovodevPromptsYaml,
} from '../../../../src/targets/rovodev/prompts-merge.js';
import {
  ROVODEV_PROMPTS_FILE,
  ROVODEV_GLOBAL_PROMPTS_FILE,
} from '../../../../src/targets/rovodev/constants.js';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';

const GENERATED = [
  'prompts:',
  '  - name: review',
  '    description: Review code',
  '    content_file: commands/review.md',
  '',
].join('\n');

function prompts(content: string): Array<Record<string, unknown>> {
  return (parseYaml(content) as { prompts: Array<Record<string, unknown>> }).prompts;
}

describe('mergeRovodevPromptsYaml', () => {
  it('claims both the project and global manifest', () => {
    expect(
      mergeRovodevPromptsYaml(null, undefined, GENERATED, ROVODEV_PROMPTS_FILE),
    ).not.toBeNull();
    expect(
      mergeRovodevPromptsYaml(null, undefined, GENERATED, ROVODEV_GLOBAL_PROMPTS_FILE),
    ).not.toBeNull();
    expect(mergeRovodevPromptsYaml(null, undefined, GENERATED, '.rovodev/config.yml')).toBeNull();
  });

  it('keeps a prompt the user saved through Rovo Dev', () => {
    const base = [
      'prompts:',
      '  - name: my-prompt',
      '    description: Mine',
      '    content_file: commands/mine.md',
      '',
    ].join('\n');

    const merged = mergeRovodevPromptsYaml(base, undefined, GENERATED, ROVODEV_PROMPTS_FILE);

    expect(prompts(merged as string).map((p) => p.name)).toEqual(['my-prompt', 'review']);
    expect(merged).toContain(`#${ROVODEV_PROMPT_MARKER}`);
  });

  it('revokes a generated prompt whose canonical command is gone, including the first', () => {
    const previous = mergeRovodevPromptsYaml(
      null,
      undefined,
      [
        'prompts:',
        '  - name: gone',
        '    description: Gone',
        '    content_file: commands/gone.md',
        '  - name: review',
        '    description: Review code',
        '    content_file: commands/review.md',
        '',
      ].join('\n'),
      ROVODEV_PROMPTS_FILE,
    );

    const merged = mergeRovodevPromptsYaml(
      previous as string,
      undefined,
      GENERATED,
      ROVODEV_PROMPTS_FILE,
    );
    expect(prompts(merged as string).map((p) => p.name)).toEqual(['review']);
  });

  it('reaches the merger through the descriptor hook', () => {
    const descriptor = getBuiltinTargetDefinition('rovodev');
    const merged = descriptor?.mergeGeneratedOutputContent?.(
      'prompts:\n  - name: mine\n    description: Mine\n    content_file: commands/mine.md\n',
      undefined,
      GENERATED,
      ROVODEV_PROMPTS_FILE,
    );
    expect(prompts(merged as string).map((p) => p.name)).toEqual(['mine', 'review']);
  });
});

describe('.rovodev/prompts.yml is co-owned at both scopes', () => {
  it.each([
    ['project', ROVODEV_PROMPTS_FILE],
    ['global', ROVODEV_GLOBAL_PROMPTS_FILE],
  ])('is in coOwnedFiles and absent from files (%s)', (scope, path) => {
    const descriptor = getBuiltinTargetDefinition('rovodev');
    const managed =
      scope === 'project'
        ? descriptor?.project.managedOutputs
        : descriptor?.globalSupport?.layout.managedOutputs;
    expect(managed?.coOwnedFiles).toContain(path);
    expect(managed?.files).not.toContain(path);
  });
});
