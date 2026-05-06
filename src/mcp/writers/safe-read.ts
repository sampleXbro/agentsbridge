import { resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { McpError } from '../errors.js';

export async function safeRead(opts: {
  projectRoot: string;
  skillName: string;
  filePath: string;
}): Promise<string> {
  const root = resolve(opts.projectRoot, '.agentsmesh/skills', opts.skillName);
  const target = resolve(root, opts.filePath);
  if (!target.startsWith(root + sep) && target !== root) {
    throw new McpError('PATH_TRAVERSAL', 'file escapes skill directory');
  }
  try {
    return await readFile(target, 'utf8');
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new McpError('NOT_FOUND', `skill file not found: ${opts.filePath}`);
    }
    throw new McpError('IO_ERROR', 'failed to read skill file');
  }
}
