/**
 * Security: MCP server `cwd` and `description` are written verbatim to
 * `.agentsmesh/mcp.json` and later consumed by downstream agents that
 * `spawn()` the server with the recorded `cwd`. Without validation, an MCP
 * client could plant `cwd: "../../../etc"`, NUL bytes, or newlines and
 * mislead any tool that interpolates these fields.
 */
import { describe, it, expect } from 'vitest';
import { McpServerInputSchema } from '../../../src/mcp/schemas.js';

const BASE = { command: 'node', args: ['server.js'] };

describe('McpServerInputSchema — cwd validation', () => {
  it('rejects cwd containing parent-traversal segments', () => {
    const result = McpServerInputSchema.safeParse({ ...BASE, cwd: '../../etc' });
    expect(result.success).toBe(false);
  });

  it('rejects cwd with NUL byte', () => {
    const result = McpServerInputSchema.safeParse({ ...BASE, cwd: 'foo\0bar' });
    expect(result.success).toBe(false);
  });

  it('rejects cwd with newline', () => {
    const result = McpServerInputSchema.safeParse({ ...BASE, cwd: 'foo\nbar' });
    expect(result.success).toBe(false);
  });

  it('accepts a relative cwd without traversal', () => {
    const result = McpServerInputSchema.safeParse({ ...BASE, cwd: 'servers/sub' });
    expect(result.success).toBe(true);
  });

  it('accepts an absolute project-style cwd', () => {
    const result = McpServerInputSchema.safeParse({ ...BASE, cwd: '/Users/dev/project' });
    // Absolute paths are still allowed (some platforms require them); the
    // refinement only blocks structural escape patterns.
    expect(result.success).toBe(true);
  });
});

describe('McpServerInputSchema — description hardening', () => {
  it('rejects description with NUL', () => {
    const result = McpServerInputSchema.safeParse({ ...BASE, description: 'ok\0pwn' });
    expect(result.success).toBe(false);
  });

  it('rejects description with newline / CR', () => {
    const result = McpServerInputSchema.safeParse({
      ...BASE,
      description: 'first\nsecond',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a plain description', () => {
    const result = McpServerInputSchema.safeParse({
      ...BASE,
      description: 'A standard MCP server.',
    });
    expect(result.success).toBe(true);
  });
});
