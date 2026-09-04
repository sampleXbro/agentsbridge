/**
 * `McpServerConfigSchema` (`agent-core-v2/src/mcpCore/config-schema.ts`) is a
 * discriminated union on `transport`. Its preprocess step infers a transport
 * only when the key is missing — `command` becomes `stdio`, `url` becomes
 * `http` — so a canonical `sse` server written verbatim connects over plain
 * HTTP. `parseMcpJsonServers` uses `.parse`, so one rejected server throws and
 * the whole `mcp.json` is refused.
 */

import { describe, it, expect } from 'vitest';
import type { McpConfig } from '../../../../src/core/types.js';
import { generateMcp } from '../../../../src/targets/kimi-code/generator.js';
import { lintMcp } from '../../../../src/targets/kimi-code/lint.js';
import { makeCanonical } from './fixtures.js';

function servers(mcp: McpConfig): Record<string, Record<string, unknown>> {
  const [output] = generateMcp(makeCanonical({ mcp }));
  return JSON.parse(output!.content).mcpServers;
}

describe('generateMcp transports', () => {
  it('names the transport instead of letting Kimi Code infer it', () => {
    const out = servers({
      mcpServers: {
        context7: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@upstash/context7-mcp'],
          env: { TOKEN: 'x' },
        },
        events: { type: 'sse', url: 'https://events.example.com/sse', headers: {}, env: {} },
        api: { type: 'http', url: 'https://api.example.com/mcp', headers: {}, env: {} },
        legacy: {
          type: 'streamable-http',
          url: 'https://api.example.com/v2',
          headers: {},
          env: {},
        },
      },
    });

    expect(out.context7!.transport).toBe('stdio');
    expect(out.events!.transport).toBe('sse');
    expect(out.api!.transport).toBe('http');
    expect(out.legacy!.transport).toBe('http');
    expect(out.context7!.command).toBe('npx');
    expect(out.context7!.env).toEqual({ TOKEN: 'x' });
  });

  it('drops a server whose url the schema rejects, keeping the rest loadable', () => {
    const mcp: McpConfig = {
      mcpServers: {
        good: { type: 'http', url: 'https://api.example.com/mcp', headers: {}, env: {} },
        broken: { type: 'http', url: '${MCP_URL}', headers: {}, env: {} },
        blank: { type: 'stdio', command: '', args: [], env: {} },
      },
    };
    expect(Object.keys(servers(mcp))).toEqual(['good']);

    const messages = lintMcp(makeCanonical({ mcp })).map((d) => d.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('broken');
    expect(messages[0]).toContain('blank');
  });

  it('names env on a remote server, which Kimi Code has no field for', () => {
    const mcp: McpConfig = {
      mcpServers: {
        api: { type: 'http', url: 'https://api.example.com/mcp', headers: {}, env: { K: 'v' } },
      },
    };
    const messages = lintMcp(makeCanonical({ mcp })).map((d) => d.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('api');
    expect(messages[0]).toContain('env');
  });

  it('is quiet when every server maps cleanly and absent when there is no config', () => {
    expect(
      lintMcp(
        makeCanonical({
          mcp: {
            mcpServers: {
              api: { type: 'http', url: 'https://a.example.com', headers: {}, env: {} },
            },
          },
        }),
      ),
    ).toEqual([]);
    expect(lintMcp(makeCanonical())).toEqual([]);
    expect(generateMcp(makeCanonical({ mcp: { mcpServers: {} } }))).toEqual([]);
  });
});
