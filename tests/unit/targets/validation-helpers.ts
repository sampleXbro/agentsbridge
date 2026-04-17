/**
 * Shared validation helpers for target generator tests.
 * These helpers validate generated file structures and content formats.
 */

import { expect } from 'vitest';
import type { GeneratedFile } from '../../../src/core/types.js';

/**
 * Validates that a JSON file is well-formed and matches expected structure
 */
export function validateJsonStructure(
  content: string,
  expectedKeys?: string[],
): Record<string, unknown> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON: ${message}`, { cause: error });
  }

  if (expectedKeys) {
    for (const key of expectedKeys) {
      expect(parsed).toHaveProperty(key);
    }
  }

  return parsed;
}

/**
 * Validates Markdown frontmatter structure
 */
export function validateFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null;
  body: string;
} {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(content);

  if (!frontmatterMatch) {
    return { frontmatter: null, body: content };
  }

  const [, yamlContent, body] = frontmatterMatch;

  // Basic YAML parsing validation (not full YAML parser)
  const frontmatter: Record<string, unknown> = {};
  const lines = yamlContent!.split('\n');

  for (const line of lines) {
    const match = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (match) {
      const [, key, value] = match;
      frontmatter[key!] = value;
    }
  }

  return { frontmatter, body: body! };
}

/**
 * Validates that generated files have correct paths for a target
 */
export function validateFilePaths(files: GeneratedFile[], expectedPaths: string[]): void {
  const actualPaths = files.map((f) => f.path).sort();
  const sortedExpected = [...expectedPaths].sort();

  expect(actualPaths).toEqual(sortedExpected);
}

/**
 * Validates that a file exists in the generated output
 * Supports string matching for partial paths
 */
export function findGeneratedFile(
  files: GeneratedFile[],
  pathOrMatcher: string | { stringContaining: string } | { stringMatching: RegExp },
): GeneratedFile {
  let file: GeneratedFile | undefined;

  if (typeof pathOrMatcher === 'string') {
    file = files.find((f) => f.path === pathOrMatcher);
  } else if ('stringContaining' in pathOrMatcher) {
    file = files.find((f) => f.path.includes(pathOrMatcher.stringContaining));
  } else if ('stringMatching' in pathOrMatcher) {
    file = files.find((f) => pathOrMatcher.stringMatching.test(f.path));
  }

  if (!file) {
    const pathDesc =
      typeof pathOrMatcher === 'string'
        ? pathOrMatcher
        : 'stringContaining' in pathOrMatcher
          ? `containing "${pathOrMatcher.stringContaining}"`
          : `matching ${pathOrMatcher.stringMatching}`;
    throw new Error(
      `File not found: ${pathDesc}. Available: ${files.map((f) => f.path).join(', ')}`,
    );
  }
  return file;
}

/**
 * Validates MCP JSON structure
 */
export function validateMcpJson(content: string): void {
  const parsed = validateJsonStructure(content, ['mcpServers']);
  const servers = parsed.mcpServers as Record<string, unknown>;

  for (const [, config] of Object.entries(servers)) {
    expect(config).toHaveProperty('command');
    expect(typeof (config as Record<string, unknown>).command).toBe('string');
  }
}

/**
 * Validates hooks JSON structure (Cursor/Copilot style)
 */
export function validateHooksJson(content: string): void {
  const parsed = validateJsonStructure(content, ['version', 'hooks']);
  expect(parsed.version).toBe(1);
  expect(typeof parsed.hooks).toBe('object');
}

/**
 * Validates settings JSON structure (Claude Code style)
 */
export function validateSettingsJson(content: string): void {
  const parsed = validateJsonStructure(content);
  // Settings can have various keys, just validate it's valid JSON
  expect(typeof parsed).toBe('object');
}

/**
 * Validates that Markdown content has expected sections
 */
export function validateMarkdownSections(content: string, expectedHeadings: string[]): void {
  for (const heading of expectedHeadings) {
    const regex = new RegExp(`^#{1,6}\\s+${heading}`, 'm');
    expect(content).toMatch(regex);
  }
}

/**
 * Validates SKILL.md structure
 */
export function validateSkillMd(content: string): void {
  // Skills should have either frontmatter or be plain markdown
  const { body } = validateFrontmatter(content);
  expect(body.trim().length).toBeGreaterThan(0);
}

/**
 * Validates agent file structure (with frontmatter)
 */
export function validateAgentMd(content: string): void {
  const { frontmatter, body } = validateFrontmatter(content);

  if (frontmatter) {
    expect(frontmatter).toHaveProperty('name');
  }

  expect(body.trim().length).toBeGreaterThan(0);
}

/**
 * Validates rule file structure (.mdc or .md)
 */
export function validateRuleMd(content: string, expectFrontmatter: boolean): void {
  const { frontmatter, body } = validateFrontmatter(content);

  if (expectFrontmatter) {
    expect(frontmatter).not.toBeNull();
  }

  expect(body.trim().length).toBeGreaterThan(0);
}

/**
 * Validates that content does not contain canonical path references
 */
export function validateNoCanonicalPaths(content: string): void {
  // Should not contain .agentsmesh/ references in generated output
  const hasCanonicalPath = /\.agentsmesh\//.test(content);
  expect(hasCanonicalPath).toBe(false);
}

/**
 * Validates file count matches expected
 */
export function validateFileCount(files: GeneratedFile[], expected: number): void {
  expect(files).toHaveLength(expected);
}
