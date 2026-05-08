import type { McpContext } from '../context.js';
import {
  loadProjectContext,
  generate as engineGenerate,
  lint as engineLint,
  check as engineCheck,
  diff as engineDiff,
} from '../../public/index.js';
import { writeFileAtomic } from '../../utils/filesystem/fs.js';
import { ensurePathInsideRoot } from '../../cli/commands/generate-path.js';
import {
  type CheckHandlerResult,
  type DiffHandlerResult,
  type GenerateHandlerResult,
  type LintHandlerResult,
  wrapEngineError,
} from './orchestrate-types.js';
import { convert, importFromTarget } from './orchestrate-import-convert.js';

export type {
  CheckHandlerResult,
  ConvertHandlerResult,
  DiffHandlerResult,
  GenerateHandlerResult,
  ImportHandlerResult,
  LintHandlerResult,
} from './orchestrate-types.js';

async function generate(
  ctx: McpContext,
  input: { targets?: string[]; features?: string[]; verbose?: boolean; dry_run?: boolean },
): Promise<GenerateHandlerResult> {
  try {
    const pctx = await loadProjectContext(ctx.projectRoot);
    const targetFilter = input.targets && input.targets.length > 0 ? input.targets : undefined;

    const results = await engineGenerate({
      config: pctx.config,
      canonical: pctx.canonical,
      projectRoot: pctx.projectRoot,
      scope: pctx.scope,
      targetFilter,
    });

    const actionable = results.filter((r) => r.status !== 'skipped');
    const written = actionable.filter((r) => r.status === 'created' || r.status === 'updated');

    if (!input.dry_run) {
      for (const r of written) {
        const fullPath = ensurePathInsideRoot(pctx.projectRoot, r.path, r.target);
        await writeFileAtomic(fullPath, r.content);
      }
    }

    const byTarget: Record<string, { filesWritten: number }> = {};
    for (const r of written) {
      const entry = byTarget[r.target] ?? { filesWritten: 0 };
      byTarget[r.target] = { filesWritten: entry.filesWritten + 1 };
    }

    const result: GenerateHandlerResult = {
      filesWritten: written.length,
      byTarget,
      lockfileUpdated: !input.dry_run && written.length >= 0,
      errors: [],
      warnings: [],
    };

    if (input.verbose === true) result.files = actionable.map((r) => r.path);
    return result;
  } catch (e) {
    wrapEngineError(e);
  }
}

async function lint(
  ctx: McpContext,
  input: { severity?: 'error' | 'warning' | 'info' },
): Promise<LintHandlerResult> {
  try {
    const pctx = await loadProjectContext(ctx.projectRoot);
    const result = await engineLint({
      config: pctx.config,
      canonical: pctx.canonical,
      projectRoot: pctx.projectRoot,
      scope: pctx.scope,
    });
    const diagnostics = input.severity
      ? result.diagnostics.filter((d) => d.level === input.severity)
      : result.diagnostics;
    return {
      issues: diagnostics.map((d) => ({
        level: d.level,
        file: d.file,
        target: d.target,
        message: d.message,
      })),
    };
  } catch (e) {
    wrapEngineError(e);
  }
}

async function check(ctx: McpContext): Promise<CheckHandlerResult> {
  try {
    const pctx = await loadProjectContext(ctx.projectRoot);
    const report = await engineCheck({
      config: pctx.config,
      configDir: pctx.configDir,
      canonicalDir: pctx.canonicalDir,
    });
    return {
      drift: !report.inSync,
      missing: [...report.removed],
      extra: [...report.added],
      modified: [...report.modified],
    };
  } catch (e) {
    wrapEngineError(e);
  }
}

async function diff(
  ctx: McpContext,
  input: { targets?: string[]; features?: string[] },
): Promise<DiffHandlerResult> {
  try {
    const pctx = await loadProjectContext(ctx.projectRoot);
    const targetFilter = input.targets && input.targets.length > 0 ? input.targets : undefined;
    const result = await engineDiff({
      config: pctx.config,
      canonical: pctx.canonical,
      projectRoot: pctx.projectRoot,
      scope: pctx.scope,
      targetFilter,
    });
    return {
      willCreate: result.summary.new,
      willModify: result.summary.updated,
      willDelete: result.summary.deleted,
    };
  } catch (e) {
    wrapEngineError(e);
  }
}

export const orchestrateHandlers = {
  generate,
  lint,
  check,
  diff,
  import: importFromTarget,
  convert,
};
