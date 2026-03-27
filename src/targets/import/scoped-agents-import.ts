import { rm } from 'node:fs/promises';

export function shouldImportScopedAgentsRule(relDir: string): boolean {
  const segments = relDir.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  if (segments.some((segment) => segment.startsWith('.'))) return false;

  const relPath = segments.join('/');
  return !relPath.startsWith('tests/e2e/fixtures/');
}

export async function removePathIfExists(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
