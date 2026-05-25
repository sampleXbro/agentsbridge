import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { detectLayout } from '../../../../src/install/classify/layout-detect.js';

let contentRoot = '';

beforeEach(() => {
  contentRoot = join(tmpdir(), `am-layout-${randomBytes(8).toString('hex')}`);
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

describe('detectLayout', () => {
  describe('canonical-agentsmesh', () => {
    it('detects .agentsmesh/ with rules/ as canonical', async () => {
      mkdirSync(join(contentRoot, '.agentsmesh', 'rules'), { recursive: true });
      writeFile('.agentsmesh/rules/_root.md', '---\nroot: true\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.canonical).toEqual({ path: '.agentsmesh' });
    });

    it('canonical takes precedence — skill pack signals ignored', async () => {
      mkdirSync(join(contentRoot, '.agentsmesh', 'rules'), { recursive: true });
      writeFile('.agentsmesh/rules/_root.md', '---\nroot: true\n---\n');
      writeFile('skills/tdd/SKILL.md', '---\nname: tdd\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.canonical).not.toBeNull();
      expect(layout.skillPack).toBeNull();
    });
  });

  describe('anthropic-style skill pack (anthropics/skills model)', () => {
    it('detects skills/<kebab>/SKILL.md as skillPack', async () => {
      writeFile('skills/interview-me/SKILL.md', '---\nname: interview-me\ndescription: x\n---\n');
      writeFile('skills/code-review/SKILL.md', '---\nname: code-review\n---\n');
      writeFile('agents/code-reviewer.md', '---\ndescription: Reviewer\n---\n');
      writeFile('spec/some-spec.md', 'spec content');
      writeFile('template/some-template.md', 'template content');
      const layout = await detectLayout(contentRoot);
      expect(layout.skillPack).toEqual({ path: 'skills' });
    });

    it('siblings like spec/ and template/ do NOT preempt skill pack detection', async () => {
      writeFile('skills/tdd/SKILL.md', '---\nname: tdd\n---\n');
      writeFile('spec/some-spec.md', 'spec content');
      const layout = await detectLayout(contentRoot);
      expect(layout.skillPack).not.toBeNull();
    });
  });

  describe('superpowers-style with plugin manifests (obra/superpowers model)', () => {
    it('plugin manifests land in toolNativeManifests, skillPack still detected', async () => {
      writeFile('skills/tdd/SKILL.md', '---\nname: tdd\n---\n');
      writeFile('skills/debug/SKILL.md', '---\nname: debug\n---\n');
      mkdirSync(join(contentRoot, '.claude-plugin'), { recursive: true });
      writeFile('.claude-plugin/manifest.json', '{}');
      mkdirSync(join(contentRoot, '.codex-plugin'), { recursive: true });
      writeFile('.codex-plugin/manifest.json', '{}');
      const layout = await detectLayout(contentRoot);
      expect(layout.skillPack).toEqual({ path: 'skills' });
      expect(layout.toolNativeManifests).toEqual(
        expect.arrayContaining([{ path: '.claude-plugin' }, { path: '.codex-plugin' }]),
      );
    });

    it('toolNativeManifests never preempt content discovery', async () => {
      writeFile('skills/tdd/SKILL.md', '---\nname: tdd\n---\n');
      mkdirSync(join(contentRoot, '.claude-plugin'), { recursive: true });
      const layout = await detectLayout(contentRoot);
      expect(layout.skillPack).not.toBeNull();
    });
  });

  describe('tool-native-only (no installable content)', () => {
    it('detects manifests but no installable content', async () => {
      mkdirSync(join(contentRoot, '.claude-plugin'), { recursive: true });
      writeFile('.claude-plugin/manifest.json', '{}');
      const layout = await detectLayout(contentRoot);
      expect(layout.canonical).toBeNull();
      expect(layout.skillPack).toBeNull();
      expect(layout.flatCollections).toHaveLength(0);
      expect(layout.toolNativeManifests).toHaveLength(1);
      expect(layout.subPacks).toHaveLength(0);
    });
  });

  describe('flat collections', () => {
    it('detects rules/ with .md files', async () => {
      writeFile('rules/style.md', '---\ndescription: Style\n---\n');
      writeFile('rules/naming.md', '---\ndescription: Naming\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.flatCollections).toContainEqual({
        path: 'rules',
        suggestedAs: 'rules',
        fileShape: 'md',
      });
    });

    it('detects commands/ with .md files', async () => {
      writeFile('commands/build.md', '---\ndescription: Build\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.flatCollections).toContainEqual({
        path: 'commands',
        suggestedAs: 'commands',
        fileShape: 'md',
      });
    });

    it('detects agents/ with .md files', async () => {
      writeFile('agents/reviewer.md', '---\ndescription: Reviewer\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.flatCollections).toContainEqual({
        path: 'agents',
        suggestedAs: 'agents',
        fileShape: 'md',
      });
    });

    it('splits mixed extensions into separate collections', async () => {
      writeFile('rules/style.md', '---\ndescription: Style\n---\n');
      writeFile('rules/cursor-rule.mdc', '---\nalwaysApply: true\n---\n');
      const layout = await detectLayout(contentRoot);
      const ruleCollections = layout.flatCollections.filter((c) => c.path === 'rules');
      expect(ruleCollections).toHaveLength(2);
      expect(ruleCollections.map((c) => c.fileShape).sort()).toEqual(['md', 'mdc']);
    });

    it('detects .mdc files as mdc shape', async () => {
      writeFile('rules/general.mdc', '---\nalwaysApply: true\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.flatCollections).toContainEqual({
        path: 'rules',
        suggestedAs: 'rules',
        fileShape: 'mdc',
      });
    });

    it('ignores boilerplate files (README.md, LICENSE.md)', async () => {
      writeFile('rules/README.md', '# Rules');
      writeFile('rules/LICENSE.md', 'MIT');
      const layout = await detectLayout(contentRoot);
      const ruleCollections = layout.flatCollections.filter((c) => c.path === 'rules');
      expect(ruleCollections).toHaveLength(0);
    });
  });

  describe('marketplace detection', () => {
    it('detects marketplace when ≥2 subdirs have non-empty layouts and root is empty', async () => {
      writeFile('plugins/canvas-apps/skills/draw/SKILL.md', '---\nname: draw\n---\n');
      writeFile('plugins/code-apps/agents/reviewer.md', '---\ndescription: r\n---\n');
      writeFile('plugins/power-pages/skills/page/SKILL.md', '---\nname: page\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.subPacks.length).toBeGreaterThanOrEqual(2);
      expect(layout.canonical).toBeNull();
      expect(layout.skillPack).toBeNull();
    });

    it('is dir-name-agnostic (categories/ works like plugins/)', async () => {
      writeFile('categories/01-core/commands/build.md', '---\ndescription: Build\n---\n');
      writeFile('categories/02-utils/commands/lint.md', '---\ndescription: Lint\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.subPacks.length).toBeGreaterThanOrEqual(2);
    });

    it('is NOT a marketplace when root has its own content', async () => {
      writeFile('skills/tdd/SKILL.md', '---\nname: tdd\n---\n');
      writeFile('plugins/canvas-apps/skills/draw/SKILL.md', '---\nname: draw\n---\n');
      writeFile('plugins/code-apps/agents/reviewer.md', '---\ndescription: r\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.subPacks).toHaveLength(0);
      expect(layout.skillPack).not.toBeNull();
    });

    it('is NOT a marketplace with only one non-empty subdir', async () => {
      writeFile('plugins/canvas-apps/skills/draw/SKILL.md', '---\nname: draw\n---\n');
      writeFile('plugins/empty-apps/README.md', '# Empty');
      const layout = await detectLayout(contentRoot);
      expect(layout.subPacks).toHaveLength(0);
    });

    it('sub-packs have FlatSourceLayout (no nested subPacks)', async () => {
      writeFile('plugins/a/skills/x/SKILL.md', '---\nname: x\n---\n');
      writeFile('plugins/b/commands/y.md', '---\ndescription: y\n---\n');
      const layout = await detectLayout(contentRoot);
      for (const sp of layout.subPacks) {
        expect(sp.layout).not.toHaveProperty('subPacks');
      }
    });
  });

  describe('root-level SKILL.md (single-skill repos like blader/humanizer)', () => {
    it('detects <root>/SKILL.md as rootSkill', async () => {
      writeFile('SKILL.md', '---\nname: humanizer\ndescription: x\n---\nbody');
      writeFile('README.md', '# Humanizer');
      const layout = await detectLayout(contentRoot);
      expect(layout.rootSkill).toEqual({ path: 'SKILL.md' });
      expect(layout.skillPack).toBeNull();
    });

    it('skillPack precedence — does NOT set rootSkill when skills/<name>/SKILL.md exists', async () => {
      writeFile('SKILL.md', '---\nname: x\n---\n');
      writeFile('skills/tdd/SKILL.md', '---\nname: tdd\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.skillPack).not.toBeNull();
      expect(layout.rootSkill).toBeNull();
    });

    it('canonical precedence — does NOT set rootSkill when .agentsmesh/ exists', async () => {
      mkdirSync(join(contentRoot, '.agentsmesh', 'rules'), { recursive: true });
      writeFile('.agentsmesh/rules/_root.md', '---\nroot: true\n---\n');
      writeFile('SKILL.md', '---\nname: x\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.canonical).not.toBeNull();
      expect(layout.rootSkill).toBeNull();
    });

    it('no rootSkill when SKILL.md is absent', async () => {
      writeFile('README.md', '# x');
      const layout = await detectLayout(contentRoot);
      expect(layout.rootSkill).toBeNull();
    });
  });

  describe('root-level .cursorrules / .windsurfrules (legacy single-file rule)', () => {
    it('detects root .cursorrules as rootRule', async () => {
      writeFile('.cursorrules', 'You are a senior TypeScript developer.');
      const layout = await detectLayout(contentRoot);
      expect(layout.rootRule).toEqual({ path: '.cursorrules' });
    });

    it('detects root .windsurfrules as rootRule', async () => {
      writeFile('.windsurfrules', 'You are a senior TypeScript developer.');
      const layout = await detectLayout(contentRoot);
      expect(layout.rootRule).toEqual({ path: '.windsurfrules' });
    });

    it('prefers .cursorrules over .windsurfrules when both present', async () => {
      writeFile('.cursorrules', 'cursor');
      writeFile('.windsurfrules', 'windsurf');
      const layout = await detectLayout(contentRoot);
      expect(layout.rootRule).toEqual({ path: '.cursorrules' });
    });

    it('skillPack precedence — does NOT set rootRule when skills/ exists', async () => {
      writeFile('.cursorrules', 'rules');
      writeFile('skills/tdd/SKILL.md', '---\nname: tdd\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.skillPack).not.toBeNull();
      expect(layout.rootRule).toBeNull();
    });

    it('canonical precedence — does NOT set rootRule when .agentsmesh/ exists', async () => {
      writeFile('.cursorrules', 'rules');
      mkdirSync(join(contentRoot, '.agentsmesh', 'rules'), { recursive: true });
      writeFile('.agentsmesh/rules/_root.md', '---\nroot: true\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.canonical).not.toBeNull();
      expect(layout.rootRule).toBeNull();
    });

    it('no rootRule when neither file exists', async () => {
      writeFile('README.md', '# x');
      const layout = await detectLayout(contentRoot);
      expect(layout.rootRule).toBeNull();
    });
  });

  describe('.claude-plugin/marketplace.json (Claude Code plugin marketplace)', () => {
    it('treats plugins[].source paths as sub-packs', async () => {
      mkdirSync(join(contentRoot, '.claude-plugin'), { recursive: true });
      writeFile(
        '.claude-plugin/marketplace.json',
        JSON.stringify({
          name: 'security-pack',
          plugins: [
            { name: 'android-re', source: './plugins/android-re' },
            { name: 'ios-re', source: './plugins/ios-re' },
          ],
        }),
      );
      writeFile('plugins/android-re/skills/decompile/SKILL.md', '---\nname: decompile\n---\n');
      writeFile('plugins/ios-re/skills/disassemble/SKILL.md', '---\nname: disassemble\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.subPacks).toHaveLength(2);
      expect(layout.subPacks.map((sp) => sp.path).sort()).toEqual([
        'plugins/android-re',
        'plugins/ios-re',
      ]);
    });

    it('ignores plugin entries whose source path does not exist', async () => {
      mkdirSync(join(contentRoot, '.claude-plugin'), { recursive: true });
      writeFile(
        '.claude-plugin/marketplace.json',
        JSON.stringify({
          plugins: [
            { name: 'real', source: './plugins/real' },
            { name: 'phantom', source: './plugins/missing' },
          ],
        }),
      );
      writeFile('plugins/real/skills/x/SKILL.md', '---\nname: x\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.subPacks).toHaveLength(1);
      expect(layout.subPacks[0]!.path).toBe('plugins/real');
    });

    it('discovers plugin sources in non-conventional directories via marketplace.json', async () => {
      // No `plugins/` dir — without manifest parsing, dir-based detection finds nothing.
      mkdirSync(join(contentRoot, '.claude-plugin'), { recursive: true });
      writeFile(
        '.claude-plugin/marketplace.json',
        JSON.stringify({
          plugins: [
            { name: 'first', source: './tools/first' },
            { name: 'second', source: './tools/second' },
          ],
        }),
      );
      writeFile('tools/first/skills/a/SKILL.md', '---\nname: a\n---\n');
      writeFile('tools/second/skills/b/SKILL.md', '---\nname: b\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.subPacks.map((sp) => sp.path).sort()).toEqual(['tools/first', 'tools/second']);
    });

    it('falls back to directory-based sub-pack detection when marketplace.json is missing', async () => {
      mkdirSync(join(contentRoot, '.claude-plugin'), { recursive: true });
      writeFile('plugins/a/skills/x/SKILL.md', '---\nname: x\n---\n');
      writeFile('plugins/b/skills/y/SKILL.md', '---\nname: y\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.subPacks.length).toBeGreaterThanOrEqual(2);
    });

    it('ignores marketplace.json with malformed JSON (no crash)', async () => {
      mkdirSync(join(contentRoot, '.claude-plugin'), { recursive: true });
      writeFile('.claude-plugin/marketplace.json', '{not valid json');
      const layout = await detectLayout(contentRoot);
      // Should fall through to dir-based detection (which finds nothing here).
      expect(layout.subPacks).toHaveLength(0);
      expect(layout.toolNativeManifests).toContainEqual({ path: '.claude-plugin' });
    });
  });

  describe('empty / truly-empty', () => {
    it('returns empty layout for an empty tree', async () => {
      const layout = await detectLayout(contentRoot);
      expect(layout.canonical).toBeNull();
      expect(layout.skillPack).toBeNull();
      expect(layout.flatCollections).toHaveLength(0);
      expect(layout.toolNativeManifests).toHaveLength(0);
      expect(layout.subPacks).toHaveLength(0);
    });

    it('returns empty layout for README-only repo', async () => {
      writeFile('README.md', '# Hello');
      const layout = await detectLayout(contentRoot);
      expect(layout.canonical).toBeNull();
      expect(layout.skillPack).toBeNull();
      expect(layout.flatCollections).toHaveLength(0);
    });
  });

  describe('backcompat: tool-native dirs do NOT appear in flatCollections', () => {
    it('.claude/commands/ is NOT a flatCollection', async () => {
      writeFile('.claude/commands/build.md', '---\ndescription: Build\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.flatCollections).toHaveLength(0);
    });

    it('.cursor/rules/ is NOT a flatCollection', async () => {
      writeFile('.cursor/rules/general.mdc', '---\nalwaysApply: true\n---\n');
      const layout = await detectLayout(contentRoot);
      expect(layout.flatCollections).toHaveLength(0);
    });
  });
});
