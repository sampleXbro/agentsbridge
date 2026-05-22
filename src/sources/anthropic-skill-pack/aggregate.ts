/**
 * Pure orchestrator for the Anthropic skill-pack source descriptor.
 *
 * Walks a fetched `contentRoot`, calling the install-layer entity importers
 * for skills/agents/rules/commands, merges command files from per-tool
 * directories per the descriptor's precedence rules (see `merge-commands.ts`),
 * and surfaces broken relative markdown links per entity
 * (see `link-scan.ts`).
 *
 * Scope:
 *  - Pure: no prompting, no disk writes, no manifest reads.
 *  - The install pipeline (P8) consumes `AggregateResult`, drives the
 *    broken-link prompt with `brokenLinks`, applies any include-resolvable
 *    decisions, and writes the resulting pack.
 */

import {
  importAgents,
  importRules,
  importSkills,
} from '../../install/importers/entity-importers.js';
import type { ParseFrontmatterOptions } from '../../canonical/features/rules.js';
import type { EntityWithBrokenLinks } from '../../install/prompts/broken-link-prompt.js';
import type {
  CanonicalAgent,
  CanonicalCommand,
  CanonicalRule,
  CanonicalSkill,
} from '../../core/types.js';
import { buildIncludedPaths, detectBrokenLinks } from './link-scan.js';
import { mergeCommands } from './merge-commands.js';

export interface CommandMergeSpec {
  /** Directory relative to `contentRoot` containing `*.md` command files. */
  readonly dir: string;
  /** Target id this directory is associated with; informational only. */
  readonly target?: string;
  /** Lower precedence wins on a `name` collision; ties resolve by array order. */
  readonly precedence: number;
}

export interface SourceDescriptor {
  /** Stable id of the source descriptor (e.g. `anthropic-skill-pack`). */
  readonly id: string;
  /** Command directories to merge in addition to canonical `commands/`. */
  readonly mergeFromToolDirs: readonly CommandMergeSpec[];
}

export interface CommandDedup {
  /** Command name (basename without extension) where the conflict occurred. */
  readonly basename: string;
  /** Source path of the command that won the merge. */
  readonly winnerPath: string;
  /** Source paths of commands that lost, ordered by precedence ascending. */
  readonly loserPaths: readonly string[];
}

export interface AggregateResult {
  readonly skills: readonly CanonicalSkill[];
  readonly agents: readonly CanonicalAgent[];
  readonly commands: readonly CanonicalCommand[];
  readonly rules: readonly CanonicalRule[];
  readonly dedups: readonly CommandDedup[];
  readonly brokenLinks: readonly EntityWithBrokenLinks[];
}

export async function aggregateAnthropicSkillPack(
  contentRoot: string,
  descriptor: SourceDescriptor,
  parseOpts: ParseFrontmatterOptions = {},
): Promise<AggregateResult> {
  const [skills, agents, rules, merged] = await Promise.all([
    importSkills(`${contentRoot}/skills`, parseOpts),
    importAgents(`${contentRoot}/agents`, parseOpts),
    importRules(`${contentRoot}/rules`, parseOpts),
    mergeCommands(contentRoot, descriptor.mergeFromToolDirs, parseOpts),
  ]);

  const includedPaths = buildIncludedPaths(contentRoot, skills, agents, merged.commands, rules);
  const brokenLinks = await detectBrokenLinks(
    contentRoot,
    skills,
    agents,
    merged.commands,
    rules,
    includedPaths,
  );

  return {
    skills,
    agents,
    commands: merged.commands,
    rules,
    dedups: merged.dedups,
    brokenLinks,
  };
}
