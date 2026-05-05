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
  imported: Array<{ from: string; to: string }>;
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
  summary: { created: number; updated: number; deleted: number };
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

export interface InstallData {
  source: string;
  mode: 'install' | 'sync';
  installed: Array<{ kind: string; name: string; path: string }>;
  skipped: Array<{ kind: string; name: string; reason: string }>;
  dryRun: boolean;
}

export interface PluginAddData {
  subcommand: 'add';
  id: string;
  package: string;
  version: string;
}

export interface PluginListData {
  subcommand: 'list';
  plugins: Array<{ id: string; package: string; version?: string }>;
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
}
