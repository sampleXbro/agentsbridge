/**
 * Normalize persisted install path/pick for manual single-item installs.
 */

import { basename, dirname, join } from 'node:path';
import { stat } from 'node:fs/promises';
import type { ExtendPick } from '../config/schema.js';
import type { ManualInstallAs } from './manual-install-mode.js';
import { readSkillFrontmatterName } from './skill-repo-filter.js';

export interface ManualInstallPersistence {
  pathInRepo?: string;
  pick?: ExtendPick;
}

function trimDot(pathInRepo: string): string | undefined {
  return pathInRepo === '.' || pathInRepo === '' ? undefined : pathInRepo;
}

function markdownPick(as: Exclude<ManualInstallAs, 'skills'>, pathValue: string): ExtendPick {
  const name = basename(pathValue).replace(/\.md$/i, '');
  if (as === 'agents') return { agents: [name] };
  if (as === 'commands') return { commands: [name] };
  return { rules: [name] };
}

export async function resolveManualInstallPersistence(args: {
  as?: ManualInstallAs;
  contentRoot: string;
  pathInRepo: string;
}): Promise<ManualInstallPersistence> {
  if (!args.as) {
    return { pathInRepo: trimDot(args.pathInRepo) };
  }

  const normalizedPath = args.pathInRepo.replace(/^\/+|\/+$/g, '');
  const info = await stat(args.contentRoot);

  if (args.as !== 'skills' && info.isFile() && args.contentRoot.toLowerCase().endsWith('.md')) {
    return {
      pathInRepo: trimDot(dirname(normalizedPath)),
      pick: markdownPick(args.as, normalizedPath || args.contentRoot),
    };
  }

  if (args.as === 'skills') {
    if (info.isFile() && basename(args.contentRoot) === 'SKILL.md') {
      const skillDir = normalizedPath ? dirname(normalizedPath) : dirname(args.contentRoot);
      return {
        pathInRepo: trimDot(dirname(skillDir)),
        pick: { skills: [basename(skillDir)] },
      };
    }
    if (info.isDirectory()) {
      const skillDir = normalizedPath || basename(args.contentRoot);
      const skillFile = join(args.contentRoot.replace(/\/+$/g, ''), 'SKILL.md');
      try {
        const skillStat = await stat(skillFile);
        if (skillStat.isFile()) {
          const fmName = await readSkillFrontmatterName(skillFile);
          return {
            pathInRepo: trimDot(dirname(skillDir)),
            pick: { skills: [fmName || basename(skillDir)] },
          };
        }
      } catch {
        return { pathInRepo: trimDot(normalizedPath) };
      }
    }
  }

  return { pathInRepo: trimDot(normalizedPath) };
}
