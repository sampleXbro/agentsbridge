/** Body text shipped before the `.agentsmesh/` substring was removed from generated targets (import/strip compatibility). */
const ROOT_INSTRUCTION_BODY_LEGACY =
  "AgentsMesh is a config sync library for AI coding tools. The only canonical source of truth is `.agentsmesh/`; files emitted into target formats such as `AGENTS.md`, `.claude/`, `.cursor/`, `.junie/`, and similar directories are generated artifacts. When making changes, edit canonical config first, then regenerate and verify the target outputs. Preserve the library's bidirectional contract: import native tool config into canonical form, generate back to target-specific layouts, and keep projected or embedded features round-trippable rather than treating them as plain text exports.";

/** Avoid the `.agentsmesh/` substring so generated targets stay free of canonical path tokens in prose (link-rewrite e2e contract). */
const ROOT_INSTRUCTION_BODY =
  "AgentsMesh is a config sync library for AI coding tools. The only canonical source of truth is the `.agentsmesh` directory at the project root; files emitted into target formats such as `AGENTS.md`, `.claude/`, `.cursor/`, `.junie/`, and similar directories are generated artifacts. When making changes, edit canonical config first, then regenerate and verify the target outputs. Preserve the library's bidirectional contract: import native tool config into canonical form, generate back to target-specific layouts, and keep projected or embedded features round-trippable rather than treating them as plain text exports.";

const LEGACY_AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH = ROOT_INSTRUCTION_BODY_LEGACY;

const LEGACY_AGENTSMESH_ROOT_INSTRUCTION_SECTION = `## Project-Specific Rules

${ROOT_INSTRUCTION_BODY_LEGACY}`;

/** Prior shipped heading + legacy body (still stripped on import after wording change). */
const AGENTSMESH_CONTRACT_WITH_LEGACY_BODY = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY_LEGACY}`;

export const AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY}`;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function appendAgentsmeshRootInstructionParagraph(content: string): string {
  const trimmed = content.trim();
  if (
    normalizeWhitespace(trimmed).includes(
      normalizeWhitespace(AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH),
    )
  ) {
    return trimmed;
  }
  if (
    normalizeWhitespace(trimmed).includes(
      normalizeWhitespace(LEGACY_AGENTSMESH_ROOT_INSTRUCTION_SECTION),
    )
  ) {
    return trimmed.replace(
      LEGACY_AGENTSMESH_ROOT_INSTRUCTION_SECTION,
      AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
    );
  }
  if (
    normalizeWhitespace(trimmed).includes(normalizeWhitespace(AGENTSMESH_CONTRACT_WITH_LEGACY_BODY))
  ) {
    return trimmed.replace(
      AGENTSMESH_CONTRACT_WITH_LEGACY_BODY,
      AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
    );
  }
  if (
    normalizeWhitespace(trimmed).includes(
      normalizeWhitespace(LEGACY_AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH),
    )
  ) {
    return trimmed.replace(
      LEGACY_AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
      AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
    );
  }
  return trimmed
    ? `${trimmed}\n\n${AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH}`
    : AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH;
}

export function stripAgentsmeshRootInstructionParagraph(content: string): string {
  return content
    .replace(`\n\n${AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH}`, '')
    .replace(`\n\n${AGENTSMESH_CONTRACT_WITH_LEGACY_BODY}`, '')
    .replace(`\n\n${LEGACY_AGENTSMESH_ROOT_INSTRUCTION_SECTION}`, '')
    .replace(`\n\n${LEGACY_AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH}`, '')
    .trim();
}
