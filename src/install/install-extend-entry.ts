/**
 * Build NewExtendEntry for agentsbridge install and write it to agentsbridge.yaml.
 */

import { join } from 'node:path';
import type { ExtendPick, ValidatedConfig } from '../config/schema.js';
import { targetSchema } from '../config/schema.js';
import type { NewExtendEntry } from './merge-extend-entry.js';
import { assertExtendNameAvailable } from './merge-extend-entry.js';
import { writeAgentsbridgeWithNewExtend } from './yaml-writer.js';
import { logger } from '../utils/logger.js';

export interface WriteExtendArgs {
  configDir: string;
  config: ValidatedConfig;
  entryArgs: Parameters<typeof toNewExtendEntry>[0];
  dryRun: boolean;
}

/**
 * Write a new extends entry to agentsbridge.yaml, or log dry-run info.
 */
export async function writeInstallAsExtend(args: WriteExtendArgs): Promise<void> {
  const { configDir, config, entryArgs, dryRun } = args;
  const entry = toNewExtendEntry(entryArgs);
  assertExtendNameAvailable(config.extends, entry);
  if (dryRun) {
    logger.info(`[dry-run] Would add extend:\n${JSON.stringify(entry, null, 2)}`);
    return;
  }
  const configPath = join(configDir, 'agentsbridge.yaml');
  await writeAgentsbridgeWithNewExtend(configPath, config, entry);
  logger.success(`Wrote extends entry "${entry.name}" to agentsbridge.yaml.`);
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
