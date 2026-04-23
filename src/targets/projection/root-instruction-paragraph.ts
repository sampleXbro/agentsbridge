import {
  replaceManagedBlock,
  ROOT_CONTRACT_END,
  ROOT_CONTRACT_START,
  stripManagedBlock,
} from './managed-blocks.js';

/** Body v1: original text with `.agentsmesh/` substring. */
const ROOT_INSTRUCTION_BODY_V1 =
  "AgentsMesh is a config sync library for AI coding tools. The only canonical source of truth is `.agentsmesh/`; files emitted into target formats such as `AGENTS.md`, `.claude/`, `.cursor/`, `.junie/`, and similar directories are generated artifacts. When making changes, edit canonical config first, then regenerate and verify the target outputs. Preserve the library's bidirectional contract: import native tool config into canonical form, generate back to target-specific layouts, and keep projected or embedded features round-trippable rather than treating them as plain text exports.";

/** Body v2: removed `.agentsmesh/` substring to satisfy the link-rewrite e2e contract. */
const ROOT_INSTRUCTION_BODY_V2 =
  "AgentsMesh is a config sync library for AI coding tools. The only canonical source of truth is the `.agentsmesh` directory at the project root; files emitted into target formats such as `AGENTS.md`, `.claude/`, `.cursor/`, `.junie/`, and similar directories are generated artifacts. When making changes, edit canonical config first, then regenerate and verify the target outputs. Preserve the library's bidirectional contract: import native tool config into canonical form, generate back to target-specific layouts, and keep projected or embedded features round-trippable rather than treating them as plain text exports.";

/** Body v3: prior short contract text. Kept for upgrade/strip compatibility. */
const ROOT_INSTRUCTION_BODY_V3 =
  'AgentsMesh syncs AI coding tool configuration from a single canonical `.agentsmesh` directory. All target-specific files (`.claude/`, `.cursor/`, `AGENTS.md`, etc.) are generated artifacts — edit canonical config first, then regenerate. The import/generate contract is bidirectional and lossless: embedded or projected features round-trip without data loss.';

/** Body v4: prior short creation guidance. Kept for upgrade/strip compatibility. */
const ROOT_INSTRUCTION_BODY_V4 =
  "Create agents, skills, commands, rules, hooks, and MCP in `.agentsmesh`, then run `agentsmesh generate` to sync each tool's native files. Edit `.agentsmesh`, not generated outputs.";

/** Body v5: prior structure guidance, kept for upgrade/strip compatibility. */
const ROOT_INSTRUCTION_BODY_V5 =
  'Use Claude-style Markdown in `.agentsmesh`: `agents/*.md`, `commands/*.md`, and `skills/*/SKILL.md`; keep rules in `rules/*.md`, hooks in `hooks.yaml`, MCP in `mcp.json`, permissions in `permissions.yaml`, and ignore patterns in `ignore`, then run `agentsmesh generate`.';

/** Body v6: prior compact canonical authoring guide, kept for upgrade/strip compatibility. */
const ROOT_INSTRUCTION_BODY_V6 =
  'Create canonical files in `.agentsmesh`: `rules/_root.md` and `rules/*.md` are Markdown rules; `commands/*.md`, `agents/*.md`, and `skills/*/SKILL.md` plus supporting files use Claude-style frontmatter Markdown; `mcp.json` is MCP JSON; `hooks.yaml` and `permissions.yaml` are YAML; `ignore` is gitignore-style text. Then run `agentsmesh generate`.';

/** Body v7: prior explicit edit-surface guidance, kept for upgrade/strip compatibility. */
const ROOT_INSTRUCTION_BODY_V7 =
  '`.agentsmesh` is the only folder you edit or add these files in: `rules/_root.md` and `rules/*.md` are Markdown rules; `commands/*.md`, `agents/*.md`, and `skills/*/SKILL.md` plus supporting files use Claude-style frontmatter Markdown; `mcp.json` is MCP JSON; `hooks.yaml` and `permissions.yaml` are YAML; `ignore` is gitignore-style text. Do not edit generated tool files; run `agentsmesh generate`.';

