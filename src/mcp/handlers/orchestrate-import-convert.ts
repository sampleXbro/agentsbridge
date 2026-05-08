import type { McpContext } from '../context.js';
import { McpError } from '../errors.js';
import { importFrom as engineImportFrom, TargetNotFoundError } from '../../public/index.js';
import { runConvert } from '../../cli/commands/convert.js';
import {
  type ConvertHandlerResult,
  type ImportHandlerResult,
  wrapEngineError,
} from './orchestrate-types.js';

export async function importFromTarget(
  ctx: McpContext,
  input: { from: string; features?: string[]; dry_run?: boolean },
): Promise<ImportHandlerResult> {
  if (input.dry_run === true) {
    throw new McpError(
      'VALIDATION_FAILED',
      'dry_run is not supported for import — the engine writes files directly. Use diff to preview changes instead.',
    );
  }
  try {
    const results = await engineImportFrom(input.from, {
      root: ctx.projectRoot,
      scope: 'project',
    });
    return {
      imported: results.length,
      files: results.map((r) => ({ fromPath: r.fromPath, toPath: r.toPath, feature: r.feature })),
      warnings: [],
      errors: [],
    };
  } catch (e) {
    if (e instanceof TargetNotFoundError) {
      throw new McpError('VALIDATION_FAILED', `unknown target "${input.from}"`);
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (/unknown target|invalid target|not found/i.test(msg)) {
      throw new McpError('VALIDATION_FAILED', msg);
    }
    wrapEngineError(e);
  }
}

export async function convert(
  ctx: McpContext,
  input: { from: string; to: string; dry_run?: boolean },
): Promise<ConvertHandlerResult> {
  try {
    const flags: Record<string, string | boolean> = {
      from: input.from,
      to: input.to,
      'dry-run': input.dry_run === true,
    };
    const result = await runConvert(flags, ctx.projectRoot);
    return {
      filesAffected: result.data.summary.created + result.data.summary.updated,
      dryRun: input.dry_run === true,
      warnings: [],
      errors: [],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unknown.*--from|unknown.*--to|unknown target/i.test(msg)) {
      throw new McpError('VALIDATION_FAILED', msg);
    }
    wrapEngineError(e);
  }
}
