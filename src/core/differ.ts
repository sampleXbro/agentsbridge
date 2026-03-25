/**
 * Diff engine: produces unified diffs between generated content and on-disk files.
 */

import { createTwoFilesPatch } from 'diff';
import type { GenerateResult } from './types.js';

export interface DiffEntry {
  path: string;
  patch: string;
}

export interface DiffSummary {
  new: number;
  updated: number;
  unchanged: number;
  deleted: number;
}

export interface ComputeDiffResult {
  diffs: DiffEntry[];
  summary: DiffSummary;
}

/**
 * Compute unified diffs for generate results.
 * @param results - Output from engine.generate()
 * @returns Diffs for created/updated files plus summary counts
 */
export function computeDiff(results: GenerateResult[]): ComputeDiffResult {
  const diffs: DiffEntry[] = [];
  const summary: DiffSummary = { new: 0, updated: 0, unchanged: 0, deleted: 0 };

  for (const r of results) {
    if (r.status === 'unchanged') {
      summary.unchanged++;
      continue;
    }
    if (r.status === 'created') {
      summary.new++;
      const patch = createTwoFilesPatch(
        `${r.path} (current)`,
        `${r.path} (generated)`,
        '',
        r.content,
        undefined,
        undefined,
        { context: 3 },
      );
      diffs.push({ path: r.path, patch });
      continue;
    }
    if (r.status === 'updated' && r.currentContent !== undefined) {
      summary.updated++;
      const patch = createTwoFilesPatch(
        `${r.path} (current)`,
        `${r.path} (generated)`,
        r.currentContent,
        r.content,
        undefined,
        undefined,
        { context: 3 },
      );
      diffs.push({ path: r.path, patch });
      continue;
    }
  }

  return { diffs, summary };
}

/**
 * Format diff summary for user display.
 * @param summary - Counts from computeDiff
 * @returns Human-readable string
 */
export function formatDiffSummary(summary: DiffSummary): string {
  return `${summary.new} files would be created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.deleted} deleted`;
}
