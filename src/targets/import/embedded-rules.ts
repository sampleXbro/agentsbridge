import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { mkdirp, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { extractEmbeddedRules } from '../projection/managed-blocks.js';
import { serializeImportedRuleWithFallback } from './import-metadata.js';

export interface SplitEmbeddedRulesInput {
  content: string;
  projectRoot: string;
  rulesDir: string;
  sourcePath: string;
  fromTool: string;
  normalize: (content: string, sourceFile: string, destinationFile: string) => string;
}

export interface SplitEmbeddedRulesResult {
  rootContent: string;
  results: ImportResult[];
}

function canonicalRulePath(source: string): string | null {
  const normalized = source.replace(/\\/g, '/');
  if (!normalized.startsWith('rules/') || normalized.endsWith('/')) return null;
  if (!normalized.endsWith('.md')) return null;
  return normalized;
}

export async function splitEmbeddedRulesToCanonical(
  input: SplitEmbeddedRulesInput,
): Promise<SplitEmbeddedRulesResult> {
  const extracted = extractEmbeddedRules(input.content);
  const results: ImportResult[] = [];
  if (extracted.rules.length === 0) {
    return { rootContent: extracted.rootContent, results };
  }

  await mkdirp(join(input.projectRoot, input.rulesDir));
  for (const rule of extracted.rules) {
    const canonicalSource = canonicalRulePath(rule.source);
    if (canonicalSource === null || canonicalSource === 'rules/_root.md') continue;
    const destPath = join(input.projectRoot, '.agentsmesh', canonicalSource);
    const normalized = input.normalize(rule.body, input.sourcePath, destPath);
    const { frontmatter, body } = parseFrontmatter(normalized);
    const content = await serializeImportedRuleWithFallback(
      destPath,
      {
        ...frontmatter,
        root: false,
        description: rule.description || undefined,
        globs: rule.globs.length > 0 ? rule.globs : undefined,
        targets: rule.targets.length > 0 ? rule.targets : undefined,
      },
      body,
    );
    await writeFileAtomic(destPath, content);
    results.push({
      fromTool: input.fromTool,
      fromPath: input.sourcePath,
      toPath: `.agentsmesh/${canonicalSource}`,
      feature: 'rules',
    });
  }
  return { rootContent: extracted.rootContent, results };
}
