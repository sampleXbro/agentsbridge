/**
 * Infer extends.pick from native files under pathInRepo (all install-supported targets).
 */

import { basename, join } from 'node:path';
import type { ExtendPick } from '../../config/core/schema.js';
import { readDirRecursive } from '../../utils/filesystem/fs.js';
import { inferGeminiCommandNamesFromFiles } from './gemini-install-commands.js';
import { GEMINI_COMMANDS_DIR } from '../../targets/gemini-cli/constants.js';
import { CLINE_SKILLS_DIR, CLINE_WORKFLOWS_DIR } from '../../targets/cline/constants.js';
import { skillNamesFromNativeSkillDir } from './native-skill-scan.js';
import { inferCopilotPickFromPath } from './native-path-pick-infer-copilot.js';

async function mdNames(dir: string, ext: string): Promise<string[]> {
  const files = await readDirRecursive(dir);
  const e = ext.toLowerCase();
  return [
    ...new Set(files.filter((f) => f.toLowerCase().endsWith(e)).map((f) => basename(f, ext))),
  ].sort();
}

export async function inferImplicitPickFromNativePath(
  repoRoot: string,
  pathInRepoPosix: string,
  target: string,
): Promise<ExtendPick> {
  const posixPath = pathInRepoPosix.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const scan = join(repoRoot, ...posixPath.split('/'));

  if (target === 'gemini-cli') {
    if (posixPath === GEMINI_COMMANDS_DIR || posixPath.startsWith(`${GEMINI_COMMANDS_DIR}/`)) {
      const commands = await inferGeminiCommandNamesFromFiles(repoRoot, posixPath);
      return commands.length ? { commands } : {};
    }
    return {};
  }

  if (target === 'claude-code') {
    if (posixPath.startsWith('.claude/commands')) {
      const commands = await mdNames(scan, '.md');
      return commands.length ? { commands } : {};
    }
    if (posixPath.startsWith('.claude/rules')) {
      const rules = await mdNames(scan, '.md');
      return rules.length ? { rules } : {};
    }
    if (posixPath.startsWith('.claude/agents')) {
      const agents = await mdNames(scan, '.md');
      return agents.length ? { agents } : {};
    }
    if (posixPath.startsWith('.claude/skills/')) {
      const rel = posixPath.replace(/^\.claude\/skills\/?/, '');
      const first = rel.split('/').filter(Boolean)[0];
      return first ? { skills: [first] } : {};
    }
    return {};
  }

  if (target === 'cursor') {
    if (posixPath.startsWith('.cursor/rules')) {
      const rules = await mdNames(scan, '.mdc');
      return rules.length ? { rules } : {};
    }
    if (posixPath.startsWith('.cursor/commands')) {
      const commands = await mdNames(scan, '.md');
      return commands.length ? { commands } : {};
    }
    if (posixPath.startsWith('.cursor/agents')) {
      const agents = await mdNames(scan, '.md');
      return agents.length ? { agents } : {};
    }
    if (posixPath.startsWith('.cursor/skills')) {
      const skills = await skillNamesFromNativeSkillDir(scan);
      return skills.length ? { skills } : {};
    }
    return {};
  }

  if (target === 'copilot') {
    return inferCopilotPickFromPath(repoRoot, posixPath);
  }

  if (target === 'windsurf' && posixPath.startsWith('.windsurf/rules')) {
    const rules = await mdNames(scan, '.md');
    return rules.length ? { rules } : {};
  }

  if (target === 'cline') {
    if (posixPath.startsWith(CLINE_SKILLS_DIR)) {
      const skills = await skillNamesFromNativeSkillDir(scan);
      return skills.length ? { skills } : {};
    }
    if (posixPath.startsWith(CLINE_WORKFLOWS_DIR)) {
      const commands = await mdNames(scan, '.md');
      return commands.length ? { commands } : {};
    }
    return {};
  }

  if (target === 'continue') {
    if (posixPath.startsWith('.continue/rules')) {
      const rules = await mdNames(scan, '.md');
      return rules.length ? { rules } : {};
    }
    if (posixPath.startsWith('.continue/prompts')) {
      const commands = await mdNames(scan, '.md');
      return commands.length ? { commands } : {};
    }
    if (posixPath.startsWith('.continue/skills')) {
      const skills = await skillNamesFromNativeSkillDir(scan);
      return skills.length ? { skills } : {};
    }
    return {};
  }

  if (target === 'junie') {
    if (posixPath.startsWith('.junie/commands')) {
      const commands = await mdNames(scan, '.md');
      return commands.length ? { commands } : {};
    }
    if (posixPath.startsWith('.junie/rules')) {
      const rules = await mdNames(scan, '.md');
      return rules.length ? { rules } : {};
    }
    if (posixPath.startsWith('.junie/agents')) {
      const agents = await mdNames(scan, '.md');
      return agents.length ? { agents } : {};
    }
    if (posixPath.startsWith('.junie/skills')) {
      const skills = await skillNamesFromNativeSkillDir(scan);
      return skills.length ? { skills } : {};
    }
    return {};
  }

  if (target === 'codex-cli' && posixPath.startsWith('.codex')) {
    const files = await readDirRecursive(scan);
    const rules = [
      ...new Set(
        files.filter((f) => f.toLowerCase().endsWith('.md')).map((f) => basename(f, '.md')),
      ),
    ].sort();
    return rules.length ? { rules } : {};
  }

  return {};
}

export function isImplicitPickEmpty(p: ExtendPick): boolean {
  return (
    (p.commands?.length ?? 0) +
      (p.rules?.length ?? 0) +
      (p.skills?.length ?? 0) +
      (p.agents?.length ?? 0) ===
    0
  );
}
