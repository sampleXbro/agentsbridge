/**
 * Copilot capability projections.
 *
 * Exported as named constants (`projectCapabilities`, `globalCapabilities`) to
 * avoid name shadowing with any inline variables in `index.ts`.
 */

import type { TargetCapabilities } from '../catalog/target.interface.js';

export const projectCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'none',
  permissions: 'none',
};

export const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  // Copilot CLI has no prompt-file/custom-slash-command mechanism: the
  // official ~/.copilot config-dir reference lists no `prompts/` entry, and
  // github/copilot-cli#618 (maintainer, closed) confirms prompt files are not
  // planned ("superseded by skills"). VS Code Copilot Chat's own user-level
  // prompt files live in the OS-specific VS Code profile folder, not ~/.copilot.
  commands: 'none',
  agents: 'native',
  skills: 'native',
  // ~/.copilot/mcp-config.json, `mcpServers` key (docs.github.com/en/copilot/
  // how-tos/copilot-cli/customize-copilot/add-mcp-servers).
  mcp: 'native',
  // ~/.copilot/hooks/*.json, same {version, hooks} schema as project scope
  // (docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks).
  hooks: 'native',
  ignore: 'none',
  // ~/.copilot/permissions-config.json records saved tool/directory approvals,
  // but explicitly does not support deny rules, ask rules, default modes, URL
  // rules, tool filtering, or repository-local shared policy (docs.github.com/
  // en/copilot/reference/copilot-cli-reference/cli-config-dir-reference) — capped
  // at partial with a lint warning, not a full generator.
  permissions: 'partial',
};
