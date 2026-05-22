/**
 * MCP handlers for the install / uninstall / installs-list pipeline.
 *
 * Each handler wraps the existing CLI orchestrator with non-interactive
 * defaults — MCP has no TTY, so:
 *   - `force` is forced to `true` (skip all interactive prompts; accept
 *     each prompt's documented `--force` default).
 *   - `assumeTty` is omitted (the orchestrator falls through to the
 *     non-TTY path even when the harness has a stdin attached).
 *
 * The full per-entity bulk-prompt / broken-link / modified-files prompt
 * matrix is therefore collapsed to "accept all defaults" through MCP.
 * Callers that need finer-grained selection should use the CLI directly.
 */

import type { McpContext } from '../context.js';
import { McpError, redactAbsolutePaths } from '../errors.js';
import { runInstall } from '../../install/run/run-install.js';
import { runUninstall } from '../../install/uninstall/run-uninstall.js';
import { runInstallsList } from '../../cli/commands/installs-list.js';
import type { InstallData, InstallsListData, UninstallData } from '../../cli/command-result.js';

export interface InstallHandlerInput {
  readonly source: string;
  readonly path?: string;
  readonly target?: string;
  readonly as?: 'rules' | 'commands' | 'agents' | 'skills';
  readonly name?: string;
  readonly extends?: boolean;
  readonly all?: boolean;
  readonly sync?: boolean;
  readonly dry_run?: boolean;
  readonly global?: boolean;
}

export interface UninstallHandlerInput {
  readonly names: readonly string[];
  readonly all?: boolean;
  readonly keep_pack?: boolean;
  readonly keep_generated?: boolean;
  readonly dry_run?: boolean;
  readonly global?: boolean;
}

export interface InstallsListHandlerInput {
  readonly global?: boolean;
}

function wrapInstallError(e: unknown): never {
  if (e instanceof McpError) throw e;
  const rawMsg = e instanceof Error ? e.message : String(e);
  // Redact filesystem paths before threading the message back through
  // `McpError` (which refuses absolute paths in `message` to prevent host
  // path leakage to remote MCP clients).
  const msg = redactAbsolutePaths(rawMsg);
  if (/lock|LockAcquisitionError/i.test(msg)) {
    throw new McpError('LOCK_HELD', '.install.lock is held by another process');
  }
  if (
    /missing source|usage:|non-interactive|invalid|unknown|not found|escapes the source root/i.test(
      msg,
    )
  ) {
    throw new McpError('VALIDATION_FAILED', msg);
  }
  throw new McpError('IO_ERROR', 'install pipeline failure', { reason: msg });
}

/**
 * Map the MCP input shape to the flag bag that `runInstall` consumes. Always
 * sets `force: true` (no stdin TTY in MCP) and leaves CLI-only knobs out.
 */
function toInstallFlags(input: InstallHandlerInput): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = { force: true };
  if (input.path !== undefined) flags.path = input.path;
  if (input.target !== undefined) flags.target = input.target;
  if (input.as !== undefined) flags.as = input.as;
  if (input.name !== undefined) flags.name = input.name;
  if (input.extends === true) flags.extends = true;
  if (input.all === true) flags.all = true;
  if (input.sync === true) flags.sync = true;
  if (input.dry_run === true) flags['dry-run'] = true;
  if (input.global === true) flags.global = true;
  return flags;
}

function toUninstallFlags(input: UninstallHandlerInput): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = { force: true };
  if (input.all === true) flags.all = true;
  if (input.keep_pack === true) flags['keep-pack'] = true;
  if (input.keep_generated === true) flags['keep-generated'] = true;
  if (input.dry_run === true) flags['dry-run'] = true;
  if (input.global === true) flags.global = true;
  return flags;
}

export async function install(ctx: McpContext, input: InstallHandlerInput): Promise<InstallData> {
  if (typeof input.source !== 'string' || input.source.trim().length === 0) {
    throw new McpError('VALIDATION_FAILED', 'install: `source` is required');
  }
  try {
    const result = await runInstall(toInstallFlags(input), [input.source], ctx.projectRoot);
    if (result.exitCode !== 0) {
      throw new McpError('IO_ERROR', `install exited ${result.exitCode}`);
    }
    return result.data;
  } catch (e) {
    wrapInstallError(e);
  }
}

export async function uninstall(
  ctx: McpContext,
  input: UninstallHandlerInput,
): Promise<UninstallData> {
  if (input.all !== true) {
    if (!Array.isArray(input.names) || input.names.length === 0) {
      throw new McpError('VALIDATION_FAILED', 'uninstall: pass `names: [...]` or set `all: true`');
    }
  }
  try {
    const result = await runUninstall(
      toUninstallFlags(input),
      input.names ?? [],
      ctx.projectRoot,
      // assumeTty omitted on purpose: MCP runs non-interactively.
    );
    return result.data;
  } catch (e) {
    wrapInstallError(e);
  }
}

export async function installsList(
  ctx: McpContext,
  input: InstallsListHandlerInput = {},
): Promise<InstallsListData> {
  try {
    const flags: Record<string, string | boolean> = {};
    if (input.global === true) flags.global = true;
    const result = await runInstallsList(flags, ctx.projectRoot);
    return result.data;
  } catch (e) {
    wrapInstallError(e);
  }
}

export const installHandlers = {
  install,
  uninstall,
  installsList,
};
