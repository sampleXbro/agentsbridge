import { dirname } from 'node:path';
import type { CanonicalFiles } from '../types.js';
import { pathApi } from '../path-helpers.js';
import { getTargetSkillDir } from '../../targets/catalog/builtin-targets.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

function addPackAbsoluteDirMapping(
  refs: Map<string, string>,
  fromAbs: string,
  toAbs: string,
  api: typeof import('node:path').posix,
): void {
  const fromNorm = api.normalize(fromAbs);
  const toNorm = api.normalize(toAbs);
  refs.set(fromNorm, toNorm);
  refs.set(`${fromNorm}/`, `${toNorm}/`);
}

function skillSupportingDirPrefixes(
  supportingFiles: CanonicalFiles['skills'][number]['supportingFiles'],
): string[] {
  const dirs = new Set<string>();
  for (const { relativePath } of supportingFiles) {
    const posixPath = relativePath.replace(/\\/g, '/');
    let d = dirname(posixPath);
    while (d !== '.' && d.length > 0) {
      dirs.add(d);
      const next = dirname(d);
      if (next === d) break;
      d = next;
    }
  }
  return [...dirs];
}

/** Maps installed pack skill trees (absolute) into target output paths, including subdirs. */
export function addPackSkillArtifactMappings(
  refs: Map<string, string>,
  target: string,
  canonical: CanonicalFiles,
  projectRoot: string,
  scope: TargetLayoutScope,
): void {
  const skillDir = getTargetSkillDir(target, scope);
  if (!skillDir) return;

  // Match the rewriter: pick the path API from the projectRoot format so the
  // same path appears identical in keys and lookups regardless of runtime OS.
  const api = pathApi(projectRoot);
  const packsPrefix = api.join(projectRoot, '.agentsmesh', 'packs');

  for (const skill of canonical.skills) {
    const skillSourceDir = dirname(skill.source);
    if (!skillSourceDir.startsWith(packsPrefix)) continue;

    const targetSkillDir = api.normalize(api.join(projectRoot, skillDir, skill.name));

    addPackAbsoluteDirMapping(refs, skillSourceDir, targetSkillDir, api);

    refs.set(api.normalize(skill.source), api.normalize(api.join(targetSkillDir, 'SKILL.md')));

    for (const file of skill.supportingFiles) {
      const targetFilePath = api.normalize(api.join(targetSkillDir, file.relativePath));
      refs.set(api.normalize(file.absolutePath), targetFilePath);
    }

    for (const relPrefix of skillSupportingDirPrefixes(skill.supportingFiles)) {
      addPackAbsoluteDirMapping(
        refs,
        api.join(skillSourceDir, relPrefix),
        api.join(targetSkillDir, relPrefix),
        api,
      );
    }
  }
}
