import { getBuiltinTargetDefinition } from '../../targets/catalog/builtin-targets.js';

export async function buildImportReferenceMap(
  target: string,
  projectRoot: string,
): Promise<Map<string, string>> {
  const refs = new Map<string, string>();
  const def = getBuiltinTargetDefinition(target);
  if (def) {
    await def.buildImportPaths(refs, projectRoot);
  }
  return refs;
}
