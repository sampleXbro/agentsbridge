/**
 * Generate Windsurf config files from canonical sources.
 * Windsurf uses .windsurfrules (root, flat no frontmatter), .windsurf/rules/*.md,
 * .windsurf/workflows/*.md, .windsurf/skills/* (skills + embedded agents), hooks, and ignore files.
 * MCP is emitted as project-owned setup/reference config (.windsurf/mcp_config.example.json).
 * Permissions remain unsupported.
 */

import { basename } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import { getHookCommand, getHookPrompt, hasHookText } from '../../core/hook-command.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import {
  WINDSURF_RULES_DIR,
  CODEIUM_IGNORE,
  WINDSURF_AGENTS_MD,
  WINDSURF_WORKFLOWS_DIR,
  WINDSURF_SKILLS_DIR,
  WINDSURF_MCP_EXAMPLE_FILE,
  WINDSURF_HOOKS_FILE,
} from './constants.js';

export interface RulesOutput {
  path: string;
  content: string;
}

function ruleSlug(source: string): string {
  const name = basename(source, '.md');
  return name === '_root' ? 'root' : name;
}

function directoryScopedRuleDir(globs: string[]): string | null {
  if (globs.length === 0) return null;
  const dirs = globs
    .map((glob) => glob.split('/')[0] ?? '')
    .filter((segment) => /^[A-Za-z0-9._-]+$/.test(segment));
  if (dirs.length !== globs.length) return null;
  return dirs.every((dir) => dir === dirs[0]) ? dirs[0]! : null;
}

/**
 * Generate AGENTS.md (root, flat) and .windsurf/rules/*.md from canonical rules.
 * Root rule body only (no frontmatter). Non-root rules get frontmatter.
 *
 * @param canonical - Loaded canonical files
 * @returns Array of rule outputs, or [] if no root rule
 */
export function generateRules(canonical: CanonicalFiles): RulesOutput[] {
  const outputs: RulesOutput[] = [];
  const root = canonical.rules.find((r) => r.root);
  if (!root) return [];

  outputs.push({
    path: WINDSURF_AGENTS_MD,
    content: root.body.trim(),
  });

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.targets.length > 0 && !rule.targets.includes('windsurf')) continue;
    const slug = ruleSlug(rule.source);
    const normalizedTrigger = rule.trigger || (rule.globs.length > 0 ? 'glob' : undefined);
    const frontmatter: Record<string, unknown> = {
      description: rule.description || undefined,
      trigger: normalizedTrigger,
      glob: rule.globs.length === 1 ? rule.globs[0] : undefined,
      globs: rule.globs.length > 1 ? rule.globs : undefined,
    };
    Object.keys(frontmatter).forEach((k) => {
      if (frontmatter[k] === undefined) delete frontmatter[k];
    });
    const content =
      Object.keys(frontmatter).length > 0
        ? serializeFrontmatter(frontmatter, rule.body.trim() || '')
        : rule.body.trim() || '';
    outputs.push({ path: `${WINDSURF_RULES_DIR}/${slug}.md`, content });

    const dir = directoryScopedRuleDir(rule.globs);
    if (dir) {
      if (dir !== slug) {
        outputs.push({ path: `${WINDSURF_RULES_DIR}/${dir}.md`, content });
      }
      outputs.push({ path: `${dir}/AGENTS.md`, content: rule.body.trim() || '' });
    }
  }

  return outputs;
}

/**
 * Generate .windsurfignore and .codeiumignore from canonical ignore patterns.
 * Both files use the same content; .codeiumignore is the official Windsurf path per docs.
 *
 * @param canonical - Loaded canonical files
 * @returns Array with both ignore file outputs, or [] if no patterns
 */
export function generateIgnore(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.ignore || canonical.ignore.length === 0) return [];
  return [{ path: CODEIUM_IGNORE, content: canonical.ignore.join('\n') }];
}

/**
 * Generate .windsurf/workflows/{name}.md from canonical commands.
 * Windsurf treats workflows as structured command definitions.
 *
 * @param canonical - Loaded canonical files
 * @returns Array of workflow file outputs, or [] if no commands
 */
export function generateWorkflows(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.commands.map((cmd) => {
    const frontmatter: Record<string, unknown> = {
      description: cmd.description.trim() || undefined,
      allowedTools: cmd.allowedTools.length > 0 ? cmd.allowedTools : undefined,
    };
    Object.keys(frontmatter).forEach((key) => {
      if (frontmatter[key] === undefined) delete frontmatter[key];
    });
    const content =
      Object.keys(frontmatter).length > 0
        ? serializeFrontmatter(frontmatter, cmd.body.trim() || '')
        : cmd.body.trim();
    return {
      path: `${WINDSURF_WORKFLOWS_DIR}/${cmd.name}.md`,
      content,
    };
  });
}

/**
 * Generate projected agent skills for Windsurf from canonical agents.
 */
export function generateAgents(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${WINDSURF_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}

/**
 * Generate .windsurf/mcp_config.example.json from canonical MCP config.
 * This is emitted as a project-owned setup/reference artifact.
 */
export function generateMcp(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    {
      path: WINDSURF_MCP_EXAMPLE_FILE,
      content: JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}

function windsurfEventName(event: string): string {
  const explicit: Record<string, string> = {
    PreToolUse: 'pre_tool_use',
    PostToolUse: 'post_tool_use',
    Notification: 'notification',
    UserPromptSubmit: 'user_prompt_submit',
    SubagentStart: 'subagent_start',
    SubagentStop: 'subagent_stop',
  };
  if (explicit[event]) return explicit[event];
  return event
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function toWindsurfHooks(hooks: import('../../core/types.js').Hooks): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) continue;
    const translated: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      if (!hasHookText(entry)) continue;
      const command = getHookCommand(entry);
      const prompt = getHookPrompt(entry);
      const value = entry.type === 'prompt' ? prompt || command : command || prompt;
      if (!value) continue;
      translated.push({ command: value, show_output: true });
    }
    if (translated.length > 0) result[windsurfEventName(event)] = translated;
  }
  return result;
}

/**
 * Generate .windsurf/hooks.json from canonical hooks.
 */
export function generateHooks(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const hooks = toWindsurfHooks(canonical.hooks);
  if (Object.keys(hooks).length === 0) return [];
  return [{ path: WINDSURF_HOOKS_FILE, content: JSON.stringify({ hooks }, null, 2) }];
}

/**
 * Generate .windsurf/skills/{name}/SKILL.md + supporting files from canonical skills.
 *
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
    const content =
      Object.keys(frontmatter).length > 0
        ? serializeFrontmatter(frontmatter, skill.body.trim() || '')
        : skill.body.trim() || '';
    outputs.push({ path: `${WINDSURF_SKILLS_DIR}/${skill.name}/SKILL.md`, content });
    for (const sf of skill.supportingFiles) {
      outputs.push({
        path: `${WINDSURF_SKILLS_DIR}/${skill.name}/${sf.relativePath}`,
        content: sf.content,
      });
    }
  }
  return outputs;
}
