import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import { AB_AGENTS, AB_COMMANDS, AB_RULES } from './constants.js';

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
