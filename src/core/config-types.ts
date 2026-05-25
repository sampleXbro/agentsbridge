/** Lock file structure */
export interface LockFile {
  generatedAt: string;
  generatedBy: string;
  libVersion: string;
  checksums: Record<string, string>;
  extends: Record<string, string>;
  packs: Record<string, string>;
}
