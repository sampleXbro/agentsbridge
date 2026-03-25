import { describe, expect, it } from 'vitest';
import type { McpServer } from '../../../src/core/types.js';
import {
  hasInterpolation,
  isStdioMcpServer,
  isUrlMcpServer,
  usesCursorSensitiveInterpolation,
} from '../../../src/core/mcp-servers.js';

function stdioServer(overrides: Partial<Extract<McpServer, { command: string }>> = {}): McpServer {
  return {
    type: 'stdio',
    command: 'node',
    args: ['server.js'],
    env: {},
    ...overrides,
  };
}

function urlServer(overrides: Partial<Extract<McpServer, { url: string }>> = {}): McpServer {
  return {
    type: 'http',
    url: 'https://example.test/mcp',
    headers: {},
    env: {},
    ...overrides,
  };
}

describe('mcp-servers', () => {
  it('identifies stdio servers', () => {
    const server = stdioServer();
    expect(isStdioMcpServer(server)).toBe(true);
    expect(isUrlMcpServer(server)).toBe(false);
  });

  it('identifies url servers', () => {
    const server = urlServer();
    expect(isUrlMcpServer(server)).toBe(true);
    expect(isStdioMcpServer(server)).toBe(false);
  });

  it('detects interpolation markers', () => {
    expect(hasInterpolation('${TOKEN}')).toBe(true);
    expect(hasInterpolation('$TOKEN')).toBe(true);
    expect(hasInterpolation('plain-value')).toBe(false);
  });

  it('treats env interpolation as cursor-sensitive on stdio servers', () => {
    expect(
      usesCursorSensitiveInterpolation(
        stdioServer({
          env: { API_KEY: '${TOKEN}' },
        }),
      ),
    ).toBe(true);
  });

  it('returns false for stdio servers without sensitive interpolation', () => {
    expect(usesCursorSensitiveInterpolation(stdioServer())).toBe(false);
  });

  it('treats interpolated urls as cursor-sensitive', () => {
    expect(
      usesCursorSensitiveInterpolation(
        urlServer({
          url: 'https://example.test/${TOKEN}',
        }),
      ),
    ).toBe(true);
  });

  it('treats interpolated headers as cursor-sensitive', () => {
    expect(
      usesCursorSensitiveInterpolation(
        urlServer({
          headers: { Authorization: 'Bearer ${TOKEN}' },
        }),
      ),
    ).toBe(true);
  });

  it('returns false for plain url servers without interpolation', () => {
    expect(usesCursorSensitiveInterpolation(urlServer())).toBe(false);
  });
});
