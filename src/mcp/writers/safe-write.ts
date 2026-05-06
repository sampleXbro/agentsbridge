import { resolve, dirname, sep } from 'node:path';
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { McpError } from '../errors.js';
import { MAX_FILE_SIZE_BYTES } from '../limits.js';

export interface SafeWriteOptions {
  projectRoot: string;
  feature: 'rules' | 'commands' | 'agents' | 'skills';
  relativePath: string;
  content: string;
}

export async function safeWrite(opts: SafeWriteOptions): Promise<string> {
  const root = resolve(opts.projectRoot, '.agentsmesh', opts.feature);
  const target = resolve(root, opts.relativePath);
  if (!target.startsWith(root + sep) && target !== root) {
    throw new McpError('PATH_TRAVERSAL', `path escapes ${opts.feature} directory`);
  }
  if (Buffer.byteLength(opts.content, 'utf8') > MAX_FILE_SIZE_BYTES) {
    throw new McpError('LIMIT_EXCEEDED', 'file body exceeds 1 MiB cap', {
      limit: MAX_FILE_SIZE_BYTES,
      actual: Buffer.byteLength(opts.content, 'utf8'),
    });
  }
  await mkdir(dirname(target), { recursive: true });
  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`;
  await writeFile(tmp, opts.content, 'utf8');
  await rename(tmp, target);
  return target;
}
