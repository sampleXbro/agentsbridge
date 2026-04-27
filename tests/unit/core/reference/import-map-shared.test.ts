import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addDirectoryMapping,
  addScopedAgentsMappings,
  addSimpleFileMapping,
  addSkillLikeMapping,
  listFiles,
  rel,
} from '../../../../src/core/reference/import-map-shared.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'am-import-map-shared-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe('import-map-shared > rel', () => {
  it('returns the POSIX-form relative path between projectRoot and an absolute path', () => {
    const abs = join(workdir, 'sub', 'file.md');
    expect(rel(workdir, abs)).toBe('sub/file.md');
  });
});

describe('import-map-shared > listFiles', () => {
  it('returns [] for a non-existent directory (readDirRecursive ENOENT path)', async () => {
    const files = await listFiles(workdir, '.does-not-exist');
    expect(files).toEqual([]);
  });

  it('returns [] for a path that is a file rather than a directory (ENOTDIR)', async () => {
    writeFileSync(join(workdir, 'plain.txt'), 'hi');
    const files = await listFiles(workdir, 'plain.txt');
    expect(files).toEqual([]);
  });

  it('lists files recursively when the directory exists', async () => {
    mkdirSync(join(workdir, 'a', 'b'), { recursive: true });
    writeFileSync(join(workdir, 'a', 'one.md'), '1');
    writeFileSync(join(workdir, 'a', 'b', 'two.md'), '2');
    const files = await listFiles(workdir, 'a');
    expect(files.sort()).toEqual([join(workdir, 'a', 'b', 'two.md'), join(workdir, 'a', 'one.md')]);
  });
});

describe('import-map-shared > addDirectoryMapping', () => {
  it('records both the bare and trailing-slash variants', () => {
    const refs = new Map<string, string>();
    addDirectoryMapping(refs, '.cursor/skills/foo', '.agentsmesh/skills/foo');
    expect(refs.get('.cursor/skills/foo')).toBe('.agentsmesh/skills/foo');
    expect(refs.get('.cursor/skills/foo/')).toBe('.agentsmesh/skills/foo/');
  });
});

describe('import-map-shared > addSimpleFileMapping', () => {
  it('strips the extension and remaps under the canonical dir', () => {
    const refs = new Map<string, string>();
    addSimpleFileMapping(refs, '.cursor/rules/sample.mdc', '.agentsmesh/rules', '.mdc');
    expect(refs.get('.cursor/rules/sample.mdc')).toBe('.agentsmesh/rules/sample.md');
  });
});

describe('import-map-shared > addSkillLikeMapping', () => {
  it('ignores entries outside the skills dir', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/rules/sample.md', '.cursor/skills');
    expect(refs.size).toBe(0);
  });

  it('ignores empty rests after the skills prefix', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/skills/', '.cursor/skills');
    expect(refs.size).toBe(0);
  });

  it('maps a top-level `.md` (skill manifest stand-in) to canonical SKILL.md', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/skills/foo.md', '.cursor/skills');
    expect(refs.get('.cursor/skills/foo.md')).toBe('.agentsmesh/skills/foo/SKILL.md');
  });

  it('skips bare top-level SKILL.md (no skill name to derive)', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/skills/SKILL.md', '.cursor/skills');
    expect(refs.size).toBe(0);
  });

  it('maps `<skill>/SKILL.md` to canonical SKILL.md plus the directory mapping', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/skills/myskill/SKILL.md', '.cursor/skills');
    expect(refs.get('.cursor/skills/myskill/SKILL.md')).toBe('.agentsmesh/skills/myskill/SKILL.md');
    expect(refs.get('.cursor/skills/myskill')).toBe('.agentsmesh/skills/myskill');
    expect(refs.get('.cursor/skills/myskill/')).toBe('.agentsmesh/skills/myskill/');
  });

  it('maps a skill supporting file with ancestor directory mappings', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/skills/myskill/refs/api.md', '.cursor/skills');
    expect(refs.get('.cursor/skills/myskill/refs/api.md')).toBe(
      '.agentsmesh/skills/myskill/refs/api.md',
    );
    // Ancestor directory mapping (refs/) up to but not including the skill dir.
    expect(refs.get('.cursor/skills/myskill/refs')).toBe('.agentsmesh/skills/myskill/refs');
  });
});

