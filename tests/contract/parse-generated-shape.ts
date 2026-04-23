import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import YAML from 'yaml';
import { parse as parseToml } from 'smol-toml';

function isReferenceMatrixFixtureProse(raw: string): boolean {
  return (
    raw.includes('## Rewrite Matrix') || (raw.includes('Plain:') && raw.includes('Status markers:'))
  );
}

/**
 * Assert generated file content parses under its on-disk format (Testing Strategy §3.2.2).
 */
export function assertParsableGeneratedFile(absPath: string, relPath: string): void {
  const raw = readFileSync(absPath, 'utf-8');
  if (isReferenceMatrixFixtureProse(raw)) {
    return;
  }
  const ext = extname(relPath).toLowerCase();
  if (ext === '.json') {
    JSON.parse(raw);
    return;
  }
  if (ext === '.toml') {
    parseToml(raw);
    return;
  }
  if (ext === '.yaml' || ext === '.yml') {
    YAML.parse(raw);
    return;
  }
  if (ext === '.md' || ext === '.mdc' || ext === '.hook' || ext === '.sh' || ext === '') {
    if (raw.startsWith('---')) {
      const end = raw.indexOf('\n---', 3);
      if (end !== -1) YAML.parse(raw.slice(3, end));
    }
    return;
  }
  if (ext === '.ts' || ext === '.js') {
    return;
  }
}
