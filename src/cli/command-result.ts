export type CommandResult =
  | { success: true; data: unknown }
  | { success: false; error: string; data?: unknown };

export interface GenerateData {
  scope: 'project' | 'global';
  mode: 'generate' | 'check' | 'dry-run';
  files: Array<{ path: string; target: string; status: 'created' | 'updated' | 'unchanged' }>;
  summary: { created: number; updated: number; unchanged: number };
}

export interface InitData {
  scope: 'project' | 'global';
  configFile: string;
  localConfigFile: string;
  detectedConfigs: string[];
  imported: Array<{ from: string; to: string }>;
  importedToolCount: number;
  scaffoldType: 'full' | 'gap-fill' | 'none';
  gitignoreUpdated: boolean;
}

export interface ImportData {
  scope: 'project' | 'global';
  target: string;
  files: Array<{ from: string; to: string }>;
}

export interface DiffData {
  files: Array<{ path: string; target: string; status: 'created' | 'updated' | 'deleted' }>;
  patches: Array<{ path: string; patch: string }>;
  summary: { created: number; updated: number; unchanged: number; deleted: number };
}

export interface LintData {
  diagnostics: Array<{ level: 'error' | 'warning'; file: string; target: string; message: string }>;
  summary: { errors: number; warnings: number };
}

export interface CheckData {
  hasLock: boolean;
  inSync: boolean;
  modified: string[];
  added: string[];
  removed: string[];
  extendsModified: string[];
  lockedViolations: string[];
}

export interface MergeData {
  hadConflict: boolean;
  resolved: boolean;
}

export interface MatrixData {
  targets: string[];
  features: Array<{ name: string; support: Record<string, string> }>;
}

export interface InstallBrokenResource {
  /** Source file or skill-directory path that was skipped during install. */
  path: string;
  /** Why it was skipped: invalid YAML, unparseable SKILL.md, etc. */
  kind: 'frontmatter' | 'skill-dir' | 'unsupported-extension';
  /** Human-readable cause; typically the underlying YAML or filesystem error. */
  reason: string;
}

export interface InstallData {
  source: string;
  mode: 'install' | 'sync';
  installed: Array<{ kind: string; name: string; path: string }>;
  skipped: Array<{ kind: string; name: string; reason: string }>;
  dryRun: boolean;
  /**
   * Files the install pipeline skipped because their YAML frontmatter (or
   * SKILL.md) could not be parsed. Absent when nothing was skipped. The CLI
   * renderer surfaces a footer warning when this is present.
   */
  brokenResources?: InstallBrokenResource[];
}

export interface UninstallRemovedEntry {
  name: string;
  /**
   * Forward-slash relative path to the pack directory, or `null` for
   * extends-only installs (`install --extends`) that never materialized
   * a pack on disk.
   */
  pack_path: string | null;
  manifest_entry_removed: boolean;
  extends_entry_removed: boolean;
  generated_files_removed: number;
  modified_files_kept: Array<{ relativePath: string; status: string }>;
  legacy_migrated: boolean;
  /**
   * True when at least one expected removal step did not land (pack bytes
   * preserved via `[k]eep-modified` or `--keep-pack`, missing extends row,
   * etc.). Lets JSON consumers distinguish a fully-clean run from a
   * deliberately-or-silently partial one.
   */
  partial: boolean;
}

export interface UninstallData {
  scope: 'project' | 'global';
  mode: 'uninstall';
  removed: UninstallRemovedEntry[];
  skipped: Array<{ name: string; reason: string }>;
  /**
   * Packs whose `applyUninstall` threw mid-batch. Surviving packs continue;
   * post-operation `generate` still runs over the packs that did apply so the
   * tool tree is consistent with `installs.yaml` after the partial run.
   */
  failed: Array<{ name: string; reason: string }>;
  dryRun: boolean;
}

export interface InstallsListEntry {
  name: string;
  source: string;
  source_kind: string;
  /** Classifier verdict captured at install time, or `null` when unknown. */
  source_type: string | null;
  version: string | null;
  features: string[];
  target: string | null;
  /** ISO timestamp from the pack install-manifest, or `null` when missing. */
  installed_at: string | null;
  /** Forward-slash relative path from the canonical scope root. */
  pack_path: string;
}

export interface InstallsListData {
  scope: 'project' | 'global';
  subcommand: 'list';
  installs: InstallsListEntry[];
}

export type InstallsData = InstallsListData;

export interface PluginAddData {
  subcommand: 'add';
  id: string;
  package: string;
  version: string;
}

export interface PluginListData {
  subcommand: 'list';
  plugins: Array<{
    id: string;
    package: string;
    version?: string;
    status?: string;
    targets?: string;
  }>;
}

export interface PluginRemoveData {
  subcommand: 'remove';
  id: string;
  found: boolean;
}

export interface PluginInfoData {
  subcommand: 'info';
  id: string;
  package: string;
  version?: string;
  descriptors: Array<{ id: string; description: string }>;
}

export type PluginData = PluginAddData | PluginListData | PluginRemoveData | PluginInfoData;

export interface TargetData {
  id: string;
  written: string[];
  skipped: string[];
  postSteps: string[];
}

export interface ConvertData {
  from: string;
  to: string;
  mode: 'convert' | 'dry-run';
  files: Array<{ path: string; target: string; status: 'created' | 'updated' | 'unchanged' }>;
  summary: { created: number; updated: number; unchanged: number };
}
