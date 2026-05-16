import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { classifySource } from '../../../../src/install/classify/classify-source.js';
import { SKILL_PACK_THRESHOLD } from '../../../../src/install/classify/types.js';

let contentRoot = '';

beforeEach(() => {
  contentRoot = join(tmpdir(), `am-classify-${randomBytes(8).toString('hex')}`);
  mkdirSync(contentRoot, { recursive: true });
});

afterEach(() => {
  rmSync(contentRoot, { recursive: true, force: true });
});

function writeFile(rel: string, content: string): void {
  const abs = join(contentRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
}

function writeSkillPackFixture(): void {
  // 23-skill-style fixture, condensed to minimum needed for signals
  writeFile('skills/interview-me/SKILL.md', '---\nname: interview-me\ndescription: x\n---\nbody');
  writeFile('skills/code-review/SKILL.md', '---\nname: code-review\n---\nbody');
  writeFile('agents/code-reviewer.md', '---\ndescription: Reviewer\n---\nbody');
  writeFile('agents/README.md', '# Personas index');
  writeFile('references/orchestration-patterns.md', 'Reference content');
  writeFile('CLAUDE.md', 'Claude rules');
  writeFile('AGENTS.md', 'Agent rules');
  writeFile('.claude/commands/build.md', 'build command');
}

describe('classifySource', () => {
  describe('canonical-agentsmesh', () => {
    it('returns canonical-agentsmesh when .agentsmesh/ exists at root', async () => {
      mkdirSync(join(contentRoot, '.agentsmesh'), { recursive: true });
      const result = await classifySource(contentRoot);
      expect(result.type).toBe('canonical-agentsmesh');
    });

    it('returns canonical-agentsmesh even when skill-pack signals also match', async () => {
      mkdirSync(join(contentRoot, '.agentsmesh'), { recursive: true });
      writeSkillPackFixture();
      const result = await classifySource(contentRoot);
      expect(result.type).toBe('canonical-agentsmesh');
    });
  });

  describe('anthropic-skill-pack (full fixture)', () => {
    it('returns anthropic-skill-pack on a full agent-skills-style layout', async () => {
      writeSkillPackFixture();
      const result = await classifySource(contentRoot);
      expect(result.type).toBe('anthropic-skill-pack');
    });

    it('reports score >= threshold for a hybrid layout', async () => {
      writeSkillPackFixture();
      const result = await classifySource(contentRoot);
      expect(result.score).toBeGreaterThanOrEqual(SKILL_PACK_THRESHOLD);
    });

    it('exposes matched signals in deterministic order', async () => {
      writeSkillPackFixture();
      const result = await classifySource(contentRoot);
      const matchedNames = result.signals.filter((s) => s.matched).map((s) => s.name);
      // The fixture matches all five signals: agents-dir contributes via the
      // non-boilerplate persona, etc.
      expect(matchedNames).toEqual([
        'skill-pack-layout',
        'agents-dir',
        'references-dir',
        'multi-tool-rules',
        'per-target-commands',
      ]);
    });

    it('returns 5 signals in the result regardless of how many matched', async () => {
      writeFile('skills/foo/SKILL.md', '---\nname: foo\n---\n');
      const result = await classifySource(contentRoot);
      expect(result.signals).toHaveLength(5);
    });
  });

  describe('threshold behavior', () => {
    it('does NOT return anthropic-skill-pack when only PRIMARY matches (score 1.0 < 1.4)', async () => {
      writeFile('skills/foo/SKILL.md', '---\nname: foo\n---\nbody');
      const result = await classifySource(contentRoot);
      expect(result.type).not.toBe('anthropic-skill-pack');
      expect(result.score).toBeLessThan(SKILL_PACK_THRESHOLD);
    });

    it('returns anthropic-skill-pack at primary + one strong secondary (1.0 + 0.4 = 1.4)', async () => {
      writeFile('skills/foo/SKILL.md', '---\nname: foo\n---\nbody');
      writeFile('agents/reviewer.md', '---\ndescription: r\n---\nbody');
      const result = await classifySource(contentRoot);
      expect(result.type).toBe('anthropic-skill-pack');
      expect(result.score).toBeCloseTo(1.4, 5);
    });

    it('does NOT return anthropic-skill-pack at primary + one weak secondary (1.0 + 0.3 = 1.3)', async () => {
      writeFile('skills/foo/SKILL.md', '---\nname: foo\n---\nbody');
      writeFile('references/x.md', 'ref');
      const result = await classifySource(contentRoot);
      expect(result.type).not.toBe('anthropic-skill-pack');
      expect(result.score).toBeCloseTo(1.3, 5);
    });

    it('does NOT return anthropic-skill-pack when PRIMARY misses even with many secondaries', async () => {
      writeFile('agents/reviewer.md', '---\ndescription: r\n---\nbody');
      writeFile('references/x.md', 'ref');
      writeFile('CLAUDE.md', 'r');
      writeFile('AGENTS.md', 'r');
      writeFile('.claude/commands/build.md', 'c');
      const result = await classifySource(contentRoot);
      // PRIMARY missing → cannot be anthropic-skill-pack regardless of total
      expect(result.type).not.toBe('anthropic-skill-pack');
    });
  });

  describe('tool-native and unknown', () => {
    it('returns tool-native when a recognized tool-native dir exists and no skill-pack signals match', async () => {
      writeFile('.claude/commands/build.md', 'cmd');
      const result = await classifySource(contentRoot);
      expect(result.type).toBe('tool-native');
    });

    it('returns tool-native for .cursor/rules layout', async () => {
      writeFile('.cursor/rules/general.mdc', 'rule');
      const result = await classifySource(contentRoot);
      expect(result.type).toBe('tool-native');
    });

    it('returns unknown for an empty tree', async () => {
      const result = await classifySource(contentRoot);
      expect(result.type).toBe('unknown');
    });

    it('returns unknown when only a random README is present', async () => {
      writeFile('README.md', '# Random repo');
      const result = await classifySource(contentRoot);
      expect(result.type).toBe('unknown');
    });
  });

  describe('precedence', () => {
    it('canonical-agentsmesh beats every other classification', async () => {
      mkdirSync(join(contentRoot, '.agentsmesh'), { recursive: true });
      writeFile('.claude/commands/build.md', 'cmd');
      writeSkillPackFixture();
      const result = await classifySource(contentRoot);
      expect(result.type).toBe('canonical-agentsmesh');
    });

    it('anthropic-skill-pack wins over tool-native when both signals exist (hybrid C1)', async () => {
      writeSkillPackFixture();
      const result = await classifySource(contentRoot);
      expect(result.type).toBe('anthropic-skill-pack');
    });
  });
});
