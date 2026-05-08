import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

declare const __AGENTSMESH_VERSION__: string | undefined;

let resolvedVersion: string | undefined;

function readPackageVersion(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = __dirname.endsWith('dist')
      ? join(__dirname, '..', 'package.json')
      : join(__dirname, '..', '..', 'package.json');
    const pkg = require(pkgPath) as { version: string };
    return pkg.version;
  } catch {
    return undefined;
  }
}

export function getVersionFallback(): string {
  if (typeof __AGENTSMESH_VERSION__ !== 'undefined') return __AGENTSMESH_VERSION__;
  const embedded = (globalThis as Record<string, unknown>).__AGENTSMESH_VERSION__;
  if (typeof embedded === 'string') return embedded;
  return 'unknown';
}

export function getVersion(): string {
  if (resolvedVersion) return resolvedVersion;
  resolvedVersion = readPackageVersion() ?? getVersionFallback();
  return resolvedVersion;
}

export function printVersion(): void {
  process.stdout.write(`agentsmesh v${getVersion()}\n`);
}