/** Body v8 (current): compact installed-repo operating guide. */
const ROOT_INSTRUCTION_BODY =
  '`agentsmesh.yaml` selects targets/features (`agentsmesh.local.yaml` overrides locally), and `.agentsmesh` is the only place to add or edit canonical items: `rules/_root.md`, `rules/*.md`, `commands/*.md`, `agents/*.md`, `skills/*/SKILL.md` plus supporting files, `mcp.json`, `hooks.yaml`, `permissions.yaml`, and `ignore`; if missing run `agentsmesh init`, use `agentsmesh import --from <tool>` for native configs, `agentsmesh install <source>` or `install --sync` for reusable packs, then run `agentsmesh generate`. Use `diff`, `lint`, `check`, `watch`, `matrix`, and `merge` as needed; never edit generated tool files.';

const LEGACY_AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH = ROOT_INSTRUCTION_BODY_V1;

const LEGACY_AGENTSMESH_ROOT_INSTRUCTION_SECTION = `## Project-Specific Rules

${ROOT_INSTRUCTION_BODY_V1}`;

/** Prior shipped heading + v1 body (still stripped on import after wording change). */
const AGENTSMESH_CONTRACT_WITH_V1_BODY = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY_V1}`;

/** Prior shipped heading + v2 body (still stripped on import after wording change). */
const AGENTSMESH_CONTRACT_WITH_V2_BODY = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY_V2}`;

/** Prior shipped heading + v3 body (still stripped on import after wording change). */
const AGENTSMESH_CONTRACT_WITH_V3_BODY = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY_V3}`;

/** Prior shipped heading + v4 body (still stripped on import after wording change). */
const AGENTSMESH_CONTRACT_WITH_V4_BODY = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY_V4}`;

/** Prior shipped heading + v5 body (still stripped on import after wording change). */
const AGENTSMESH_CONTRACT_WITH_V5_BODY = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY_V5}`;

/** Prior shipped heading + v6 body (still stripped on import after wording change). */
const AGENTSMESH_CONTRACT_WITH_V6_BODY = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY_V6}`;

/** Prior shipped heading + v7 body (still stripped on import after wording change). */
const AGENTSMESH_CONTRACT_WITH_V7_BODY = `## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY_V7}`;

export const AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH = `${ROOT_CONTRACT_START}
## AgentsMesh Generation Contract

${ROOT_INSTRUCTION_BODY}
${ROOT_CONTRACT_END}`;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** All legacy paragraph forms, newest first. Each is tried for upgrade/strip. */
const LEGACY_FORMS = [
  AGENTSMESH_CONTRACT_WITH_V7_BODY,
  AGENTSMESH_CONTRACT_WITH_V6_BODY,
  AGENTSMESH_CONTRACT_WITH_V5_BODY,
  AGENTSMESH_CONTRACT_WITH_V4_BODY,
  AGENTSMESH_CONTRACT_WITH_V3_BODY,
  AGENTSMESH_CONTRACT_WITH_V2_BODY,
  AGENTSMESH_CONTRACT_WITH_V1_BODY,
  LEGACY_AGENTSMESH_ROOT_INSTRUCTION_SECTION,
  LEGACY_AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
];

export function appendAgentsmeshRootInstructionParagraph(content: string): string {
  const trimmed = content.trim();
  if (trimmed.includes(ROOT_CONTRACT_START) && trimmed.includes(ROOT_CONTRACT_END)) {
    return replaceManagedBlock(
      trimmed,
      ROOT_CONTRACT_START,
      ROOT_CONTRACT_END,
      AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
    );
  }
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
  let result = stripManagedBlock(content, ROOT_CONTRACT_START, ROOT_CONTRACT_END);
  result = result.replace(`\n\n${AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH}`, '');
  for (const legacy of LEGACY_FORMS) {
    result = result.replace(`\n\n${legacy}`, '');
  }
  return result.trim();
}
