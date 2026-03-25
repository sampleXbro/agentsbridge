import { join } from 'node:path';
import { exists } from '../utils/fs.js';

interface TargetSignature {
  target: string;
  paths: string[];
}

const TARGET_SIGNATURES: TargetSignature[] = [
  {
    target: 'claude-code',
    paths: [
      'CLAUDE.md',
      '.claude/rules',
      '.claude/commands',
      '.claude/agents',
      '.claude/skills',
      '.claude/settings.json',
      '.claudeignore',
    ],
  },
  {
    target: 'cursor',
    paths: ['.cursorrules', '.cursor/rules', '.cursor', '.cursor/mcp.json'],
  },
  {
    target: 'copilot',
    paths: [
      '.github/copilot-instructions.md',
      '.github/copilot',
      '.github/instructions',
      '.github/prompts',
      '.github/skills',
      '.github/agents',
      '.github/hooks',
    ],
  },
  {
    target: 'gemini-cli',
    paths: ['GEMINI.md', '.gemini', '.gemini/settings.json'],
  },
  {
    target: 'codex-cli',
    paths: ['.codex', '.codex/config.toml', 'AGENTS.md', 'codex.md'],
  },
  {
    target: 'windsurf',
    paths: ['.windsurfrules', '.windsurf', '.windsurf/workflows'],
  },
  {
    target: 'cline',
    paths: ['.clinerules', '.cline'],
  },
  {
    target: 'continue',
    paths: ['.continue', '.continuerc.json'],
  },
  {
    target: 'junie',
    paths: ['.junie', '.junie/guidelines.md'],
  },
];

/**
 * Detect which native agent format a repo uses by scoring presence of
 * known signature paths. Returns the highest-scoring target name, or null
 * if no recognized format is found (score === 0).
 *
 * Ties break in favour of the earlier entry in TARGET_SIGNATURES.
 *
 * @param repoPath - Absolute path to the repo root to inspect
 * @returns The detected target name, or null if none found
 */
export async function detectNativeFormat(repoPath: string): Promise<string | null> {
  let bestTarget: string | null = null;
  let bestScore = 0;

  for (const sig of TARGET_SIGNATURES) {
    let score = 0;
    for (const rel of sig.paths) {
      if (await exists(join(repoPath, rel))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTarget = sig.target;
    }
  }

  return bestScore > 0 ? bestTarget : null;
}

/** Human-readable list of representative recognisable paths, for error messages. */
export const KNOWN_NATIVE_PATHS: string[] = TARGET_SIGNATURES.map((sig) => sig.paths[0]).filter(
  (p): p is string => p !== undefined,
);
