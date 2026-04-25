/**
 * Public API — canonical loading (package.json "exports"."./canonical").
 */

import type { CanonicalFiles } from '../core/types.js';
import { loadCanonicalFiles } from '../canonical/load/loader.js';

export { loadCanonicalFiles };

export type {
  CanonicalFiles,
  CanonicalRule,
  CanonicalCommand,
  CanonicalAgent,
  CanonicalSkill,
  SkillSupportingFile,
  Permissions,
  IgnorePatterns,
} from '../core/canonical-types.js';

export type { McpServer, StdioMcpServer, UrlMcpServer, McpConfig } from '../core/mcp-types.js';

export type { Hooks, HookEntry } from '../core/hook-types.js';

/** Load `.agentsmesh/` from a project root (or an explicit canonical directory). */
export async function loadCanonical(projectRoot: string): Promise<CanonicalFiles> {
  return loadCanonicalFiles(projectRoot);
}
