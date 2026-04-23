/**
 * Zod schemas for canonical .agentsmesh/ file types.
 * These are the source of truth for JSON Schema generation.
 */

import { z } from 'zod';

// ─── permissions.yaml ─────────────────────────────────────────────────────────

export const permissionsSchema = z
  .object({
    allow: z.array(z.string()).default([]).describe('Tool calls to allow without confirmation'),
    deny: z.array(z.string()).default([]).describe('Tool calls to always deny'),
    ask: z.array(z.string()).default([]).describe('Tool calls to confirm before running'),
  })
  .describe('Permission allow/deny lists for AI tool calls (.agentsmesh/permissions.yaml)');

// ─── hooks.yaml ───────────────────────────────────────────────────────────────

const hookEntrySchema = z
  .object({
    matcher: z.string().describe('Tool name pattern to match (e.g. "Edit|Write", "Bash", "*")'),
    command: z.string().describe('Shell command to run'),
    type: z.enum(['command', 'prompt']).optional().describe('Hook entry type'),
    timeout: z.number().optional().describe('Timeout in milliseconds'),
    prompt: z.string().optional().describe('Prompt text (when type is prompt)'),
  })
  .describe('A single lifecycle hook entry');

export const hooksSchema = z
  .record(z.string(), z.array(hookEntrySchema))
  .describe(
    'Lifecycle hooks keyed by event name (e.g. PreToolUse, PostToolUse, SubagentStart, SubagentStop) (.agentsmesh/hooks.yaml)',
  );

// ─── mcp.json ─────────────────────────────────────────────────────────────────

const baseMcpServerSchema = z.object({
  description: z.string().optional().describe('Human-readable description of this MCP server'),
  type: z.string().describe('Server transport type (stdio or url)'),
  env: z.record(z.string(), z.string()).default({}).describe('Environment variables'),
});

const stdioMcpServerSchema = baseMcpServerSchema
  .extend({
    type: z.literal('stdio').describe('stdio transport — launches a local process'),
    command: z.string().describe('Executable to run'),
    args: z.array(z.string()).default([]).describe('Command-line arguments'),
  })
  .describe('stdio MCP server (local process)');

const urlMcpServerSchema = baseMcpServerSchema
  .extend({
    type: z.literal('url').describe('url transport — connects to a remote HTTP/SSE endpoint'),
    url: z.string().url().describe('Remote endpoint URL'),
    headers: z.record(z.string(), z.string()).default({}).describe('HTTP headers'),
  })
  .describe('URL-based MCP server (HTTP/SSE)');

const mcpServerSchema = z
  .discriminatedUnion('type', [stdioMcpServerSchema, urlMcpServerSchema])
  .describe('MCP server configuration');

export const mcpConfigSchema = z
  .object({
    mcpServers: z
      .record(z.string(), mcpServerSchema)
      .default({})
      .describe('Map of server name to server configuration'),
  })
  .describe('MCP server configuration (.agentsmesh/mcp.json)');
