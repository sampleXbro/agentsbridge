/**
 * Generate Gemini CLI config files from canonical sources.
 * Gemini uses GEMINI.md (root + embedded non-root rules as sections), .gemini/commands/*.toml,
 * .gemini/skills/* (skills + embedded agents), and .gemini/settings.json
 * (MCP, ignorePatterns, hooks - postToolUse only).
 */

import type { CanonicalFiles } from '../../core/types.js';
import { getHookCommand, hasHookCommand } from '../../core/hook-command.js';
import { serializeFrontmatter } from '../../utils/markdown.js';
import {
  GEMINI_ROOT,
  GEMINI_COMPAT_AGENTS,
  GEMINI_COMMANDS_DIR,
  GEMINI_SETTINGS,
  GEMINI_IGNORE,
  GEMINI_SKILLS_DIR,
  GEMINI_AGENTS_DIR,
} from './constants.js';
import { canonicalCommandNameToGeminiTomlPath } from './command-namespace.js';

export interface RulesOutput {
  path: string;
  content: string;
}

function serializeTomlMultilineLiteral(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n');
  if (!normalized.includes('"""')) {
    return `"""\n${normalized}\n"""`;
  }
  return JSON.stringify(normalized);
}

function serializeGeminiCommand(cmd: CanonicalFiles['commands'][number]): string {
  const lines = [
    `description = ${JSON.stringify(cmd.description || cmd.name)}`,
    `prompt = ${serializeTomlMultilineLiteral(cmd.body.trim() || '')}`,
  ];
  return lines.join('\n') + '\n';
}

function mapHookEvent(event: string): string | null {
  switch (event) {
    case 'PreToolUse':
      return 'BeforeTool';
    case 'PostToolUse':
      return 'AfterTool';
    case 'Notification':
      return 'Notification';
    default:
      return null;
  }
}

/**
 * Generate GEMINI.md from root rule and non-root rules as ---‑separated sections.
 * @param canonical - Loaded canonical files
 * @returns Array of rule outputs, or [] if no rules for gemini-cli
 */
