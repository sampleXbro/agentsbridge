import type { CanonicalFiles } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { buildReferenceMap } from './map.js';
import { pathApi } from '../path-helpers.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import { addPackSkillArtifactMappings } from './pack-skill-artifact-paths.js';
import { applyCopilotInstructionArtifactRefs } from '../../targets/catalog/copilot-instruction-artifacts.js';
import { extraRuleOutputPaths } from '../../targets/catalog/rule-output-extra-paths.js';
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
  const raw = layout.mirrorGlobalPath(primaryOutputPath, activeTargets ?? []);
  const mirrorPaths = raw === null ? [] : Array.isArray(raw) ? raw : [raw];
  for (const mirrorPath of mirrorPaths) {
    if (mirrorPath !== primaryOutputPath) {
      sourceMap.set(mirrorPath, source);
    }
  }
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
  // The rewriter uses `pathApi(projectRoot)` to pick win32/posix from the
  // path FORMAT, not the host platform. Use the same API here so map keys
  // match the lookups even when projectRoot is a synthetic POSIX path on a
  // Windows runner (or vice versa).
  const api = pathApi(projectRoot);
  const refs = new Map(
    [...buildReferenceMap(target, canonical, config, scope)].map(([canonicalPath, targetPath]) => [
      api.normalize(api.join(projectRoot, canonicalPath)),
      api.normalize(api.join(projectRoot, targetPath)),
    ]),
  );

  applyCopilotInstructionArtifactRefs(target, refs, projectRoot, destinationPath, canonical);

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
    for (const targetPath of extraRuleOutputPaths(target, rule, refs, scope)) {
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
