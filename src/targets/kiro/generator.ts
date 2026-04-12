import { basename } from 'node:path';
import type { CanonicalFiles, CanonicalRule } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import { generateKiroHooks } from './hook-format.js';
import {
  KIRO_TARGET,
  KIRO_AGENTS_MD,
  KIRO_STEERING_DIR,
  KIRO_SKILLS_DIR,
  KIRO_MCP_FILE,
  KIRO_HOOKS_DIR,
  KIRO_IGNORE,
} from './constants.js';

export interface KiroOutput {
  path: string;
  content: string;
}

function steeringFrontmatter(rule: CanonicalRule): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};
  if (rule.globs.length > 0) {
    frontmatter.inclusion = 'fileMatch';
    frontmatter.fileMatchPattern = rule.globs.length === 1 ? rule.globs[0] : rule.globs;
  } else if (rule.trigger === 'manual') {
    frontmatter.inclusion = 'manual';
  } else if (rule.trigger === 'model_decision') {
    frontmatter.inclusion = 'auto';
  } else {
    frontmatter.inclusion = 'always';
  }
  if (rule.description) frontmatter.description = rule.description;
  return frontmatter;
}

export function generateRules(canonical: CanonicalFiles): KiroOutput[] {
  const outputs: KiroOutput[] = [];
  const root = canonical.rules.find((rule) => rule.root);
  if (root) {
    outputs.push({ path: KIRO_AGENTS_MD, content: root.body.trim() || '' });
  }
  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.targets.length > 0 && !rule.targets.includes(KIRO_TARGET)) continue;
    const slug = basename(rule.source, '.md');
    outputs.push({
      path: `${KIRO_STEERING_DIR}/${slug}.md`,
      content: serializeFrontmatter(steeringFrontmatter(rule), rule.body.trim() || ''),
    });
  }
  return outputs;
}

export function generateSkills(canonical: CanonicalFiles): KiroOutput[] {
  return generateEmbeddedSkills(canonical, KIRO_SKILLS_DIR);
}

export function generateMcp(canonical: CanonicalFiles): KiroOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    {
      path: KIRO_MCP_FILE,
      content: JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}

export function generateHooks(canonical: CanonicalFiles): KiroOutput[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  return generateKiroHooks(canonical.hooks).map((hook) => ({
    path: `${KIRO_HOOKS_DIR}/${hook.name}`,
    content: hook.content,
  }));
}

export function generateIgnore(canonical: CanonicalFiles): KiroOutput[] {
  if (canonical.ignore.length === 0) return [];
  return [{ path: KIRO_IGNORE, content: canonical.ignore.join('\n') }];
}
