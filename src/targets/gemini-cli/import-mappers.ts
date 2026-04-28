/**
 * Gemini CLI-specific entry mappers for the descriptor-driven import runner.
 * Sibling-file pattern avoids the `index.ts ↔ importer.ts` TDZ trap.
 *
 * Re-exports the existing `mapGeminiRuleFile` / `mapGeminiCommandFile` helpers
 * adapted to the descriptor `ImportEntryMapper` shape.
 */

import type { ImportEntryMapper } from '../catalog/import-descriptor.js';
import { mapGeminiCommandFile, mapGeminiRuleFile } from './importer-mappers.js';

export const geminiRuleMapper: ImportEntryMapper = ({ relativePath, destDir, normalizeTo }) =>
  mapGeminiRuleFile(relativePath, destDir, normalizeTo);

export const geminiCommandMapper: ImportEntryMapper = ({ relativePath, destDir, normalizeTo }) =>
  mapGeminiCommandFile(relativePath, destDir, normalizeTo);
