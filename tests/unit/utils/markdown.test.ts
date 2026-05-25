import { describe, it, expect, vi } from 'vitest';
import {
  parseFrontmatter,
  parseFrontmatterForPath,
  serializeFrontmatter,
  tryParseFrontmatter,
} from '../../../src/utils/text/markdown.js';

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

describe('tryParseFrontmatter', () => {
  it('returns ok=true with parsed content on valid frontmatter', () => {
    const result = tryParseFrontmatter('---\ndescription: ok\n---\nbody', '/x.md');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.frontmatter.description).toBe('ok');
      expect(result.value.body).toBe('body');
    }
  });

  it('returns ok=true with empty frontmatter when content has none', () => {
    const result = tryParseFrontmatter('# Just body', '/x.md');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.frontmatter).toEqual({});
    }
  });

  it('returns ok=false with the underlying error on malformed YAML', () => {
    // Mirrors qdhenry/Claude-Command-Suite: multi-bracket sequence on one line.
    const bad = '---\nargument-hint: [path/to/video.mp4] [interval] [output-dir]\n---\nbody';
    const result = tryParseFrontmatter(bad, '/cmd/x.md');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      // The path is folded into the message for parity with parseFrontmatterForPath.
      expect(result.error.message).toContain('/cmd/x.md');
      // Body fallback skips the broken frontmatter block.
      expect(result.bodyFallback).toBe('body');
    }
  });
});

// Mirrors the qdhenry/Claude-Command-Suite breakage: multi-bracket sequence
// trips a YAML flow-seq-start error after the first `[foo]` parses.
const BAD_FRONTMATTER =
  '---\nargument-hint: [path/to/video.mp4] [interval] [output-dir]\n---\nbody';

describe('parseFrontmatterForPath lenient mode', () => {
  it('throws when no onError callback is provided (strict default)', () => {
    expect(() => parseFrontmatterForPath(BAD_FRONTMATTER, '/strict.md')).toThrow(
      /Failed to parse frontmatter in \/strict\.md/,
    );
  });

  it('invokes onError and returns empty frontmatter when callback is provided', () => {
    const onError = vi.fn();
    const result = parseFrontmatterForPath(BAD_FRONTMATTER, '/lenient.md', onError);
    expect(onError).toHaveBeenCalledOnce();
    const [err, path] = onError.mock.calls[0] as [Error, string];
    expect(err).toBeInstanceOf(Error);
    expect(path).toBe('/lenient.md');
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('body');
  });

  it('does not invoke onError on successful parse', () => {
    const onError = vi.fn();
    parseFrontmatterForPath('---\nx: 1\n---\nbody', '/ok.md', onError);
    expect(onError).not.toHaveBeenCalled();
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
