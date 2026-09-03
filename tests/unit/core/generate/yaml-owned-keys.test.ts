import { describe, expect, it } from 'vitest';
import {
  mergeOwnedYamlKeys,
  ownedYamlKeysMerger,
} from '../../../../src/core/generate/yaml-owned-keys.js';

const GENERATED = 'rules:\n  - name: r\nname: agentsmesh\n';

describe('mergeOwnedYamlKeys', () => {
  it('returns null when there is no base, so the caller writes the generated file', () => {
    expect(mergeOwnedYamlKeys(null, GENERATED, ['rules'])).toBeNull();
    expect(mergeOwnedYamlKeys('   \n', GENERATED, ['rules'])).toBeNull();
  });

  it('returns null when the generated content is not a mapping', () => {
    expect(mergeOwnedYamlKeys('name: mine\n', '- a\n- b\n', ['rules'])).toBeNull();
  });

  it('replaces owned keys and keeps every other key, comment and ordering', () => {
    const base = [
      '# my config',
      'name: My Assistant',
      'models:',
      '  - name: gpt',
      'rules: []',
      '',
    ].join('\n');
    const merged = mergeOwnedYamlKeys(base, GENERATED, ['rules']);
    expect(merged).toBe(
      [
        '# my config',
        'name: My Assistant',
        'models:',
        '  - name: gpt',
        'rules:',
        '  - name: r',
        '',
      ].join('\n'),
    );
  });

  it('leaves a key the generated content omits alone', () => {
    const merged = mergeOwnedYamlKeys('ask:\n  - Write(*)\n', 'allow:\n  - Read\n', [
      'allow',
      'ask',
    ]);
    expect(merged).toBe('ask:\n  - Write(*)\nallow:\n  - Read\n');
  });

  it('returns a non-mapping base verbatim rather than rewriting it', () => {
    expect(mergeOwnedYamlKeys('- just\n- a list\n', GENERATED, ['rules'])).toBe(
      '- just\n- a list\n',
    );
  });

  it('returns an unparsable base verbatim, so one syntax error costs nothing', () => {
    const broken = 'name: [unclosed\n';
    expect(mergeOwnedYamlKeys(broken, GENERATED, ['rules'])).toBe(broken);
  });
});

describe('ownedYamlKeysMerger', () => {
  it('declines a path it does not own', () => {
    const merge = ownedYamlKeysMerger(['a.yaml'], ['rules']);
    expect(merge('name: mine\n', undefined, GENERATED, 'b.yaml')).toBeNull();
  });

  it('prefers a pending result over the on-disk file as merge base', () => {
    const merge = ownedYamlKeysMerger(['a.yaml'], ['rules']);
    const pending = { content: 'name: from-pending\nrules: []\n' };
    expect(merge('name: from-disk\n', pending, GENERATED, 'a.yaml')).toBe(
      'name: from-pending\nrules:\n  - name: r\n',
    );
  });
});
