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

import type { CanonicalFiles, CanonicalRule, LintDiagnostic } from '../../core/types.js';
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

/** Import-path builder: populates refs with (target path -> canonical path) mappings. */
export type ImportPathBuilder = (refs: Map<string, string>, projectRoot: string) => Promise<void>;

/** Rule linter function signature. */
export type RuleLinter = (
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
) => LintDiagnostic[];

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
  /** Message shown when import finds nothing for this target */
  readonly emptyImportMessage: string;
  /** Optional linter for canonical files */
  readonly lintRules: RuleLinter | null;
  /** Target-native skills directory, e.g. '.claude/skills' */
  readonly skillDir?: string;
  /** Path resolvers for the output reference map */
  readonly paths: TargetPathResolvers;
  /** Import reference map builder */
  readonly buildImportPaths: ImportPathBuilder;
  /** Filesystem paths used to detect this target during `init` */
  readonly detectionPaths: readonly string[];
}
