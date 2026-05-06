import { resolve, dirname } from 'node:path';
import { stat } from 'node:fs/promises';
import { McpError } from './errors.js';
import { loadCanonicalFiles } from '../canonical/load/loader.js';
import type { CanonicalFiles } from '../core/types.js';

export interface McpContext {
  projectRoot: string;
  loadCanonical: () => Promise<CanonicalFiles>;
}

async function findProjectRoot(start: string): Promise<string> {
  let dir = resolve(start);
  while (true) {
    try {
      await stat(resolve(dir, 'agentsmesh.yaml'));
      return dir;
    } catch {
      /* not here */
    }
    const parent = dirname(dir);
    if (parent === dir) throw new McpError('NO_PROJECT', 'agentsmesh.yaml not found');
    dir = parent;
  }
}

export async function resolveContext(opts: { cwd: string }): Promise<McpContext> {
  const projectRoot = await findProjectRoot(opts.cwd);
  return {
    projectRoot,
    loadCanonical: () => loadCanonicalFiles(projectRoot),
  };
}
