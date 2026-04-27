/**
 * Public API — built-in target catalog and plugin registration (package.json "exports"."./targets").
 */

import { BUILTIN_TARGETS } from '../targets/catalog/builtin-targets.js';
import type {
  GlobalTargetSupport,
  TargetDescriptor,
  TargetLayout,
  TargetManagedOutputs,
  TargetOutputFamily,
} from '../targets/catalog/target-descriptor.js';
import type { TargetCapabilities, TargetGenerators } from '../targets/catalog/target.interface.js';

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
  ExtraRuleOutputContext,
  ExtraRuleOutputResolver,
  GeneratedOutputMerger,
} from '../targets/catalog/target-descriptor.js';

export type { TargetCapabilities, TargetGenerators } from '../targets/catalog/target.interface.js';

function copyCapabilities(capabilities: TargetCapabilities): TargetCapabilities {
  return Object.freeze({ ...capabilities }) as TargetCapabilities;
}

function copyGenerators(generators: TargetGenerators): TargetGenerators {
  return Object.freeze({ ...generators }) as TargetGenerators;
}

function copyOutputFamily(family: TargetOutputFamily): TargetOutputFamily {
  return Object.freeze({
    ...family,
    explicitPaths:
      family.explicitPaths === undefined ? undefined : Object.freeze([...family.explicitPaths]),
  }) as TargetOutputFamily;
}

function copyManagedOutputs(outputs: TargetManagedOutputs): TargetManagedOutputs {
  return Object.freeze({
    dirs: Object.freeze([...outputs.dirs]),
    files: Object.freeze([...outputs.files]),
  });
}

function copyLayout(layout: TargetLayout): TargetLayout {
  return Object.freeze({
    ...layout,
    outputFamilies:
      layout.outputFamilies === undefined
        ? undefined
        : Object.freeze(layout.outputFamilies.map(copyOutputFamily)),
    managedOutputs:
      layout.managedOutputs === undefined ? undefined : copyManagedOutputs(layout.managedOutputs),
    paths: Object.freeze({ ...layout.paths }),
  }) as TargetLayout;
}

function copyGlobalSupport(globalSupport: GlobalTargetSupport): GlobalTargetSupport {
  return Object.freeze({
    ...globalSupport,
    capabilities: copyCapabilities(globalSupport.capabilities),
    detectionPaths: Object.freeze([...globalSupport.detectionPaths]),
    layout: copyLayout(globalSupport.layout),
  });
}

function copyTargetDescriptor(descriptor: TargetDescriptor): TargetDescriptor {
  return Object.freeze({
    ...descriptor,
    generators: copyGenerators(descriptor.generators),
    capabilities: copyCapabilities(descriptor.capabilities),
    globalSupport:
      descriptor.globalSupport === undefined
        ? undefined
        : copyGlobalSupport(descriptor.globalSupport),
    lint: descriptor.lint === undefined ? undefined : Object.freeze({ ...descriptor.lint }),
    project: copyLayout(descriptor.project),
    supportsConversion:
      descriptor.supportsConversion === undefined
        ? undefined
        : Object.freeze({ ...descriptor.supportsConversion }),
    detectionPaths: Object.freeze([...descriptor.detectionPaths]),
    sharedArtifacts:
      descriptor.sharedArtifacts === undefined
        ? undefined
        : Object.freeze({ ...descriptor.sharedArtifacts }),
  }) as TargetDescriptor;
}

export function getTargetCatalog(): readonly TargetDescriptor[] {
  return Object.freeze(BUILTIN_TARGETS.map(copyTargetDescriptor));
}
