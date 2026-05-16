/**
 * B1 broken-link prompt: per-entity user decision on how to handle relative
 * markdown links that point outside the install scope or fail to resolve.
 *
 * For each entity that surfaced one or more `resolvable-outside` /
 * `unresolvable` links, the user picks one of three actions:
 *
 *   [i]nclude resolvable as supporting files - aggregator copies the
 *     resolvable targets in and rewrites the link to the local path;
 *     unresolvable links remain with a warning.
 *   [l]eave with warnings - all links unchanged; warning per link.
 *   [a]bort install - exit 130; no writes happen.
 *
 * Non-interactive callers (`--force`, `--json`, non-TTY) pass `bypass: true`
 * and every entity defaults to `leave-with-warnings`. EOF/Ctrl-D and any
 * unrecognized response abort the run; the caller maps `aborted = true`
 * onto exit code 130.
 *
 * This module is pure: it owns no streams, asks no questions directly, and
 * does NOT perform the actual rewrite or copy. It returns the per-entity
 * decision; the aggregator (P7) applies it during pack staging.
 */

import type { ResolvedLink } from '../links/resolve-link.js';
import type { PromptAdapter } from './prompt-types.js';

export type BrokenLinkAction = 'include-resolvable' | 'leave-with-warnings';

export interface EntityWithBrokenLinks {
  readonly entityKind: 'skill' | 'agent' | 'command' | 'rule';
  readonly entityName: string;
  /** Links the caller wants surfaced - typically every link NOT in-tree-included. */
  readonly resolved: readonly ResolvedLink[];
}

export interface BrokenLinkDecision {
  readonly entityKind: EntityWithBrokenLinks['entityKind'];
  readonly entityName: string;
  readonly action: BrokenLinkAction;
}

export interface BrokenLinkPromptResult {
  readonly decisions: readonly BrokenLinkDecision[];
  readonly aborted: boolean;
}

export interface BrokenLinkPromptOptions {
  /** `--force` / `--json` / non-TTY: defaults every entity to `leave-with-warnings`. */
  readonly bypass: boolean;
}

function writeBanner(deps: PromptAdapter, entity: EntityWithBrokenLinks): void {
  const count = entity.resolved.length;
  const label = count === 1 ? 'link' : 'links';
  const lines: string[] = [
    `Entity "${entity.entityName}" (${entity.entityKind}) has ${count} broken ${label}:`,
  ];
  for (const r of entity.resolved) {
    lines.push(`  - ${r.link.path} (${r.classification})`);
  }
  lines.push('');
  deps.write(`${lines.join('\n')}\n`);
}

export async function runBrokenLinkPrompt(
  entities: readonly EntityWithBrokenLinks[],
  options: BrokenLinkPromptOptions,
  deps: PromptAdapter,
): Promise<BrokenLinkPromptResult> {
  const decisions: BrokenLinkDecision[] = [];

  for (const entity of entities) {
    if (entity.resolved.length === 0) continue;

    if (options.bypass) {
      writeBanner(deps, entity);
      decisions.push({
        entityKind: entity.entityKind,
        entityName: entity.entityName,
        action: 'leave-with-warnings',
      });
      continue;
    }

    writeBanner(deps, entity);
    const answer = (
      await deps.ask(
        'Action: [i]nclude resolvable as supporting files / [l]eave with warnings / [a]bort install ',
      )
    )
      .trim()
      .toLowerCase();

    if (answer === 'i') {
      decisions.push({
        entityKind: entity.entityKind,
        entityName: entity.entityName,
        action: 'include-resolvable',
      });
      continue;
    }
    if (answer === 'l') {
      decisions.push({
        entityKind: entity.entityKind,
        entityName: entity.entityName,
        action: 'leave-with-warnings',
      });
      continue;
    }
    return { decisions: [], aborted: true };
  }

  return { decisions, aborted: false };
}
