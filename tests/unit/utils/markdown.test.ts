import { describe, it, expect } from 'vitest';
import { parseFrontmatter, serializeFrontmatter } from '../../../src/utils/text/markdown.js';

describe('parseFrontmatter', () => {
  it('parses YAML frontmatter + body', () => {
    const input = `---
description: "Test rule"
globs: "src/**/*.ts"
---

# My Rule

Content here.`;
    const result = parseFrontmatter(input);
    expect(result.frontmatter.description).toBe('Test rule');
    expect(result.frontmatter.globs).toBe('src/**/*.ts');
    expect(result.body).toContain('# My Rule');
    expect(result.body).toContain('Content here.');
  });

  it('returns empty frontmatter when none present', () => {
    const result = parseFrontmatter('# Just a title\n\nContent.');
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('# Just a title\n\nContent.');
  });

  it('handles boolean frontmatter values', () => {
    const input = `---
root: true
alwaysApply: false
---
Body`;
    const result = parseFrontmatter(input);
    expect(result.frontmatter.root).toBe(true);
    expect(result.frontmatter.alwaysApply).toBe(false);
  });

  it('handles array frontmatter values', () => {
    const input = `---
targets: ["claude-code", "cursor"]
tools: Read, Grep, Glob
---
Body`;
    const result = parseFrontmatter(input);
    expect(result.frontmatter.targets).toEqual(['claude-code', 'cursor']);
    expect(result.frontmatter.tools).toBe('Read, Grep, Glob');
  });

  it('handles nested YAML (hooks in agents)', () => {
    const input = `---
name: reviewer
hooks:
  PostToolUse:
    - matcher: "Write"
      hooks:
        - type: command
          command: "prettier --write"
---
System prompt here`;
    const result = parseFrontmatter(input);
    expect(result.frontmatter.name).toBe('reviewer');
    expect(result.frontmatter.hooks).toBeDefined();
    expect((result.frontmatter.hooks as Record<string, unknown>).PostToolUse).toBeInstanceOf(Array);
  });

  it('handles empty frontmatter block', () => {
    const input = `---
---
Body`;
    const result = parseFrontmatter(input);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('Body');
  });

  it('returns empty frontmatter when opening --- has no matching close', () => {
    const result = parseFrontmatter('---\nkey: value\n\nNo closing delimiter.');
    expect(result.frontmatter).toEqual({});
    expect(result.body).toContain('No closing delimiter.');
  });

  it('trims leading/trailing whitespace from body', () => {
    const input = `---
x: 1
---

  Body  

`;
    const result = parseFrontmatter(input);
    expect(result.body).toBe('Body');
  });
});

describe('serializeFrontmatter', () => {
  it('serializes frontmatter + body back to string', () => {
    const result = serializeFrontmatter({ description: 'Test', root: true }, '# Content');
    expect(result).toContain('---');
    expect(result).toContain('description');
    expect(result).toContain('Test');
    expect(result).toContain('root: true');
    expect(result).toContain('# Content');
  });

  it('omits frontmatter block when empty', () => {
    const result = serializeFrontmatter({}, '# Content');
    expect(result).toBe('# Content');
    expect(result).not.toContain('---');
  });
});
