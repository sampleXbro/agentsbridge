import { describe, expect, it } from 'vitest';
import { normalizeMdcToCanonical } from '../../../../src/install/manual/mdc-reader.js';
import { parseFrontmatter } from '../../../../src/utils/text/markdown.js';

describe('normalizeMdcToCanonical', () => {
  it('normalizes cursor alwaysApply: true to root: true', () => {
    const input = '---\nalwaysApply: true\ndescription: Root rule\n---\n\nBody';
    const result = normalizeMdcToCanonical(input);
    const { frontmatter, body } = parseFrontmatter(result);
    expect(frontmatter.root).toBe(true);
    expect(frontmatter.alwaysApply).toBeUndefined();
    expect(frontmatter.description).toBe('Root rule');
    expect(body.trim()).toBe('Body');
  });

  it('derives trigger: glob from cursor alwaysApply: false with globs', () => {
    const input = '---\nalwaysApply: false\nglobs:\n  - "*.ts"\ndescription: Scoped\n---\n\nBody';
    const result = normalizeMdcToCanonical(input);
    const { frontmatter } = parseFrontmatter(result);
    expect(frontmatter.root).toBe(false);
    expect(frontmatter.trigger).toBe('glob');
    expect(frontmatter.globs).toEqual(['*.ts']);
    expect(frontmatter.alwaysApply).toBeUndefined();
  });

  it('derives trigger: model_decision from cursor alwaysApply: false with description only', () => {
    const input = '---\nalwaysApply: false\ndescription: When doing tests\n---\n\nBody';
    const result = normalizeMdcToCanonical(input);
    const { frontmatter } = parseFrontmatter(result);
    expect(frontmatter.trigger).toBe('model_decision');
    expect(frontmatter.root).toBe(false);
  });

  it('derives trigger: manual from cursor alwaysApply: false with no globs or description', () => {
    const input = '---\nalwaysApply: false\n---\n\nBody';
    const result = normalizeMdcToCanonical(input);
    const { frontmatter } = parseFrontmatter(result);
    expect(frontmatter.trigger).toBe('manual');
    expect(frontmatter.root).toBe(false);
  });

  it('maps windsurf trigger: always to trigger: always_on', () => {
    const input = '---\ntrigger: always\ndescription: Windsurf root\n---\n\nBody';
    const result = normalizeMdcToCanonical(input);
    const { frontmatter } = parseFrontmatter(result);
    expect(frontmatter.trigger).toBe('always_on');
  });

  it('converts windsurf singular glob to globs array', () => {
    const input = '---\ntrigger: glob\nglob: "*.ts"\ndescription: Scoped\n---\n\nBody';
    const result = normalizeMdcToCanonical(input);
    const { frontmatter } = parseFrontmatter(result);
    expect(frontmatter.globs).toEqual(['*.ts']);
    expect(frontmatter.glob).toBeUndefined();
  });

  it('preserves windsurf trigger: model_decision unchanged', () => {
    const input = '---\ntrigger: model_decision\ndescription: Agent pick\n---\n\nBody';
    const result = normalizeMdcToCanonical(input);
    const { frontmatter } = parseFrontmatter(result);
    expect(frontmatter.trigger).toBe('model_decision');
  });

  it('passes through content without cursor/windsurf keys unchanged', () => {
    const input = '---\ndescription: Plain\nglobs:\n  - "*.js"\n---\n\nBody';
    const result = normalizeMdcToCanonical(input);
    const { frontmatter, body } = parseFrontmatter(result);
    expect(frontmatter.description).toBe('Plain');
    expect(frontmatter.globs).toEqual(['*.js']);
    expect(body.trim()).toBe('Body');
  });

  it('handles content with no frontmatter', () => {
    const input = 'Just a body with no frontmatter';
    const result = normalizeMdcToCanonical(input);
    expect(result).toBe(input);
  });

  it('preserves body content through normalization', () => {
    const input = '---\nalwaysApply: true\n---\n\n# Title\n\nParagraph with **bold**.\n';
    const result = normalizeMdcToCanonical(input);
    const { body } = parseFrontmatter(result);
    expect(body).toContain('# Title');
    expect(body).toContain('Paragraph with **bold**.');
  });

  it('returns body only when frontmatter contains invalid YAML (globs alias)', () => {
    const input =
      '---\ndescription: TS rules\nglobs: **/*\nalwaysApply: false\n---\n\nBody content';
    const result = normalizeMdcToCanonical(input);
    expect(result).toBe('Body content');
  });

  it('returns body only when frontmatter has YAML flow-sequence error', () => {
    const input = '---\nargument-hint: [path/to/file.ts] [output-dir]\n---\n\nBody';
    const result = normalizeMdcToCanonical(input);
    expect(result).toBe('Body');
  });
});
