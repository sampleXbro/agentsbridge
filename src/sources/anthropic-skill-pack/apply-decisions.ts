/**
 * Applies the user's broken-link decisions to a skill-pack aggregate.
 *
 * For each `include-resolvable` decision on a skill entity, copies the
 * resolvable external targets into the skill's `supportingFiles`, then
 * rewrites every occurrence of the original link destination in the entity
 * body to `./references/<basename>` (preserving any `#anchor`). Unresolvable
 * links inside the same entity are left in place and surfaced as warnings.
 *
 * Limitations:
 *  - Only skills carry per-entity supporting files in the canonical model.
 *    For agents / commands / rules, an `include-resolvable` decision is
 *    downgraded to `leave-with-warnings` and a warning is emitted.
 *  - Body rewrites use string replace on the raw destination. The same
 *    destination appearing in multiple places (e.g. inline plus reference
 *    definition) is replaced everywhere it occurs in that single body.
 */

import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { AggregateResult } from './aggregate.js';
import type {
  BrokenLinkDecision,
  EntityWithBrokenLinks,
} from '../../install/prompts/broken-link-prompt.js';
import type { ResolvedLink } from '../../install/links/resolve-link.js';
import type { CanonicalSkill, SkillSupportingFile } from '../../core/types.js';

export interface WarnLogger {
  warn: (msg: string) => void;
}

export interface ApplyBrokenLinkDecisionsArgs {
  readonly contentRoot: string;
  readonly aggregate: AggregateResult;
  readonly decisions: readonly BrokenLinkDecision[];
  readonly logger: WarnLogger;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function warnLink(logger: WarnLogger, entity: EntityWithBrokenLinks, resolved: ResolvedLink): void {
  logger.warn(
    `Broken link in ${entity.entityKind} "${entity.entityName}": ${resolved.link.path} (${resolved.classification})`,
  );
}

async function applyResolvableToSkill(
  contentRoot: string,
  skill: CanonicalSkill,
  resolved: ResolvedLink,
): Promise<CanonicalSkill> {
  if (resolved.classification !== 'resolvable-outside' || resolved.resolvedRelative === null) {
    return skill;
  }
  const absolutePath = `${contentRoot}/${resolved.resolvedRelative}`;
  const targetBasename = basename(resolved.resolvedRelative);
  const relativePath = `references/${targetBasename}`;
  const localDest = `./references/${targetBasename}${resolved.anchor}`;

  const supportingFiles = skill.supportingFiles.some((sf) => sf.relativePath === relativePath)
    ? skill.supportingFiles
    : [
        ...skill.supportingFiles,
        {
          relativePath,
          absolutePath,
          content: await readFile(absolutePath, 'utf-8'),
        } satisfies SkillSupportingFile,
      ];

  const body = skill.body.replace(new RegExp(escapeRegex(resolved.link.path), 'g'), localDest);
  return { ...skill, body, supportingFiles };
}

function findEntity(
  entities: readonly EntityWithBrokenLinks[],
  kind: EntityWithBrokenLinks['entityKind'],
  name: string,
): EntityWithBrokenLinks | undefined {
  return entities.find((e) => e.entityKind === kind && e.entityName === name);
}

async function applySkillDecision(
  contentRoot: string,
  skill: CanonicalSkill,
  entity: EntityWithBrokenLinks,
  logger: WarnLogger,
): Promise<CanonicalSkill> {
  let next = skill;
  for (const r of entity.resolved) {
    if (r.classification === 'resolvable-outside') {
      next = await applyResolvableToSkill(contentRoot, next, r);
    } else {
      warnLink(logger, entity, r);
    }
  }
  return next;
}

export async function applyBrokenLinkDecisions(
  args: ApplyBrokenLinkDecisionsArgs,
): Promise<AggregateResult> {
  const { contentRoot, aggregate, decisions, logger } = args;
  if (decisions.length === 0) return aggregate;

  const skillIncludeNames = new Set<string>();
  for (const d of decisions) {
    if (d.entityKind === 'skill' && d.action === 'include-resolvable') {
      skillIncludeNames.add(d.entityName);
    }
  }

  const skills: CanonicalSkill[] = [];
  for (const skill of aggregate.skills) {
    const entity = skillIncludeNames.has(skill.name)
      ? findEntity(aggregate.brokenLinks, 'skill', skill.name)
      : undefined;
    skills.push(entity ? await applySkillDecision(contentRoot, skill, entity, logger) : skill);
  }

  for (const d of decisions) {
    if (d.entityKind === 'skill' && d.action === 'include-resolvable') continue;
    const entity = findEntity(aggregate.brokenLinks, d.entityKind, d.entityName);
    if (!entity) continue;
    for (const r of entity.resolved) warnLink(logger, entity, r);
  }

  return { ...aggregate, skills };
}
