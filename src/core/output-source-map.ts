import { dirname, join, normalize as normalizePath } from 'node:path';
import type { CanonicalFiles } from './types.js';
import type { ValidatedConfig } from '../config/schema.js';
import { buildReferenceMap } from './reference-map.js';
import { GEMINI_COMPAT_AGENTS } from '../targets/gemini-cli/constants.js';
import { SKILL_DIRS } from './reference-map-targets.js';

function canonicalRulePath(rule: CanonicalFiles['rules'][number]): string {
  return `.agentsmesh/rules/${rule.source.split('/').pop()!}`;
}

function canonicalCommandPath(command: CanonicalFiles['commands'][number]): string {
  return `.agentsmesh/commands/${command.name}.md`;
}

function canonicalAgentPath(agent: CanonicalFiles['agents'][number]): string {
  return `.agentsmesh/agents/${agent.name}.md`;
}

function canonicalSkillPath(skill: CanonicalFiles['skills'][number]): string {
  return `.agentsmesh/skills/${skill.name}/SKILL.md`;
}

function directoryScopedRuleDir(globs: string[]): string | null {
  if (globs.length === 0) return null;
  const dirs = globs
    .map((glob) => glob.split('/')[0] ?? '')
    .filter((segment) => /^[A-Za-z0-9._-]+$/.test(segment));
  if (dirs.length !== globs.length) return null;
  return dirs.every((dir) => dir === dirs[0]) ? dirs[0]! : null;
}

function copilotInstructionsPath(rule: CanonicalFiles['rules'][number]): string {
  const slug = rule.source.split('/').pop()!.replace(/\.md$/, '');
  return `.github/instructions/${slug}.instructions.md`;
}

function ruleOutputPaths(
  target: string,
  rule: CanonicalFiles['rules'][number],
  refs: Map<string, string>,
): string[] {
  const paths: string[] = [];
  const targetPath = refs.get(canonicalRulePath(rule));
  if (targetPath) paths.push(targetPath);

  if (target === 'copilot' && !rule.root && rule.globs.length > 0) {
    paths.push(copilotInstructionsPath(rule));
  }

  if ((target === 'cline' || target === 'cursor') && rule.root) {
    paths.push('AGENTS.md');
  }

  if (target === 'windsurf') {
    if (rule.root) {
      paths.push('AGENTS.md');
    } else {
      const dir = directoryScopedRuleDir(rule.globs);
      if (dir) paths.push(`${dir}/AGENTS.md`);
    }
  }

  // Gemini AGENTS.md compatibility mirror is generated from root rule content and must
  // participate in source mapping for reference rewriting.
  if (target === 'gemini-cli') {
    paths.push(GEMINI_COMPAT_AGENTS);
  }

  return paths;
}

function addPackSkillPaths(
  refs: Map<string, string>,
  target: string,
  canonical: CanonicalFiles,
  projectRoot: string,
): void {
  const skillDir = SKILL_DIRS[target];
  if (!skillDir) return;

  const packsPrefix = join(projectRoot, '.agentsmesh', 'packs');

  for (const skill of canonical.skills) {
    const skillSourceDir = dirname(skill.source);
    if (!skillSourceDir.startsWith(packsPrefix)) continue;

    const targetSkillDir = normalizePath(join(projectRoot, skillDir, skill.name));

    // Map pack skill directory → target skill directory
    refs.set(normalizePath(skillSourceDir), targetSkillDir);

    // Map pack SKILL.md → target SKILL.md
    refs.set(normalizePath(skill.source), normalizePath(join(targetSkillDir, 'SKILL.md')));

    // Map pack supporting files → target supporting files
    for (const file of skill.supportingFiles) {
      const targetFilePath = normalizePath(join(targetSkillDir, file.relativePath));
      refs.set(normalizePath(file.absolutePath), targetFilePath);
    }
  }
}

export function buildArtifactPathMap(
  target: string,
  canonical: CanonicalFiles,
  config: ValidatedConfig,
  projectRoot: string,
  destinationPath?: string,
): Map<string, string> {
  const refs = new Map(
    [...buildReferenceMap(target, canonical, config)].map(([canonicalPath, targetPath]) => [
      normalizePath(join(projectRoot, canonicalPath)),
      normalizePath(join(projectRoot, targetPath)),
    ]),
  );

  if (target === 'copilot' && destinationPath?.startsWith('.github/instructions/')) {
    for (const rule of canonical.rules) {
      if (rule.root || rule.globs.length === 0) continue;
      refs.set(
        normalizePath(join(projectRoot, canonicalRulePath(rule))),
        normalizePath(join(projectRoot, copilotInstructionsPath(rule))),
      );
    }
  }

  addPackSkillPaths(refs, target, canonical, projectRoot);

  return refs;
}

export function buildOutputSourceMap(
  target: string,
  canonical: CanonicalFiles,
  config: ValidatedConfig,
): Map<string, string> {
  const refs = buildReferenceMap(target, canonical, config);
  const sourceMap = new Map<string, string>();

  for (const rule of canonical.rules) {
    for (const targetPath of ruleOutputPaths(target, rule, refs)) {
      sourceMap.set(targetPath, rule.source);
    }
  }
  for (const command of canonical.commands) {
    const targetPath = refs.get(canonicalCommandPath(command));
    if (targetPath) sourceMap.set(targetPath, command.source);
  }
  for (const agent of canonical.agents) {
    const targetPath = refs.get(canonicalAgentPath(agent));
    if (targetPath) sourceMap.set(targetPath, agent.source);
  }
  for (const skill of canonical.skills) {
    const skillTargetPath = refs.get(canonicalSkillPath(skill));
    if (skillTargetPath) sourceMap.set(skillTargetPath, skill.source);
    for (const file of skill.supportingFiles) {
      const canonicalPath = `.agentsmesh/skills/${skill.name}/${file.relativePath.replace(/\\/g, '/')}`;
      const targetPath = refs.get(canonicalPath);
      if (targetPath) sourceMap.set(targetPath, file.absolutePath);
    }
  }

  return sourceMap;
}
