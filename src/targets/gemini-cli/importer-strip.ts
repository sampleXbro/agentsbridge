import { realpathSync } from 'node:fs';

export function stripProjectRootCanonicalPrefix(content: string, projectRoot: string): string {
  const variants = new Set([
    projectRoot,
    projectRoot.replace(/\\/g, '/'),
    projectRoot.replace(/\//g, '\\'),
  ]);
  try {
    variants.add(realpathSync(projectRoot));
    variants.add(realpathSync.native(projectRoot));
  } catch {
    // Keep direct path variants when realpath lookup fails.
  }

  const stripped = Array.from(variants).reduce((next, variant) => {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return next
      .replace(new RegExp(`${escaped}[/\\\\]\\.agentsmesh[/\\\\]`, 'g'), '.agentsmesh/')
      .replaceAll(`${variant}/.agentsmesh`, '.agentsmesh')
      .replaceAll(`${variant}\\.agentsmesh`, '.agentsmesh');
  }, content);

  return stripped.replace(/(?:[A-Za-z]:)?[^\s"'`()<>]+[/\\]\.agentsmesh[/\\]/g, '.agentsmesh/');
}
