import type { CanonicalFiles, ImportResult, LintDiagnostic } from '../../core/types.js';
import type { TargetCapabilities } from './target.interface.js';
import {
  BUILTIN_TARGETS,
  TARGET_IDS,
  isBuiltinTargetId,
  type BuiltinTargetId,
} from './builtin-targets.js';

type RuleLinter = (
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
) => LintDiagnostic[];

interface TargetCatalogEntry {
  importFrom: (root: string) => Promise<ImportResult[]>;
  emptyImportMessage: string;
  lintRules: RuleLinter | null;
  capabilities: TargetCapabilities;
}

export { TARGET_IDS, isBuiltinTargetId, type BuiltinTargetId };

export const TARGET_CATALOG: Record<BuiltinTargetId, TargetCatalogEntry> = Object.fromEntries(
  BUILTIN_TARGETS.map((target) => [
    target.id,
    {
      importFrom: target.generators.importFrom,
      emptyImportMessage: target.emptyImportMessage,
      lintRules: target.lintRules,
      capabilities: target.capabilities,
    },
  ]),
) as Record<BuiltinTargetId, TargetCatalogEntry>;

export function getTargetCatalogEntry(id: BuiltinTargetId): TargetCatalogEntry {
  const entry = TARGET_CATALOG[id];
  if (!entry) {
    throw new Error(`Unknown target: ${id}`);
  }
  return entry;
}
