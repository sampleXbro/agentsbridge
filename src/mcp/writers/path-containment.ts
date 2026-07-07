import { realpath } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { McpError } from '../errors.js';

async function canonicalize(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    const parent = dirname(path);
    if (parent === path) return resolve(path);
    return join(await canonicalize(parent), basename(path));
  }
}

export async function assertContainedPath(opts: {
  root: string;
  target: string;
  boundaryRoot?: string;
  message: string;
}): Promise<void> {
  const root = await canonicalize(resolve(opts.root));
  const target = await canonicalize(resolve(opts.target));
  if (opts.boundaryRoot !== undefined) {
    const boundary = await canonicalize(resolve(opts.boundaryRoot));
    if (!isInside(root, boundary)) throw new McpError('PATH_TRAVERSAL', opts.message);
  }
  if (isInside(target, root)) return;
  throw new McpError('PATH_TRAVERSAL', opts.message);
}

function isInside(target: string, root: string): boolean {
  if (target === root || target.startsWith(`${root}${sep}`)) return true;
  return false;
}
