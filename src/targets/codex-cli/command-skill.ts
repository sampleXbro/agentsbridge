import type { CanonicalCommand } from '../../core/types.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';

export const CODEX_COMMAND_SKILL_PREFIX = 'am-command-';
export const LEGACY_CODEX_COMMAND_SKILL_PREFIX = 'ab-command-';

interface ParsedCommandSkill {
  name: string;
  description: string;
  allowedTools: string[];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }
  if (typeof value === 'string' && value.length > 0) {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function commandSkillDirName(name: string): string {
  return `${CODEX_COMMAND_SKILL_PREFIX}${name}`;
}

export function serializeCommandSkill(command: CanonicalCommand): string {
  const frontmatter: Record<string, unknown> = {
    name: commandSkillDirName(command.name),
    description: command.description || undefined,
    'x-agentsmesh-kind': 'command',
    'x-agentsmesh-name': command.name,
    'x-agentsmesh-allowed-tools':
      command.allowedTools.length > 0 ? command.allowedTools : undefined,
  };
  if (frontmatter.description === undefined) delete frontmatter.description;
  if (frontmatter['x-agentsmesh-allowed-tools'] === undefined) {
    delete frontmatter['x-agentsmesh-allowed-tools'];
  }
  return serializeFrontmatter(frontmatter, command.body.trim() || '');
}

export function parseCommandSkillFrontmatter(
  frontmatter: Record<string, unknown>,
  dirName: string,
): ParsedCommandSkill | null {
  if (frontmatter['x-agentsmesh-kind'] !== 'command') return null;

  const metadataName =
    typeof frontmatter['x-agentsmesh-name'] === 'string' ? frontmatter['x-agentsmesh-name'] : '';
  const derivedName = dirName.startsWith(CODEX_COMMAND_SKILL_PREFIX)
    ? dirName.slice(CODEX_COMMAND_SKILL_PREFIX.length)
    : dirName.startsWith(LEGACY_CODEX_COMMAND_SKILL_PREFIX)
      ? dirName.slice(LEGACY_CODEX_COMMAND_SKILL_PREFIX.length)
      : '';
  const name = (metadataName || derivedName).trim();
  if (!name) return null;

  return {
    name,
    description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
    allowedTools: toStringArray(frontmatter['x-agentsmesh-allowed-tools']),
  };
}

export function serializeImportedCommand(command: ParsedCommandSkill, body: string): string {
  const frontmatter: Record<string, unknown> = {
    description: command.description || undefined,
    'allowed-tools': command.allowedTools.length > 0 ? command.allowedTools : undefined,
  };
  if (frontmatter.description === undefined) delete frontmatter.description;
  if (frontmatter['allowed-tools'] === undefined) delete frontmatter['allowed-tools'];
  return serializeFrontmatter(frontmatter, body.trim() || '');
}
