import { basename } from 'node:path';
import { JUNIE_DOT_AGENTS, JUNIE_GUIDELINES } from '../../targets/junie/constants.js';
import {
  KIRO_AGENTS_MD,
  KIRO_STEERING_DIR,
  KIRO_SKILLS_DIR,
} from '../../targets/kiro/constants.js';
import {
  ROO_CODE_ROOT_RULE,
  ROO_CODE_ROOT_RULE_FALLBACK,
  ROO_CODE_RULES_DIR,
  ROO_CODE_COMMANDS_DIR,
  ROO_CODE_SKILLS_DIR,
} from '../../targets/roo-code/constants.js';
import {
  ANTIGRAVITY_RULES_ROOT,
  ANTIGRAVITY_RULES_ROOT_LEGACY,
  ANTIGRAVITY_RULES_DIR,
  ANTIGRAVITY_WORKFLOWS_DIR,
  ANTIGRAVITY_SKILLS_DIR,
} from '../../targets/antigravity/constants.js';
import { CONTINUE_ROOT_RULE, CONTINUE_ROOT_RULE_LEGACY } from '../../targets/continue/constants.js';
import {
  addScopedAgentsMappings,
  addSimpleFileMapping,
  addSkillLikeMapping,
  listFiles,
  rel,
} from './import-map-shared.js';

const AB_RULES = '.agentsmesh/rules';
const AB_COMMANDS = '.agentsmesh/commands';
const AB_AGENTS = '.agentsmesh/agents';

function addCopilotInstructionMapping(refs: Map<string, string>, fromPath: string): void {
  if (fromPath.endsWith('.instructions.md')) {
    refs.set(fromPath, `${AB_RULES}/${basename(fromPath, '.instructions.md')}.md`);
    return;
  }
  addSimpleFileMapping(refs, fromPath, AB_RULES, '.md');
}

export async function buildClaudeCodeImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  // Root instruction files — explicit mappings (not inside a scannable subdirectory)
  refs.set('.claude/CLAUDE.md', `${AB_RULES}/_root.md`);
  refs.set('CLAUDE.md', `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, '.claude/rules')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.claude/commands')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.claude/agents')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.claude/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.claude/skills');
  }
}

export async function buildCursorImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  // AGENTS.md is the cursor root compatibility mirror (§3.1 of cursor format doc)
  refs.set('AGENTS.md', `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, '.cursor/rules')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.mdc');
  }
  for (const absPath of await listFiles(projectRoot, '.cursor/commands')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.cursor/agents')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.cursor/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.cursor/skills');
  }
}

export async function buildCopilotImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  refs.set('.github/copilot-instructions.md', `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, '.github/copilot')) {
    refs.set(rel(projectRoot, absPath), `${AB_RULES}/${basename(absPath, '.instructions.md')}.md`);
  }
  for (const absPath of await listFiles(projectRoot, '.github/instructions')) {
    addCopilotInstructionMapping(refs, rel(projectRoot, absPath));
  }
  for (const absPath of await listFiles(projectRoot, '.github/prompts')) {
    refs.set(rel(projectRoot, absPath), `${AB_COMMANDS}/${basename(absPath, '.prompt.md')}.md`);
  }
  for (const absPath of await listFiles(projectRoot, '.github/agents')) {
    refs.set(rel(projectRoot, absPath), `${AB_AGENTS}/${basename(absPath, '.agent.md')}.md`);
  }
  for (const absPath of await listFiles(projectRoot, '.github/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.github/skills');
  }
}

export async function buildContinueImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  refs.set(CONTINUE_ROOT_RULE, `${AB_RULES}/_root.md`);
  refs.set(CONTINUE_ROOT_RULE_LEGACY, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, '.continue/rules')) {
    const relPath = rel(projectRoot, absPath);
    if (relPath === CONTINUE_ROOT_RULE || relPath === CONTINUE_ROOT_RULE_LEGACY) continue;
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.continue/prompts')) {
    refs.set(rel(projectRoot, absPath), `${AB_COMMANDS}/${basename(absPath, '.md')}.md`);
  }
  for (const absPath of await listFiles(projectRoot, '.continue/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.continue/skills');
  }
}

export async function buildJunieImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  refs.set(JUNIE_GUIDELINES, `${AB_RULES}/_root.md`);
  refs.set(JUNIE_DOT_AGENTS, `${AB_RULES}/_root.md`);
  refs.set('AGENTS.md', `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, '.junie/rules')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.junie/commands')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.junie/agents')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.junie/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.junie/skills');
  }
}

