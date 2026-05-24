/**
 * Command merging for the Anthropic skill-pack aggregator.
 *
 * Walks every command directory declared in the descriptor in precedence
 * order (lowest precedence wins on `name` collision) and produces a merged
 * command list plus a `CommandDedup` record per conflict. The explicit root
 * `commands/` directory is included as `precedence: 0`, so it always wins
 * over per-tool directories such as `.claude/commands/`.
 *
 * Per-tool dirs delegate to that target's command importer mapper (via
 * `readToolNativeCommands`) when `spec.target` is set and the target ships
 * a directory-mode mapper. That's how `.gemini/commands/*.toml` parse
 * correctly — single source of truth for the per-target native format
 * lives in the target descriptor, not duplicated here.
 */

import { join } from 'node:path';
import { importCommands } from '../../install/importers/entity-importers.js';
import {
  hasToolNativeCommandImporter,
  readToolNativeCommands,
  toolNativeCommandExtensions,
} from '../../install/importers/target-native-commands.js';
import type { ParseFrontmatterOptions } from '../../canonical/features/rules.js';
import type { CanonicalCommand } from '../../core/types.js';
import type { CommandDedup, CommandMergeSpec } from './aggregate.js';

interface MergedCommand {
  readonly command: CanonicalCommand;
  readonly precedence: number;
}

export interface MergedCommandsResult {
  readonly commands: readonly CanonicalCommand[];
  readonly dedups: readonly CommandDedup[];
  /**
   * Removes any temp staging directories created by per-target command
   * importers. Always safe to call (no-op when nothing was staged). The
   * install pipeline invokes it via `prep.cleanup()` after pack materialization.
   */
  readonly cleanup: () => Promise<void>;
}

export async function mergeCommands(
  contentRoot: string,
  specs: readonly CommandMergeSpec[],
  parseOpts: ParseFrontmatterOptions = {},
): Promise<MergedCommandsResult> {
  const winners = new Map<string, MergedCommand>();
  const losers = new Map<string, Array<{ path: string; precedence: number }>>();
  const cleanups: Array<() => Promise<void>> = [];

  const ordered = [...specs].sort((a, b) => a.precedence - b.precedence);
  for (const spec of ordered) {
    // Canonical .md files always go through `importCommands` so the upstream
    // path lives on `CanonicalCommand.source` (dedup metadata, error
    // messages). Per-tool native non-.md formats (e.g. Gemini `.toml`)
    // additionally route through that target's importer mapper so they
    // parse correctly instead of being silently dropped.
    const handledByOtherReader = spec.target ? toolNativeCommandExtensions(spec.target) : undefined;
    const collected: CanonicalCommand[] = [
      ...(await importCommands(join(contentRoot, spec.dir), {
        ...parseOpts,
        handledByOtherReader,
      })),
    ];
    if (spec.target && hasToolNativeCommandImporter(spec.target)) {
      const result = await readToolNativeCommands(contentRoot, spec.dir, spec.target, parseOpts);
      collected.push(...result.commands);
      cleanups.push(result.cleanup);
    }
    for (const cmd of collected) {
      const existing = winners.get(cmd.name);
      if (existing === undefined) {
        winners.set(cmd.name, { command: cmd, precedence: spec.precedence });
        continue;
      }
      const list = losers.get(cmd.name) ?? [];
      list.push({ path: cmd.source, precedence: spec.precedence });
      losers.set(cmd.name, list);
    }
  }

  const dedups: CommandDedup[] = [];
  for (const [name, loserList] of losers) {
    const winner = winners.get(name);
    // Invariant: `losers` is only populated when a `winners` entry already
    // exists for the same name. A missing winner here means the invariant has
    // been broken by a refactor — fail loudly rather than hide the bug.
    if (winner === undefined) {
      throw new Error(`mergeCommands invariant: loser without winner for "${name}"`);
    }
    // `loserList` was filled by iterating `ordered` (sorted ascending by
    // precedence at line 32), so it is already in precedence order.
    dedups.push({
      basename: name,
      winnerPath: winner.command.source,
      loserPaths: loserList.map((l) => l.path),
    });
  }
  dedups.sort((a, b) => a.basename.localeCompare(b.basename));

  const mergedCommands = [...winners.values()]
    .map((w) => w.command)
    .sort((a, b) => a.name.localeCompare(b.name));

  const cleanup = async (): Promise<void> => {
    // Run every staged-dir cleanup, swallowing per-step errors so one
    // mid-batch failure can't strand the others. Cleanup is best-effort
    // by design — tmpdir reapers will catch anything we miss.
    await Promise.allSettled(cleanups.map((fn) => fn()));
  };

  return { commands: mergedCommands, dedups, cleanup };
}
