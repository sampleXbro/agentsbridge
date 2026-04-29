import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addScopedAgentsMappings,
  addSkillLikeMapping,
} from '../../../src/core/reference/import-map-shared.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'amesh-deep-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe('addSkillLikeMapping — branch coverage', () => {
  it('skips top-level non-.md file (extension guard)', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/skills/foo.txt', '.cursor/skills');
    expect(refs.size).toBe(0);
  });

  it('skips deep entry whose dirName is empty (split yields empty first segment)', () => {
    // relPath = '.cursor/skills//foo.md' → rest = '/foo.md' → split(/) → ['', 'foo.md']
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/skills//foo.md', '.cursor/skills');
    expect(refs.size).toBe(0);
  });

  it('skips deep entry whose filePath is empty (split yields trailing empty)', () => {
    // relPath = '.cursor/skills/myskill/' → rest = 'myskill/' → split → ['myskill', '']
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/skills/myskill/', '.cursor/skills');
    expect(refs.size).toBe(0);
  });

  it('maps codex am-command- skill folder to canonical commands/<name>.md', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.codex/skills/am-command-review/SKILL.md', '.codex/skills');
    expect(refs.get('.codex/skills/am-command-review/SKILL.md')).toBe(
      '.agentsmesh/commands/review.md',
    );
  });

  it('maps legacy ab-command- skill folder to canonical commands/<name>.md', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.codex/skills/ab-command-review/SKILL.md', '.codex/skills');
    expect(refs.get('.codex/skills/ab-command-review/SKILL.md')).toBe(
      '.agentsmesh/commands/review.md',
    );
  });

  it('maps projected am-agent- skill folder to canonical agents/<name>.md', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/skills/am-agent-reviewer/SKILL.md', '.cursor/skills');
    expect(refs.get('.cursor/skills/am-agent-reviewer/SKILL.md')).toBe(
      '.agentsmesh/agents/reviewer.md',
    );
  });

  it('maps legacy ab-agent- skill folder to canonical agents/<name>.md', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/skills/ab-agent-reviewer/SKILL.md', '.cursor/skills');
    expect(refs.get('.cursor/skills/ab-agent-reviewer/SKILL.md')).toBe(
      '.agentsmesh/agents/reviewer.md',
    );
  });

  it('does NOT map command-prefixed skill when filePath is not SKILL.md (falls through to plain skill mapping)', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.codex/skills/am-command-review/refs/api.md', '.codex/skills');
    // Falls through to canonical skill path layout (the prefix is treated as a regular skill name).
    expect(refs.get('.codex/skills/am-command-review/refs/api.md')).toBe(
      '.agentsmesh/skills/am-command-review/refs/api.md',
    );
  });

  it('does NOT map agent-prefixed skill when filePath is not SKILL.md', () => {
    const refs = new Map<string, string>();
    addSkillLikeMapping(refs, '.cursor/skills/am-agent-reviewer/refs/api.md', '.cursor/skills');
    expect(refs.get('.cursor/skills/am-agent-reviewer/refs/api.md')).toBe(
      '.agentsmesh/skills/am-agent-reviewer/refs/api.md',
    );
  });
});

describe('addScopedAgentsMappings — additional branch coverage', () => {
  it('records nothing when projectRoot only contains a top-level AGENTS.md (root file is excluded)', async () => {
    writeFileSync(join(workdir, 'AGENTS.md'), '# top');
    const refs = new Map<string, string>();
    await addScopedAgentsMappings(refs, workdir);
    expect(refs.size).toBe(0);
  });

  it('skips AGENTS.override.md at the project root (only nested overrides count)', async () => {
    writeFileSync(join(workdir, 'AGENTS.override.md'), '# override');
    const refs = new Map<string, string>();
    await addScopedAgentsMappings(refs, workdir);
    expect(refs.size).toBe(0);
  });

  it('does not map non-AGENTS files at any depth', async () => {
    mkdirSync(join(workdir, 'src'), { recursive: true });
    writeFileSync(join(workdir, 'src', 'README.md'), 'readme');
    const refs = new Map<string, string>();
    await addScopedAgentsMappings(refs, workdir);
    expect(refs.size).toBe(0);
  });

  it('handles deep directory tree with both nested AGENTS.md and AGENTS.override.md', async () => {
    mkdirSync(join(workdir, 'a', 'b'), { recursive: true });
    writeFileSync(join(workdir, 'a', 'AGENTS.md'), '1');
    writeFileSync(join(workdir, 'a', 'b', 'AGENTS.override.md'), '2');
    const refs = new Map<string, string>();
    await addScopedAgentsMappings(refs, workdir);
    expect(refs.get('a/AGENTS.md')).toBe('.agentsmesh/rules/a.md');
    expect(refs.get('a/b/AGENTS.override.md')).toBe('.agentsmesh/rules/a-b.md');
  });
});