export async function buildKiroImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  refs.set(KIRO_AGENTS_MD, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, KIRO_STEERING_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, KIRO_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), KIRO_SKILLS_DIR);
  }
}

export async function buildGeminiCliImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  for (const absPath of await listFiles(projectRoot, '.gemini/rules')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.gemini/commands')) {
    const relPath = rel(projectRoot, absPath);
    if (!relPath.endsWith('.toml') && !relPath.endsWith('.md')) continue;

    const noExt = relPath.replace(/\.(toml|md)$/i, '');
    const commandsPrefix = '.gemini/commands/';
    const relativeNoExt = noExt.startsWith(commandsPrefix)
      ? noExt.slice(commandsPrefix.length)
      : noExt;
    const segments = relativeNoExt.split('/').filter(Boolean);
    const canonicalName = segments.join(':');
    refs.set(relPath, `${AB_COMMANDS}/${canonicalName}.md`);
  }
  for (const absPath of await listFiles(projectRoot, '.gemini/agents')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.gemini/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.gemini/skills');
  }
}

export async function buildClineImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  // Explicit root mapping (excluded from directory scan below)
  refs.set('.clinerules/_root.md', `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, '.clinerules')) {
    const relPath = rel(projectRoot, absPath);
    if (
      !relPath.endsWith('.md') ||
      relPath.includes('/workflows/') ||
      basename(relPath) === '_root.md'
    ) {
      continue;
    }
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.clinerules/workflows')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.cline/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.cline/skills');
  }
}

export async function buildCodexCliImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  refs.set('AGENTS.md', `${AB_RULES}/_root.md`);
  refs.set('codex.md', `${AB_RULES}/_root.md`);
  await addScopedAgentsMappings(refs, projectRoot);
  for (const absPath of await listFiles(projectRoot, '.codex/instructions')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.codex/rules')) {
    const relPath = rel(projectRoot, absPath);
    if (relPath.endsWith('.rules')) {
      addSimpleFileMapping(refs, relPath, AB_RULES, '.rules');
    } else if (relPath.endsWith('.md')) {
      addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
    }
  }
  for (const absPath of await listFiles(projectRoot, '.codex/agents')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.toml');
  }
  for (const absPath of await listFiles(projectRoot, '.agents/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.agents/skills');
  }
}

export async function buildWindsurfImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  refs.set('AGENTS.md', `${AB_RULES}/_root.md`);
  refs.set('.windsurfrules', `${AB_RULES}/_root.md`);
  await addScopedAgentsMappings(refs, projectRoot);
  for (const absPath of await listFiles(projectRoot, '.windsurf/rules')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.windsurf/workflows')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.windsurf/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.windsurf/skills');
  }
}

export async function buildAntigravityImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  refs.set(ANTIGRAVITY_RULES_ROOT, `${AB_RULES}/_root.md`);
  refs.set(ANTIGRAVITY_RULES_ROOT_LEGACY, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, ANTIGRAVITY_RULES_DIR)) {
    const relPath = rel(projectRoot, absPath);
    if (relPath === ANTIGRAVITY_RULES_ROOT || relPath === ANTIGRAVITY_RULES_ROOT_LEGACY) continue;
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, ANTIGRAVITY_WORKFLOWS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, ANTIGRAVITY_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), ANTIGRAVITY_SKILLS_DIR);
  }
}

export async function buildRooCodeImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  refs.set(ROO_CODE_ROOT_RULE, `${AB_RULES}/_root.md`);
  refs.set(ROO_CODE_ROOT_RULE_FALLBACK, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, ROO_CODE_RULES_DIR)) {
    const relPath = rel(projectRoot, absPath);
    if (relPath === ROO_CODE_ROOT_RULE) continue;
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  // Per-mode rule dirs (.roo/rules-{mode}/) → canonical rules
  for (const absPath of await listFiles(projectRoot, '.roo')) {
    const relPath = rel(projectRoot, absPath);
    if (/^\.roo\/rules-[^/]+\/.+\.md$/.test(relPath)) {
      addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
    }
  }
  for (const absPath of await listFiles(projectRoot, ROO_CODE_COMMANDS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, ROO_CODE_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), ROO_CODE_SKILLS_DIR);
  }
}
