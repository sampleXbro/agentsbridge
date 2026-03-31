/** Body v1: original text with `.agentsmesh/` substring. */
const ROOT_INSTRUCTION_BODY_V1 =
  "AgentsMesh is a config sync library for AI coding tools. The only canonical source of truth is `.agentsmesh/`; files emitted into target formats such as `AGENTS.md`, `.claude/`, `.cursor/`, `.junie/`, and similar directories are generated artifacts. When making changes, edit canonical config first, then regenerate and verify the target outputs. Preserve the library's bidirectional contract: import native tool config into canonical form, generate back to target-specific layouts, and keep projected or embedded features round-trippable rather than treating them as plain text exports.";

/** Body v2: removed `.agentsmesh/` substring to satisfy the link-rewrite e2e contract. */
const ROOT_INSTRUCTION_BODY_V2 =
  "AgentsMesh is a config sync library for AI coding tools. The only canonical source of truth is the `.agentsmesh` directory at the project root; files emitted into target formats such as `AGENTS.md`, `.claude/`, `.cursor/`, `.junie/`, and similar directories are generated artifacts. When making changes, edit canonical config first, then regenerate and verify the target outputs. Preserve the library's bidirectional contract: import native tool config into canonical form, generate back to target-specific layouts, and keep projected or embedded features round-trippable rather than treating them as plain text exports.";

/** Body v3 (current): optimized for brevity. Avoids `.agentsmesh/` substring. */
const ROOT_INSTRUCTION_BODY =
  'AgentsMesh syncs AI coding tool configuration from a single canonical `.agentsmesh` directory. All target-specific files (`.claude/`, `.cursor/`, `AGENTS.md`, etc.) are generated artifacts — edit canonical config first, then regenerate. The import/generate contract is bidirectional and lossless: embedded or projected features round-trip without data loss.';

const LEGACY_AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH = ROOT_INSTRUCTION_BODY_V1;

const LEGACY_AGENTSMESH_ROOT_INSTRUCTION_SECTION = `## Project-Specific Rules

${ROOT_INSTRUCTION_BODY_V1}`;

/** Prior shipped heading + v1 body (still stripped on import after wording change). */
const AGENTSMESH_CONTRACT_WITH_V1_BODY = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY_V1}`;

/** Prior shipped heading + v2 body (still stripped on import after wording change). */
const AGENTSMESH_CONTRACT_WITH_V2_BODY = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY_V2}`;

export const AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY}`;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** All legacy paragraph forms, newest first. Each is tried for upgrade/strip. */
const LEGACY_FORMS = [
  AGENTSMESH_CONTRACT_WITH_V2_BODY,
  AGENTSMESH_CONTRACT_WITH_V1_BODY,
  LEGACY_AGENTSMESH_ROOT_INSTRUCTION_SECTION,
  LEGACY_AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
];

export function appendAgentsmeshRootInstructionParagraph(content: string): string {
  const trimmed = content.trim();
  const norm = normalizeWhitespace(trimmed);
  if (norm.includes(normalizeWhitespace(AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH))) {
    return trimmed;
  }
  for (const legacy of LEGACY_FORMS) {
    if (norm.includes(normalizeWhitespace(legacy))) {
      return trimmed.replace(legacy, AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH);
    }
  }
  return trimmed
    ? `${trimmed}\n\n${AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH}`
    : AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH;
}

export function stripAgentsmeshRootInstructionParagraph(content: string): string {
  let result = content;
  result = result.replace(`\n\n${AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH}`, '');
  for (const legacy of LEGACY_FORMS) {
    result = result.replace(`\n\n${legacy}`, '');
  }
  return result.trim();
}
