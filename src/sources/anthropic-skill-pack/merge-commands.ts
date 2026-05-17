/**
 * Command merging for the Anthropic skill-pack aggregator.
 *
 * Walks every command directory declared in the descriptor in precedence
 * order (lowest precedence wins on `name` collision) and produces a merged
 * command list plus a `CommandDedup` record per conflict. The explicit root
 * `commands/` directory is included as `precedence: 0`, so it always wins
 * over per-tool directories such as `.claude/commands/`.
 */

import { importCommands } from '../../install/importers/entity-importers.js';
import type { CanonicalCommand } from '../../core/types.js';
import type { CommandDedup, CommandMergeSpec } from './aggregate.js';

interface MergedCommand {
  readonly command: CanonicalCommand;
  readonly precedence: number;
}

export interface MergedCommandsResult {
  readonly commands: readonly CanonicalCommand[];
  readonly dedups: readonly CommandDedup[];
}

export async function mergeCommands(
  contentRoot: string,
  specs: readonly CommandMergeSpec[],
): Promise<MergedCommandsResult> {
  const winners = new Map<string, MergedCommand>();
  const losers = new Map<string, Array<{ path: string; precedence: number }>>();

  const ordered = [...specs].sort((a, b) => a.precedence - b.precedence);
  for (const spec of ordered) {
    const dir = `${contentRoot}/${spec.dir}`;
    const commands = await importCommands(dir);
    for (const cmd of commands) {
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
    if (winner === undefined) continue;
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

  return { commands: mergedCommands, dedups };
}
