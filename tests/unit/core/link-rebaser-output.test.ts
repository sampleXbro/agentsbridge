import { describe, expect, it } from 'vitest';
import {
  formatLinkPathForDestination,
  pickShortestValidatedFormattedLink,
} from '../../../src/core/reference/link-rebaser-output.js';

const EXPLICIT_CURRENT_DIR = { explicitCurrentDirLinks: true };
const LEGACY = { explicitCurrentDirLinks: true, scope: 'global' as const };

describe('formatLinkPathForDestination', () => {
  it('in project scope uses project-root-relative paths for targets outside `.agentsmesh/`', () => {
    const root = '/proj';
    const dest = '/proj/.claude/CLAUDE.md';
    const target = '/proj/.claude/commands/review.md';
    expect(formatLinkPathForDestination(root, dest, target, false, EXPLICIT_CURRENT_DIR)).toBe(
      '.claude/commands/review.md',
    );
  });

  it('in project scope uses project-root-relative paths for sibling tool paths outside `.agentsmesh/`', () => {
    const root = '/proj';
    const dest = '/proj/.claude/commands/review.md';
    const target = '/proj/.claude/skills/api-gen/SKILL.md';
    expect(formatLinkPathForDestination(root, dest, target, false, EXPLICIT_CURRENT_DIR)).toBe(
      '.claude/skills/api-gen/SKILL.md',
    );
  });

  it('falls back to project-root-relative when the destination lies outside the project', () => {
    const root = '/proj';
    const dest = '/other/notes.md';
    const target = '/proj/.claude/commands/review.md';
    expect(formatLinkPathForDestination(root, dest, target, false, EXPLICIT_CURRENT_DIR)).toBe(
      '.claude/commands/review.md',
    );
  });

  it('in project scope uses project-root-relative paths for directory targets outside `.agentsmesh/`', () => {
    const root = '/proj';
    const dest = '/proj/.claude/CLAUDE.md';
    const target = '/proj/.claude/skills/qa';
    expect(formatLinkPathForDestination(root, dest, target, true, EXPLICIT_CURRENT_DIR)).toBe(
      '.claude/skills/qa/',
    );
  });

  it('computes correct relative link in global mode when dest and target share a common prefix', () => {
    // windsurf global: dest at .codeium/windsurf/memories/, target under .codeium/windsurf/skills/
    const root = '/proj';
    const dest = '/proj/.codeium/windsurf/memories/global_rules.md';
    const target = '/proj/.codeium/windsurf/skills/api-gen/SKILL.md';
    expect(formatLinkPathForDestination(root, dest, target, false, LEGACY)).toBe(
      '../skills/api-gen/SKILL.md',
    );
  });

  it('computes correct relative link in global mode for sibling directories', () => {
    // cursor global: dest at .cursor/rules/, target under .cursor/skills/
    const root = '/proj';
    const dest = '/proj/.cursor/rules/general.mdc';
    const target = '/proj/.cursor/skills/api-gen/SKILL.md';
    expect(formatLinkPathForDestination(root, dest, target, false, LEGACY)).toBe(
      '../skills/api-gen/SKILL.md',
    );
  });

  it('computes correct relative link in global mode for same-level reference', () => {
    // copilot global: dest at .copilot/, target under .copilot/skills/
    const root = '/proj';
    const dest = '/proj/.copilot/copilot-instructions.md';
    const target = '/proj/.copilot/skills/api-gen/SKILL.md';
    expect(formatLinkPathForDestination(root, dest, target, false, LEGACY)).toBe(
      './skills/api-gen/SKILL.md',
    );
  });

  it('in global scope produces shortest relative link for deeply nested source and target', () => {
    const root = '/proj';
    const dest = '/proj/.claude/skills/api-gen/references/checklist.md';
    const target = '/proj/.claude/skills/api-gen/SKILL.md';
    expect(formatLinkPathForDestination(root, dest, target, false, LEGACY)).toBe('../SKILL.md');
  });

  it('prefers ./… over a long ../… chain when both absolute targets exist (global scope)', () => {
    const root = '/proj';
    const dest = '/proj/.gemini/skills/ts-library/SKILL.md';
    const geminiRef = '/proj/.gemini/skills/ts-library/references/project-setup.md';
    const agentsRef = '/proj/.agents/skills/ts-library/references/project-setup.md';
    const pathExists = (p: string): boolean => p === geminiRef || p === agentsRef;
    expect(
      pickShortestValidatedFormattedLink(
        root,
        dest,
        [agentsRef, geminiRef],
        false,
        LEGACY,
        pathExists,
      ),
    ).toBe('./references/project-setup.md');
  });

  it('uses relative file paths when linking from Antigravity `.agents/rules` into `.agentsmesh`', () => {
    const root = '/tmp/proj';
    const dest = '/tmp/proj/.agents/rules/general.md';
    const target = '/tmp/proj/.agentsmesh/agents/code-reviewer.md';
    expect(formatLinkPathForDestination(root, dest, target, false, EXPLICIT_CURRENT_DIR)).toBe(
      '../../.agentsmesh/agents/code-reviewer.md',
    );
  });

  it('in project scope uses mesh-root paths for a directory under `.agentsmesh/`', () => {
    const root = '/proj';
    const dest = '/proj/.claude/skills/foo/SKILL.md';
    const target = '/proj/.agentsmesh/skills/bar';
    expect(formatLinkPathForDestination(root, dest, target, true, EXPLICIT_CURRENT_DIR)).toBe(
      'skills/bar/',
    );
  });
});
