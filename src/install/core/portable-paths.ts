import { posix, win32 } from 'node:path';

const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/;
const WINDOWS_ABSOLUTE_POSIX_PATH = /^[A-Za-z]:\//;

export type PathApi = typeof posix;

export function pathApiFor(...paths: readonly string[]): PathApi {
  return paths.some((path) => path.includes('\\') || WINDOWS_ABSOLUTE_PATH.test(path))
    ? win32
    : posix;
}

export function toPosixPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function normalizeInstallPathField(path: string): string {
  return toPosixPath(path).replace(/^\/+|\/+$/g, '');
}

export function normalizeLocalSourceForYaml(source: string): string {
  const portable = toPosixPath(source);
  if (portable === '' || portable === '.' || portable === './.') return '.';
  if (
    portable.startsWith('./') ||
    portable.startsWith('../') ||
    portable.startsWith('/') ||
    WINDOWS_ABSOLUTE_POSIX_PATH.test(portable)
  ) {
    return portable;
  }
  return `./${portable}`;
}

export function normalizePersistedInstallPaths<
  T extends {
    source: string;
    source_kind: string;
    path?: string;
    paths?: string[];
  },
>(entry: T): T {
  return {
    ...entry,
    source:
      entry.source_kind === 'local' ? normalizeLocalSourceForYaml(entry.source) : entry.source,
    ...(entry.path !== undefined ? { path: normalizeInstallPathField(entry.path) } : {}),
    ...(entry.paths !== undefined
      ? { paths: entry.paths.map((path) => normalizeInstallPathField(path)) }
      : {}),
  };
}
