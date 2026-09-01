import { describe, it, expect } from 'vitest';
import {
  mergeCanonicalHooks,
  serializeCanonicalHooks,
  toCanonicalHooks,
  type CanonicalHookMap,
} from '../../../../src/targets/kimi-code/hooks-import.js';

const imported: CanonicalHookMap = { Stop: [{ matcher: '', command: 'notify' }] };

describe('toCanonicalHooks', () => {
  it('defaults a missing matcher and keeps an integer timeout', () => {
    expect(toCanonicalHooks([{ event: 'Stop', command: 'notify', timeout: 30 }])).toEqual({
      Stop: [{ matcher: '', command: 'notify', timeout: 30 }],
    });
  });

  it('drops a non-numeric timeout rather than guessing', () => {
    expect(toCanonicalHooks([{ event: 'Stop', command: 'notify', timeout: '30' }])).toEqual({
      Stop: [{ matcher: '', command: 'notify' }],
    });
  });
});

describe('mergeCanonicalHooks', () => {
  it('takes the imported hooks when there is no canonical file', () => {
    expect(mergeCanonicalHooks(null, imported)).toEqual(imported);
  });

  it('ignores a canonical document that is not a map', () => {
    expect(mergeCanonicalHooks('- one\n- two\n', imported)).toEqual(imported);
  });

  it('ignores a canonical event whose value is not a list', () => {
    expect(mergeCanonicalHooks('PreCommit: run-lint\n', imported)).toEqual(imported);
  });

  it('drops an unsupported event whose list is empty', () => {
    expect(mergeCanonicalHooks('PreCommit: []\n', imported)).toEqual(imported);
  });

  it('drops a supported event that Kimi Code no longer carries', () => {
    expect(mergeCanonicalHooks('Stop:\n  - matcher: x\n    command: old\n', {})).toEqual({});
  });

  it('takes a hand-edited timeout from config.toml over the canonical one', () => {
    const merged = mergeCanonicalHooks(
      'PreToolUse:\n  - matcher: Bash\n    command: echo x\n    timeout: 12\n',
      { PreToolUse: [{ matcher: 'Bash', command: 'echo x', timeout: 60 }] },
    );
    expect(merged).toEqual({ PreToolUse: [{ matcher: 'Bash', command: 'echo x', timeout: 60 }] });
  });

  it('drops an expressible timeout the user deleted from config.toml', () => {
    const merged = mergeCanonicalHooks(
      'PreToolUse:\n  - matcher: Bash\n    command: echo x\n    timeout: 12\n',
      { PreToolUse: [{ matcher: 'Bash', command: 'echo x' }] },
    );
    expect(merged).toEqual({ PreToolUse: [{ matcher: 'Bash', command: 'echo x' }] });
  });

  it('keeps a canonical timeout Kimi Code could never have written', () => {
    const merged = mergeCanonicalHooks(
      'PreToolUse:\n  - matcher: Bash\n    command: echo x\n    timeout: 900\n',
      { PreToolUse: [{ matcher: 'Bash', command: 'echo x' }] },
    );
    expect(merged).toEqual({ PreToolUse: [{ matcher: 'Bash', command: 'echo x', timeout: 900 }] });
  });

  it('keeps canonical keys Kimi Code has no field for', () => {
    const merged = mergeCanonicalHooks(
      'Stop:\n  - matcher: ""\n    command: notify\n    background: true\n',
      imported,
    );
    expect(merged).toEqual({ Stop: [{ matcher: '', command: 'notify', background: true }] });
  });

  it('keeps unsupported events untouched alongside the imported ones', () => {
    const merged = mergeCanonicalHooks(
      'PreCommit:\n  - matcher: ""\n    command: lint\n',
      imported,
    );
    expect(merged).toEqual({
      PreCommit: [{ matcher: '', command: 'lint' }],
      Stop: [{ matcher: '', command: 'notify' }],
    });
  });
});

describe('serializeCanonicalHooks', () => {
  it('writes YAML with a single trailing newline', () => {
    expect(serializeCanonicalHooks(imported)).toBe('Stop:\n  - matcher: ""\n    command: notify\n');
  });
});
