import { existsSync, readFileSync } from 'node:fs';
import { lessonsPaths } from './paths.js';
import { DEFAULT_RECALL_LIMIT, DEFAULT_RECALL_MAX_TOKENS } from './ranking.js';

/**
 * Optional per-project recall tuning, read from `.agentsmesh/lessons/config.json`:
 *
 *   { "recallLimit": 5, "recallMaxTokens": 250 }
 *
 * Both fields are optional and independently fall back to the built-in defaults.
 * Lowering them keeps mandatory `--file`/`--cmd` recall lean on a large, high-fanout
 * graph (where recall otherwise returns many lessons per call); per-invocation
 * `--top`/`--all`/`--max-tokens` flags still override these.
 *
 * Recall is a BLOCKING hot path, so loading never throws: a missing/malformed
 * file or an invalid field silently uses the default for that field.
 */

export interface RecallConfig {
  readonly limit: number;
  readonly maxTokens: number;
}

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

export function loadRecallConfig(projectRoot: string): RecallConfig {
  const fallback: RecallConfig = {
    limit: DEFAULT_RECALL_LIMIT,
    maxTokens: DEFAULT_RECALL_MAX_TOKENS,
  };
  const path = lessonsPaths(projectRoot).config;
  if (!existsSync(path)) return fallback;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const cfg = parsed as Record<string, unknown>;
    return {
      limit: positiveInt(cfg.recallLimit) ?? fallback.limit,
      maxTokens: positiveInt(cfg.recallMaxTokens) ?? fallback.maxTokens,
    };
  } catch {
    return fallback;
  }
}
