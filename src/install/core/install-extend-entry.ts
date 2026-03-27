/**
 * Build NewExtendEntry for agentsmesh install and write it to agentsmesh.yaml.
 */

import { join } from 'node:path';
import type { ExtendPick, ValidatedConfig } from '../../config/core/schema.js';
import { targetSchema } from '../../config/core/schema.js';
import type { NewExtendEntry } from './merge-extend-entry.js';
import { assertExtendNameAvailable } from './merge-extend-entry.js';
import { writeAgentsmeshWithNewExtend } from './yaml-writer.js';
import { logger } from '../../utils/output/logger.js';

export interface WriteExtendArgs {
  configDir: string;
  config: ValidatedConfig;
  entryArgs: Parameters<typeof toNewExtendEntry>[0];
  dryRun: boolean;
}

/**
 * Write a new extends entry to agentsmesh.yaml, or log dry-run info.
 */
export async function writeInstallAsExtend(args: WriteExtendArgs): Promise<void> {
  const { configDir, config, entryArgs, dryRun } = args;
  const entry = toNewExtendEntry(entryArgs);
  assertExtendNameAvailable(config.extends, entry);
  if (dryRun) {
    logger.info(`[dry-run] Would add extend:\n${JSON.stringify(entry, null, 2)}`);
    return;
  }
  const configPath = join(configDir, 'agentsmesh.yaml');
  await writeAgentsmeshWithNewExtend(configPath, config, entry);
  logger.success(`Wrote extends entry "${entry.name}" to agentsmesh.yaml.`);
}

export function toNewExtendEntry(args: {
  name: string;
  source: string;
  version?: string;
  features: ValidatedConfig['features'];
  path?: string;
  pick?: ExtendPick;
  yamlTarget?: string;
}): NewExtendEntry {
  return {
    name: args.name,
    source: args.source,
    version: args.version,
    features: args.features,
    path: args.path,
    pick: args.pick,
    target: args.yamlTarget !== undefined ? targetSchema.parse(args.yamlTarget) : undefined,
  };
}
