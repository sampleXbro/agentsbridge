import { posix } from 'node:path';

function addDirectoryMapping(refs: Map<string, string>, from: string, to: string): void {
  refs.set(from, to);
  refs.set(`${from}/`, `${to}/`);
}

export function addSkillDirectoryMappings(
  refs: Map<string, string>,
  canonicalPath: string,
  targetPath: string,
): void {
  let fromDir = posix.dirname(canonicalPath);
  let toDir = posix.dirname(targetPath);

  while (fromDir !== '.agentsbridge/skills' && fromDir !== '.') {
    addDirectoryMapping(refs, fromDir, toDir);
    fromDir = posix.dirname(fromDir);
    toDir = posix.dirname(toDir);
  }
}
