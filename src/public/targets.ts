/**
 * Public API — built-in target catalog and plugin registration (package.json "exports"."./targets").
 */

import { BUILTIN_TARGETS } from '../targets/catalog/builtin-targets.js';
import type { TargetDescriptor } from '../targets/catalog/target-descriptor.js';

export {
  registerTargetDescriptor,
  getDescriptor,
  getAllDescriptors,
} from '../targets/catalog/registry.js';

export type {
  TargetDescriptor,
  TargetLayout,
  TargetLayoutScope,
  TargetOutputFamily,
  TargetPathResolvers,
  TargetManagedOutputs,
  TargetLintHooks,
  FeatureLinter,
  RuleLinter,
  ScopeExtrasFn,
  ImportPathBuilder,
  GlobalTargetSupport,
} from '../targets/catalog/target-descriptor.js';

export type { TargetCapabilities, TargetGenerators } from '../targets/catalog/target.interface.js';

export function getTargetCatalog(): readonly TargetDescriptor[] {
  return BUILTIN_TARGETS;
}
