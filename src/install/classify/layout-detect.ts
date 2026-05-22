/**
 * Structural layout detection for install sources.
 *
 * Pure function: reads the filesystem under `contentRoot` and returns a
 * `SourceLayout` describing what's there. No scoring, no thresholds —
 * downstream code (the picker in step 3) converts shape to intent.
 */

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { isBoilerplate } from '../importers/boilerplate-filter.js';
import { detectMarketplaceSubPacks } from './marketplace-manifest.js';
import type {
  CanonicalRoot,
  FlatCollection,
  FlatSourceLayout,
  FileShape,
  RootRule,
  RootSkill,
  SkillPackRoot,
  SourceLayout,
  SubPack,
  ToolNativeManifest,
} from './layout-types.js';

const CANONICAL_MARKERS = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp.json',
  'hooks.yaml',
  'permissions.yaml',
  'ignore',
];

const FLAT_COLLECTION_DIRS: Record<string, FlatCollection['suggestedAs']> = {
  rules: 'rules',
  commands: 'commands',
  agents: 'agents',
  skills: 'skills',
};

const PLUGIN_MANIFESTS = ['.claude-plugin', '.codex-plugin', '.cursor-plugin'];

/**
 * Legacy single-file rule formats: `.cursorrules` (Cursor) and `.windsurfrules`
 * (Windsurf). Ordered by preference: when both exist (e.g. devin.cursorrules),
 * `.cursorrules` wins because Cursor's format is the more widely-cited source.
 */
const ROOT_RULE_FILES = ['.cursorrules', '.windsurfrules'];

const KEBAB_DIR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function dirExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function listDirEntries(
  dir: string,
): Promise<ReadonlyArray<{ name: string; isDir: boolean; isFile: boolean }>> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDir: e.isDirectory(), isFile: e.isFile() }));
  } catch {
    return [];
  }
}

function classifyFileShape(name: string): FileShape | null {
  if (name.endsWith('.instructions.md')) return 'copilot-instructions';
  if (name.endsWith('.md')) return 'md';
  if (name.endsWith('.mdc')) return 'mdc';
  if (name.endsWith('.toml')) return 'toml';
  return null;
}

async function detectCanonical(root: string): Promise<CanonicalRoot | null> {
  const agentsmeshDir = join(root, '.agentsmesh');
  if (!(await dirExists(agentsmeshDir))) return null;
  const entries = await listDirEntries(agentsmeshDir);
  const names = new Set(entries.map((e) => e.name));
  for (const marker of CANONICAL_MARKERS) {
    if (names.has(marker)) return { path: '.agentsmesh' };
  }
  return null;
}

async function detectRootRule(root: string): Promise<RootRule | null> {
  for (const name of ROOT_RULE_FILES) {
    try {
      const s = await stat(join(root, name));
      if (s.isFile()) return { path: name };
    } catch {
      // missing — try next candidate
    }
  }
  return null;
}

async function detectRootSkill(root: string): Promise<RootSkill | null> {
  try {
    const skillMd = await stat(join(root, 'SKILL.md'));
    if (skillMd.isFile()) return { path: 'SKILL.md' };
  } catch {
    // missing or unreadable — fall through
  }
  return null;
}

