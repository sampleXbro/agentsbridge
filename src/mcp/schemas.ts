/**
 * Strict Zod schemas for MCP write-tool inputs.
 *
 * These guard the trust boundary between an MCP client (typically a hosting
 * LLM agent) and `.agentsmesh/` files that downstream runners execute.
 * Loose-typed inputs were the vector for the C1/H1/M4 findings: an arbitrary
 * `command` written into `mcp.json` becomes RCE on next server spawn; an
 * arbitrary `command` in `hooks.yaml` becomes RCE on next tool invocation.
 */
import { z } from 'zod';
import {
  MAX_DESCRIPTION_LEN,
  MAX_HOOK_COMMAND_LEN,
  MAX_HOOK_ENTRIES_PER_EVENT,
  MAX_HOOK_MATCHER_LEN,
  MAX_MCP_ARG_LEN,
  MAX_MCP_ARGS,
  MAX_MCP_COMMAND_LEN,
  MAX_MCP_ENV_VALUE_LEN,
  MAX_MCP_URL_LEN,
  MAX_NESTED_HOOK_ENTRIES,
  MAX_PERMISSION_ENTRIES,
  MAX_PERMISSION_PATTERN_LEN,
} from './limits.js';

const SHELL_META_RE = /[;&|`$<>!\\\r\n]/u;
const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const HEADER_KEY_RE = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const PERMISSION_PATTERN_RE = /^[A-Za-z][A-Za-z0-9_-]*(\([^)]*\))?$/u;
const NEWLINE_RE = /[\r\n]/u;

function noShellMeta(label: string): z.ZodType<string> {
  return z
    .string()
    .min(1)
    .max(MAX_MCP_COMMAND_LEN)
    .refine((s) => !SHELL_META_RE.test(s), {
      message: `${label} must not contain shell metacharacters (;&|\`$<>!\\\\, newlines)`,
    });
}

export const McpServerInputSchema = z
  .object({
    type: z.enum(['stdio', 'sse', 'http', 'streamable-http', 'streamable_http']).optional(),
    description: z.string().max(MAX_DESCRIPTION_LEN).optional(),
    command: noShellMeta('command').optional(),
    args: z.array(z.string().max(MAX_MCP_ARG_LEN)).max(MAX_MCP_ARGS).optional(),
    env: z
      .record(
        z.string().regex(ENV_KEY_RE, 'env key must be a valid identifier'),
        z.string().max(MAX_MCP_ENV_VALUE_LEN),
      )
      .optional(),
    url: z
      .string()
      .url()
      .max(MAX_MCP_URL_LEN)
      .refine((u) => /^https?:\/\//u.test(u), {
        message: 'url must use http(s) protocol',
      })
      .optional(),
    headers: z
      .record(
        z.string().regex(HEADER_KEY_RE, 'header name must be a valid identifier'),
        z.string().max(MAX_MCP_ENV_VALUE_LEN),
      )
      .optional(),
    cwd: z.string().max(MAX_MCP_URL_LEN).optional(),
    disabled: z.boolean().optional(),
    timeout: z.number().int().nonnegative().max(3_600_000).optional(),
  })
  .strict();

export type McpServerInput = z.infer<typeof McpServerInputSchema>;

const HookCallable = z
  .object({
    type: z.enum(['command', 'prompt']).optional(),
    command: z.string().min(1).max(MAX_HOOK_COMMAND_LEN).optional(),
    prompt: z.string().min(1).max(MAX_HOOK_COMMAND_LEN).optional(),
    timeout: z.number().int().nonnegative().max(3_600_000).optional(),
  })
  .strict()
  .refine((v) => (v.command ?? '').length > 0 || (v.prompt ?? '').length > 0, {
    message: 'hook entry must define command or prompt',
  });

const HookMatcher = z
  .string()
  .max(MAX_HOOK_MATCHER_LEN)
  .refine((s) => !NEWLINE_RE.test(s), {
    message: 'hook matcher must not contain newlines',
  });

const FlatHookEntry = z
  .object({
    matcher: HookMatcher,
    type: z.enum(['command', 'prompt']).optional(),
    command: z.string().min(1).max(MAX_HOOK_COMMAND_LEN).optional(),
    prompt: z.string().min(1).max(MAX_HOOK_COMMAND_LEN).optional(),
    timeout: z.number().int().nonnegative().max(3_600_000).optional(),
  })
  .strict()
  .refine((v) => (v.command ?? '').length > 0 || (v.prompt ?? '').length > 0, {
    message: 'hook entry must define command or prompt',
  });

const NestedHookEntry = z
  .object({
    matcher: HookMatcher,
    hooks: z.array(HookCallable).min(1).max(MAX_NESTED_HOOK_ENTRIES),
  })
  .strict();

export const HookEntryInputSchema = z.union([FlatHookEntry, NestedHookEntry]);

export const HooksRecordSchema = z.record(
  z.string().min(1).max(64),
  z.array(HookEntryInputSchema).max(MAX_HOOK_ENTRIES_PER_EVENT),
);

export type HooksRecordInput = z.infer<typeof HooksRecordSchema>;

const PermissionPattern = z
  .string()
  .min(1)
  .max(MAX_PERMISSION_PATTERN_LEN)
  .refine((s) => !NEWLINE_RE.test(s), {
    message: 'permission pattern must not contain newlines',
  })
  .refine((s) => PERMISSION_PATTERN_RE.test(s), {
    message: 'permission pattern must match Tool or Tool(matcher) form',
  });

export const PermissionListSchema = z.array(PermissionPattern).max(MAX_PERMISSION_ENTRIES);
