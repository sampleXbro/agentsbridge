/**
 * Generate Cursor config files from canonical sources.
 */

import type { CanonicalFiles } from '../../core/types.js';
import { getHookCommand, getHookPrompt, hasHookText } from '../../core/hook-command.js';
import { serializeFrontmatter } from '../../utils/markdown.js';
import {
  CURSOR_COMPAT_AGENTS,
  CURSOR_GENERAL_RULE,
  CURSOR_RULES_DIR,
  CURSOR_COMMANDS_DIR,
  CURSOR_MCP,
  CURSOR_SKILLS_DIR,
  CURSOR_AGENTS_DIR,
  CURSOR_HOOKS,
  CURSOR_IGNORE,
} from './constants.js';

export interface RulesOutput {
  path: string;
  content: string;
}

/**
 * Generate .cursor/rules/_root.mdc from root rule + .cursor/rules/{slug}.mdc from non-root rules.
 * @param canonical - Loaded canonical files
 * @returns _root.mdc (alwaysApply: true) + one .mdc per contextual rule (alwaysApply: false)
 */
export function generateRules(canonical: CanonicalFiles): RulesOutput[] {
  const outputs: RulesOutput[] = [];

  const root = canonical.rules.find((r) => r.root);
  if (root) {
    const body = root.body.trim() ? root.body : '';
    // Emit AGENTS.md as a plain-body compatibility mirror (§3.1 of cursor format doc)
    outputs.push({ path: CURSOR_COMPAT_AGENTS, content: body });
    // Emit .cursor/rules/general.mdc as the primary structured rule (§2.1)
    const frontmatter: Record<string, unknown> = { alwaysApply: true };
    if (root.description) frontmatter.description = root.description;
    const content = serializeFrontmatter(frontmatter, body);
    outputs.push({ path: CURSOR_GENERAL_RULE, content });
  }

  const nonRoot = canonical.rules.filter(
    (r) => !r.root && (r.targets.length === 0 || r.targets.includes('cursor')),
  );
  for (const rule of nonRoot) {
    const slug = rule.source.split('/').pop()!.replace(/\.md$/, '');
    const alwaysApply = rule.trigger === 'always_on' ? true : false;
    const frontmatter: Record<string, unknown> = { alwaysApply };
    if (rule.description) frontmatter.description = rule.description;
    if (rule.globs.length > 0) frontmatter.globs = rule.globs;
    const content = serializeFrontmatter(frontmatter, rule.body.trim() || '');
    outputs.push({ path: `${CURSOR_RULES_DIR}/${slug}.mdc`, content });
  }

  return outputs;
}

/**
 * Generate .cursor/commands/*.md from canonical commands.
 * @param canonical - Loaded canonical files
 * @returns Array of command file outputs, or [] if no commands
 */
export function generateCommands(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.commands.map((cmd) => ({
    path: `${CURSOR_COMMANDS_DIR}/${cmd.name}.md`,
    content: cmd.body.trim() || '',
  }));
}

/**
 * Generate .cursor/mcp.json from canonical MCP config.
 * Cursor stores MCP server definitions in .cursor/mcp.json.
 * @param canonical - Loaded canonical files
 * @returns Array with single .cursor/mcp.json output, or [] if no MCP config or empty mcpServers
 */
export function generateMcp(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const content = JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2);
  return [{ path: CURSOR_MCP, content }];
}

/**
 * Generate .cursor/skills/*.md from canonical skills.
 * Cursor uses flat structure: one .md file per skill with frontmatter+body.
 * @param canonical - Loaded canonical files
 * @returns Array of skill file outputs, or [] if no skills
 */
export function generateSkills(canonical: CanonicalFiles): RulesOutput[] {
  const outputs: RulesOutput[] = [];
  for (const skill of canonical.skills) {
    const frontmatter: Record<string, unknown> = {
      name: skill.name,
      description: skill.description || undefined,
    };
    if (frontmatter.description === undefined) delete frontmatter.description;
    const content = serializeFrontmatter(frontmatter, skill.body.trim() || '');
    outputs.push({ path: `${CURSOR_SKILLS_DIR}/${skill.name}/SKILL.md`, content });
    for (const file of skill.supportingFiles) {
      const relPath = file.relativePath.replace(/\\/g, '/');
      outputs.push({
        path: `${CURSOR_SKILLS_DIR}/${skill.name}/${relPath}`,
        content: file.content,
      });
    }
  }
  return outputs;
}

