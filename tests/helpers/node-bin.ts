import { join } from 'node:path';

export function resolveNodeBin(
  root: string,
  name: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const executable = platform === 'win32' ? `${name}.cmd` : name;
  return join(root, 'node_modules', '.bin', executable);
}
