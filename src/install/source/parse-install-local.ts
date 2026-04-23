import { relative, sep } from 'node:path';
import type { ParsedInstallSource } from './install-source-types.js';

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

export function localParsedFromAbsPath(
  absLocal: string,
  configDir: string,
  pathFlag: string,
): ParsedInstallSource {
  const abMarker = `${sep}.agentsmesh${sep}`;
  const idx = absLocal.indexOf(abMarker);
  if (idx >= 0) {
    const root = absLocal.slice(0, idx);
    const after = absLocal.slice(idx + abMarker.length);
    const pathFromAb = toPosix(after.replace(/\\/g, '/')).replace(/^\/+/, '');
    const localSource = relative(configDir, root) || '.';
    return {
      kind: 'local',
      rawRef: '',
      pathInRepo: pathFlag || pathFromAb.replace(/\.md$/i, '').replace(/\/$/, ''),
      localRoot: root,
      localSourceForYaml: localSource.startsWith('..')
        ? localSource
        : `./${localSource}`.replace(/^\.\/\./, '.'),
    };
  }

  const localSource = relative(configDir, absLocal) || '.';
  return {
    kind: 'local',
    rawRef: '',
    pathInRepo: pathFlag,
    localRoot: absLocal,
    localSourceForYaml: localSource.startsWith('..')
      ? localSource
      : `./${localSource}`.replace(/^\.\/\./, '.'),
  };
}
