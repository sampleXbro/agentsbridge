/**
 * Creates a bare git repo with two commits at the same ref.
 * Used by refresh integration tests to verify the full refresh flow.
 */

import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export interface BareRepoWithTwoCommits {
  /** Absolute path to the bare git repo directory (e.g. /tmp/.../bare.git). */
  readonly bareRepoPath: string;
  readonly firstSha: string;
  readonly secondSha: string;
  readonly refName: string;
  readonly cleanup: () => Promise<void>;
}

export async function createBareRepoWithTwoCommits(): Promise<BareRepoWithTwoCommits> {
  const baseDir = await mkdtemp(join(tmpdir(), 'refresh-bare-'));
  const workDir = join(baseDir, 'work');
  const bareDir = join(baseDir, 'bare.git');

  await mkdir(workDir, { recursive: true });

  // Initialize working repo with a minimal canonical-agentsmesh layout
  await execFileP('git', ['init', '-b', 'main'], { cwd: workDir });
  await execFileP('git', ['config', 'user.email', 'test@test.local'], { cwd: workDir });
  await execFileP('git', ['config', 'user.name', 'test'], { cwd: workDir });
  await mkdir(join(workDir, 'skills', 'a-skill'), { recursive: true });
  await writeFile(
    join(workDir, 'skills', 'a-skill', 'SKILL.md'),
    '---\nname: a-skill\ndescription: v1\n---\n# v1\n',
  );
  await execFileP('git', ['add', '.'], { cwd: workDir });
  await execFileP('git', ['commit', '-m', 'first'], { cwd: workDir });
  const firstSha = (await execFileP('git', ['rev-parse', 'HEAD'], { cwd: workDir })).stdout.trim();

  // Modify and commit again to create second commit
  await writeFile(
    join(workDir, 'skills', 'a-skill', 'SKILL.md'),
    '---\nname: a-skill\ndescription: v2\n---\n# v2\n',
  );
  await execFileP('git', ['commit', '-am', 'second'], { cwd: workDir });
  const secondSha = (await execFileP('git', ['rev-parse', 'HEAD'], { cwd: workDir })).stdout.trim();

  // Clone as bare so we have a "remote" to push/pull
  await execFileP('git', ['clone', '--bare', workDir, bareDir]);

  return {
    bareRepoPath: bareDir,
    firstSha,
    secondSha,
    refName: 'main',
    cleanup: async () => {
      const { rm } = await import('node:fs/promises');
      await rm(baseDir, { recursive: true, force: true });
    },
  };
}

/**
 * Rewind the bare repo's main branch to the first commit.
 * Used to simulate "install captures v1, then upstream advances to v2".
 */
export async function rewindRepoToFirstCommit(
  bareRepoPath: string,
  firstSha: string,
): Promise<void> {
  await execFileP('git', ['--git-dir', bareRepoPath, 'update-ref', 'refs/heads/main', firstSha]);
}
