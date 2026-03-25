/**
 * Write agentsbridge.yaml after merging extends (full-document stringify).
 */

import { parse as parseYaml, stringify } from 'yaml';
import type { ValidatedConfig } from '../config/schema.js';
import { readFileSafe, writeFileAtomic } from '../utils/fs.js';
import { mergeExtendList, type NewExtendEntry } from './merge-extend-entry.js';

/**
 * Merge extends into config on disk and write YAML.
 */
export async function writeAgentsbridgeWithNewExtend(
  configPath: string,
  currentConfig: ValidatedConfig,
  entry: NewExtendEntry,
): Promise<void> {
  const content = await readFileSafe(configPath);
  if (content === null) throw new Error(`Missing config: ${configPath}`);

  const raw = parseYaml(content) as Record<string, unknown>;
  const mergedExtends = mergeExtendList(currentConfig.extends, entry);
  raw.extends = mergedExtends as unknown;

  const out = stringify(raw, { indent: 2, lineWidth: 0 });
  await writeFileAtomic(configPath, out.endsWith('\n') ? out : `${out}\n`);
}
