import { dirname, join, normalize as normalizePath } from 'node:path';
import type { CanonicalFiles } from '../types.js';
import { getTargetSkillDir } from '../../targets/catalog/builtin-targets.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

function addPackAbsoluteDirMapping(
  refs: Map<string, string>,
  fromAbs: string,
  toAbs: string,
): void {
  const fromNorm = normalizePath(fromAbs);
  const toNorm = normalizePath(toAbs);
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

  const packsPrefix = join(projectRoot, '.agentsmesh', 'packs');

  for (const skill of canonical.skills) {
    const skillSourceDir = dirname(skill.source);
    if (!skillSourceDir.startsWith(packsPrefix)) continue;

    const targetSkillDir = normalizePath(join(projectRoot, skillDir, skill.name));

    addPackAbsoluteDirMapping(refs, skillSourceDir, targetSkillDir);

    refs.set(normalizePath(skill.source), normalizePath(join(targetSkillDir, 'SKILL.md')));

    for (const file of skill.supportingFiles) {
      const targetFilePath = normalizePath(join(targetSkillDir, file.relativePath));
      refs.set(normalizePath(file.absolutePath), targetFilePath);
    }

    for (const relPrefix of skillSupportingDirPrefixes(skill.supportingFiles)) {
      addPackAbsoluteDirMapping(
        refs,
        join(skillSourceDir, relPrefix),
        join(targetSkillDir, relPrefix),
      );
    }
  }
}
