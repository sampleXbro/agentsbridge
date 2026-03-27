import { readdir, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { exists } from '../../utils/filesystem/fs.js';

interface ManagedScope {
  dirs: string[];
  files: string[];
}

const TARGET_MANAGED_OUTPUTS: Record<string, ManagedScope> = {
  'claude-code': {
    dirs: ['.claude/agents', '.claude/commands', '.claude/rules', '.claude/skills'],
    files: ['.claude/CLAUDE.md', '.claude/settings.json', '.claudeignore', '.mcp.json'],
  },
  cursor: {
    dirs: ['.cursor/agents', '.cursor/commands', '.cursor/rules', '.cursor/skills'],
    files: ['.cursor/hooks.json', '.cursor/mcp.json', '.cursorignore', 'AGENTS.md'],
  },
  copilot: {
    dirs: [
      '.github/agents',
      '.github/instructions',
      '.github/prompts',
      '.github/skills',
      '.github/hooks/scripts',
    ],
    files: ['.github/copilot-instructions.md', '.github/hooks/agentsmesh.json'],
  },
  continue: {
    dirs: ['.continue/prompts', '.continue/rules', '.continue/skills'],
    files: ['.continue/mcpServers/agentsmesh.json'],
  },
  junie: {
    dirs: ['.junie/agents', '.junie/commands', '.junie/rules', '.junie/skills'],
    files: ['.aiignore', '.junie/AGENTS.md', '.junie/mcp/mcp.json'],
  },
  'gemini-cli': {
    dirs: ['.gemini/agents', '.gemini/commands', '.gemini/skills'],
    files: [
      'AGENTS.md',
      'GEMINI.md',
      '.gemini/settings.json',
      '.gemini/policies/permissions.toml',
      '.geminiignore',
    ],
  },
  cline: {
    dirs: ['.cline/skills', '.clinerules/hooks', '.clinerules/workflows'],
    files: [
      'AGENTS.md',
      '.cline/cline_mcp_settings.json',
      '.clineignore',
      '.clinerules/typescript.md',
    ],
  },
  'codex-cli': {
    dirs: ['.agents/skills', '.codex/agents', '.codex/instructions'],
    files: ['AGENTS.md', '.codex/config.toml'],
  },
  windsurf: {
    dirs: ['.windsurf/rules', '.windsurf/skills', '.windsurf/workflows'],
    files: [
      'AGENTS.md',
      'src/AGENTS.md',
      '.codeiumignore',
      '.windsurf/hooks.json',
      '.windsurf/mcp_config.example.json',
    ],
  },
};

async function listFiles(root: string, base = root): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(abs, base)));
      continue;
    }
    files.push(relative(base, abs).replace(/\\/g, '/'));
  }
  return files;
}

async function removeIfStale(
  projectRoot: string,
  relPath: string,
  expected: Set<string>,
): Promise<void> {
  if (expected.has(relPath)) return;
  const abs = join(projectRoot, relPath);
  if (await exists(abs)) await rm(abs, { recursive: true, force: true });
}

export async function cleanupStaleGeneratedOutputs(args: {
  projectRoot: string;
  targets: string[];
  expectedPaths: string[];
}): Promise<void> {
  const expected = new Set(args.expectedPaths);
  const stale = new Set<string>();

  for (const target of args.targets) {
    const managed = TARGET_MANAGED_OUTPUTS[target];
    if (!managed) continue;
    for (const file of managed.files) stale.add(file);
    for (const dir of managed.dirs) {
      const absDir = join(args.projectRoot, dir);
      if (!(await exists(absDir))) continue;
      for (const file of await listFiles(absDir)) {
        stale.add(`${dir}/${file}`.replace(/\/+/g, '/'));
      }
    }
  }

  for (const relPath of stale) {
    await removeIfStale(args.projectRoot, relPath, expected);
  }
}