/**
 * Generate .cursor/agents/*.md from canonical agents.
 * @param canonical - Loaded canonical files
 * @returns Array of agent file outputs, or [] if no agents
 */
export function generateAgents(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.agents.map((agent) => {
    const frontmatter: Record<string, unknown> = {
      name: agent.name,
      description: agent.description,
      tools: agent.tools.length > 0 ? agent.tools : undefined,
      disallowedTools: agent.disallowedTools.length > 0 ? agent.disallowedTools : undefined,
      model: agent.model || undefined,
      permissionMode: agent.permissionMode || undefined,
      maxTurns: agent.maxTurns > 0 ? agent.maxTurns : undefined,
      mcpServers: agent.mcpServers.length > 0 ? agent.mcpServers : undefined,
      hooks: Object.keys(agent.hooks).length > 0 ? agent.hooks : undefined,
      skills: agent.skills.length > 0 ? agent.skills : undefined,
      memory: agent.memory || undefined,
    };
    Object.keys(frontmatter).forEach((k) => {
      if (frontmatter[k] === undefined) delete frontmatter[k];
    });
    const content = serializeFrontmatter(frontmatter, agent.body.trim() || '');
    return { path: `${CURSOR_AGENTS_DIR}/${agent.name}.md`, content };
  });
}

/**
 * Generate Cursor permissions. Cursor has no native tool-level permission file
 * equivalent to .claude/settings.json; tool allow/deny are Claude-specific.
 * A linter warning is emitted instead (see src/core/linter-permissions.ts).
 * @returns Always [] — permissions are not projected for Cursor
 */
export function generatePermissions(_canonical: CanonicalFiles): RulesOutput[] {
  return [];
}

/**
 * Convert canonical Hooks to Cursor hooks.json format.
 * Same structure as Claude Code: { event: [{ matcher, hooks: [{ type, command?, prompt?, timeout? }] }] }
 */
function toCursorHooks(hooks: import('../../core/types.js').Hooks): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) continue;
    const translated: Array<{ matcher: string; hooks: unknown[] }> = [];
    for (const e of entries) {
      if (!hasHookText(e)) continue;
      const command = getHookCommand(e);
      const prompt = getHookPrompt(e);
      const value = e.type === 'prompt' ? prompt || command : command || prompt;
      const hookItem: Record<string, unknown> = {
        type: e.type === 'prompt' ? 'prompt' : 'command',
        [e.type === 'prompt' ? 'prompt' : 'command']: value,
      };
      if (e.timeout !== undefined) hookItem.timeout = e.timeout;
      translated.push({ matcher: e.matcher, hooks: [hookItem] });
    }
    if (translated.length > 0) result[event] = translated;
  }
  return result;
}

/**
 * Generate .cursor/hooks.json from canonical sources.
 * @param canonical - Loaded canonical files
 * @returns Array with single .cursor/hooks.json output, or [] if no hooks
 */
export function generateHooks(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const cursorHooks = toCursorHooks(canonical.hooks);
  if (Object.keys(cursorHooks).length === 0) return [];
  const content = JSON.stringify({ version: 1, hooks: cursorHooks }, null, 2);
  return [{ path: CURSOR_HOOKS, content }];
}

/**
 * Generate .cursorignore from canonical ignore patterns.
 * Uses gitignore-style syntax (one pattern per line).
 * Note: .cursorindexingignore is community-sourced and not an officially documented
 * Cursor project file — it is not emitted.
 * @param canonical - Loaded canonical files
 * @returns Array with single .cursorignore output, or [] if no patterns
 */
export function generateIgnore(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.ignore || canonical.ignore.length === 0) return [];
  const content = canonical.ignore.join('\n');
  return [{ path: CURSOR_IGNORE, content }];
}
