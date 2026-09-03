import { describe, expect, it } from 'vitest';
import {
  mcpServersJsonMerger,
  mergeMcpServersJson,
} from '../../../../src/core/generate/mcp-servers-merge.js';

const OWNED = ['type', 'command', 'args', 'env'];
const GENERATED = JSON.stringify({ mcpServers: { ctx: { command: 'npx' } } });

describe('mergeMcpServersJson', () => {
  it('returns the generated content when there is no base', () => {
    expect(mergeMcpServersJson(null, GENERATED, OWNED)).toBe(GENERATED);
  });

  // A base we cannot parse is a file we do not understand — MCP config files are
  // comment-legal in several tools — so it is preserved rather than replaced.
  it('preserves a base that is not a JSON object', () => {
    expect(mergeMcpServersJson('[1,2]', GENERATED, OWNED)).toBe('[1,2]');
    expect(mergeMcpServersJson('not json', GENERATED, OWNED)).toBe('not json');
    const jsonc = '{\n  // mine\n  "mcpServers": {}\n}';
    expect(mergeMcpServersJson(jsonc, GENERATED, OWNED)).toBe(jsonc);
  });

  it('still writes the generated document when there is no base', () => {
    expect(mergeMcpServersJson(null, GENERATED, OWNED)).toBe(GENERATED);
  });

  it('keeps foreign top-level keys and per-server keys canonical cannot express', () => {
    const base = JSON.stringify({
      $schema: 'x',
      mcpServers: { ctx: { command: 'old', tools: ['search'], enabled: false } },
    });
    expect(mergeMcpServersJson(base, GENERATED, OWNED)).toBe(
      JSON.stringify(
        {
          $schema: 'x',
          mcpServers: { ctx: { command: 'npx', tools: ['search'], enabled: false } },
        },
        null,
        2,
      ),
    );
  });

  it('revokes a server canonical no longer lists', () => {
    const base = JSON.stringify({ mcpServers: { ctx: {}, gone: { command: 'x' } } });
    expect(mergeMcpServersJson(base, GENERATED, OWNED)).toBe(
      JSON.stringify({ mcpServers: { ctx: { command: 'npx' } } }, null, 2),
    );
  });

  it('ignores a non-object server entry on either side', () => {
    const base = JSON.stringify({ mcpServers: { ctx: 'bogus' } });
    const generated = JSON.stringify({ mcpServers: { ctx: { command: 'npx' }, bad: 7 } });
    expect(mergeMcpServersJson(base, generated, OWNED)).toBe(
      JSON.stringify({ mcpServers: { ctx: { command: 'npx' } } }, null, 2),
    );
  });

  it('empties the server map when the base has no mcpServers key at all', () => {
    expect(mergeMcpServersJson('{"other":1}', '{"other":2}', OWNED)).toBe(
      JSON.stringify({ other: 1, mcpServers: {} }, null, 2),
    );
  });
});

describe('mcpServersJsonMerger', () => {
  it('declines a path it does not own', () => {
    expect(
      mcpServersJsonMerger(['a.json'], OWNED)('{}', undefined, GENERATED, 'b.json'),
    ).toBeNull();
  });

  it('prefers a pending result over the on-disk file as merge base', () => {
    const pending = { content: JSON.stringify({ $schema: 'pending' }) };
    expect(
      mcpServersJsonMerger(['a.json'], OWNED)(
        JSON.stringify({ $schema: 'disk' }),
        pending,
        GENERATED,
        'a.json',
      ),
    ).toBe(
      JSON.stringify({ $schema: 'pending', mcpServers: { ctx: { command: 'npx' } } }, null, 2),
    );
  });
});
