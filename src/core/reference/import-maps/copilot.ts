import { basename } from 'node:path';
import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import { AB_AGENTS, AB_COMMANDS, AB_RULES } from './constants.js';

function addCopilotInstructionMapping(refs: Map<string, string>, fromPath: string): void {
  if (fromPath.endsWith('.instructions.md')) {
    refs.set(fromPath, `${AB_RULES}/${basename(fromPath, '.instructions.md')}.md`);
    return;
  }
  addSimpleFileMapping(refs, fromPath, AB_RULES, '.md');
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
