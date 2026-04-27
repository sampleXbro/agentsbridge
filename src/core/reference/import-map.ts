import { getDescriptor } from '../../targets/catalog/registry.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

export async function buildImportReferenceMap(
  target: string,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<Map<string, string>> {
  const refs = new Map<string, string>();
  const def = getDescriptor(target);
  if (def) {
    await def.buildImportPaths(refs, projectRoot, scope);
  }
  return refs;
}
