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

import { basename, posix } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { AggregateResult } from './aggregate.js';
import type {
  BrokenLinkDecision,
  EntityWithBrokenLinks,
} from '../../install/prompts/broken-link-prompt.js';
import type { ResolvableOutsideLink, ResolvedLink } from '../../install/links/resolve-link.js';
import {
  applyRangeRewrites,
  scanMarkdownLinks,
  type RangeRewrite,
} from '../../core/reference/markdown-link-scan.js';
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

/**
 * Build exact-range rewrites for every markdown link destination in `body`
 * that matches `rawDestination`. Uses the shared markdown scanner so fenced
 * code blocks containing the same path stay untouched, and rewrites operate
 * on destination spans only (never on surrounding markdown).
 *
 * Match against the verbatim scanned destination — NOT a normalized form —
 * so links authored with `{baseDir}/…` or Windows-style `..\..\x.md` still
 * get rewritten. The scanner returns `token.destination` verbatim, and the
 * caller threads through `ScannedLink.raw` which preserves the original
 * spelling.
 */
function buildLinkRewrites(
  body: string,
  rawDestination: string,
  replacement: string,
): RangeRewrite[] {
  const rewrites: RangeRewrite[] = [];
  for (const token of scanMarkdownLinks(body)) {
    if (token.destination !== rawDestination) continue;
    rewrites.push({
      offset: token.destinationOffset,
      length: token.destinationLength,
      replacement,
    });
  }
  return rewrites;
}

function warnLink(logger: WarnLogger, entity: EntityWithBrokenLinks, resolved: ResolvedLink): void {
  logger.warn(
    `Broken link in ${entity.entityKind} "${entity.entityName}": ${resolved.link.path} (${resolved.classification})`,
  );
}

/**
 * Allocate `references/<name>` paths for a skill's `resolvable-outside` links.
 *
 * Default to `references/<basename>` when basenames are unique. If two distinct
 * `resolvedRelative` paths share a basename (e.g. `docs/A/README.md` and
 * `docs/B/README.md`), slug their parent path into the name (`docs-A-README.md`
 * and `docs-B-README.md`) so neither file is silently dropped and each citation
 * resolves to its own content.
 */
function allocateSupportingFileNames(
  resolvableLinks: readonly ResolvableOutsideLink[],
): Map<string, string> {
  const pathsByBasename = new Map<string, Set<string>>();
  for (const r of resolvableLinks) {
    const b = basename(r.resolvedRelative);
    const set = pathsByBasename.get(b) ?? new Set<string>();
    set.add(r.resolvedRelative);
    pathsByBasename.set(b, set);
  }
  const allocation = new Map<string, string>();
  for (const [b, paths] of pathsByBasename) {
    if (paths.size === 1) {
      const only = [...paths][0]!;
      allocation.set(only, `references/${b}`);
      continue;
    }
    for (const p of paths) {
      const slug = p.replaceAll('/', '-');
      allocation.set(p, `references/${slug}`);
    }
  }
  return allocation;
}

function findEntity(
  entities: readonly EntityWithBrokenLinks[],
  kind: EntityWithBrokenLinks['entityKind'],
  name: string,
): EntityWithBrokenLinks | undefined {
  return entities.find((e) => e.entityKind === kind && e.entityName === name);
}

async function buildSupportingFiles(
  contentRoot: string,
  existing: readonly SkillSupportingFile[],
  resolvableLinks: readonly ResolvableOutsideLink[],
  allocation: ReadonlyMap<string, string>,
): Promise<SkillSupportingFile[]> {
  const out: SkillSupportingFile[] = [...existing];
  const seenRelative = new Set(out.map((sf) => sf.relativePath));
  const seenResolved = new Set<string>();
  for (const r of resolvableLinks) {
    if (seenResolved.has(r.resolvedRelative)) continue;
    seenResolved.add(r.resolvedRelative);
    const relativePath = allocation.get(r.resolvedRelative);
    if (relativePath === undefined || seenRelative.has(relativePath)) continue;
    seenRelative.add(relativePath);
    // Forward-slash via `posix.join` so the path is identical on every
    // platform. Previous template-literal `${contentRoot}/${rel}`
    // produced mixed separators on Windows (back-slash in the tmpdir
    // root, forward-slash in the relative tail), which broke equality
    // checks downstream. `readFile` accepts both styles.
    const absolutePath = posix.join(contentRoot.replaceAll('\\', '/'), r.resolvedRelative);
    out.push({
      relativePath,
      absolutePath,
      content: await readFile(absolutePath, 'utf-8'),
    } satisfies SkillSupportingFile);
  }
  return out;
}

async function applySkillDecision(
  contentRoot: string,
  skill: CanonicalSkill,
  entity: EntityWithBrokenLinks,
  logger: WarnLogger,
): Promise<CanonicalSkill> {
  const resolvableLinks = entity.resolved.filter(
    (r): r is ResolvableOutsideLink => r.classification === 'resolvable-outside',
  );
  const allocation = allocateSupportingFileNames(resolvableLinks);
  const supportingFiles = await buildSupportingFiles(
    contentRoot,
    skill.supportingFiles,
    resolvableLinks,
    allocation,
  );

  // Dedupe by raw destination so the same `(raw, anchor)` pair doesn't trigger
  // multiple overlapping rewrites when the entity has inline + reference-def
  // entries pointing at the same target.
  const rewrites: RangeRewrite[] = [];
  const rewrittenRaw = new Set<string>();
  for (const r of entity.resolved) {
    if (r.classification === 'resolvable-outside') {
      if (rewrittenRaw.has(r.link.raw)) continue;
      const relativePath = allocation.get(r.resolvedRelative);
      if (relativePath === undefined) continue;
      rewrittenRaw.add(r.link.raw);
      const localDest = `./${relativePath}${r.anchor}`;
      rewrites.push(...buildLinkRewrites(skill.body, r.link.raw, localDest));
    } else {
      warnLink(logger, entity, r);
    }
  }

  const body = applyRangeRewrites(skill.body, rewrites);
  return { ...skill, body, supportingFiles };
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
