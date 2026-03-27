/**
 * Build validated resource pools for install (description checks + optional prompts).
 */

import type {
  CanonicalAgent,
  CanonicalCommand,
  CanonicalFiles,
  CanonicalRule,
  CanonicalSkill,
} from '../../core/types.js';
import { confirm } from './prompts.js';
import {
  validateAgent,
  validateCommand,
  validateRule,
  validateSkill,
  ruleSlug,
} from './validate-resources.js';

export function hasArrayResources(c: CanonicalFiles): boolean {
  return !!(c.skills.length || c.rules.length || c.commands.length || c.agents.length);
}

export function hasInstallableResources(c: CanonicalFiles): boolean {
  return (
    hasArrayResources(c) ||
    c.mcp !== null ||
    c.permissions !== null ||
    c.hooks !== null ||
    c.ignore.length > 0
  );
}

export async function resolveSkillPool(
  narrowed: CanonicalFiles,
  force: boolean,
  dryRun: boolean,
  tty: boolean,
): Promise<CanonicalSkill[]> {
  const skillCandidates = narrowed.skills.map((s) => validateSkill(s));
  let pool = skillCandidates.filter((c) => c.ok).map((c) => c.skill);
  const invalid = skillCandidates.filter((c) => !c.ok);
  if (!force && !dryRun && tty) {
    for (const inv of invalid) {
      const ok = await confirm(
        `Include invalid skill "${inv.skill.name}" anyway? (${inv.reason}). You can fix it later.`,
      );
      if (ok) pool.push(inv.skill);
    }
  } else if (force) {
    pool = skillCandidates.map((c) => c.skill);
  }
  if (dryRun) {
    pool = skillCandidates.filter((c) => c.ok).map((c) => c.skill);
  }
  return pool;
}

export async function resolveRulePool(
  narrowed: CanonicalFiles,
  force: boolean,
  dryRun: boolean,
  tty: boolean,
): Promise<CanonicalRule[]> {
  const candidates = narrowed.rules.map((r) => validateRule(r));
  let pool = candidates.filter((c) => c.ok).map((c) => c.rule);
  const invalid = candidates.filter((c) => !c.ok);
  if (!force && !dryRun && tty) {
    for (const inv of invalid) {
      const ok = await confirm(
        `Include invalid rule "${ruleSlug(inv.rule)}" anyway? (${inv.reason}). You can fix it later.`,
      );
      if (ok) pool.push(inv.rule);
    }
  } else if (force) {
    pool = candidates.map((c) => c.rule);
  }
  if (dryRun) {
    pool = candidates.filter((c) => c.ok).map((c) => c.rule);
  }
  return pool;
}

export async function resolveCommandPool(
  narrowed: CanonicalFiles,
  force: boolean,
  dryRun: boolean,
  tty: boolean,
): Promise<CanonicalCommand[]> {
  const candidates = narrowed.commands.map((c) => validateCommand(c));
  let pool = candidates.filter((c) => c.ok).map((c) => c.command);
  const invalid = candidates.filter((c) => !c.ok);
  if (!force && !dryRun && tty) {
    for (const inv of invalid) {
      const ok = await confirm(
        `Include invalid command "${inv.command.name}" anyway? (${inv.reason}). You can fix it later.`,
      );
      if (ok) pool.push(inv.command);
    }
  } else if (force) {
    pool = candidates.map((c) => c.command);
  }
  if (dryRun) {
    pool = candidates.filter((c) => c.ok).map((c) => c.command);
  }
  return pool;
}

export async function resolveAgentPool(
  narrowed: CanonicalFiles,
  force: boolean,
  dryRun: boolean,
  tty: boolean,
): Promise<CanonicalAgent[]> {
  const candidates = narrowed.agents.map((a) => validateAgent(a));
  let pool = candidates.filter((c) => c.ok).map((c) => c.agent);
  const invalid = candidates.filter((c) => !c.ok);
  if (!force && !dryRun && tty) {
    for (const inv of invalid) {
      const ok = await confirm(
        `Include invalid agent "${inv.agent.name}" anyway? (${inv.reason}). You can fix it later.`,
      );
      if (ok) pool.push(inv.agent);
    }
  } else if (force) {
    pool = candidates.map((c) => c.agent);
  }
  if (dryRun) {
    pool = candidates.filter((c) => c.ok).map((c) => c.agent);
  }
  return pool;
}
