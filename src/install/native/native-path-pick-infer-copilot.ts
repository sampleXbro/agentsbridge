/**
 * Copilot native path → extends.pick for install.
 */

import { basename, join } from 'node:path';
import type { ExtendPick } from '../../config/core/schema.js';
import { readDirRecursive } from '../../utils/filesystem/fs.js';
import { COPILOT_PROMPTS_DIR } from '../../targets/copilot/constants.js';
import { skillNamesFromNativeSkillDir } from './native-skill-scan.js';

export async function inferCopilotPickFromPath(
  repoRoot: string,
  posixPath: string,
): Promise<ExtendPick> {
  const scan = join(repoRoot, ...posixPath.split('/'));
  if (posixPath.startsWith(COPILOT_PROMPTS_DIR)) {
    const files = await readDirRecursive(scan);
    const commands = [
      ...new Set(
        files
          .filter((f) => f.toLowerCase().endsWith('.prompt.md'))
          .map((f) => basename(f, '.prompt.md')),
      ),
    ].sort();
    return commands.length ? { commands } : {};
  }
  if (posixPath.startsWith('.github/copilot') && !posixPath.includes('copilot-instructions.md')) {
    const files = await readDirRecursive(scan);
    const rules = [
      ...new Set(
        files
          .filter((f) => f.includes('.instructions.md'))
          .map((f) => basename(f).replace(/\.instructions\.md$/i, '')),
      ),
    ].sort();
    return rules.length ? { rules } : {};
  }
  if (posixPath.startsWith('.github/instructions')) {
    const files = await readDirRecursive(scan);
    const names = new Set<string>();
    for (const f of files) {
      const b = basename(f);
      if (b.toLowerCase().endsWith('.instructions.md'))
        names.add(b.replace(/\.instructions\.md$/i, ''));
      else if (b.toLowerCase().endsWith('.md')) names.add(basename(f, '.md'));
    }
    const rules = [...names].sort();
    return rules.length ? { rules } : {};
  }
  if (posixPath.startsWith('.github/skills')) {
    const skills = await skillNamesFromNativeSkillDir(scan);
    return skills.length ? { skills } : {};
  }
  if (posixPath.startsWith('.github/agents')) {
    const files = await readDirRecursive(scan);
    const agents = [
      ...new Set(
        files
          .filter((f) => f.toLowerCase().endsWith('.agent.md'))
          .map((f) => basename(f, '.agent.md')),
      ),
    ].sort();
    return agents.length ? { agents } : {};
  }
  return {};
}
