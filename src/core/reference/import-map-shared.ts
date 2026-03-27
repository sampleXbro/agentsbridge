import { basename, dirname, join, relative } from 'node:path';
import { readDirRecursive } from '../../utils/filesystem/fs.js';
import {
  CODEX_COMMAND_SKILL_PREFIX,
  LEGACY_CODEX_COMMAND_SKILL_PREFIX,
} from '../../targets/codex-cli/command-skill.js';
import {
  PROJECTED_AGENT_SKILL_PREFIX,
  LEGACY_PROJECTED_AGENT_SKILL_PREFIX,
} from '../../targets/projection/projected-agent-skill.js';

const AB_RULES = '.agentsmesh/rules';
const AB_COMMANDS = '.agentsmesh/commands';
const AB_AGENTS = '.agentsmesh/agents';
const AB_SKILLS = '.agentsmesh/skills';

export function rel(projectRoot: string, absPath: string): string {
  return relative(projectRoot, absPath).replace(/\\/g, '/');
}

export async function listFiles(projectRoot: string, dir: string): Promise<string[]> {
  return readDirRecursive(join(projectRoot, dir)).catch(() => []);
}

export function addDirectoryMapping(refs: Map<string, string>, from: string, to: string): void {
  refs.set(from, to);
  refs.set(`${from}/`, `${to}/`);
}

function addAncestorMappings(
  refs: Map<string, string>,
  fromPath: string,
  toPath: string,
  stopDir: string,
): void {
  let fromDir = dirname(fromPath);
  let toDir = dirname(toPath);
  while (fromDir !== stopDir && fromDir !== '.') {
    addDirectoryMapping(refs, fromDir, toDir);
    fromDir = dirname(fromDir);
    toDir = dirname(toDir);
  }
}

export function addSimpleFileMapping(
  refs: Map<string, string>,
  fromPath: string,
  canonicalDir: string,
  extension: string,
): void {
  refs.set(fromPath, `${canonicalDir}/${basename(fromPath, extension)}.md`);
}

export function addSkillLikeMapping(
  refs: Map<string, string>,
  relPath: string,
  skillsDir: string,
): void {
  if (!relPath.startsWith(`${skillsDir}/`)) return;
  const rest = relPath.slice(skillsDir.length + 1);
  if (!rest) return;

  if (!rest.includes('/')) {
    if (!rest.endsWith('.md') || basename(rest) === 'SKILL.md') return;
    const name = basename(rest, '.md');
    refs.set(relPath, `${AB_SKILLS}/${name}/SKILL.md`);
    return;
  }

  const [dirName, ...tail] = rest.split('/');
  const filePath = tail.join('/');
  if (!dirName || !filePath) return;

  const commandPrefix = dirName.startsWith(CODEX_COMMAND_SKILL_PREFIX)
    ? CODEX_COMMAND_SKILL_PREFIX
    : dirName.startsWith(LEGACY_CODEX_COMMAND_SKILL_PREFIX)
      ? LEGACY_CODEX_COMMAND_SKILL_PREFIX
      : null;
  if (commandPrefix && filePath === 'SKILL.md') {
    refs.set(relPath, `${AB_COMMANDS}/${dirName.slice(commandPrefix.length)}.md`);
    return;
  }
  const agentPrefix = dirName.startsWith(PROJECTED_AGENT_SKILL_PREFIX)
    ? PROJECTED_AGENT_SKILL_PREFIX
    : dirName.startsWith(LEGACY_PROJECTED_AGENT_SKILL_PREFIX)
      ? LEGACY_PROJECTED_AGENT_SKILL_PREFIX
      : null;
  if (agentPrefix && filePath === 'SKILL.md') {
    refs.set(relPath, `${AB_AGENTS}/${dirName.slice(agentPrefix.length)}.md`);
    return;
  }

  const canonicalBase = `${AB_SKILLS}/${dirName}`;
  if (filePath === 'SKILL.md') addDirectoryMapping(refs, `${skillsDir}/${dirName}`, canonicalBase);
  const canonicalPath = `${canonicalBase}/${filePath}`;
  refs.set(relPath, canonicalPath);
  if (filePath !== 'SKILL.md') {
    addAncestorMappings(refs, relPath, canonicalPath, `${skillsDir}/${dirName}`);
  }
}

/** Paths that are target root artifacts, not scoped rules. Must not overwrite explicit mappings. */
const SCOPED_AGENTS_SKIP_DIRS = new Set([
  '.agents',
  '.claude',
  '.clinerules',
  '.cline',
  '.continue',
  '.cursor',
  '.gemini',
  '.github',
  '.junie',
  '.windsurf',
]);

export async function addScopedAgentsMappings(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  const files = await listFiles(projectRoot, '.');
  for (const absPath of files) {
    const relPath = rel(projectRoot, absPath);
    const isNestedAgents =
      relPath.endsWith('/AGENTS.md') &&
      relPath !== 'AGENTS.md' &&
      !relPath.endsWith('/AGENTS.override.md');
    const isNestedOverride =
      relPath.endsWith('/AGENTS.override.md') && relPath !== 'AGENTS.override.md';
    if (!isNestedAgents && !isNestedOverride) continue;
    const parentDir = dirname(relPath);
    if (SCOPED_AGENTS_SKIP_DIRS.has(parentDir)) continue;
    const ruleName = parentDir.replace(/\//g, '-');
    refs.set(relPath, `${AB_RULES}/${ruleName}.md`);
  }
}
