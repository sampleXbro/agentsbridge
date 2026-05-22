/**
 * Structural layout types for install source classification.
 *
 * Replaces the weighted-scoring classifier with pure structural predicates.
 * Every field describes what IS on disk — never a classification verdict.
 * The picker (step 3) converts layout to intent; downstream code dispatches
 * on the layout shape, not a single enum.
 */

import type { ManualInstallAs } from '../manual/manual-install-mode.js';

export interface CanonicalRoot {
  readonly path: string;
}

export interface SkillPackRoot {
  readonly path: string;
}

/**
 * Marker for a repo that IS a single skill: `<root>/SKILL.md` (with optional
 * sibling supporting files). Used for repos like `blader/humanizer` where
 * the entire repository is one Anthropic-style skill. Mutually exclusive
 * with `canonical` and `skillPack` (which take precedence).
 */
export interface RootSkill {
  /** Path of the SKILL.md file relative to the content root (always `SKILL.md`). */
  readonly path: string;
}

/**
 * Marker for a repo with a legacy single-file root rule: `.cursorrules` or
 * `.windsurfrules` at the repository root (e.g. `grapeot/devin.cursorrules`).
 * Mutually exclusive with `canonical`, `skillPack`, `rootSkill` and
 * `flatCollections` (which all take precedence).
 */
export interface RootRule {
  /** Path of the rule file relative to the content root (`.cursorrules` or `.windsurfrules`). */
  readonly path: string;
}

export type FileShape = 'md' | 'mdc' | 'toml' | 'copilot-instructions';

export interface FlatCollection {
  readonly path: string;
  readonly suggestedAs: ManualInstallAs;
  readonly fileShape: FileShape;
  readonly inferredTarget?: string;
}

export interface ToolNativeManifest {
  readonly path: string;
}

export interface FlatSourceLayout {
  readonly canonical: CanonicalRoot | null;
  readonly skillPack: SkillPackRoot | null;
  readonly rootSkill: RootSkill | null;
  readonly rootRule: RootRule | null;
  readonly flatCollections: readonly FlatCollection[];
  readonly toolNativeManifests: readonly ToolNativeManifest[];
}

export interface SubPack {
  readonly path: string;
  readonly layout: FlatSourceLayout;
}

export interface SourceLayout extends FlatSourceLayout {
  readonly subPacks: readonly SubPack[];
}
