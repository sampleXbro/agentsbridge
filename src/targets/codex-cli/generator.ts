/**
 * Generate Codex CLI config files from canonical sources.
 * Per codex-cli-project-level-advanced.md: root → `AGENTS.md`; advisory rules → nested
 * `AGENTS.md` / `AGENTS.override.md`; execution policy → `.codex/rules/*.rules` (Starlark).
 */

import type { CanonicalCommand, CanonicalFiles, StdioMcpServer } from '../../core/types.js';
import { isStdioMcpServer } from '../../core/mcp-servers.js';
import { serializeFrontmatter } from '../../utils/markdown.js';
import type { CanonicalAgent } from '../../core/types.js';
import { basename } from 'node:path';
import {
  AGENTS_MD,
  CODEX_AGENTS_DIR,
  CODEX_RULES_DIR,
  CODEX_SKILLS_DIR,
  CODEX_CONFIG_TOML,
} from './constants.js';
import { commandSkillDirName, serializeCommandSkill } from './command-skill.js';
import { codexAdvisoryInstructionPath } from './codex-rule-paths.js';

export interface RulesOutput {
  path: string;
  content: string;
}

function looksLikeCodexRulesDsl(body: string): boolean {
  return /(^|\n)\s*[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(body);
}

function toCodexRulesComments(body: string): string {
  return body
    .split('\n')
    .map((line) => (line.length > 0 ? `# ${line}` : '#'))
    .join('\n');
}

function toSafeCodexRulesContent(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';
  if (looksLikeCodexRulesDsl(trimmed)) return `${trimmed}\n`;
  const lines: string[] = [
    '# agentsmesh: canonical execution rule body is not Codex DSL',
    '# The original body is preserved below as comments.',
    '# Replace with Codex rules DSL (for example prefix_rule(...)) to enforce behavior.',
    '#',
    ...toCodexRulesComments(trimmed).split('\n'),
    '#',
    '# Example template:',
    '# prefix_rule(',
    '#   pattern = ["git", "status"],',
    '#   decision = "allow",',
    '#   justification = "Allow safe status checks",',
    '# )',
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * Generate AGENTS.md from root rule; advisory non-root → nested instruction files;
 * `codex_emit: execution` → `.codex/rules/{slug}.rules` (Starlark or safe comments).
 *
 * @param canonical - Loaded canonical files
 * @returns AGENTS.md + nested `AGENTS*.md` + optional `.codex/rules/*.rules`
 */
export function generateRules(canonical: CanonicalFiles): RulesOutput[] {
  const root = canonical.rules.find((r) => r.root);
  const outputs: RulesOutput[] = [];
  if (root) {
    outputs.push({ path: AGENTS_MD, content: root.body.trim() });
  }

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.targets.length > 0 && !rule.targets.includes('codex-cli')) continue;
    const slug = basename(rule.source, '.md');
    if (rule.codexEmit === 'execution') {
      outputs.push({
        path: `${CODEX_RULES_DIR}/${slug}.rules`,
        content: toSafeCodexRulesContent(rule.body),
      });
      continue;
    }
    outputs.push({
      path: codexAdvisoryInstructionPath(rule),
      content: rule.body.trim(),
    });
  }

  return outputs;
}

/**
 * Generate .agents/skills/{name}/SKILL.md and supporting files from canonical skills.
 * Uses the standard agentskills.io format also shared with Claude Code and Cline.
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
      path: `${CODEX_SKILLS_DIR}/${skill.name}/SKILL.md`,
      content: skillContent,
    });
    for (const file of skill.supportingFiles) {
      const relPath = file.relativePath.replace(/\\/g, '/');
      outputs.push({
        path: `${CODEX_SKILLS_DIR}/${skill.name}/${relPath}`,
        content: file.content,
      });
    }
  }
  return outputs;
}

function commandToSkillOutput(command: CanonicalCommand): RulesOutput {
  return {
    path: `${CODEX_SKILLS_DIR}/${commandSkillDirName(command.name)}/SKILL.md`,
    content: serializeCommandSkill(command),
  };
}

export function generateCommands(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.commands.map(commandToSkillOutput);
}

/**
 * Generate .codex/agents/*.toml from canonical agents.
 * Per docs/agent-structures/codex-cli-project-level-advanced.md: native agent format.
 */
export function generateAgents(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${CODEX_AGENTS_DIR}/${agent.name}.toml`,
    content: serializeAgentToCodexToml(agent),
  }));
}

function serializeAgentToCodexToml(agent: CanonicalAgent): string {
  const lines: string[] = [];
  lines.push(`name = ${JSON.stringify(agent.name)}`);
  if (agent.description) {
    lines.push(`description = ${JSON.stringify(agent.description)}`);
  }
  if (agent.model) {
    lines.push(`model = ${JSON.stringify(agent.model)}`);
  }
  if (agent.permissionMode === 'read-only' || agent.permissionMode === 'deny') {
    lines.push('sandbox_mode = "read-only"');
  } else if (agent.permissionMode === 'allow') {
    lines.push('sandbox_mode = "workspace-write"');
  }
  const body = agent.body.trim() || '';
  if (body.includes("'''")) {
    const escaped = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    lines.push(`developer_instructions = """\n${escaped}\n"""`);
  } else {
    lines.push(`developer_instructions = '''\n${body}\n'''`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Generate .codex/config.toml with [mcp_servers.*] sections from canonical MCP config.
 * Codex reads project-level MCP from .codex/config.toml (when project is trusted).
 *
 * @param canonical - Loaded canonical files
 * @returns Array with single config.toml output, or [] if no MCP
 */
export function generateMcp(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const stdioServers: Record<string, StdioMcpServer> = Object.fromEntries(
    Object.entries(canonical.mcp.mcpServers).flatMap(([name, server]) =>
      isStdioMcpServer(server) ? [[name, server] as const] : [],
    ),
  );
  if (Object.keys(stdioServers).length === 0) return [];
  const content = serializeMcpToToml(stdioServers);
  return [{ path: CODEX_CONFIG_TOML, content }];
}

/**
 * Serialize MCP servers to Codex config.toml format.
 * Each server becomes a [mcp_servers.{name}] table section.
 */
function serializeMcpToToml(mcpServers: Record<string, StdioMcpServer>): string {
  const sections: string[] = [];

  for (const [name, server] of Object.entries(mcpServers)) {
    const quotedName = needsTomlQuoting(name) ? `"${name}"` : name;
    const lines: string[] = [];
    lines.push(`[mcp_servers.${quotedName}]`);
    lines.push(`command = ${JSON.stringify(server.command)}`);
    const argsToml = '[' + server.args.map((arg) => JSON.stringify(arg)).join(', ') + ']';
    lines.push(`args = ${argsToml}`);

    const envEntries = Object.entries(server.env);
    if (envEntries.length > 0) {
      const envParts = envEntries
        .map(([k, v]) => `${needsTomlQuoting(k) ? JSON.stringify(k) : k} = ${JSON.stringify(v)}`)
        .join(', ');
      lines.push(`env = { ${envParts} }`);
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n') + '\n';
}

/** Returns true if a TOML bare key needs quoting (not A-Z a-z 0-9 - _). */
function needsTomlQuoting(key: string): boolean {
  return !/^[A-Za-z0-9_-]+$/.test(key);
}