describe('import-map-shared > addScopedAgentsMappings', () => {
  it('walks an empty projectRoot without errors and records nothing', async () => {
    const refs = new Map<string, string>();
    await addScopedAgentsMappings(refs, workdir);
    expect(refs.size).toBe(0);
  });

  it('returns silently when projectRoot does not exist (walk readdir-catch)', async () => {
    // Non-existent projectRoot exercises the `.catch(() => [])` branch around
    // `readdir` inside the recursive `walk` helper.
    const refs = new Map<string, string>();
    await addScopedAgentsMappings(refs, join(workdir, 'never-created'));
    expect(refs.size).toBe(0);
  });

  it('maps nested AGENTS.md to a canonical rule keyed by its parent path', async () => {
    mkdirSync(join(workdir, 'sub', 'feature'), { recursive: true });
    writeFileSync(join(workdir, 'AGENTS.md'), '# top');
    writeFileSync(join(workdir, 'sub', 'feature', 'AGENTS.md'), '# nested');
    const refs = new Map<string, string>();
    await addScopedAgentsMappings(refs, workdir);
    expect(refs.get('sub/feature/AGENTS.md')).toBe('.agentsmesh/rules/sub-feature.md');
    expect(refs.has('AGENTS.md')).toBe(false);
  });

  it('maps nested AGENTS.override.md to a canonical rule keyed by its parent path', async () => {
    mkdirSync(join(workdir, 'team'), { recursive: true });
    writeFileSync(join(workdir, 'team', 'AGENTS.override.md'), '# override');
    const refs = new Map<string, string>();
    await addScopedAgentsMappings(refs, workdir);
    expect(refs.get('team/AGENTS.override.md')).toBe('.agentsmesh/rules/team.md');
  });

  it('skips directories that match a builtin target root segment', async () => {
    mkdirSync(join(workdir, '.cursor', 'rules'), { recursive: true });
    writeFileSync(join(workdir, '.cursor', 'rules', 'AGENTS.md'), '# inside cursor');
    const refs = new Map<string, string>();
    await addScopedAgentsMappings(refs, workdir);
    expect(refs.size).toBe(0);
  });

  it('skips directories whose path contains a hidden segment', async () => {
    mkdirSync(join(workdir, '.private', 'sub'), { recursive: true });
    writeFileSync(join(workdir, '.private', 'sub', 'AGENTS.md'), '# hidden');
    const refs = new Map<string, string>();
    await addScopedAgentsMappings(refs, workdir);
    expect(refs.size).toBe(0);
  });

  // Skipped on Windows: creating a regular symlink requires admin/dev mode and
  // is not a reliable test environment for the broken-symlink stat-error path.
  it.skipIf(process.platform === 'win32')(
    'tolerates broken symlinks (stat error path)',
    async () => {
      // Create a symlink that points at a non-existent target. The walk uses
      // `stat(...).then(ok, () => false)` so the broken symlink is skipped
      // without throwing — exercising the `() => false` error callback.
      mkdirSync(join(workdir, 'dir'), { recursive: true });
      symlinkSync(join(workdir, 'does-not-exist'), join(workdir, 'dir', 'broken'));
      writeFileSync(join(workdir, 'dir', 'AGENTS.md'), '# real');

      const refs = new Map<string, string>();
      await addScopedAgentsMappings(refs, workdir);
      expect(refs.get('dir/AGENTS.md')).toBe('.agentsmesh/rules/dir.md');
    },
  );

  it.skipIf(process.platform === 'win32')(
    'follows directory symlinks during walk and maps AGENTS.md inside',
    async () => {
      // A symlink that resolves to a real directory must be walked: this hits
      // the `info.isDirectory() === true` arm of `stat(...).then(...)` plus
      // the recursive `walk(relPath)` call (lines 162-163).
      mkdirSync(join(workdir, 'real-dir'), { recursive: true });
      writeFileSync(join(workdir, 'real-dir', 'AGENTS.md'), '# real');
      symlinkSync(join(workdir, 'real-dir'), join(workdir, 'linked-dir'));

      const refs = new Map<string, string>();
      await addScopedAgentsMappings(refs, workdir);
      // Both the original directory and the symlinked one should yield mappings.
      expect(refs.get('real-dir/AGENTS.md')).toBe('.agentsmesh/rules/real-dir.md');
      expect(refs.get('linked-dir/AGENTS.md')).toBe('.agentsmesh/rules/linked-dir.md');
    },
  );
});
