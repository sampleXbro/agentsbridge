/**
 * Codebuff (Freebuff) target descriptor.
 *
 * Generation emits:
 *   - `AGENTS.md` / `~/.AGENTS.md`  — root rule
 *   - `<dir>/AGENTS.md`             — nested knowledge files (project scope only)
 *   - `.agents/skills/`             — skills, plus commands projected as skills
 *   - `.agents/mcp.json`            — MCP servers
 *   - `.codebuffignore`             — ignore patterns (project scope only)
 *
 * Import reads the same set back.
 *
 * `AGENTS.md` and `.agents/skills/` are shared with other targets; codex-cli
 * owns the skills prefix and this target is a CONSUMER. Every shared artifact
 * is produced by the shared serializer verbatim so the bytes match.
 *
 * See `constants.ts` for the source citations, the inverted global/project
 * precedence, and the `cwd/../.agents` middle scope agentsmesh cannot express.
 */

import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  generatePermissions,
} from './generator.js';
import { importFromCodebuff } from './importer.js';
import { mergeCodebuffMcpJson } from './merge.js';
import { projectCapabilities, globalCapabilities } from './capabilities.js';
import { projectLayout, globalLayout } from './layout.js';
import { lintRules } from './linter.js';
import { lintAgents, lintHooks, lintIgnore, lintMcp, lintPermissions } from './lint.js';
import { buildCodebuffImportPaths } from '../../core/reference/import-map-builders.js';
import {
  CODEBUFF_TARGET,
  CODEBUFF_ROOT_FILE,
  CODEBUFF_MCP_FILE,
  CODEBUFF_IGNORE_FILE,
  CODEBUFF_GLOBAL_ROOT_FILE,
} from './constants.js';

export const target: TargetGenerators = {
  name: CODEBUFF_TARGET,
  primaryRootInstructionPath: CODEBUFF_ROOT_FILE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  generatePermissions,
  importFrom: importFromCodebuff,
  lint: lintAgents,
};

export const descriptor = {
  id: CODEBUFF_TARGET,
  metadata: {
    displayName: 'Codebuff',
    category: 'cli',
    officialUrl: 'https://github.com/CodebuffAI/freebuff',
    shortDescription: 'Terminal multi-agent coding CLI',
  },
  generators: target,
  mergeGeneratedOutputContent: mergeCodebuffMcpJson,
  capabilities: projectCapabilities,
  emptyImportMessage:
    'No Codebuff config found (AGENTS.md, .agents/skills, .agents/mcp.json, or .codebuffignore).',
  lintRules,
  lint: {
    mcp: lintMcp,
    permissions: lintPermissions,
    hooks: lintHooks,
    ignore: lintIgnore,
  },
  supportsConversion: { commands: true },
  conversionDefaults: { commandsToSkills: true },
  project: projectLayout,
  globalSupport: {
    capabilities: globalCapabilities,
    // `.agents/skills` is deliberately absent: it is shared with codex-cli and
    // friends, so detecting on it would claim Codebuff in any repo using it.
    detectionPaths: [CODEBUFF_GLOBAL_ROOT_FILE],
    layout: globalLayout,
  },
  importer: {
    ignore: {
      feature: 'ignore',
      mode: 'flatFile',
      source: { project: [CODEBUFF_IGNORE_FILE] },
      canonicalDir: '.agentsmesh',
      canonicalFilename: 'ignore',
    },
    mcp: {
      feature: 'mcp',
      mode: 'mcpJson',
      source: { project: [CODEBUFF_MCP_FILE], global: [CODEBUFF_MCP_FILE] },
      canonicalDir: '.agentsmesh',
      canonicalFilename: 'mcp.json',
      mcpServersKey: 'mcpServers',
    },
  },
  sharedArtifacts: {
    '.agents/skills/': 'consumer',
  },
  buildImportPaths: buildCodebuffImportPaths,
  // `AGENTS.md` is shared, but `.codebuffignore` is unique to this tool, so it
  // leads: a repo with only `AGENTS.md` belongs to whichever target claims it.
  detectionPaths: [CODEBUFF_IGNORE_FILE, CODEBUFF_ROOT_FILE],
} satisfies TargetDescriptor;
