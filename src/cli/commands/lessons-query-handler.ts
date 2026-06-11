import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CURRENT_GRAPH_VERSION } from '../../lessons/graph-schema.js';
import { loadLessonsGraphResilient } from '../../lessons/graph-store.js';
import { normalizeRecallFile } from '../../lessons/normalize-query-file.js';
import { ancestorAgentsmeshDir, lessonsSetupHint } from '../../lessons/paths.js';
import { queryLessons } from '../../lessons/query.js';
import { rankLessons } from '../../lessons/ranking.js';
import { recordRecallTelemetry } from '../../lessons/recall.js';
import { loadRecallConfig, lessonsConfigWarning } from '../../lessons/recall-config.js';
import { commitSeen, filterUnseen, openSessionDedup } from '../../lessons/seen-cache.js';
import {
  errorResult,
  numberFlag,
  parseFormat,
  queryFromFlags,
  stringFlag,
  type LessonsFlags,
} from './lessons-helpers.js';
import type { LessonsCommandResult, LessonsQueryData } from './lessons-types.js';

/** Returns an error message if the flag is present but not a positive integer, else null. */
function validatePositiveIntFlag(flags: LessonsFlags, name: string): string | null {
  const v = flags[name];
  if (v === undefined || v === false) return null;
  const n = typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < 1) return `Invalid --${name}: expected a positive integer.`;
  return null;
}

/** Returns an error message if --format is present with a value outside plain|md|json, else null. */
function validateFormatFlag(flags: LessonsFlags): string | null {
  const v = flags.format;
  if (v === undefined) return null;
  if (v === 'plain' || v === 'md' || v === 'json') return null;
  return 'Invalid --format: expected plain|md|json.';
}

/** Join the non-empty warning parts into one stderr blob (or undefined when none). */
function mergeWarnings(...parts: Array<string | undefined>): string | undefined {
  const present = parts.filter((p): p is string => p !== undefined && p.length > 0);
  return present.length > 0 ? present.join('\n') : undefined;
}

/**
 * Warn when recall finds no graph at the CWD but a `.agentsmesh` project exists
 * in an ancestor — the classic "invoked from a subdirectory" trap, which would
 * otherwise look like an empty (but valid) recall.
 */
function strayDirWarning(projectRoot: string): string | undefined {
  if (existsSync(join(projectRoot, '.agentsmesh'))) return undefined;
  const ancestor = ancestorAgentsmeshDir(projectRoot);
  if (ancestor === null) return undefined;
  return `no lessons graph here — this directory has no .agentsmesh, but a project exists at ${ancestor.replaceAll('\\', '/')}. Run lessons from there (cd into it) for recall to work.`;
}

