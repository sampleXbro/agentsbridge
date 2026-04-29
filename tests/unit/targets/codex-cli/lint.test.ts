import { describe, expect, it } from 'vitest';
import { lintMcp } from '../../../../src/targets/codex-cli/lint.js';
import type { CanonicalFiles, McpConfig } from '../../../../src/core/types.js';

function makeCanonical(mcp: McpConfig | null): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('codex-cli lintMcp', () => {
  it('returns [] when mcp is null', () => {
    expect(lintMcp(makeCanonical(null))).toEqual([]);
  });

  it('returns [] when mcpServers is empty', () => {
    expect(lintMcp(makeCanonical({ mcpServers: {} }))).toEqual([]);
  });

  it('warns when server has description', () => {
    const out = lintMcp(
      makeCanonical({
        mcpServers: {
          docs: { command: 'npx', args: [], env: {}, type: 'stdio', description: 'My docs' },
        },
      }),
    );
    expect(out.some((d) => d.message.includes('description'))).toBe(true);
  });

  it('does not emit description warning when description is empty', () => {
    const out = lintMcp(
      makeCanonical({
        mcpServers: {
          docs: { command: 'npx', args: [], env: {}, type: 'stdio', description: '' },
        },
      }),
    );
    expect(out.filter((d) => d.message.includes('description'))).toEqual([]);
  });

  it('does not emit description warning when description is non-string', () => {
    const out = lintMcp(
      // @ts-expect-error testing runtime guard
      makeCanonical({ mcpServers: { docs: { command: 'npx', description: 42 } } }),
    );
    expect(out.filter((d) => d.message.includes('description'))).toEqual([]);
  });

  it('warns about non-stdio transport via type field', () => {
    const out = lintMcp(
      makeCanonical({
        mcpServers: {
          srv: {
            // @ts-expect-error simulating non-stdio variant
            type: 'http',
            url: 'https://example.com',
          },
        },
      }),
    );
    expect(out.some((d) => d.message.includes('http transport'))).toBe(true);
  });

  it('warns about url transport when only url is present (no type)', () => {
    const out = lintMcp(
      makeCanonical({
        mcpServers: {
          // @ts-expect-error url-only variant
          srv: { url: 'https://example.com' },
        },
      }),
    );
    expect(out.some((d) => d.message.includes('url transport'))).toBe(true);
  });

  it('produces both description and transport warnings on the same server', () => {
    const out = lintMcp(
      makeCanonical({
        mcpServers: {
          srv: {
            // @ts-expect-error non-stdio
            type: 'sse',
            url: 'https://example.com',
            description: 'has desc',
          },
        },
      }),
    );
    expect(out).toHaveLength(2);
  });
});
