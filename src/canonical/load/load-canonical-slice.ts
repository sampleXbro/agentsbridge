/**
 * Load canonical slices from a path: .agentsmesh project, partial rules/commands/agents/skills trees.
 */

import { basename, dirname, join } from 'node:path';
import { stat } from 'node:fs/promises';
import type { ExtendPick } from '../../config/core/schema.js';
import type {
  CanonicalAgent,
  CanonicalCommand,
  CanonicalFiles,
  CanonicalRule,
  CanonicalSkill,
} from '../../core/types.js';
import { exists } from '../../utils/filesystem/fs.js';
import {
  importAgents,
  importCommands,
  importRules,
} from '../../install/importers/entity-importers.js';
import type { ParseFrontmatterOptions } from '../features/rules.js';
import { loadCanonicalFiles } from './loader.js';
import { isSkillPackLayout, loadSkillsAtExtendPath } from './skill-pack-load.js';

function emptyCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

export function isCanonicalSliceEmpty(c: CanonicalFiles): boolean {
  return (
    c.rules.length === 0 &&
    c.commands.length === 0 &&
    c.agents.length === 0 &&
    c.skills.length === 0 &&
    c.mcp === null &&
    c.permissions === null &&
    c.hooks === null &&
    c.ignore.length === 0
  );
}

/**
 * If path is a single .md under rules/, commands/, or agents/, return parent dir + pick hint.
 */
export async function normalizeSlicePath(absolutePath: string): Promise<{
  sliceRoot: string;
  implicitPick?: ExtendPick;
}> {
  if (!(await exists(absolutePath))) {
    throw new Error(`Path does not exist: ${absolutePath}`);
  }
  const st = await stat(absolutePath);
  if (st.isDirectory()) {
    return { sliceRoot: absolutePath };
  }
  if (!st.isFile() || !absolutePath.toLowerCase().endsWith('.md')) {
    throw new Error(
      `Install path must be a directory or a .md file inside rules/, commands/, or agents/: ${absolutePath}`,
    );
  }
  const parent = dirname(absolutePath);
  const parentBase = basename(parent);
  const fileBase = basename(absolutePath);
  const slug = fileBase.replace(/\.md$/i, '');
  if (parentBase === 'rules') {
    return { sliceRoot: parent, implicitPick: { rules: [slug] } };
  }
  if (parentBase === 'commands') {
    return { sliceRoot: parent, implicitPick: { commands: [slug] } };
  }
  if (parentBase === 'agents') {
    return { sliceRoot: parent, implicitPick: { agents: [slug] } };
  }
  throw new Error(
    `Single-file install only supports .md files under rules/, commands/, or agents/. Got: ${absolutePath}`,
  );
}

/**
 * Install-time slice loaders. These route through the install-layer entity
 * importers (`importRules` / `importCommands` / `importAgents`) so repo
 * boilerplate files (`README.md`, `CONTRIBUTING.md`, `LICENSE*`,
 * `CODE_OF_CONDUCT.md`, ...) that frequently sit next to entity content in
 * third-party source repos are excluded from canonical discovery.
 *
 * The pure canonical loader (`loadCanonicalFiles`) used for the user's own
 * `.agentsmesh/` stays filter-free per the canonical-parser contract.
 */
async function parseRulesAt(
  sliceRoot: string,
  opts: ParseFrontmatterOptions,
): Promise<CanonicalRule[]> {
  const base = basename(sliceRoot);
  if (base === 'rules') {
    return importRules(sliceRoot, opts);
  }
  const nested = join(sliceRoot, 'rules');
  if (await exists(nested)) {
    return importRules(nested, opts);
  }
  return [];
}

async function parseCommandsAt(
  sliceRoot: string,
  opts: ParseFrontmatterOptions,
): Promise<CanonicalCommand[]> {
  const base = basename(sliceRoot);
  if (base === 'commands') {
    return importCommands(sliceRoot, opts);
  }
  const nested = join(sliceRoot, 'commands');
  if (await exists(nested)) {
    return importCommands(nested, opts);
  }
  return [];
}

async function parseAgentsAt(
  sliceRoot: string,
  opts: ParseFrontmatterOptions,
): Promise<CanonicalAgent[]> {
  const base = basename(sliceRoot);
  if (base === 'agents') {
    return importAgents(sliceRoot, opts);
  }
  const nested = join(sliceRoot, 'agents');
  if (await exists(nested)) {
    return importAgents(nested, opts);
  }
  return [];
}

/** Skill pack at slice root or nested `skills/` (common in upstream repos). */
async function loadSkillsForPartialSlice(
  sliceRoot: string,
  opts: ParseFrontmatterOptions,
): Promise<CanonicalSkill[]> {
  if (await isSkillPackLayout(sliceRoot)) {
    return loadSkillsAtExtendPath(sliceRoot, opts);
  }
  const nestedSkills = join(sliceRoot, 'skills');
  if (await isSkillPackLayout(nestedSkills)) {
    return loadSkillsAtExtendPath(nestedSkills, opts);
  }
  return [];
}

/**
 * Load whatever canonical resources exist at sliceRoot (directory).
 */
export async function loadCanonicalSliceAtPath(
  sliceRoot: string,
  opts: ParseFrontmatterOptions = {},
): Promise<CanonicalFiles> {
  const ab = join(sliceRoot, '.agentsmesh');
  if (await exists(ab)) {
    return loadCanonicalFiles(sliceRoot, opts);
  }

  const partial = emptyCanonical();
  partial.rules = await parseRulesAt(sliceRoot, opts);
  partial.commands = await parseCommandsAt(sliceRoot, opts);
  partial.agents = await parseAgentsAt(sliceRoot, opts);

  partial.skills = await loadSkillsForPartialSlice(sliceRoot, opts);

  if (isCanonicalSliceEmpty(partial)) {
    throw new Error(
      `No installable resources at ${sliceRoot}. ` +
        'Expected .agentsmesh/, or rules/, commands/, agents/, or Anthropic-style skills (SKILL.md). ' +
        'Hint: pass --as commands|agents|rules|skills to force a kind for flat markdown directories.',
    );
  }

  return partial;
}
