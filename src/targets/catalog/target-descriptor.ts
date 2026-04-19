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
import type { TargetCapabilities, TargetGenerators } from './target.interface.js';

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
  /** Output path for a command. Null suppresses generation.
   *  Config is typed as `unknown` to avoid a circular dependency with schema.ts.
   *  Implementations receive ValidatedConfig at runtime. */
  commandPath(name: string, config: unknown): string | null;
  /** Output path for an agent. Null suppresses generation.
   *  Config is typed as `unknown` to avoid a circular dependency with schema.ts.
   *  Implementations receive ValidatedConfig at runtime. */
  agentPath(name: string, config: unknown): string | null;
}

export interface TargetManagedOutputs {
  dirs: readonly string[];
  files: readonly string[];
}

export interface TargetLayout {
  /** Primary root instruction artifact for this scope, if any. */
  readonly rootInstructionPath?: string;
  /**
   * Extra generated paths that should receive the same AgentsMesh root appendix as
   * `rootInstructionPath` (for example Cursor `AGENTS.md` / `.cursor/AGENTS.md`, Gemini `AGENTS.md`).
   */
  readonly additionalRootDecorationPaths?: readonly string[];
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
  readonly mirrorGlobalPath?: (path: string, activeTargets: readonly string[]) => string | null;
  /** Path resolvers for this scope. */
  readonly paths: TargetPathResolvers;
}

export type TargetLayoutScope = 'project' | 'global';

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
  /** Optional global-scope feature support levels when they differ from project mode */
  readonly globalCapabilities?: TargetCapabilities;
  /** Message shown when import finds nothing for this target */
  readonly emptyImportMessage: string;
  /** Optional linter for canonical files */
  readonly lintRules: RuleLinter | null;
  /** Optional per-feature lint hooks */
  readonly lint?: TargetLintHooks;
  /** Project-scope target layout metadata */
  readonly project: TargetLayout;
  /** Optional future global-scope target layout metadata */
  readonly global?: TargetLayout;
  /**
   * Declares which embedded-capability features support user-configured conversion.
   * When the corresponding conversion is disabled in config, the feature generator is skipped.
   */
  readonly supportsConversion?: { readonly commands?: true; readonly agents?: true };
  /**
   * Optional hook for generating scope-specific extras beyond the standard feature loop.
   * Called once per target after all standard features are processed.
   */
  readonly generateScopeExtras?: (
    canonical: CanonicalFiles,
    projectRoot: string,
    scope: TargetLayoutScope,
    enabledFeatures: ReadonlySet<string>,
  ) => Promise<GenerateResult[]>;
  /** @deprecated Use project.skillDir */
  readonly skillDir?: string;
  /** @deprecated Use project.paths */
  readonly paths?: TargetPathResolvers;
  /** Import reference map builder */
  readonly buildImportPaths: ImportPathBuilder;
  /** Filesystem paths used to detect this target during `init` */
  readonly detectionPaths: readonly string[];
  /** Optional filesystem paths used to detect this target in global scope during `init --global` */
  readonly globalDetectionPaths?: readonly string[];
  /**
   * Declares which shared artifact paths this target owns or consumes.
   * Used by the reference rewriter to select the correct artifact map for shared outputs.
   * Example: codex-cli owns '.agents/skills/', copilot consumes it in global mode.
   */
  readonly sharedArtifacts?: { readonly [pathPrefix: string]: 'owner' | 'consumer' };
}
