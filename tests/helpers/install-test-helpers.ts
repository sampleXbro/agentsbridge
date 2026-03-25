import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface TestInstallEntry {
  name?: string;
  source?: string;
  version?: string;
  source_kind?: string;
  features?: string[];
  target?: string;
  path?: string;
  paths?: string[];
  as?: string;
  pick?: Record<string, string[]>;
}

interface TestInstallManifest {
  version?: number;
  installs: TestInstallEntry[];
}

export function listRelativeFiles(dir: string, base = ''): string[] {
  if (!existsSync(dir)) {
    throw new Error(`Expected directory to exist: ${dir}`);
  }
  const currentPath = base ? join(dir, base) : dir;
  return readdirSync(currentPath, { withFileTypes: true })
    .flatMap((entry) => {
      const relPath = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        return listRelativeFiles(dir, relPath);
      }
      return relPath;
    })
    .sort();
}

export function readInstallManifest(manifestPath: string): TestInstallManifest {
  const parsed = parseYaml(readFileSync(manifestPath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Expected install manifest object at ${manifestPath}`);
  }

  const installs = Reflect.get(parsed, 'installs');
  if (!Array.isArray(installs)) {
    throw new Error(`Expected installs array at ${manifestPath}`);
  }

  return {
    version:
      typeof Reflect.get(parsed, 'version') === 'number'
        ? (Reflect.get(parsed, 'version') as number)
        : undefined,
    installs: installs.map((entry) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error(`Expected install manifest entry object at ${manifestPath}`);
      }
      return entry as TestInstallEntry;
    }),
  };
}
