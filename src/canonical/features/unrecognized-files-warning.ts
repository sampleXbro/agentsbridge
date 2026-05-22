import { basename, extname } from 'node:path';
import { logger } from '../../utils/output/logger.js';

/**
 * Extensions that look like an *alternative* command/agent/rule definition
 * format — i.e. another tool's native format that agentsmesh doesn't parse.
 * Triggering on these helps users discover that, for example, codex-cli /
 * gemini-cli `.toml` slash commands or YAML-style configs were silently
 * dropped by the install pipeline.
 *
 * Plain content extensions (`.txt`, `.png`, `.sh`, …) are not flagged
 * because they're not command definitions.
 */
const ALTERNATE_RESOURCE_FORMATS = new Set(['.toml', '.yaml', '.yml', '.json']);

/**
 * R-5: warn when a feature directory contains files in an alternate
 * definition format (e.g. `.toml` slash commands) that the parser silently
 * skipped. Pure data files (`.txt`, images, scripts) are NOT flagged.
 *
 * `featureLabel` is what the user sees in the warning (e.g. "commands").
 * `dir` is the scanned directory. `allFiles` and `parsedFiles` are the
 * pre-computed file lists from the caller so we don't re-walk the tree.
 */
export function warnIfUnrecognizedResourceFormats(
  featureLabel: string,
  dir: string,
  allFiles: readonly string[],
  parsedFiles: readonly string[],
): void {
  if (allFiles.length === 0) return;
  const parsed = new Set(parsedFiles);
  const formats = new Set<string>();
  let droppedCount = 0;
  for (const f of allFiles) {
    if (parsed.has(f)) continue;
    if (basename(f).startsWith('.')) continue;
    const ext = extname(f).toLowerCase();
    if (!ALTERNATE_RESOURCE_FORMATS.has(ext)) continue;
    formats.add(ext);
    droppedCount++;
  }
  if (droppedCount === 0) return;
  const formatList = [...formats].sort().join(', ');
  logger.warn(
    `Skipped ${droppedCount} ${featureLabel} file(s) in ${dir} ` +
      `(format${formats.size === 1 ? '' : 's'}: ${formatList}). ` +
      `agentsmesh ${featureLabel} are parsed from .md files only.`,
  );
}
