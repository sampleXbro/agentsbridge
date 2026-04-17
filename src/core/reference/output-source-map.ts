import { join, normalize as normalizePath } from 'node:path';
import type { CanonicalFiles } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { buildReferenceMap } from './map.js';
import { GEMINI_COMPAT_AGENTS } from '../../targets/gemini-cli/constants.js';
import { CODEX_RULES_DIR } from '../../targets/codex-cli/constants.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import { addPackSkillArtifactMappings } from './pack-skill-artifact-paths.js';
import { getTargetLayout } from '../../targets/catalog/builtin-targets.js';

function addGlobalSkillMirrorSourceEntry(
  target: string,
  scope: TargetLayoutScope,
  primaryOutputPath: string,
  source: string,
  sourceMap: Map<string, string>,
  activeTargets: readonly string[] | undefined,
): void {
  if (scope !== 'global') return;
  const layout = getTargetLayout(target, scope);
  if (!layout?.mirrorGlobalPath) return;
  const mirrorPath = layout.mirrorGlobalPath(primaryOutputPath, activeTargets ?? []);
  if (mirrorPath !== null && mirrorPath !== primaryOutputPath) {
    sourceMap.set(mirrorPath, source);
  }
}

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
  scope: TargetLayoutScope,
): string[] {
  const paths: string[] = [];
  const targetPath = refs.get(canonicalRulePath(rule));
  if (targetPath) paths.push(targetPath);

  if (target === 'copilot' && !rule.root && rule.globs.length > 0) {
    paths.push(copilotInstructionsPath(rule));
  }

  if ((target === 'cline' || target === 'cursor') && rule.root && scope === 'project') {
    paths.push('AGENTS.md');
  }

  if (target === 'windsurf' && scope === 'project') {
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

  if (target === 'codex-cli') {
    if (!rule.root && rule.codexEmit === 'execution') {
      const slug = rule.source.split('/').pop()!.replace(/\.md$/, '');
      paths.push(`${CODEX_RULES_DIR}/${slug}.rules`);
    }
  }

  return paths;
}

export function buildArtifactPathMap(
  target: string,
  canonical: CanonicalFiles,
  config: ValidatedConfig,
  projectRoot: string,
  destinationPath?: string,
  options?: {
    scope?: TargetLayoutScope;
  },
): Map<string, string> {
  const scope = options?.scope ?? 'project';
  const refs = new Map(
    [...buildReferenceMap(target, canonical, config, scope)].map(([canonicalPath, targetPath]) => [
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

  addPackSkillArtifactMappings(refs, target, canonical, projectRoot, scope);

  return refs;
}

export function buildOutputSourceMap(
  target: string,
  canonical: CanonicalFiles,
  config: ValidatedConfig,
  scope: TargetLayoutScope = 'project',
  activeTargets?: readonly string[],
): Map<string, string> {
  const refs = buildReferenceMap(target, canonical, config, scope);
  const sourceMap = new Map<string, string>();

  for (const rule of canonical.rules) {
    for (const targetPath of ruleOutputPaths(target, rule, refs, scope)) {
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
    if (skillTargetPath) {
      sourceMap.set(skillTargetPath, skill.source);
      addGlobalSkillMirrorSourceEntry(
        target,
        scope,
        skillTargetPath,
        skill.source,
        sourceMap,
        activeTargets,
      );
    }
    for (const file of skill.supportingFiles) {
      const canonicalPath = `.agentsmesh/skills/${skill.name}/${file.relativePath.replace(/\\/g, '/')}`;
      const targetPath = refs.get(canonicalPath);
      if (targetPath) {
        sourceMap.set(targetPath, file.absolutePath);
        addGlobalSkillMirrorSourceEntry(
          target,
          scope,
          targetPath,
          file.absolutePath,
          sourceMap,
          activeTargets,
        );
      }
    }
  }

  return sourceMap;
}
