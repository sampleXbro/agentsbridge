import { resolve } from 'node:path';
import { writeFile, rename } from 'node:fs/promises';
import { McpError } from '../errors.js';
import { MAX_FILE_SIZE_BYTES } from '../limits.js';

export async function safeConfigWrite(opts: {
  projectRoot: string;
  content: string;
  filename?: 'agentsmesh.yaml';
}): Promise<string> {
  if (opts.filename !== undefined && opts.filename !== 'agentsmesh.yaml') {
    throw new McpError('PATH_TRAVERSAL', 'only agentsmesh.yaml is writable');
  }
  if (Buffer.byteLength(opts.content, 'utf8') > MAX_FILE_SIZE_BYTES) {
    throw new McpError('LIMIT_EXCEEDED', 'config exceeds 1 MiB cap');
  }
  const target = resolve(opts.projectRoot, 'agentsmesh.yaml');
  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`;
  await writeFile(tmp, opts.content, 'utf8');
  await rename(tmp, target);
  return target;
}
