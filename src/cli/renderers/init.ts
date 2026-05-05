/**
 * Human-readable renderer for init command output.
 */

import { logger } from '../../utils/output/logger.js';
import type { InitCommandResult } from '../commands/init.js';

export function renderInit(result: InitCommandResult): void {
  const { data } = result;

  // Log detected configs info
  if (data.detectedConfigs.length > 0) {
    logger.info(`Found existing configurations: ${data.detectedConfigs.join(', ')}`);
  }

  // Log existing config hint when --yes not passed but configs detected
  if (data.detectedConfigs.length > 0 && data.imported.length === 0) {
    logger.info(
      `Run 'agentsmesh init --yes' to auto-import, or 'agentsmesh import --from <tool>' manually.`,
    );
  }

  // Log each imported file
  if (data.imported.length > 0) {
    logger.info('Auto-importing existing configurations (--yes)...');
    for (const f of data.imported) {
      logger.success(`  ${f.from} → ${f.to}`);
    }
    logger.info(`Imported ${data.imported.length} file(s) from ${data.importedToolCount} tool(s).`);
  }

  // Config file creation
  logger.success(`Created ${data.configFile}`);

  // Local config creation
  logger.success(`Created ${data.localConfigFile}`);

  // Gitignore update
  if (data.gitignoreUpdated) {
    logger.success('Updated .gitignore');
  }
}