export function doQuery(
  flags: LessonsFlags,
  projectRoot: string,
  autoMigrated: boolean,
): LessonsCommandResult {
  const topErr = validatePositiveIntFlag(flags, 'top');
  if (topErr !== null) return errorResult('query', topErr, 2);
  const maxTokErr = validatePositiveIntFlag(flags, 'max-tokens');
  if (maxTokErr !== null) return errorResult('query', maxTokErr, 2);
  const fmtErr = validateFormatFlag(flags);
  if (fmtErr !== null) return errorResult('query', fmtErr, 2);

  const format = parseFormat(flags);
  const raw = queryFromFlags(flags);
  // A recall must be anchored to something. Zero predicates is a no-op call —
  // fail loudly so an agent learns to pass the file/command it is about to touch.
  if (raw.file === undefined && raw.command === undefined && raw.keyword === undefined) {
    return errorResult(
      'query',
      'Recall needs a predicate: pass at least one of --file <path-about-to-edit>, ' +
        '--cmd <command-about-to-run>, or --keyword <text>.',
      2,
    );
  }
  // Keyword-only recall silently misses file_glob / command_pattern lessons (the
  // reliable majority). Allow it, but warn — it is the recall anti-pattern.
  const keywordOnlyWarning =
    raw.keyword !== undefined && raw.file === undefined && raw.command === undefined
      ? 'keyword-only recall misses file_glob and command_pattern lessons — pass ' +
        '--file <path-about-to-edit> and/or --cmd <command-about-to-run> for complete recall.'
      : undefined;
  // Normalize the file path so a project-relative glob matches regardless of the
  // shape the caller passed (absolute / ./-prefixed / backslash).
  const query =
    raw.file === undefined ? raw : { ...raw, file: normalizeRecallFile(raw.file, projectRoot) };
  // A present-but-broken config.json must not silently revert to defaults.
  const configWarning = lessonsConfigWarning(projectRoot) ?? undefined;
  const load = loadLessonsGraphResilient(projectRoot);
  if (load.status === 'corrupt') {
    // Recall is a blocking requirement before every edit/command — a corrupt
    // graph must degrade to empty (exit 0), with a warning, not a stack trace.
    const data: LessonsQueryData = {
      lessons: [],
      query,
      autoMigrated,
      totalMatches: 0,
      warning: mergeWarnings(
        `lessons.json is unreadable (corrupt) — recall returned no lessons. Run \`agentsmesh lessons validate\`. (${load.error.message})`,
        configWarning,
      ),
    };
    return { subcommand: 'query', exitCode: 0, format, data };
  }
  if (load.status === 'newer-version') {
    // The graph is fine; this CLI is behind. Degrade to empty with an upgrade
    // hint instead of the misleading "corrupt" warning.
    const data: LessonsQueryData = {
      lessons: [],
      query,
      autoMigrated,
      totalMatches: 0,
      warning: mergeWarnings(
        `lessons.json is version ${load.version}, newer than this build supports (${CURRENT_GRAPH_VERSION}) — recall returned no lessons. Upgrade agentsmesh to read it.`,
        configWarning,
      ),
    };
    return { subcommand: 'query', exitCode: 0, format, data };
  }
  if (load.status === 'absent') {
    // A subdir-of-a-project warning already tells the user to cd to the root;
    // otherwise the graph is genuinely not set up here — point at init --lessons.
    const stray = strayDirWarning(projectRoot);
    const setup = stray === undefined ? lessonsSetupHint() : undefined;
    const warning = mergeWarnings(stray, setup, keywordOnlyWarning, configWarning);
    const data: LessonsQueryData = {
      lessons: [],
      query,
      autoMigrated,
      totalMatches: 0,
      ...(warning ? { warning } : {}),
    };
    return { subcommand: 'query', exitCode: 0, format, data };
  }
  const graph = load.graph;
  const matches = queryLessons(graph, query);
  // Dedup before ranking so the caps fill with fresh lessons (see seen-cache).
  const dedup = openSessionDedup({
    explicit: stringFlag(flags, 'session') ?? undefined,
    disabled: flags['no-dedup'] === true,
  });
  const forRank = dedup === null ? matches : filterUnseen(dedup, matches);
  // `--all` bypasses both caps; otherwise apply the per-project caps (which
  // default to the built-ins) so mandatory recall stays lean unless the caller
  // overrides via --top/--max-tokens.
  const cfg = loadRecallConfig(projectRoot);
  const limit = flags.all === true ? undefined : (numberFlag(flags, 'top') ?? cfg.limit);
  const maxTokens =
    flags.all === true ? undefined : (numberFlag(flags, 'max-tokens') ?? cfg.maxTokens);
  const ranked = rankLessons(graph, query, forRank, { limit, maxTokens });
  if (dedup !== null) commitSeen(dedup, ranked.map(({ id }) => id));
  // Record recall telemetry on the CLI path too (gated; no-op unless opt-in),
  // so shell-driven `lessons query` is visible to `lessons stats` — parity with
  // the MCP `lessons_query` tool, which records via recallLessons. `--all` is a
  // diagnostic dump, not a mandatory recall, so flag it as a bypass.
  recordRecallTelemetry(projectRoot, graph, query, matches, ranked, {
    bypassed: flags.all === true,
  });
  const lessons = ranked.map(({ id, lesson, score }) => ({
    id,
    rule: lesson.rule,
    topics: [...lesson.topics],
    triggers: [...lesson.triggers],
    evidence: [...lesson.evidence],
    score,
  }));
  const suppressed = matches.length - forRank.length;
  const data: LessonsQueryData = {
    lessons,
    query,
    autoMigrated,
    totalMatches: matches.length,
    ...(suppressed > 0 ? { suppressed } : {}),
    ...(flags.ids === true ? { showIds: true } : {}),
    ...((): { warning?: string } => {
      const warning = mergeWarnings(keywordOnlyWarning, configWarning);
      return warning ? { warning } : {};
    })(),
  };
  return { subcommand: 'query', exitCode: 0, format, data };
}
