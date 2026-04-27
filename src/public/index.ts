/**
 * Public API barrel — re-exports from engine, canonical, and targets.
 */

export {
  generate,
  resolveOutputCollisions,
  importFrom,
  loadConfig,
  loadConfigFromDirectory,
  loadProjectContext,
  lint,
  diff,
  check,
  computeDiff,
  formatDiffSummary,
} from './engine.js';

export type {
  GenerateContext,
  GenerateResult,
  ImportResult,
  LintDiagnostic,
  LintOptions,
  LintResult,
  LoadProjectContextOptions,
  ProjectContext,
  ValidatedConfig,
  TargetLayoutScope,
  CheckLockSyncOptions,
  LockSyncReport,
  ComputeDiffResult,
  DiffEntry,
  DiffSummary,
} from './engine.js';

export {
  AgentsMeshError,
  ConfigNotFoundError,
  ConfigValidationError,
  TargetNotFoundError,
  ImportError,
  GenerationError,
  RemoteFetchError,
  LockAcquisitionError,
  FileSystemError,
} from './engine.js';
export type { AgentsMeshErrorCode } from './engine.js';

export { loadCanonical, loadCanonicalFiles } from './canonical.js';

export type {
  CanonicalFiles,
  CanonicalRule,
  CanonicalCommand,
  CanonicalAgent,
  CanonicalSkill,
  SkillSupportingFile,
  Permissions,
  IgnorePatterns,
  McpServer,
  StdioMcpServer,
  UrlMcpServer,
  McpConfig,
  Hooks,
  HookEntry,
  LoadCanonicalOptions,
} from './canonical.js';

export {
  registerTargetDescriptor,
  getDescriptor,
  getAllDescriptors,
  getTargetCatalog,
} from './targets.js';

export type {
  TargetDescriptor,
  TargetLayout,
  // TargetLayoutScope re-exported via ./engine.js to avoid a duplicate-export
  // conflict at the barrel level. Subpath entrypoint `agentsmesh/targets`
  // still exposes it directly.
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
  TargetCapabilities,
  TargetGenerators,
} from './targets.js';
