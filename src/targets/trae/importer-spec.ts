/**
 * Trae importer descriptor — declarative scan+map rules dispatched by the
 * shared `runDescriptorImport` orchestrator.
 *
 * Agents round-trip through `.trae/agents/<name>.md` (project) and
 * `.trae-cn/agents/<name>.md` (global CN edition). Commands, MCP, and ignore
 * follow the same pattern as the project scope.
 */

import type { TargetImporterDescriptor } from '../catalog/import-descriptor.js';
import {
  TRAE_AGENTS_DIR,
  TRAE_COMMANDS_DIR,
  TRAE_GLOBAL_AGENTS_DIR,
  TRAE_GLOBAL_COMMANDS_DIR,
  TRAE_MCP_FILE,
  TRAE_GLOBAL_MCP_FILE,
  TRAE_IGNORE,
  TRAE_CANONICAL_AGENTS_DIR,
  TRAE_CANONICAL_COMMANDS_DIR,
  TRAE_CANONICAL_MCP,
  TRAE_CANONICAL_IGNORE,
} from './constants.js';

export const traeImporterSpec: TargetImporterDescriptor = {
  agents: {
    feature: 'agents',
    mode: 'directory',
    source: {
      project: [TRAE_AGENTS_DIR],
      global: [TRAE_GLOBAL_AGENTS_DIR],
    },
    canonicalDir: TRAE_CANONICAL_AGENTS_DIR,
    extensions: ['.md'],
    preset: 'agent',
  },
  commands: {
    feature: 'commands',
    mode: 'directory',
    source: {
      project: [TRAE_COMMANDS_DIR],
      global: [TRAE_GLOBAL_COMMANDS_DIR],
    },
    canonicalDir: TRAE_CANONICAL_COMMANDS_DIR,
    extensions: ['.md'],
    preset: 'command',
  },
  mcp: {
    feature: 'mcp',
    mode: 'mcpJson',
    source: { project: [TRAE_MCP_FILE], global: [TRAE_GLOBAL_MCP_FILE] },
    canonicalDir: '.agentsmesh',
    canonicalFilename: TRAE_CANONICAL_MCP,
  },
  ignore: {
    feature: 'ignore',
    mode: 'flatFile',
    source: { project: [TRAE_IGNORE] },
    canonicalDir: '.agentsmesh',
    canonicalFilename: TRAE_CANONICAL_IGNORE,
  },
};
