export type InstallSourceKind = 'github' | 'gitlab' | 'git' | 'local';

export interface ParsedInstallSource {
  kind: InstallSourceKind;
  rawRef: string;
  org?: string;
  repo?: string;
  gitRemoteUrl?: string;
  gitPlusBase?: string;
  pathInRepo: string;
  localRoot?: string;
  localSourceForYaml?: string;
}