async function detectSkillPack(root: string): Promise<SkillPackRoot | null> {
  const skillsDir = join(root, 'skills');
  const entries = await listDirEntries(skillsDir);
  for (const ent of entries) {
    if (!ent.isDir || ent.name.startsWith('_') || !KEBAB_DIR.test(ent.name)) continue;
    if (await dirExists(join(skillsDir, ent.name))) {
      try {
        const skillMd = await stat(join(skillsDir, ent.name, 'SKILL.md'));
        if (skillMd.isFile()) return { path: 'skills' };
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function detectFlatCollections(root: string): Promise<FlatCollection[]> {
  const collections: FlatCollection[] = [];
  for (const [dirName, suggestedAs] of Object.entries(FLAT_COLLECTION_DIRS)) {
    const dirPath = join(root, dirName);
    const entries = await listDirEntries(dirPath);
    const shapeHits = new Set<FileShape>();
    for (const ent of entries) {
      if (!ent.isFile) continue;
      if (isBoilerplate(ent.name)) continue;
      const shape = classifyFileShape(ent.name);
      if (shape) shapeHits.add(shape);
    }
    for (const shape of shapeHits) {
      collections.push({ path: dirName, suggestedAs, fileShape: shape });
    }
  }
  return collections;
}

async function detectToolNativeManifests(root: string): Promise<ToolNativeManifest[]> {
  const manifests: ToolNativeManifest[] = [];
  for (const name of PLUGIN_MANIFESTS) {
    if (await dirExists(join(root, name))) {
      manifests.push({ path: name });
    }
  }
  return manifests;
}

async function detectFlatLayout(root: string, relPrefix: string): Promise<FlatSourceLayout> {
  const canonical = await detectCanonical(root);
  if (canonical) {
    return {
      canonical,
      skillPack: null,
      rootSkill: null,
      rootRule: null,
      flatCollections: [],
      toolNativeManifests: [],
    };
  }
  const skillPack = await detectSkillPack(root);
  const rootSkill = skillPack ? null : await detectRootSkill(root);
  const flatCollections = await detectFlatCollections(root);
  // rootRule is the lowest-priority root marker: it only fires when no
  // structured content (canonical, skillPack, rootSkill, flatCollections) is
  // present, since those represent richer install intents.
  const rootRule =
    skillPack || rootSkill || flatCollections.length > 0 ? null : await detectRootRule(root);
  const toolNativeManifests = await detectToolNativeManifests(root);
  return {
    canonical,
    skillPack: skillPack ? { path: relPrefix ? `${relPrefix}/skills` : 'skills' } : null,
    rootSkill: rootSkill ? { path: relPrefix ? `${relPrefix}/SKILL.md` : 'SKILL.md' } : null,
    rootRule: rootRule
      ? { path: relPrefix ? `${relPrefix}/${rootRule.path}` : rootRule.path }
      : null,
    flatCollections: flatCollections.map((c) => ({
      ...c,
      path: relPrefix ? `${relPrefix}/${c.path}` : c.path,
    })),
    toolNativeManifests: toolNativeManifests.map((m) => ({
      path: relPrefix ? `${relPrefix}/${m.path}` : m.path,
    })),
  };
}

function hasContent(layout: FlatSourceLayout): boolean {
  return (
    layout.canonical !== null ||
    layout.skillPack !== null ||
    layout.rootSkill !== null ||
    layout.rootRule !== null ||
    layout.flatCollections.length > 0
  );
}

async function collectSubPackCandidates(dirPath: string, relPrefix: string): Promise<SubPack[]> {
  const entries = await listDirEntries(dirPath);
  const packs: SubPack[] = [];
  for (const ent of entries) {
    if (!ent.isDir || ent.name.startsWith('.')) continue;
    const childPath = join(dirPath, ent.name);
    const childRel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
    const layout = await detectFlatLayout(childPath, childRel);
    if (hasContent(layout)) packs.push({ path: childRel, layout });
  }
  return packs;
}

async function detectSubPacks(root: string, rootLayout: FlatSourceLayout): Promise<SubPack[]> {
  if (hasContent(rootLayout)) return [];
  const manifestPacks = await detectMarketplaceSubPacks(root, detectFlatLayout, hasContent);
  if (manifestPacks && manifestPacks.length > 0) return manifestPacks;
  const directCandidates = await collectSubPackCandidates(root, '');
  if (directCandidates.length >= 2) return directCandidates;
  const entries = await listDirEntries(root);
  for (const ent of entries) {
    if (!ent.isDir || ent.name.startsWith('.')) continue;
    const nested = await collectSubPackCandidates(join(root, ent.name), ent.name);
    if (nested.length >= 2) return nested;
  }
  return [];
}

export async function detectLayout(contentRoot: string): Promise<SourceLayout> {
  const rootLayout = await detectFlatLayout(contentRoot, '');
  if (rootLayout.canonical) {
    return { ...rootLayout, subPacks: [] };
  }
  const subPacks = await detectSubPacks(contentRoot, rootLayout);
  return { ...rootLayout, subPacks };
}
