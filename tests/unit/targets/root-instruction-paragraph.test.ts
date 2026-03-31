import { describe, expect, it } from 'vitest';
import {
  AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
  appendAgentsmeshRootInstructionParagraph,
} from '../../../src/targets/projection/root-instruction-paragraph.js';

describe('appendAgentsmeshRootInstructionParagraph', () => {
  const LEGACY_BODY_V1 =
    "AgentsMesh is a config sync library for AI coding tools. The only canonical source of truth is `.agentsmesh/`; files emitted into target formats such as `AGENTS.md`, `.claude/`, `.cursor/`, `.junie/`, and similar directories are generated artifacts. When making changes, edit canonical config first, then regenerate and verify the target outputs. Preserve the library's bidirectional contract: import native tool config into canonical form, generate back to target-specific layouts, and keep projected or embedded features round-trippable rather than treating them as plain text exports.";

  const LEGACY_BODY_V2 =
    "AgentsMesh is a config sync library for AI coding tools. The only canonical source of truth is the `.agentsmesh` directory at the project root; files emitted into target formats such as `AGENTS.md`, `.claude/`, `.cursor/`, `.junie/`, and similar directories are generated artifacts. When making changes, edit canonical config first, then regenerate and verify the target outputs. Preserve the library's bidirectional contract: import native tool config into canonical form, generate back to target-specific layouts, and keep projected or embedded features round-trippable rather than treating them as plain text exports.";

  it('appends the headed section to plain content', () => {
    const result = appendAgentsmeshRootInstructionParagraph('First');
    expect(result).toContain('First');
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result).toContain('AgentsMesh syncs AI coding tool configuration');
    expect(result).not.toContain('.agentsmesh/');
  });

  it('does not append the section twice when already present', () => {
    const result = appendAgentsmeshRootInstructionParagraph(
      `First\n\n${AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH}`,
    );
    expect(result.match(/AgentsMesh syncs AI coding tool configuration/g)).toHaveLength(1);
    expect(result.match(/## AgentsMesh Generation Contract/g)).toHaveLength(1);
  });

  it('upgrades the v1 legacy paragraph without a heading', () => {
    const result = appendAgentsmeshRootInstructionParagraph(`First\n\n${LEGACY_BODY_V1}`);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result).toContain('AgentsMesh syncs AI coding tool configuration');
    expect(result).not.toContain('.agentsmesh/');
  });

  it('replaces the old Project-Specific Rules heading with the current one', () => {
    const oldSection = `## Project-Specific Rules\n\n${LEGACY_BODY_V1}`;
    const result = appendAgentsmeshRootInstructionParagraph(`First\n\n${oldSection}`);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result).not.toContain('## Project-Specific Rules');
    expect(result).toContain('AgentsMesh syncs AI coding tool configuration');
    expect(result).not.toContain('.agentsmesh/');
  });

  it('upgrades the v1 body under the current heading', () => {
    const oldContract = `First\n\n## AgentsMesh Generation Contract\n\n${LEGACY_BODY_V1}`;
    const result = appendAgentsmeshRootInstructionParagraph(oldContract);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result.match(/## AgentsMesh Generation Contract/g)).toHaveLength(1);
    expect(result).not.toContain('.agentsmesh/');
    expect(result).toContain('AgentsMesh syncs AI coding tool configuration');
  });

  it('upgrades the v2 body under the current heading', () => {
    const v2Contract = `First\n\n## AgentsMesh Generation Contract\n\n${LEGACY_BODY_V2}`;
    const result = appendAgentsmeshRootInstructionParagraph(v2Contract);
    expect(result).toContain('## AgentsMesh Generation Contract');
    expect(result.match(/## AgentsMesh Generation Contract/g)).toHaveLength(1);
    expect(result).toContain('AgentsMesh syncs AI coding tool configuration');
    expect(result).not.toContain('The only canonical source of truth');
  });
});
