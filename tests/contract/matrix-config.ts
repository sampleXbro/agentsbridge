/** Shared agentsmesh.yaml for parametrized contract tests (matches e2e target-contract-matrix). */
export const MATRIX_CONFIG = `version: 1
targets:
  - aider
  - amazon-q
  - amp
  - augment-code
  - claude-code
  - cursor
  - copilot
  - continue
  - crush
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
  - qwen-code
  - trae
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
