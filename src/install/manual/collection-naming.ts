import { basename, relative } from 'node:path';

export function sanitizeNameSegment(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function computeDestName(file: string): string {
  const isMdc = file.toLowerCase().endsWith('.mdc');
  return isMdc ? basename(file).replace(/\.mdc$/i, '.md') : basename(file);
}

export function namespacedName(sourceRoot: string, file: string, bareName: string): string {
  const rel = relative(sourceRoot, file).replace(/\\/g, '/');
  const segments = rel.split('/');
  segments.pop();
  if (segments.length === 0) return bareName;
  const prefix = sanitizeNameSegment(segments[segments.length - 1]!);
  if (!prefix) return bareName;
  return `${prefix}-${bareName}`;
}
