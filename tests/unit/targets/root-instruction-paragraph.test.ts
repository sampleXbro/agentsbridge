import { describe, expect, it } from 'vitest';
import {
  AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
  appendAgentsmeshRootInstructionParagraph,
} from '../../../src/targets/projection/root-instruction-paragraph.js';

describe('appendAgentsmeshRootInstructionParagraph', () => {
  const CURRENT_BODY_SNIPPET = '`agentsmesh.yaml` selects targets/features';

  const LEGACY_BODY_V1 =
    "AgentsMesh is a config sync library for AI coding tools. The only canonical source of truth is `.agentsmesh/`; files emitted into target formats such as `AGENTS.md`, `.claude/`, `.cursor/`, `.junie/`, and similar directories are generated artifacts. When making changes, edit canonical config first, then regenerate and verify the target outputs. Preserve the library's bidirectional contract: import native tool config into canonical form, generate back to target-specific layouts, and keep projected or embedded features round-trippable rather than treating them as plain text exports.";

  const LEGACY_BODY_V2 =
    "AgentsMesh is a config sync library for AI coding tools. The only canonical source of truth is the `.agentsmesh` directory at the project root; files emitted into target formats such as `AGENTS.md`, `.claude/`, `.cursor/`, `.junie/`, and similar directories are generated artifacts. When making changes, edit canonical config first, then regenerate and verify the target outputs. Preserve the library's bidirectional contract: import native tool config into canonical form, generate back to target-specific layouts, and keep projected or embedded features round-trippable rather than treating them as plain text exports.";

  const LEGACY_BODY_V3 =
    'AgentsMesh syncs AI coding tool configuration from a single canonical `.agentsmesh` directory. All target-specific files (`.claude/`, `.cursor/`, `AGENTS.md`, etc.) are generated artifacts — edit canonical config first, then regenerate. The import/generate contract is bidirectional and lossless: embedded or projected features round-trip without data loss.';

  const LEGACY_BODY_V4 =
    "Create agents, skills, commands, rules, hooks, and MCP in `.agentsmesh`, then run `agentsmesh generate` to sync each tool's native files. Edit `.agentsmesh`, not generated outputs.";

  const LEGACY_BODY_V5 =
    'Use Claude-style Markdown in `.agentsmesh`: `agents/*.md`, `commands/*.md`, and `skills/*/SKILL.md`; keep rules in `rules/*.md`, hooks in `hooks.yaml`, MCP in `mcp.json`, permissions in `permissions.yaml`, and ignore patterns in `ignore`, then run `agentsmesh generate`.';

  const LEGACY_BODY_V6 =
    'Create canonical files in `.agentsmesh`: `rules/_root.md` and `rules/*.md` are Markdown rules; `commands/*.md`, `agents/*.md`, and `skills/*/SKILL.md` plus supporting files use Claude-style frontmatter Markdown; `mcp.json` is MCP JSON; `hooks.yaml` and `permissions.yaml` are YAML; `ignore` is gitignore-style text. Then run `agentsmesh generate`.';

  const LEGACY_BODY_V7 =
    '`.agentsmesh` is the only folder you edit or add these files in: `rules/_root.md` and `rules/*.md` are Markdown rules; `commands/*.md`, `agents/*.md`, and `skills/*/SKILL.md` plus supporting files use Claude-style frontmatter Markdown; `mcp.json` is MCP JSON; `hooks.yaml` and `permissions.yaml` are YAML; `ignore` is gitignore-style text. Do not edit generated tool files; run `agentsmesh generate`.';

  it('appends the headed section to plain content', () => {
    const result = appendAgentsmeshRootInstructionParagraph('First');
    expect(result).toContain('First');
    expect(result).toContain('<!-- agentsmesh:root-generation-contract:start -->');
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result).toContain('<!-- agentsmesh:root-generation-contract:end -->');
    expect(result).toContain(CURRENT_BODY_SNIPPET);
    expect(result).not.toContain('.agentsmesh/');
  });

  it('does not append the section twice when already present', () => {
    const result = appendAgentsmeshRootInstructionParagraph(
      `First\n\n${AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH}`,
    );
    expect(result.split(CURRENT_BODY_SNIPPET)).toHaveLength(2);
    expect(result.match(/## AgentsMesh Generation Contract/g)).toHaveLength(1);
  });

  it('replaces an existing managed contract block instead of appending another', () => {
    const existing = [
      'First',
      '<!-- agentsmesh:root-generation-contract:start -->',
      '## AgentsMesh Generation Contract',
      '',
      'Old generated text with .agentsmesh/rules/example.md',
      '<!-- agentsmesh:root-generation-contract:end -->',
    ].join('\n');
    const result = appendAgentsmeshRootInstructionParagraph(existing);
    expect(result.match(/agentsmesh:root-generation-contract:start/g)).toHaveLength(1);
    expect(result).toContain(CURRENT_BODY_SNIPPET);
    expect(result).not.toContain('Old generated text');
  });

  it('upgrades the v1 legacy paragraph without a heading', () => {
    const result = appendAgentsmeshRootInstructionParagraph(`First\n\n${LEGACY_BODY_V1}`);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result).toContain(CURRENT_BODY_SNIPPET);
    expect(result).not.toContain('.agentsmesh/');
  });

  it('replaces the old Project-Specific Rules heading with the current one', () => {
    const oldSection = `## Project-Specific Rules\n\n${LEGACY_BODY_V1}`;
    const result = appendAgentsmeshRootInstructionParagraph(`First\n\n${oldSection}`);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result).not.toContain('## Project-Specific Rules');
    expect(result).toContain(CURRENT_BODY_SNIPPET);
    expect(result).not.toContain('.agentsmesh/');
  });

  it('upgrades the v1 body under the current heading', () => {
    const oldContract = `First\n\n## AgentsMesh Generation Contract\n\n${LEGACY_BODY_V1}`;
    const result = appendAgentsmeshRootInstructionParagraph(oldContract);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result.match(/## AgentsMesh Generation Contract/g)).toHaveLength(1);
    expect(result).not.toContain('.agentsmesh/');
    expect(result).toContain(CURRENT_BODY_SNIPPET);
  });

  it('upgrades the v2 body under the current heading', () => {
    const v2Contract = `First\n\n## AgentsMesh Generation Contract\n\n${LEGACY_BODY_V2}`;
    const result = appendAgentsmeshRootInstructionParagraph(v2Contract);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result.match(/## AgentsMesh Generation Contract/g)).toHaveLength(1);
    expect(result).toContain(CURRENT_BODY_SNIPPET);
    expect(result).not.toContain('The only canonical source of truth');
  });

  it('upgrades the previous short contract body under the current heading', () => {
    const v3Contract = `First\n\n## AgentsMesh Generation Contract\n\n${LEGACY_BODY_V3}`;
    const result = appendAgentsmeshRootInstructionParagraph(v3Contract);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result.match(/## AgentsMesh Generation Contract/g)).toHaveLength(1);
    expect(result).toContain(CURRENT_BODY_SNIPPET);
    expect(result).not.toContain('AgentsMesh syncs AI coding tool configuration');
  });

  it('upgrades the previous creation-guidance body under the current heading', () => {
    const v4Contract = `First\n\n## AgentsMesh Generation Contract\n\n${LEGACY_BODY_V4}`;
    const result = appendAgentsmeshRootInstructionParagraph(v4Contract);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result.match(/## AgentsMesh Generation Contract/g)).toHaveLength(1);
    expect(result).toContain(CURRENT_BODY_SNIPPET);
    expect(result).not.toContain('Create agents, skills, commands, rules, hooks, and MCP');
  });

  it('upgrades the previous structure-guidance body under the current heading', () => {
    const v5Contract = `First\n\n## AgentsMesh Generation Contract\n\n${LEGACY_BODY_V5}`;
    const result = appendAgentsmeshRootInstructionParagraph(v5Contract);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result.match(/## AgentsMesh Generation Contract/g)).toHaveLength(1);
    expect(result).toContain(CURRENT_BODY_SNIPPET);
    expect(result).not.toContain('Use Claude-style Markdown in `.agentsmesh`');
  });

  it('upgrades the previous canonical-authoring body under the current heading', () => {
    const v6Contract = `First\n\n## AgentsMesh Generation Contract\n\n${LEGACY_BODY_V6}`;
    const result = appendAgentsmeshRootInstructionParagraph(v6Contract);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result.match(/## AgentsMesh Generation Contract/g)).toHaveLength(1);
    expect(result).toContain(CURRENT_BODY_SNIPPET);
    expect(result).not.toContain('Create canonical files in `.agentsmesh`');
  });

  it('upgrades the previous edit-surface body under the current heading', () => {
    const v7Contract = `First\n\n## AgentsMesh Generation Contract\n\n${LEGACY_BODY_V7}`;
    const result = appendAgentsmeshRootInstructionParagraph(v7Contract);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result.match(/## AgentsMesh Generation Contract/g)).toHaveLength(1);
    expect(result).toContain(CURRENT_BODY_SNIPPET);
    expect(result).not.toContain('`.agentsmesh` is the only folder you edit or add these files in');
  });
});
