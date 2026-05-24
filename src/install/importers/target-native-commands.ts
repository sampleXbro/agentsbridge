/**
 * Read commands from a tool-native directory using THAT target's command
 * importer mapper, so non-Markdown formats (e.g. Gemini's `.toml` slash
 * commands) parse correctly into canonical entities.
 *
 * Single source of truth: there is exactly one definition of "how to read X's
 * commands" — the target descriptor's `importer.commands` spec. Both the
 * descriptor-driven full install (`runDescriptorImport`) and the skill-pack
 * aggregator (`mergeCommands`) route per-tool directory reads through this
 * helper, so adding a new target with an exotic command format is a one-place
 * change (the target descriptor) instead of a sweep across aggregators.
 *
 * Implementation: stage the mapper's canonical-`.md` output into a temp dir,
 * then read it back through `parseCommands`. That keeps the canonical
 * parser's collision detection, frontmatter handling, and name validation in
 * one place; we don't reimplement any of it here.
 */

import { basename, dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { parseCommands } from '../../canonical/features/commands.js';
import type { ParseFrontmatterOptions } from '../../canonical/features/rules.js';
import {
  mkdirp,
  readDirRecursive,
  readFileSafe,
  writeFileAtomic,
} from '../../utils/filesystem/fs.js';
import { getDescriptor } from '../../targets/catalog/registry.js';
import type { CanonicalCommand } from '../../core/types.js';
import { isBoilerplate } from './boilerplate-filter.js';

/**
 * True when `targetId` ships its own directory-mode command importer mapper
 * **and** that mapper accepts at least one non-Markdown extension. Pure-`.md`
 * targets (claude-code, cursor, …) stay on the canonical reader: routing
 * them through the staging path would be a no-op transform that destroys
 * upstream source-path metadata (dedup logging, error messages) for no gain.
 *
 * The dispatch fires for targets like gemini-cli whose commands ship in
 * native non-Markdown formats (TOML), where the mapper actually produces
 * different bytes than the upstream file.
 */
export function hasToolNativeCommandImporter(targetId: string): boolean {
  const spec = getDescriptor(targetId)?.importer?.commands;
  if (!spec || spec.mode !== 'directory' || !spec.map) return false;
  const extensions = spec.extensions ?? ['.md'];
  return extensions.some((ext) => ext.toLowerCase() !== '.md');
}

/**
 * Non-`.md` extensions the target's command importer handles. Used by
 * `mergeCommands` to silence the canonical reader's "unrecognized formats"
 * warning for files this target's mapper will pick up downstream.
 */
export function toolNativeCommandExtensions(targetId: string): ReadonlySet<string> {
  const spec = getDescriptor(targetId)?.importer?.commands;
  if (!spec || spec.mode !== 'directory' || !spec.map) return new Set();
  return new Set(
    (spec.extensions ?? []).map((ext) => ext.toLowerCase()).filter((ext) => ext !== '.md'),
  );
}

export interface ToolNativeCommandsResult {
  readonly commands: readonly CanonicalCommand[];
  /**
   * Removes the temp staging directory holding the mapper's canonical output.
   * Callers MUST invoke this only after they're done reading from
   * `commands[].source` (e.g. after pack materialization has copied each
   * staged file into the pack tree).
   */
  readonly cleanup: () => Promise<void>;
}

/**
 * Read commands from `<contentRoot>/<dirRel>` via the target's importer
 * mapper. Returns canonical commands referencing files in a temp staging
 * directory plus a cleanup callback to remove that directory once the caller
 * has finished using `commands[].source` (pack-writer `copyFile`s from
 * `cmd.source`, so the staging dir must outlive that step).
 *
 * Throws when the target has no directory-mode command importer with a
 * mapper — callers should guard with `hasToolNativeCommandImporter` and
 * fall back to the canonical Markdown reader for canonical dirs.
 */
export async function readToolNativeCommands(
  contentRoot: string,
  dirRel: string,
  targetId: string,
  parseOpts: ParseFrontmatterOptions = {},
): Promise<ToolNativeCommandsResult> {
  const descriptor = getDescriptor(targetId);
  const spec = descriptor?.importer?.commands;
  if (!descriptor || !spec || spec.mode !== 'directory' || !spec.map) {
    throw new Error(
      `Target "${targetId}" has no directory-mode command importer with a mapper. ` +
        `Callers must guard with hasToolNativeCommandImporter() first.`,
    );
  }

  const srcDir = join(contentRoot, dirRel);
  const allFiles = await readDirRecursive(srcDir);
  const extensions = spec.extensions ?? ['.md'];
  // Only handle non-Markdown extensions here. `.md` files are read via the
  // canonical reader by the caller so the upstream path lives on
  // `CanonicalCommand.source` (preserves dedup-log readability + tests that
  // assert upstream paths). Staging is reserved for formats that genuinely
  // need transformation, e.g. Gemini's `.toml` slash commands.
  const nonMdExtensions = extensions.filter((ext) => ext.toLowerCase() !== '.md');
  const matched = allFiles.filter(
    (path) =>
      nonMdExtensions.some((ext) => path.toLowerCase().endsWith(ext.toLowerCase())) &&
      !isBoilerplate(basename(path)),
  );
  if (matched.length === 0) return { commands: [], cleanup: async () => {} };

  const stageDir = await mkdtemp(join(tmpdir(), `am-tool-cmds-${targetId}-`));
  const cleanup = async (): Promise<void> => {
    await rm(stageDir, { recursive: true, force: true });
  };
  try {
    for (const absPath of matched) {
      const content = await readFileSafe(absPath);
      if (content === null) continue;
      const relPath = relative(srcDir, absPath).replaceAll('\\', '/');
      const mapping = await spec.map({
        absolutePath: absPath,
        relativePath: relPath,
        content,
        destDir: stageDir,
        normalizeTo: () => content,
      });
      if (!mapping) continue;
      await mkdirp(dirname(mapping.destPath));
      await writeFileAtomic(mapping.destPath, mapping.content);
    }
    const commands = await parseCommands(stageDir, parseOpts);
    return { commands, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
