import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
// src/cli/version.ts -> ../../package.json; dist/cli.js -> ../package.json
const pkgPath = __dirname.endsWith('dist')
  ? join(__dirname, '..', 'package.json')
  : join(__dirname, '..', '..', 'package.json');
const pkg = require(pkgPath) as { version: string };

/**
 * Returns the lib version from package.json.
 */
export function getVersion(): string {
  return pkg.version;
}

/**
 * Prints the CLI version from package.json.
 */
export function printVersion(): void {
  process.stdout.write(`agentsbridge v${pkg.version}\n`);
}
