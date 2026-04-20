/**
 * Generate Cline config files from canonical sources.
 * Cline uses .clinerules (rules, workflows), .clineignore, .cline/cline_mcp_settings.json, .cline/skills (skills).
 * Supports rules, workflows (from canonical commands), ignore, MCP, skills. Skips agents, hooks, permissions.
 */

import { basename } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import { hasHookCommand } from '../../core/hook-command.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import {
  CLINE_RULES_DIR,
  CLINE_AGENTS_MD,
  CLINE_IGNORE,
  CLINE_MCP_SETTINGS,
  CLINE_SKILLS_DIR,
  CLINE_WORKFLOWS_DIR,
  CLINE_HOOKS_DIR,
} from './constants.js';

export interface RulesOutput {
  path: string;
  content: string;
}

function ruleSlug(source: string): string {
  const name = basename(source, '.md');
  return name === '_root' ? 'root' : name;
}

/**
 * Generate .clinerules/*.md from canonical rules.
 * Cline supports plain markdown with optional frontmatter.
 * Root rule → AGENTS.md, non-root → .clinerules/{slug}.md
 *
 * @param canonical - Loaded canonical files
 * @returns Array of rule outputs, or [] if no rules for cline
 */
export function generateRules(canonical: CanonicalFiles): RulesOutput[] {
  const outputs: RulesOutput[] = [];
  const root = canonical.rules.find((r) => r.root);

  if (root) {
    const body = root.body.trim() ? root.body : '';
    outputs.push({ path: CLINE_AGENTS_MD, content: body });
  }

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.targets.length > 0 && !rule.targets.includes('cline')) continue;
    const slug = ruleSlug(rule.source);
    const frontmatter: Record<string, unknown> = {
      description: rule.description || undefined,
      paths: rule.globs.length > 0 ? rule.globs : undefined,
    };
    Object.keys(frontmatter).forEach((k) => {
      if (frontmatter[k] === undefined) delete frontmatter[k];
    });
    const content =
      Object.keys(frontmatter).length > 0
        ? serializeFrontmatter(frontmatter, rule.body.trim() || '')
        : rule.body.trim() || '';
    outputs.push({ path: `${CLINE_RULES_DIR}/${slug}.md`, content });
  }

  return outputs;
}

/**
 * Generate .clinerules/workflows/{name}.md from canonical commands.
 * Cline workflows are slash-invokable prompts analogous to Cursor/Windsurf commands.
 * Per Cline doc section 6.4: command description → workflow intro paragraph.
 *
 * @param canonical - Loaded canonical files
 * @returns Array of workflow file outputs, or [] if no commands
 */
export function generateCommands(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.commands.map((cmd) => {
    const desc = cmd.description.trim();
    const body = cmd.body.trim();
    const content = desc && body ? `${desc}\n\n${body}` : desc || body;
    return { path: `${CLINE_WORKFLOWS_DIR}/${cmd.name}.md`, content };
  });
}

/**
 * Generate .clineignore from canonical ignore patterns.
 *
 * @param canonical - Loaded canonical files
 * @returns Array with single .clineignore output, or [] if no patterns
 */
export function generateIgnore(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.ignore || canonical.ignore.length === 0) return [];
  const content = canonical.ignore.join('\n');
  return [{ path: CLINE_IGNORE, content }];
}

/**
 * Generate .cline/cline_mcp_settings.json from canonical MCP config.
 * Cline uses mcpServers format compatible with canonical.
 *
 * @param canonical - Loaded canonical files
 * @returns Array with single output, or [] if no MCP
 */
export function generateMcp(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const content = JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2);
  return [{ path: CLINE_MCP_SETTINGS, content }];
}

/**
 * Generate projected agent skills for Cline from canonical agents.
 */
export function generateAgents(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${CLINE_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}

function safeEventName(event: string): string {
  return event.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

function buildHookScript(command: string, matcher: string): string {
  return [
    '#!/usr/bin/env bash',
    `# agentsmesh-matcher: ${matcher}`,
    `# agentsmesh-command: ${command}`,
    'set -e',
    command,
    '',
  ].join('\n');
}

/**
 * Generate .clinerules/hooks/{event}-{index}.sh from canonical hooks.
 * Cline hooks are deterministic shell scripts at .clinerules/hooks/.
 *
 * @param canonical - Loaded canonical files
 * @returns Array of hook script outputs, or [] if no hooks
 */
export function generateHooks(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const outputs: RulesOutput[] = [];
  for (const [event, entries] of Object.entries(canonical.hooks)) {
    if (!Array.isArray(entries)) continue;
    let index = 0;
    for (const entry of entries) {
      if (!hasHookCommand(entry)) continue;
      outputs.push({
        path: `${CLINE_HOOKS_DIR}/${safeEventName(event)}-${index}.sh`,
        content: buildHookScript(entry.command, entry.matcher),
      });
      index++;
    }
  }
  return outputs;
}

/**
 * Generate .cline/skills/{name}/SKILL.md and supporting files.
 *
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
      path: `${CLINE_SKILLS_DIR}/${skill.name}/SKILL.md`,
      content: skillContent,
    });
    for (const file of skill.supportingFiles) {
      const relPath = file.relativePath.replace(/\\/g, '/');
      outputs.push({
        path: `${CLINE_SKILLS_DIR}/${skill.name}/${relPath}`,
        content: file.content,
      });
    }
  }
  return outputs;
}
