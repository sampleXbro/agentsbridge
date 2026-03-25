/** Lock file structure */
export interface LockFile {
  generatedAt: string;
  generatedBy: string;
  libVersion: string;
  checksums: Record<string, string>;
  extends: Record<string, string>;
  packs: Record<string, string>;
}

export interface ExtendSource {
  name: string;
  source: string;
  version?: string;
  target?: string;
  features: string[];
}

/** Validated configuration from agentsbridge.yaml */
export interface Config {
  version: number;
  targets: string[];
  features: string[];
  extends: ExtendSource[];
  overrides: Record<string, Record<string, unknown>>;
  collaboration: {
    strategy: 'merge' | 'lock' | 'last-wins';
    lock_features: string[];
  };
  conversions?: {
    commands_to_skills?: {
      'codex-cli'?: boolean;
    };
    agents_to_skills?: {
      'gemini-cli'?: boolean;
      cline?: boolean;
      'codex-cli'?: boolean;
      windsurf?: boolean;
    };
  };
}
