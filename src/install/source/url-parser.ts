/**
 * Parse install sources: GitHub/GitLab tree URLs, git SSH/HTTPS, local paths.
 */

export {
  parseGithubBlobUrl,
  parseGithubRepoUrl,
  parseGithubTreeUrl,
  parseGitlabBlobUrl,
  parseGitlabRepoUrl,
  parseGitlabTreeUrl,
  parseGitSshGithub,
  parseGitSshGitlab,
} from './url-parser-remotes.js';

export type { InstallSourceKind, ParsedInstallSource } from './install-source-types.js';
export { parseInstallSource } from './parse-install-source.js';
