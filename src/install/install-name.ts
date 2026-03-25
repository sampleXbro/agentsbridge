/**
 * Derive the persisted name for an install entry.
 */

import type { ValidatedConfig } from '../config/schema.js';
import { suggestExtendName } from './name-generator.js';

export function selectInstallEntryName(args: {
  config: ValidatedConfig;
  parsed: Parameters<typeof suggestExtendName>[0];
  entryFeatures: ValidatedConfig['features'];
  nameOverride: string;
}): string {
  const { config, parsed, entryFeatures, nameOverride } = args;
  const used = new Set(config.extends.map((entry) => entry.name));
  return (
    nameOverride ||
    suggestExtendName(
      parsed,
      { featureHint: entryFeatures.length === 1 ? entryFeatures[0] : undefined },
      used,
    )
  );
}
