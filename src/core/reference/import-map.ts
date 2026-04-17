import { getBuiltinTargetDefinition } from '../../targets/catalog/builtin-targets.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

export async function buildImportReferenceMap(
  target: string,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<Map<string, string>> {
  const refs = new Map<string, string>();
  const def = getBuiltinTargetDefinition(target);
  if (def) {
    await def.buildImportPaths(refs, projectRoot, scope);
  }
  return refs;
}
