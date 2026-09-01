import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ImportResult } from '../../../../src/core/types.js';
import { importKimiCodeConfig } from '../../../../src/targets/kimi-code/config-import.js';
import { KIMI_CODE_GLOBAL_CONFIG_FILE } from '../../../../src/targets/kimi-code/constants.js';

let dir = '';

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

function home(files: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), 'kimi-cfgimport-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

async function importConfig(root: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  await importKimiCodeConfig(root, results);
  return results;
}

describe('importKimiCodeConfig', () => {
  it('does nothing when there is no config file', async () => {
    expect(await importConfig(home({}))).toEqual([]);
  });

  it('skips hook entries missing an event or command, and unknown events', async () => {
    const root = home({
      [KIMI_CODE_GLOBAL_CONFIG_FILE]: `[[hooks]]
command = "no-event"

[[hooks]]
event = "PostToolUse"

[[hooks]]
event = "PreCommit"
command = "lint"

[[hooks]]
event = "Stop"
command = "notify"
`,
    });

    expect((await importConfig(root)).map((r) => r.feature)).toEqual(['hooks']);
    expect(parseYaml(readFileSync(join(root, '.agentsmesh/hooks.yaml'), 'utf-8'))).toEqual({
      Stop: [{ matcher: '', command: 'notify' }],
    });
  });

  it('writes no hooks file when every entry is unusable', async () => {
    const root = home({
      [KIMI_CODE_GLOBAL_CONFIG_FILE]: '[[hooks]]\nevent = "PreCommit"\ncommand = "lint"\n',
    });
    expect(await importConfig(root)).toEqual([]);
  });

  it('keeps canonical hook entries Kimi Code cannot express', async () => {
    const root = home({
      [KIMI_CODE_GLOBAL_CONFIG_FILE]: '[[hooks]]\nevent = "Stop"\ncommand = "notify"\n',
      '.agentsmesh/hooks.yaml': `PreCommit:
  - matcher: ''
    command: lint
Stop:
  - matcher: ''
    type: prompt
    prompt: summarize the session
`,
    });

    await importConfig(root);

    expect(parseYaml(readFileSync(join(root, '.agentsmesh/hooks.yaml'), 'utf-8'))).toEqual({
      PreCommit: [{ matcher: '', command: 'lint' }],
      Stop: [
        { matcher: '', command: 'notify' },
        { matcher: '', type: 'prompt', prompt: 'summarize the session' },
      ],
    });
  });

  it('keeps the canonical spelling of a hook Kimi Code round-tripped unchanged', async () => {
    const root = home({
      [KIMI_CODE_GLOBAL_CONFIG_FILE]:
        '[[hooks]]\nevent = "PostToolUse"\nmatcher = "Write"\ncommand = "fmt"\n',
      '.agentsmesh/hooks.yaml':
        'PostToolUse:\n  - matcher: Write\n    type: command\n    command: fmt\n',
    });

    await importConfig(root);

    expect(parseYaml(readFileSync(join(root, '.agentsmesh/hooks.yaml'), 'utf-8'))).toEqual({
      PostToolUse: [{ matcher: 'Write', type: 'command', command: 'fmt' }],
    });
  });

  it('drops a supported-event hook the user removed from config.toml', async () => {
    const root = home({
      [KIMI_CODE_GLOBAL_CONFIG_FILE]: '[[hooks]]\nevent = "Stop"\ncommand = "notify"\n',
      '.agentsmesh/hooks.yaml': 'PostToolUse:\n  - matcher: Write\n    command: fmt\n',
    });

    await importConfig(root);

    expect(parseYaml(readFileSync(join(root, '.agentsmesh/hooks.yaml'), 'utf-8'))).toEqual({
      Stop: [{ matcher: '', command: 'notify' }],
    });
  });

  it('ignores a canonical hooks file it cannot parse', async () => {
    const root = home({
      [KIMI_CODE_GLOBAL_CONFIG_FILE]: '[[hooks]]\nevent = "Stop"\ncommand = "notify"\n',
      '.agentsmesh/hooks.yaml': 'PreCommit: [oops\n',
    });
    await importConfig(root);
    expect(parseYaml(readFileSync(join(root, '.agentsmesh/hooks.yaml'), 'utf-8'))).toEqual({
      Stop: [{ matcher: '', command: 'notify' }],
    });
  });

  it('skips permission rules with an unknown decision or no pattern', async () => {
    const root = home({
      [KIMI_CODE_GLOBAL_CONFIG_FILE]: `[[permission.rules]]
decision = "maybe"
pattern = "Read"

[[permission.rules]]
decision = "allow"

[[permission.rules]]
decision = "ask"
pattern = "Bash"
`,
    });

    expect((await importConfig(root)).map((r) => r.feature)).toEqual(['permissions']);
    expect(parseYaml(readFileSync(join(root, '.agentsmesh/permissions.yaml'), 'utf-8'))).toEqual({
      ask: ['Bash'],
    });
  });

  it('starts a fresh canonical document when the existing one is not a map', async () => {
    const root = home({
      [KIMI_CODE_GLOBAL_CONFIG_FILE]: '[[permission.rules]]\ndecision = "deny"\npattern = "Bash"\n',
      '.agentsmesh/permissions.yaml': '- not\n- a\n- map\n',
    });
    await importConfig(root);
    expect(parseYaml(readFileSync(join(root, '.agentsmesh/permissions.yaml'), 'utf-8'))).toEqual({
      deny: ['Bash'],
    });
  });

  it('fills an empty canonical permissions file', async () => {
    const root = home({
      [KIMI_CODE_GLOBAL_CONFIG_FILE]:
        '[[permission.rules]]\ndecision = "allow"\npattern = "Read"\n',
      '.agentsmesh/permissions.yaml': '',
    });
    await importConfig(root);
    expect(parseYaml(readFileSync(join(root, '.agentsmesh/permissions.yaml'), 'utf-8'))).toEqual({
      allow: ['Read'],
    });
  });

  it('keeps the comments and unrelated keys of the canonical permissions file', async () => {
    const root = home({
      [KIMI_CODE_GLOBAL_CONFIG_FILE]:
        '[[permission.rules]]\ndecision = "allow"\npattern = "Read"\n',
      '.agentsmesh/permissions.yaml': '# curated by hand\nallow: [Grep]\ndeny: [WebFetch]\n',
    });
    await importConfig(root);
    const written = readFileSync(join(root, '.agentsmesh/permissions.yaml'), 'utf-8');
    expect(written).toContain('# curated by hand');
    expect(parseYaml(written)).toEqual({ allow: ['Read'], deny: ['WebFetch'] });
  });
});
