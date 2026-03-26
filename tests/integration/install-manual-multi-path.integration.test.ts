import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run-install.js';

const ROOT = join(tmpdir(), 'am-install-manual-multi-path');

function listFiles(root: string, base = root): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(abs, base));
    else if (statSync(abs).isFile()) files.push(relative(base, abs));
  }
  return files.sort();
}

describe('manual install multi-path replay (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(join(ROOT, 'upstream', 'agents', 'core'), { recursive: true });
    mkdirSync(join(ROOT, 'upstream', 'agents', 'universal'), { recursive: true });
    mkdirSync(join(ROOT, 'project', '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(ROOT, 'upstream', 'agents', 'core', 'code-archaeologist.md'),
      '---\ndescription: Code archaeologist\ntools: Read, Grep\n---\n\nDig.\n',
    );
    writeFileSync(
      join(ROOT, 'upstream', 'agents', 'universal', 'documentation-specialist.md'),
      '---\ndescription: Documentation specialist\ntools: Read, Write\n---\n\nDocs.\n',
    );
    writeFileSync(
      join(ROOT, 'project', 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules,agents]\nextends: []\n',
    );
    writeFileSync(
      join(ROOT, 'project', '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('amends one repo-feature pack across multiple source folders and replays all paths on sync', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall(
      { force: true, as: 'agents', path: 'agents/core/code-archaeologist.md' },
      [upstream],
      project,
    );
    await runInstall(
      { force: true, as: 'agents', path: 'agents/universal/documentation-specialist.md' },
      [upstream],
      project,
    );

    expect(listFiles(join(project, '.agentsmesh', 'packs', 'upstream-agents', 'agents'))).toEqual([
      'code-archaeologist.md',
      'documentation-specialist.md',
    ]);

    const installs = readFileSync(join(project, '.agentsmesh', 'installs.yaml'), 'utf8');
    expect(installs).toContain('name: upstream-agents');
    expect(installs).toContain('paths:');
    expect(installs).toContain('- agents/core');
    expect(installs).toContain('- agents/universal');
    expect(installs).toContain('- code-archaeologist');
    expect(installs).toContain('- documentation-specialist');

    rmSync(join(project, '.agentsmesh', 'packs'), { recursive: true, force: true });
    expect(existsSync(join(project, '.agentsmesh', 'packs', 'upstream-agents'))).toBe(false);

    await runInstall({ sync: true, force: true }, [], project);

    expect(listFiles(join(project, '.agentsmesh', 'packs', 'upstream-agents', 'agents'))).toEqual([
      'code-archaeologist.md',
      'documentation-specialist.md',
    ]);
    expect(listFiles(join(project, '.claude', 'agents'))).toEqual([
      'code-archaeologist.md',
      'documentation-specialist.md',
    ]);
  });
});
