import { existsSync, readFileSync } from 'node:fs';
import picomatch from 'picomatch';
import type { AddLessonInput } from './add.js';
import { isBroadGlob, WIDE_GLOB_MATCH_COUNT, type GuardrailWarning } from './capture-guardrails.js';
import {
  isLowSignalKeyword,
  keywordNeedleLosesTokens,
  MAX_RECOMMENDED_KEYWORD_TOKENS,
} from './keyword-signal.js';
import { lessonsPaths } from './paths.js';
import { tokenize } from './ranking-text.js';
import { fileGlobMatchCount } from './validate-liveness.js';

/**
 * Opt-in capture-time trigger repair (config `repairTriggers: true`) — the
 * enforcement half of the warn-only capture guardrails. Field data shows the
 * guardrails detect degraded triggers on ~1/3 of captures but, being warn-only,
 * let them into the graph anyway; this pass repairs the INPUT before the write:
 *
 * - A broad/wide `file_glob` is narrowed toward the evidence file's directory
 *   class (`src/lessons/recall.ts` → `src/lessons/*.ts`) — but ONLY when a
 *   concrete evidence path exists, the author's glob covers it, and the derived
 *   glob matches no more files than the original. No evidence → no rewrite
 *   (never degrade coverage blindly; the BROAD_GLOB warning still fires).
 * - A stopworded or over-long keyword gets a matchable VARIANT added beside it
 *   (never replaced: the original still byte-matches prompt text; the variant
 *   makes the mandatory --file/--cmd token path reachable).
 * - A keyword that tokenizes to nothing is dropped (dead on every path).
 *
 * Repairs surface as warnings on the capture result, so CLI/MCP output and
 * capture telemetry show exactly what was rewritten. The directory class is an
 * automatic compromise — for general/library behavior the author should still
 * re-point at the file-CLASS recurrence surface (a globstar over a distinctive
 * basename pattern), which no automatic pass can infer; the NARROWED_GLOB
 * message says so.
 */

/** True when the project config opts into capture-time trigger repair. */
export function isTriggerRepairEnabled(projectRoot: string): boolean {
  const path = lessonsPaths(projectRoot).config;
  if (!existsSync(path)) return false;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return false;
    return (parsed as Record<string, unknown>).repairTriggers === true;
  } catch {
    return false;
  }
}

export interface TriggerRepairResult {
  /** The (possibly rewritten) capture input. The original object when no repair applied. */
  readonly input: AddLessonInput;
  /** One warning per repair action, reported through the guardrail channel. */
  readonly repairs: GuardrailWarning[];
}

/** First evidence entry that is a working-tree path (strips `:line` suffixes and backslashes). */
function evidencePath(
  evidence: readonly string[] | undefined,
  knownPaths: ReadonlySet<string>,
): string | undefined {
  for (const entry of evidence ?? []) {
    const candidate = entry
      .replaceAll('\\', '/')
      .replace(/(:\d+)+$/, '')
      .trim();
    if (knownPaths.has(candidate)) return candidate;
  }
  return undefined;
}

/** Directory-class glob for a path: `src/lessons/recall.ts` → `src/lessons/*.ts`. */
function classGlobFor(path: string): string {
  const slash = path.lastIndexOf('/');
  const dir = slash === -1 ? '' : path.slice(0, slash + 1);
  const base = path.slice(slash + 1);
  const dot = base.lastIndexOf('.');
  return `${dir}*${dot > 0 ? base.slice(dot) : ''}`;
}

function repairFileGlobs(
  files: readonly string[],
  evidence: string | undefined,
  knownPaths: ReadonlySet<string> | undefined,
  repairs: GuardrailWarning[],
): string[] {
  const out: string[] = [];
  for (const glob of files) {
    const needsNarrow =
      knownPaths !== undefined &&
      (isBroadGlob(glob) || fileGlobMatchCount(glob, knownPaths) > WIDE_GLOB_MATCH_COUNT);
    if (!needsNarrow || evidence === undefined || !picomatch(glob, { dot: true })(evidence)) {
      if (!out.includes(glob)) out.push(glob);
      continue;
    }
    const derived = classGlobFor(evidence);
    // `derived !== glob`: a wide glob that is ALREADY its own directory class needs
    // no rewrite — narrowing X→X changes nothing and must not emit a self-referential
    // "narrowed X to X" warning.
    const derivedOk =
      derived !== glob &&
      picomatch(derived, { dot: true })(evidence) &&
      fileGlobMatchCount(derived, knownPaths) <= fileGlobMatchCount(glob, knownPaths);
    if (!derivedOk) {
      if (!out.includes(glob)) out.push(glob);
      continue;
    }
    if (!out.includes(derived)) out.push(derived);
    repairs.push({
      code: 'NARROWED_GLOB',
      message:
        `Narrowed broad file glob "${glob}" to the evidence file's class "${derived}". ` +
        `Review: for general/library behavior, re-point at the file-CLASS recurrence ` +
        `surface (a '**/.../*Name*.ts'-style glob) where the rule will actually recur.`,
    });
  }
  return out;
}

function repairKeywords(keywords: readonly string[], repairs: GuardrailWarning[]): string[] {
  const out: string[] = [];
  for (const kw of keywords) {
    const tokens = tokenize(kw);
    if (tokens.length === 0) {
      repairs.push({
        code: 'DROPPED_KEYWORD',
        message: `Dropped keyword trigger "${kw}" — it tokenizes to nothing (stopwords/short words only) and can never fire.`,
      });
      continue;
    }
    if (!out.includes(kw)) out.push(kw);
    if (!keywordNeedleLosesTokens(kw) && !isLowSignalKeyword(kw)) continue;
    const variant = tokens.slice(0, MAX_RECOMMENDED_KEYWORD_TOKENS).join(' ');
    if (variant.toLowerCase() === kw.toLowerCase() || out.includes(variant)) continue;
    out.push(variant);
    repairs.push({
      code: 'KEYWORD_VARIANT_ADDED',
      message:
        `Keyword trigger "${kw}" cannot match on the mandatory --file/--cmd token path; ` +
        `added the matchable variant "${variant}" beside it (the original still matches prompt text).`,
    });
  }
  return out;
}

/**
 * Repair the capture input's triggers (pure). Returns the ORIGINAL input object
 * untouched when nothing needed repair — or when repair would leave the lesson
 * with zero triggers (a repair must never block an add the author's input would
 * have passed; the existing gates judge the original instead).
 */
export function repairTriggers(
  input: AddLessonInput,
  knownPaths: ReadonlySet<string> | undefined,
): TriggerRepairResult {
  const repairs: GuardrailWarning[] = [];
  const evidence = knownPaths === undefined ? undefined : evidencePath(input.evidence, knownPaths);
  const files =
    input.triggers.files === undefined
      ? undefined
      : repairFileGlobs(input.triggers.files, evidence, knownPaths, repairs);
  const keywords =
    input.triggers.keywords === undefined
      ? undefined
      : repairKeywords(input.triggers.keywords, repairs);
  if (repairs.length === 0) return { input, repairs };

  const total =
    (files?.length ?? 0) + (input.triggers.commands?.length ?? 0) + (keywords?.length ?? 0);
  if (total === 0) return { input, repairs: [] };

  return {
    input: {
      ...input,
      triggers: {
        ...(files !== undefined ? { files } : {}),
        ...(input.triggers.commands !== undefined ? { commands: input.triggers.commands } : {}),
        ...(keywords !== undefined ? { keywords } : {}),
      },
    },
    repairs,
  };
}
