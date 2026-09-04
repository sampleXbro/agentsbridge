/**
 * Install command builders shared by the hero snippet and the catalog explorer.
 * Plain ESM so `node --test` can exercise it without a TypeScript toolchain.
 */

/** @typedef {'skills' | 'agents' | 'commands'} CatalogKind */
/** @typedef {{ id: 'brew' | 'curl' | 'npm', label: string, note: string, command: string }} InstallMethod */

const DEFAULT_TARGET = 'claude-code';

/** @type {readonly InstallMethod[]} */
export const INSTALL_METHODS = Object.freeze([
  {
    id: 'brew',
    label: 'Homebrew',
    note: 'No Node.js needed',
    command: 'brew install samplexbro/agentsmesh/agentsmesh',
  },
  {
    id: 'curl',
    label: 'Binary',
    note: 'Linux, macOS, Windows',
    command:
      'curl -fsSL https://github.com/sampleXbro/agentsmesh/releases/latest/download/install.sh | sh',
  },
  {
    id: 'npm',
    label: 'npm',
    note: 'Node.js 20+',
    command: 'npm install -D agentsmesh',
  },
]);

/** @param {boolean} global */
export function libraryInstallCommand(global) {
  return global ? 'pnpm add --global agentsmesh' : 'pnpm install agentsmesh';
}

/** @param {string} value */
function shellSingleQuoted(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * @param {{ link: string, kind: CatalogKind, global: boolean, target?: string }} opts
 */
export function packInstallCommand({ link, kind, global, target = DEFAULT_TARGET }) {
  const scope = global ? ' --global' : '';
  return `agentsmesh install${scope} ${shellSingleQuoted(link)} --target ${target} --as ${kind}`;
}
