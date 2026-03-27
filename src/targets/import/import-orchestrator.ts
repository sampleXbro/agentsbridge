import { dirname } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import {
  readDirRecursive,
  readFileSafe,
  writeFileAtomic,
  mkdirp,
} from '../../utils/filesystem/fs.js';

export interface ImportFileMapping {
  destPath: string;
  toPath: string;
  feature: string;
  content: string;
}

export interface ImportFileEntry {
  srcPath: string;
  content: string;
  normalizeTo: (destinationFile: string, sourceContent?: string) => string;
}

export interface ImportFileOptions {
  srcDir: string;
  destDir: string;
  extensions: string[];
  fromTool: string;
  normalize: (content: string, sourceFile: string, destinationFile: string) => string;
  mapEntry: (
    entry: ImportFileEntry,
  ) => Promise<ImportFileMapping | null> | ImportFileMapping | null;
}

function matchesExtension(path: string, extensions: string[]): boolean {
  return extensions.some((extension) => path.endsWith(extension));
}

export async function importFileDirectory(opts: ImportFileOptions): Promise<ImportResult[]> {
  const files = await readDirRecursive(opts.srcDir);
  const matchedFiles = files.filter((path) => matchesExtension(path, opts.extensions));
  const results: ImportResult[] = [];

  for (const srcPath of matchedFiles) {
    const content = await readFileSafe(srcPath);
    if (!content) continue;

    const mapping = await opts.mapEntry({
      srcPath,
      content,
      normalizeTo: (destinationFile, sourceContent = content) =>
        opts.normalize(sourceContent, srcPath, destinationFile),
    });
    if (!mapping) continue;

    await mkdirp(dirname(mapping.destPath));
    await writeFileAtomic(mapping.destPath, mapping.content);
    results.push({
      fromTool: opts.fromTool,
      fromPath: srcPath,
      toPath: mapping.toPath,
      feature: mapping.feature,
    });
  }

  return results;
}
