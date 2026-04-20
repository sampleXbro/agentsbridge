import { resolve, sep } from 'node:path';

export function ensurePathInsideRoot(
  rootDir: string,
  relativePath: string,
  target: string,
): string {
  const rootAbs = resolve(rootDir);
  const outputAbs = resolve(rootDir, relativePath);
  if (outputAbs === rootAbs || outputAbs.startsWith(`${rootAbs}${sep}`)) return outputAbs;
  throw new Error(`Unsafe generated output path for ${target}: ${relativePath}`);
}
