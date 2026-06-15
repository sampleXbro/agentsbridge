/**
 * Descriptor-driven importer spec for Goose.
 *
 * Extracted from `index.ts` to keep that file under the 200-line cap. The shared
 * runner (`runDescriptorImport`) walks these specs per scope:
 *   - rules  → `.goosehints` (project) / global `.goosehints`
 *   - mcp    → global `config.yaml` extensions (custom YAML mapper, global-only)
 *   - ignore → `.gooseignore` (project) / global `.gooseignore`
 */

import type { TargetImporterDescriptor } from '../catalog/import-descriptor.js';
import { gooseMcpMap } from './mcp-import.js';
import {
  GOOSE_ROOT_FILE,
  GOOSE_IGNORE,
  GOOSE_GLOBAL_ROOT_FILE,
  GOOSE_GLOBAL_IGNORE,
  GOOSE_GLOBAL_CONFIG,
  GOOSE_CANONICAL_RULES_DIR,
  GOOSE_CANONICAL_IGNORE,
} from './constants.js';

export const gooseImporter: TargetImporterDescriptor = {
  rules: {
    feature: 'rules',
    mode: 'singleFile',
    source: {
      project: [GOOSE_ROOT_FILE],
      global: [GOOSE_GLOBAL_ROOT_FILE],
    },
    canonicalDir: GOOSE_CANONICAL_RULES_DIR,
    canonicalRootFilename: '_root.md',
    markAsRoot: true,
  },
  mcp: {
    feature: 'mcp',
    mode: 'singleFile',
    // Goose MCP lives only in the global `config.yaml`; with no project source
    // the runner skips this feature entirely under project scope.
    source: { global: [GOOSE_GLOBAL_CONFIG] },
    canonicalDir: '.agentsmesh',
    canonicalRootFilename: 'mcp.json',
    map: gooseMcpMap,
  },
  ignore: {
    feature: 'ignore',
    mode: 'flatFile',
    source: {
      project: [GOOSE_IGNORE],
      global: [GOOSE_GLOBAL_IGNORE],
    },
    canonicalDir: '.agentsmesh',
    canonicalFilename: GOOSE_CANONICAL_IGNORE,
  },
};
