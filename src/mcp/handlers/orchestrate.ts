import type { McpContext } from '../context.js';
import { McpError } from '../errors.js';
import {
  loadProjectContext,
  generate as engineGenerate,
  lint as engineLint,
  check as engineCheck,
  diff as engineDiff,
  importFrom as engineImportFrom,
  TargetNotFoundError,
} from '../../public/index.js';
import { runConvert } from '../../cli/commands/convert.js';
import { writeFileAtomic } from '../../utils/filesystem/fs.js';
import { ensurePathInsideRoot } from '../../cli/commands/generate-path.js';

function wrapEngineError(e: unknown): never {
  if (e instanceof McpError) throw e;
  if (e instanceof TargetNotFoundError) {
    throw new McpError('VALIDATION_FAILED', e.message);
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/unknown.*--from|unknown.*--to|unknown target/i.test(msg)) {
    throw new McpError('VALIDATION_FAILED', msg);
  }
  if (/lock/i.test(msg)) throw new McpError('LOCK_HELD', 'generate lock is held');
  throw new McpError('IO_ERROR', 'engine failure', { reason: msg });
}

export interface GenerateHandlerResult {
  filesWritten: number;
  byTarget: Record<string, { filesWritten: number }>;
  lockfileUpdated: boolean;
  errors: string[];
  warnings: string[];
  files?: string[];
}

export interface LintHandlerResult {
  issues: Array<{ level: 'error' | 'warning'; file: string; target: string; message: string }>;
}

export interface CheckHandlerResult {
  drift: boolean;
  missing: string[];
  extra: string[];
  modified: string[];
}

export interface DiffHandlerResult {
  willCreate: number;
  willModify: number;
  willDelete: number;
}

export interface ImportHandlerResult {
  imported: number;
  files: Array<{ fromPath: string; toPath: string; feature: string }>;
  warnings: string[];
  errors: string[];
}

export interface ConvertHandlerResult {
  written: number;
  warnings: string[];
  errors: string[];
}

export const orchestrateHandlers = {
  async generate(
    ctx: McpContext,
    input: {
      targets?: string[];
      features?: string[];
      verbose?: boolean;
      dry_run?: boolean;
    },
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

      if (input.verbose === true) {
        result.files = actionable.map((r) => r.path);
      }

      return result;
    } catch (e) {
      wrapEngineError(e);
    }
  },

  async lint(
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

      const severity = input.severity;
      const diagnostics = severity
        ? result.diagnostics.filter((d) => d.level === severity)
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
  },

  async check(ctx: McpContext): Promise<CheckHandlerResult> {
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
  },

  async diff(
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
  },

  async import(
    ctx: McpContext,
    input: { from: string; features?: string[]; dry_run?: boolean },
  ): Promise<ImportHandlerResult> {
    try {
      const results = await engineImportFrom(input.from, {
        root: ctx.projectRoot,
        scope: 'project',
      });

      return {
        imported: results.length,
        files: results.map((r) => ({
          fromPath: r.fromPath,
          toPath: r.toPath,
          feature: r.feature,
        })),
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
  },

  async convert(
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
        written: result.data.summary.created + result.data.summary.updated,
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
  },
};
