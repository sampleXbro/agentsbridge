import {
  normalizeInstallPathField,
  normalizeLocalSourceForYaml,
  pathApiFor,
  toPosixPath,
} from '../core/portable-paths.js';
import type { ParsedInstallSource } from './install-source-types.js';

export function localParsedFromAbsPath(
  absLocal: string,
  configDir: string,
  pathFlag: string,
): ParsedInstallSource {
  const pathApi = pathApiFor(absLocal, configDir);
  const normalizedAbsLocal = pathApi.normalize(absLocal);
  const normalizedConfigDir = pathApi.normalize(configDir);
  const normalizedPathFlag = normalizeInstallPathField(pathFlag);
  const abMarker = `${pathApi.sep}.agentsmesh${pathApi.sep}`;
  const idx = normalizedAbsLocal.indexOf(abMarker);
  if (idx >= 0) {
    const root = normalizedAbsLocal.slice(0, idx);
    const after = normalizedAbsLocal.slice(idx + abMarker.length);
    const pathFromAb = normalizeInstallPathField(after);
    // POSIX-normalize so installs.yaml stays portable across Windows/POSIX clones.
    const localSource = toPosixPath(pathApi.relative(normalizedConfigDir, root)) || '.';
    return {
      kind: 'local',
      rawRef: '',
      pathInRepo: normalizedPathFlag || pathFromAb.replace(/\.md$/i, '').replace(/\/$/, ''),
      localRoot: root,
      localSourceForYaml: normalizeLocalSourceForYaml(localSource),
    };
  }

  const localSource = toPosixPath(pathApi.relative(normalizedConfigDir, normalizedAbsLocal)) || '.';
  return {
    kind: 'local',
    rawRef: '',
    pathInRepo: normalizedPathFlag,
    localRoot: normalizedAbsLocal,
    localSourceForYaml: normalizeLocalSourceForYaml(localSource),
  };
}
