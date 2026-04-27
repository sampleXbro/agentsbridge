/**
 * Self-describing target descriptor interface.
 *
 * A new target exports one TargetDescriptor from its index.ts.
 * The catalog imports it and adds it to BUILTIN_TARGETS — that
 * is the only central registration step.
 *
 * Designed for future plugin support: plugins will export a
 * TargetDescriptor that gets registered at runtime.
 */

import type {
  CanonicalFiles,
  CanonicalRule,
  GenerateResult,
  LintDiagnostic,
} from '../../core/types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import type { TargetCapabilities, TargetGenerators } from './target.interface.js';

/** Declared output families for reference rewriting and decoration (architecture P1-3). */
export interface TargetOutputFamily {
  readonly id: string;
  readonly kind: 'primary' | 'mirror' | 'additional';
  /** Match generated paths under this prefix (e.g. Copilot `.github/instructions/`). */
  readonly pathPrefix?: string;
  /** Explicit paths for additional root mirrors (Cursor, Gemini compat). */
  readonly explicitPaths?: readonly string[];
}

export interface ExtraRuleOutputContext {
  readonly refs: ReadonlyMap<string, string>;
  readonly scope: TargetLayoutScope;
}

export type ExtraRuleOutputResolver = (
  rule: CanonicalFiles['rules'][number],
  context: ExtraRuleOutputContext,
) => readonly string[];

/**
 * Path resolvers for the output reference map.
 * Each method returns a relative output path, or null to skip.
 *
 * Shared pre-checks (root rule handling, target filtering) remain
 * centralized in map-targets.ts — descriptors only handle the
 * target-specific path logic after those guards pass.
 */
export interface TargetPathResolvers {
  /** Output path for a non-root, non-filtered rule. */
  rulePath(slug: string, rule: CanonicalRule): string;
  /** Output path for a command. Null suppresses generation. */
  commandPath(name: string, config: ValidatedConfig): string | null;
  /** Output path for an agent. Null suppresses generation. */
  agentPath(name: string, config: ValidatedConfig): string | null;
}

export interface TargetManagedOutputs {
  dirs: readonly string[];
  files: readonly string[];
}

export interface TargetLayout {
  /** Primary root instruction artifact for this scope, if any. */
  readonly rootInstructionPath?: string;
  /** Output families for rewrite cache keys and root decoration (see `layout-outputs.ts`). */
  readonly outputFamilies?: readonly TargetOutputFamily[];
  /** Additional generated rule paths that share source ownership for reference rewriting. */
  readonly extraRuleOutputPaths?: ExtraRuleOutputResolver;
  /** Optional renderer for scope-specific primary root instruction content. */
  readonly renderPrimaryRootInstruction?: (canonical: CanonicalFiles) => string;
  /** Target-native skills directory for this scope, if any. */
  readonly skillDir?: string;
  /** Files/directories agentsmesh fully manages for stale cleanup. */
  readonly managedOutputs?: TargetManagedOutputs;
  /** Optional path rewriter for scope-specific generated outputs. Return null to skip emission. */
  readonly rewriteGeneratedPath?: (path: string) => string | null;
  /**
   * Optional mirror hook. Called after rewriteGeneratedPath resolves the primary path.
   * Returns an additional path to emit the same content to, or null to skip mirroring.
   */
  readonly mirrorGlobalPath?: (
    path: string,
    activeTargets: readonly string[],
  ) => string | readonly string[] | null;
  /** Path resolvers for this scope. */
  readonly paths: TargetPathResolvers;
}

export type TargetLayoutScope = 'project' | 'global';

/** Scope extras hook (e.g. Claude Code global output-styles). */
export type ScopeExtrasFn = (
  canonical: CanonicalFiles,
  projectRoot: string,
  scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
) => Promise<GenerateResult[]>;

/** Single block for global-mode support (replaces scattered global* fields). */
export interface GlobalTargetSupport {
  readonly capabilities: TargetCapabilities;
  readonly detectionPaths: readonly string[];
  readonly layout: TargetLayout;
  readonly scopeExtras?: ScopeExtrasFn;
}

/** Import-path builder: populates refs with (target path -> canonical path) mappings. */
export type ImportPathBuilder = (
  refs: Map<string, string>,
  projectRoot: string,
  scope?: TargetLayoutScope,
) => Promise<void>;

/** Rule linter function signature. */
export type RuleLinter = (
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
  options?: { scope?: TargetLayoutScope },
) => LintDiagnostic[];

/** Feature-specific lint hook signature. */
export type FeatureLinter = (canonical: CanonicalFiles, options?: unknown) => LintDiagnostic[];

export type GeneratedOutputMerger = (
  existing: string | null,
  pending: GenerateResult | undefined,
  newContent: string,
  resolvedPath: string,
) => string | null;

/** Optional per-feature lint hooks for target-specific validation. */
export interface TargetLintHooks {
  readonly commands?: FeatureLinter;
  readonly mcp?: FeatureLinter;
  readonly permissions?: FeatureLinter;
  readonly hooks?: FeatureLinter;
  readonly ignore?: FeatureLinter;
  readonly settings?: FeatureLinter;
}

/**
 * Full self-describing target descriptor.
 * Bundles everything needed to generate, import, lint, and detect a target.
 */
export interface TargetDescriptor {
  /** Unique target identifier, e.g. 'claude-code' */
  readonly id: string;
  /** Feature generators (rules, commands, agents, etc.) */
  readonly generators: TargetGenerators;
  /** Feature support levels */
  readonly capabilities: TargetCapabilities;
  /** Consolidated global-mode metadata. */
  readonly globalSupport?: GlobalTargetSupport;
  /** Message shown when import finds nothing for this target */
  readonly emptyImportMessage: string;
  /** Optional linter for canonical files */
  readonly lintRules: RuleLinter | null;
  /** Optional per-feature lint hooks */
  readonly lint?: TargetLintHooks;
  /** Project-scope target layout metadata */
  readonly project: TargetLayout;
  /**
   * Declares which embedded-capability features support user-configured conversion.
   * When the corresponding conversion is disabled in config, the feature generator is skipped.
   */
  readonly supportsConversion?: { readonly commands?: true; readonly agents?: true };
  /** Import reference map builder */
  readonly buildImportPaths: ImportPathBuilder;
  /** Filesystem paths used to detect this target during `init` */
  readonly detectionPaths: readonly string[];
  /**
   * Declares which shared artifact paths this target owns or consumes.
   * Used by the reference rewriter to select the correct artifact map for shared outputs.
   * Example: codex-cli owns '.agents/skills/', copilot consumes it in global mode.
   */
  readonly sharedArtifacts?: { readonly [pathPrefix: string]: 'owner' | 'consumer' };
  /**
   * Optional native settings sidecar (e.g. Gemini `.gemini/settings.json` when embedded features are on).
   */
  readonly emitScopedSettings?: (
    canonical: CanonicalFiles,
    scope: TargetLayoutScope,
  ) => readonly { readonly path: string; readonly content: string }[];
  /** Optional target-specific merge strategy for generated outputs. */
  readonly mergeGeneratedOutputContent?: GeneratedOutputMerger;
  /**
   * Async post-pass for hook generator outputs (e.g. Copilot hook script assets under `.github/hooks/`).
   */
  readonly postProcessHookOutputs?: (
    projectRoot: string,
    canonical: CanonicalFiles,
    outputs: readonly { readonly path: string; readonly content: string }[],
  ) => Promise<readonly { readonly path: string; readonly content: string }[]>;
}
