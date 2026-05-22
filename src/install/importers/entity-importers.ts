/**
 * Install-layer entity importers that wrap canonical parsers with the
 * repository-boilerplate filter.
 *
 * Scope: install discovery of third-party source repos, where housekeeping
 * files (README.md, LICENSE.md, CONTRIBUTING.md, ...) commonly sit alongside
 * entity content. The canonical parsers themselves remain filter-free so
 * users may legitimately name their own canonical content `security.md` or
 * `support.md` under `.agentsmesh/`.
 *
 * Each function preserves the wrapped parser's contract verbatim except for
 * removing entities sourced from boilerplate filenames.
 */
import { basename } from 'node:path';
import { parseAgents } from '../../canonical/features/agents.js';
import { parseCommands } from '../../canonical/features/commands.js';
import { parseRules, type ParseFrontmatterOptions } from '../../canonical/features/rules.js';
import { parseSkills } from '../../canonical/features/skills.js';
import type {
  CanonicalAgent,
  CanonicalCommand,
  CanonicalRule,
  CanonicalSkill,
} from '../../core/types.js';
import { isBoilerplate } from './boilerplate-filter.js';

/** Returns agents from `agentsDir`, excluding repository-boilerplate files. */
export async function importAgents(
  agentsDir: string,
  opts: ParseFrontmatterOptions = {},
): Promise<CanonicalAgent[]> {
  const agents = await parseAgents(agentsDir, opts);
  return agents.filter((entity) => !isBoilerplate(basename(entity.source)));
}

/** Returns commands from `commandsDir`, excluding repository-boilerplate files. */
export async function importCommands(
  commandsDir: string,
  opts: ParseFrontmatterOptions = {},
): Promise<CanonicalCommand[]> {
  const commands = await parseCommands(commandsDir, opts);
  return commands.filter((entity) => !isBoilerplate(basename(entity.source)));
}

/** Returns rules from `rulesDir`, excluding repository-boilerplate files. */
export async function importRules(
  rulesDir: string,
  opts: ParseFrontmatterOptions = {},
): Promise<CanonicalRule[]> {
  const rules = await parseRules(rulesDir, opts);
  return rules.filter((entity) => !isBoilerplate(basename(entity.source)));
}

/**
 * Returns skills from `skillsDir`. The canonical parser already discovers
 * skills by directory entries containing `SKILL.md`, so a `README.md` at
 * the skills/ root is naturally ignored. Supporting files (including
 * nested `scripts/`, `references/`, `assets/`) are preserved by the
 * canonical parser.
 */
export async function importSkills(
  skillsDir: string,
  opts: ParseFrontmatterOptions = {},
): Promise<CanonicalSkill[]> {
  return parseSkills(skillsDir, opts);
}
