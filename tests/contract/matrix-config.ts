/** Shared agentsmesh.yaml for parametrized contract tests (matches e2e target-contract-matrix). */
export const MATRIX_CONFIG = `version: 1
targets:
  - amp
  - claude-code
  - cursor
  - copilot
  - continue
  - junie
  - gemini-cli
  - cline
  - codex-cli
  - windsurf
  - antigravity
  - kiro
  - roo-code
  - kilo-code
  - opencode
  - goose
  - warp
  - zed
features:
  - rules
  - commands
  - agents
  - skills
  - mcp
  - hooks
  - ignore
  - permissions
`;
