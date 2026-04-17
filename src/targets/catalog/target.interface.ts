import type {
  CanonicalFiles,
  GenerateResult,
  ImportResult,
  LintDiagnostic,
} from '../../core/types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import type { TargetLayoutScope } from './target-descriptor.js';

/** Feature support level for a given target */
export type SupportLevel = 'native' | 'embedded' | 'partial' | 'none';

/** Capabilities of a target tool */
export interface TargetCapabilities {
  rules: SupportLevel;
  commands: SupportLevel;
  agents: SupportLevel;
  skills: SupportLevel;
  mcp: SupportLevel;
  hooks: SupportLevel;
  ignore: SupportLevel;
  permissions: SupportLevel;
}

/** Context passed to generate() */
export interface GenerateContext {
  config: ValidatedConfig;
  canonical: CanonicalFiles;
  projectRoot: string;
  targetFilter?: string[];
}

/**
 * Interface that every target implementation satisfies.
 * Targets are implemented as standalone function modules rather than classes
 * (per project style: no classes unless stateful), but this interface documents
 * the expected shape for reference.
 */
export interface Target {
  /** Tool identifier, e.g. 'claude-code' */
  id: string;
  /** Human-readable tool name, e.g. 'Claude Code' */
  name: string;
  /** What this tool natively supports */
  capabilities: TargetCapabilities;
  /** Whether this tool supports project-scoped config */
  supportsProject: boolean;
  /** Whether this tool supports user-global config */
  supportsGlobal: boolean;

  /**
   * Generate tool-specific files from canonical sources.
   * @param ctx - Generate context (config, canonical files, project root)
   * @returns Array of file outputs with path and content
   */
  generate(ctx: GenerateContext): GenerateResult[];

  /**
   * Import tool-specific files into canonical .agentsmesh/ format.
   * @param projectRoot - Project root directory
   * @returns Array of import results describing what was imported
   */
  import(projectRoot: string): Promise<ImportResult[]>;

  /**
   * Validate canonical files against this target's constraints.
   * @param files - Canonical files to validate
   * @returns Array of lint diagnostics (errors and warnings)
   */
  lint(files: CanonicalFiles): LintDiagnostic[];
}

/**
 * Per-feature generator contract matching engine.ts dispatch tables.
 * Each generator takes CanonicalFiles and returns file outputs.
 * Only generateRules and importFrom are required; all others are optional
 * because not every target supports every feature.
 */
export interface TargetGenerators {
  name: string;
  primaryRootInstructionPath?: string;
  generateRules(c: CanonicalFiles): { path: string; content: string }[];
  generateCommands?(c: CanonicalFiles): { path: string; content: string }[];
  generateAgents?(c: CanonicalFiles): { path: string; content: string }[];
  generateSkills?(c: CanonicalFiles): { path: string; content: string }[];
  generateMcp?(c: CanonicalFiles): { path: string; content: string }[];
  generatePermissions?(c: CanonicalFiles): { path: string; content: string }[];
  generateHooks?(c: CanonicalFiles): { path: string; content: string }[];
  generateIgnore?(c: CanonicalFiles): { path: string; content: string }[];
  /** cline and windsurf use generateWorkflows instead of generateCommands */
  generateWorkflows?(c: CanonicalFiles): { path: string; content: string }[];
  /** gemini-cli uses generateSettings for .gemini/settings.json */
  generateSettings?(c: CanonicalFiles): { path: string; content: string }[];
  importFrom(projectRoot: string, options?: { scope?: TargetLayoutScope }): Promise<ImportResult[]>;
  lint?(files: CanonicalFiles): LintDiagnostic[];
}