export function generateRules(canonical: CanonicalFiles): RulesOutput[] {
  const root = canonical.rules.find((r) => r.root);
  const nonRootRules = canonical.rules.filter((r) => {
    if (r.root) return false;
    if (r.targets.length > 0 && !r.targets.includes('gemini-cli')) return false;
    return true;
  });

  if (!root && nonRootRules.length === 0) return [];

  // Build GEMINI.md: root body + non-root rule sections separated by ---
  // Gemini CLI has no native .gemini/rules/ directory; all rules go into GEMINI.md.
  const sections: string[] = [];

  if (root) {
    sections.push(root.body.trim());
  }

  for (const rule of nonRootRules) {
    const parts: string[] = [];
    if (rule.description) {
      parts.push(`## ${rule.description}`);
      parts.push('');
    }
    parts.push(rule.body.trim());
    sections.push(parts.join('\n'));
  }

  // Join non-empty sections with --- separators
  const nonEmpty = sections.filter((s) => s.length > 0);
  const content = nonEmpty.join('\n\n---\n\n');

  // Compatibility mirror:
  // - `AGENTS.md` is root-only to avoid conflicts with Codex/Cline.
  const outputs: RulesOutput[] = [{ path: GEMINI_ROOT, content }];
  if (root) {
    // `AGENTS.md` is a shared, cross-target compatibility mirror.
    // Codex/Cline expect shared GitHub Agents skill links under `.agents/skills/...`,
    // but Gemini would otherwise rewrite them to `.gemini/skills/...`, causing collisions.
    const compatAgentsContent = root.body
      .trim()
      .replace(/\.agentsmesh\/skills\//g, '.agents/skills/');
    outputs.push({ path: GEMINI_COMPAT_AGENTS, content: compatAgentsContent });
  }
  return outputs;
}

/**
 * Generate .gemini/commands/*.toml from canonical commands.
 * @param canonical - Loaded canonical files
 * @returns Array of command outputs, or [] if no commands
 */
export function generateCommands(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.commands.map((cmd) => ({
    path: canonicalCommandNameToGeminiTomlPath(cmd.name, GEMINI_COMMANDS_DIR),
    content: serializeGeminiCommand(cmd),
  }));
}

/**
 * Generate native .gemini/agents/{name}.md from canonical agents.
 */
export function generateAgents(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.agents.map((agent) => {
    const frontmatter: Record<string, unknown> = {
      name: agent.name,
      kind: 'local',
      description: agent.description || undefined,
      tools: agent.tools.length > 0 ? agent.tools : undefined,
      model: agent.model || undefined,
      maxTurns: agent.maxTurns > 0 ? agent.maxTurns : undefined,
      permissionMode: agent.permissionMode || undefined,
      disallowedTools: agent.disallowedTools.length > 0 ? agent.disallowedTools : undefined,
    };
    Object.keys(frontmatter).forEach((k) => {
      if (frontmatter[k] === undefined) delete frontmatter[k];
    });
    const content = serializeFrontmatter(frontmatter, agent.body.trim() || '');
    return { path: `${GEMINI_AGENTS_DIR}/${agent.name}.md`, content };
  });
}

/**
 * Generate .gemini/skills/{name}/SKILL.md and supporting files (Agent Skills standard).
 * @param canonical - Loaded canonical files
 * @returns Array of skill file outputs
 */
export function generateSkills(canonical: CanonicalFiles): RulesOutput[] {
  const outputs: RulesOutput[] = [];
  for (const skill of canonical.skills) {
    const frontmatter: Record<string, unknown> = {
      name: skill.name,
      description: skill.description || undefined,
    };
    if (frontmatter.description === undefined) delete frontmatter.description;
    const skillContent = serializeFrontmatter(frontmatter, skill.body.trim() || '');
    outputs.push({
      path: `${GEMINI_SKILLS_DIR}/${skill.name}/SKILL.md`,
      content: skillContent,
    });
    for (const file of skill.supportingFiles) {
      const relPath = file.relativePath.replace(/\\/g, '/');
      outputs.push({
        path: `${GEMINI_SKILLS_DIR}/${skill.name}/${relPath}`,
        content: file.content,
      });
    }
  }
  return outputs;
}

/**
 * Generate .gemini/settings.json with mcpServers and hooks.
 * @param canonical - Loaded canonical files
 * @returns Array with single settings.json output, or [] if nothing to emit
 */
export function generateSettings(canonical: CanonicalFiles): RulesOutput[] {
  const settings: Record<string, unknown> = {};
  let hasAnyNativeSettings = false;

  if (canonical.mcp && Object.keys(canonical.mcp.mcpServers).length > 0) {
    settings.mcpServers = canonical.mcp.mcpServers;
    hasAnyNativeSettings = true;
  }
  if (canonical.agents.length > 0) {
    settings.experimental = { enableAgents: true };
    hasAnyNativeSettings = true;
  }
  if (canonical.hooks) {
    const hookEntries = Object.entries(canonical.hooks).flatMap(([event, entries]) => {
      const mappedEvent = mapHookEvent(event);
      if (!mappedEvent || !Array.isArray(entries)) return [];
      const mappedEntries = entries
        .filter(
          (entry): entry is NonNullable<typeof entry> =>
            typeof entry === 'object' && entry !== null && hasHookCommand(entry),
        )
        .map((entry, index) => ({
          matcher: entry!.matcher,
          hooks: [
            {
              name: `${mappedEvent}-${index + 1}`,
              type: 'command',
              command: getHookCommand(entry),
              timeout: entry!.timeout,
            },
          ],
        }));
      return mappedEntries.length > 0 ? [[mappedEvent, mappedEntries] as const] : [];
    });
    if (hookEntries.length > 0) {
      settings.hooks = Object.fromEntries(hookEntries);
      hasAnyNativeSettings = true;
    }
  }

  // Compatibility: Gemini can also load `AGENTS.md` if we list it in `context.fileName`.
  if (hasAnyNativeSettings) {
    settings.context = { fileName: [GEMINI_ROOT, GEMINI_COMPAT_AGENTS] };
  }

  if (Object.keys(settings).length === 0) return [];
  return [{ path: GEMINI_SETTINGS, content: JSON.stringify(settings, null, 2) }];
}

export function generateIgnore(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.ignore || canonical.ignore.length === 0) return [];
  return [{ path: GEMINI_IGNORE, content: canonical.ignore.join('\n') }];
}
