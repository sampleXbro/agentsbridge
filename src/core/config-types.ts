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

/** Validated configuration from agentsmesh.yaml */
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
    commands_to_skills?: Record<string, boolean>;
    agents_to_skills?: Record<string, boolean>;
  };
}
