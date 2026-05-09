import { addSimpleFileMapping, listFiles, rel } from '../import-map-shared.js';
import {
  AMAZON_Q_RULES_DIR,
  AMAZON_Q_GLOBAL_RULES_DIR,
} from '../../../targets/amazon-q/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_RULES } from './constants.js';

export async function buildAmazonQImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  const rulesDir = scope === 'global' ? AMAZON_Q_GLOBAL_RULES_DIR : AMAZON_Q_RULES_DIR;
  for (const absPath of await listFiles(projectRoot, rulesDir)) {
    const relPath = rel(projectRoot, absPath);
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
}
