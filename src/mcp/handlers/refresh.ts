/**
 * MCP handler for `agentsmesh refresh`. Forces `force: true` (MCP has no
 * TTY) so the consolidated consent prompt is bypassed.
 */

import type { McpContext } from '../context.js';
import { McpError, redactAbsolutePaths } from '../errors.js';
import { runRefresh } from '../../install/refresh/run-refresh.js';
import type { RefreshData } from '../../cli/command-result.js';

export interface RefreshHandlerInput {
  readonly names?: readonly string[];
  readonly dry_run?: boolean;
  readonly global?: boolean;
}

function toRefreshFlags(input: RefreshHandlerInput): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = { force: true };
  if (input.dry_run === true) flags['dry-run'] = true;
  if (input.global === true) flags.global = true;
  return flags;
}

function wrapRefreshError(e: unknown): never {
  if (e instanceof McpError) throw e;
  const rawMsg = e instanceof Error ? e.message : String(e);
  const msg = redactAbsolutePaths(rawMsg);
  if (/lock|LockAcquisitionError/i.test(msg)) {
    throw new McpError('LOCK_HELD', '.install.lock is held by another process');
  }
  if (/unknown pack|not found|usage:/i.test(msg)) {
    throw new McpError('VALIDATION_FAILED', msg);
  }
  if (/resolve|network|fetch/i.test(msg)) {
    throw new McpError('REFRESH_RESOLVE_FAILED', msg);
  }
  if (/materialize|apply|manifest-update/i.test(msg)) {
    throw new McpError('REFRESH_APPLY_FAILED', msg);
  }
  throw new McpError('IO_ERROR', 'refresh pipeline failure', { reason: msg });
}

export async function refresh(
  ctx: McpContext,
  input: RefreshHandlerInput = {},
): Promise<RefreshData> {
  try {
    const result = await runRefresh(
      toRefreshFlags(input),
      [...(input.names ?? [])],
      ctx.projectRoot,
    );
    if (result.exitCode === 2) {
      const firstFailed = result.data.failed[0];
      const names = input.names ?? [];
      const detail =
        firstFailed?.error ??
        (names.length > 0 ? `unknown pack(s): ${names.join(', ')}` : 'refresh validation failed');
      throw new McpError('VALIDATION_FAILED', detail);
    }
    return result.data;
  } catch (e) {
    wrapRefreshError(e);
  }
}

export const refreshHandlers = { refresh };
