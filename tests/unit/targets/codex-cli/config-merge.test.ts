import { describe, expect, it } from 'vitest';
import { parse as parseToml } from 'smol-toml';
import { mergeCodexConfigToml } from '../../../../src/targets/codex-cli/config-merge.js';
import type { GenerateResult } from '../../../../src/core/types.js';

const GENERATED = '[mcp_servers.fetch]\ncommand = "npx"\nargs = []\n';
const PATH = '.codex/config.toml';

function pending(content: string): GenerateResult {
  return { target: 'codex-cli', path: PATH, content, status: 'updated' };
}

describe('mergeCodexConfigToml', () => {
  it('declines paths it does not own', () => {
    expect(mergeCodexConfigToml('x', undefined, GENERATED, '.codex/hooks.json')).toBeNull();
  });

  it('declines when there is no base file', () => {
    expect(mergeCodexConfigToml(null, undefined, GENERATED, PATH)).toBeNull();
  });

  it('keeps user tables and comments while replacing the mcp_servers tables', () => {
    const existing = [
      '# top comment',
      'model = "gpt-5"',
      '',
      '[mcp_servers.stale]',
      'command = "gone"',
      '',
      '[shell_environment_policy]',
      'inherit = "core"',
      '',
    ].join('\n');

    const merged = mergeCodexConfigToml(existing, undefined, GENERATED, PATH);

    expect(merged).toBe(
      [
        '# top comment',
        'model = "gpt-5"',
        '',
        '[shell_environment_policy]',
        'inherit = "core"',
        '',
        '[mcp_servers.fetch]',
        'command = "npx"',
        'args = []',
        '',
      ].join('\n'),
    );
  });

  it('drops an array-of-tables mcp_servers header and a header with a trailing comment', () => {
    const existing = [
      '[[mcp_servers.a]]',
      'command = "x"',
      '[mcp_servers.b] # note',
      'command="y"',
    ];
    expect(mergeCodexConfigToml(existing.join('\n'), undefined, GENERATED, PATH)).toBe(GENERATED);
  });

  it('prefers a pending result over the on-disk file as merge base', () => {
    const merged = mergeCodexConfigToml(
      'model = "from-disk"\n',
      pending('model = "from-pending"\n'),
      GENERATED,
      PATH,
    );
    expect(parseToml(merged!)).toEqual({
      model: 'from-pending',
      mcp_servers: { fetch: { command: 'npx', args: [] } },
    });
  });

  it('does not mistake a multi-line array element for a table header', () => {
    const existing = ['matrix = [', '  [1, 2],', ']', '[mcp_servers.stale]', 'command = "gone"'];
    const merged = mergeCodexConfigToml(existing.join('\n'), undefined, GENERATED, PATH);
    expect(parseToml(merged!)).toEqual({
      matrix: [[1, 2]],
      mcp_servers: { fetch: { command: 'npx', args: [] } },
    });
  });
});
