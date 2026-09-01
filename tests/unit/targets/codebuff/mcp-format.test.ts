/**
 * `.agents/mcp.json` must satisfy freebuff's STRICT schema.
 *
 * `mcpConfigSchema` (CodebuffAI/freebuff `common/src/types/mcp.ts`) is a union
 * of two `z.strictObject`s, replicated verbatim below. `loadMCPConfig`
 * (`sdk/src/agents/load-mcp-config.ts`) runs `mcpFileSchema.safeParse` on the
 * WHOLE file and `continue`s when it fails, logging only under `verbose`. One
 * unknown key on one server therefore discards EVERY server in the file.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generateMcp } from '../../../../src/targets/codebuff/generator.js';
import { lintMcp } from '../../../../src/targets/codebuff/lint.js';
import { CODEBUFF_MCP_FILE } from '../../../../src/targets/codebuff/constants.js';
import { makeCanonical } from './factories.js';

// Verbatim copy of common/src/types/mcp.ts + the mcpFileSchema wrapper.
const mcpConfigStdioSchema = z.strictObject({
  type: z.literal('stdio').default('stdio'),
  command: z.string(),
  args: z
    .string()
    .array()
    .default(() => []),
  env: z.record(z.string(), z.string()).default(() => ({})),
});

const mcpConfigRemoteSchema = z.strictObject({
  type: z.enum(['http', 'sse']).default('http'),
  url: z.string(),
  params: z.record(z.string(), z.string()).default(() => ({})),
  headers: z.record(z.string(), z.string()).default(() => ({})),
});

const mcpFileSchema = z.object({
  mcpServers: z
    .record(z.string(), z.union([mcpConfigRemoteSchema, mcpConfigStdioSchema]))
    .default(() => ({})),
});

function parsedByCodebuff(content: string): z.infer<typeof mcpFileSchema> {
  const result = mcpFileSchema.safeParse(JSON.parse(content) as unknown);
  expect(result.success, JSON.stringify(result.error?.issues ?? [], null, 2)).toBe(true);
  return result.data!;
}

const remoteServer = {
  description: 'Linear issue tracker',
  type: 'http',
  url: 'https://mcp.linear.app/mcp',
  headers: { Authorization: 'Bearer $LINEAR_TOKEN' },
  env: {},
};

const stdioServer = {
  description: 'Upstash docs',
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@upstash/context7-mcp'],
  env: { CONTEXT7_KEY: '$CONTEXT7_KEY' },
};

describe('generateMcp writes what freebuff can actually parse', () => {
  it('emits a remote server that survives the strict union', () => {
    const [output] = generateMcp(makeCanonical({ mcp: { mcpServers: { linear: remoteServer } } }));

    expect(output?.path).toBe(CODEBUFF_MCP_FILE);
    expect(parsedByCodebuff(output!.content).mcpServers.linear).toEqual({
      type: 'http',
      url: 'https://mcp.linear.app/mcp',
      headers: { Authorization: 'Bearer $LINEAR_TOKEN' },
      params: {},
    });
  });

  it('emits a stdio server that survives the strict union', () => {
    const [output] = generateMcp(makeCanonical({ mcp: { mcpServers: { ctx7: stdioServer } } }));

    expect(parsedByCodebuff(output!.content).mcpServers.ctx7).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
      env: { CONTEXT7_KEY: '$CONTEXT7_KEY' },
    });
  });

  it('keeps one bad server from discarding the whole file', () => {
    const [output] = generateMcp(
      makeCanonical({ mcp: { mcpServers: { linear: remoteServer, ctx7: stdioServer } } }),
    );

    expect(Object.keys(parsedByCodebuff(output!.content).mcpServers)).toEqual(['linear', 'ctx7']);
  });

  it('narrows a canonical transport name to the http/sse enum', () => {
    const [output] = generateMcp(
      makeCanonical({
        mcp: {
          mcpServers: {
            streamable: { ...remoteServer, type: 'streamable-http' },
            events: { ...remoteServer, type: 'sse' },
          },
        },
      }),
    );

    const servers = parsedByCodebuff(output!.content).mcpServers;
    expect(servers.streamable).toMatchObject({ type: 'http' });
    expect(servers.events).toMatchObject({ type: 'sse' });
  });

  it('narrows a non-stdio transport name on a command server to stdio', () => {
    const [output] = generateMcp(
      makeCanonical({ mcp: { mcpServers: { local: { ...stdioServer, type: 'local' } } } }),
    );

    expect(parsedByCodebuff(output!.content).mcpServers.local).toMatchObject({ type: 'stdio' });
  });

  it('emits nothing when there are no servers', () => {
    expect(generateMcp(makeCanonical())).toEqual([]);
    expect(generateMcp(makeCanonical({ mcp: { mcpServers: {} } }))).toEqual([]);
  });
});

describe('lintMcp names every field the strict schema forces us to drop', () => {
  it('is silent when canonical carries nothing unrepresentable', () => {
    expect(
      lintMcp(
        makeCanonical({
          mcp: { mcpServers: { ctx7: { ...stdioServer, description: undefined } } },
        }),
      ),
    ).toEqual([]);
  });

  it('is silent when there is no mcp config at all', () => {
    expect(lintMcp(makeCanonical())).toEqual([]);
  });

  it('warns about dropped descriptions naming each server', () => {
    const diagnostics = lintMcp(
      makeCanonical({ mcp: { mcpServers: { linear: remoteServer, ctx7: stdioServer } } }),
    );

    const message = diagnostics.map((d) => d.message).join('\n');
    expect(message).toContain('description');
    expect(message).toContain('linear');
    expect(message).toContain('ctx7');
    expect(diagnostics.every((d) => d.level === 'warning')).toBe(true);
  });

  it('warns that env is dropped for a remote server only', () => {
    const diagnostics = lintMcp(
      makeCanonical({
        mcp: {
          mcpServers: {
            linear: { ...remoteServer, description: undefined, env: { TOKEN: '$T' } },
            ctx7: { ...stdioServer, description: undefined },
          },
        },
      }),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('env');
    expect(diagnostics[0]!.message).toContain('linear');
    expect(diagnostics[0]!.message).not.toContain('ctx7');
  });
});
