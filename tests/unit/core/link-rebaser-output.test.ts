import { describe, expect, it } from 'vitest';
import { formatLinkPathForDestination } from '../../../src/core/reference/link-rebaser-output.js';

describe('formatLinkPathForDestination', () => {
  it('uses paths relative to the destination file directory under the project root', () => {
    const root = '/proj';
    const dest = '/proj/.claude/CLAUDE.md';
    const target = '/proj/.claude/commands/review.md';
    expect(formatLinkPathForDestination(root, dest, target, false)).toBe('commands/review.md');
  });

  it('uses parent segments when the target lives outside the destination directory', () => {
    const root = '/proj';
    const dest = '/proj/.claude/commands/review.md';
    const target = '/proj/.claude/skills/api-gen/SKILL.md';
    expect(formatLinkPathForDestination(root, dest, target, false)).toBe(
      '../skills/api-gen/SKILL.md',
    );
  });

  it('falls back to project-root-relative when the destination lies outside the project', () => {
    const root = '/proj';
    const dest = '/other/notes.md';
    const target = '/proj/.claude/commands/review.md';
    expect(formatLinkPathForDestination(root, dest, target, false)).toBe(
      '.claude/commands/review.md',
    );
  });

  it('appends a trailing slash for directory targets when keepSlash is true', () => {
    const root = '/proj';
    const dest = '/proj/.claude/CLAUDE.md';
    const target = '/proj/.claude/skills/qa';
    expect(formatLinkPathForDestination(root, dest, target, true)).toBe('skills/qa/');
  });

  it('computes correct relative link in global mode when dest and target share a common prefix', () => {
    // windsurf global: dest at .codeium/windsurf/memories/, target under .codeium/windsurf/skills/
    const root = '/proj';
    const dest = '/proj/.codeium/windsurf/memories/global_rules.md';
    const target = '/proj/.codeium/windsurf/skills/api-gen/SKILL.md';
    expect(formatLinkPathForDestination(root, dest, target, false)).toBe(
      '../skills/api-gen/SKILL.md',
    );
  });

  it('computes correct relative link in global mode for sibling directories', () => {
    // cursor global: dest at .cursor/rules/, target under .cursor/skills/
    const root = '/proj';
    const dest = '/proj/.cursor/rules/general.mdc';
    const target = '/proj/.cursor/skills/api-gen/SKILL.md';
    expect(formatLinkPathForDestination(root, dest, target, false)).toBe(
      '../skills/api-gen/SKILL.md',
    );
  });

  it('computes correct relative link in global mode for same-level reference', () => {
    // copilot global: dest at .copilot/, target under .copilot/skills/
    const root = '/proj';
    const dest = '/proj/.copilot/copilot-instructions.md';
    const target = '/proj/.copilot/skills/api-gen/SKILL.md';
    expect(formatLinkPathForDestination(root, dest, target, false)).toBe('skills/api-gen/SKILL.md');
  });

  it('produces shortest relative link for deeply nested source and target', () => {
    // skill file referencing another skill file
    const root = '/proj';
    const dest = '/proj/.claude/skills/api-gen/references/checklist.md';
    const target = '/proj/.claude/skills/api-gen/SKILL.md';
    expect(formatLinkPathForDestination(root, dest, target, false)).toBe('../SKILL.md');
  });
});
