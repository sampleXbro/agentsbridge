/**
 * Branch coverage for windsurf workflows generator (generateCommands):
 *  - description present | empty
 *  - allowedTools non-empty | empty
 *  - frontmatter keys.length === 0 fallthrough (body-only output)
 */

import { describe, it, expect } from 'vitest';
import { generateCommands } from '../../../../src/targets/windsurf/generator/workflows.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

function emptyCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

function cmd(
  name: string,
  description: string,
  allowedTools: string[],
  body = 'body',
): CanonicalFiles['commands'][number] {
  return { source: `/${name}.md`, name, description, body, allowedTools };
}

describe('windsurf workflows generateCommands — branch gaps', () => {
  it('emits description-only frontmatter when allowedTools is empty', () => {
    const out = generateCommands({ ...emptyCanonical(), commands: [cmd('a', 'do it', [])] });
    expect(out[0]!.content).toContain('description: do it');
    expect(out[0]!.content).not.toContain('allowedTools');
  });

  it('emits allowedTools-only frontmatter when description is empty after trim', () => {
    const out = generateCommands({
      ...emptyCanonical(),
      commands: [cmd('a', '   ', ['Bash(echo)'])],
    });
    expect(out[0]!.content).toContain('allowedTools');
    expect(out[0]!.content).not.toContain('description:');
  });

  it('emits body-only (no frontmatter) when both description and allowedTools are empty', () => {
    const out = generateCommands({
      ...emptyCanonical(),
      commands: [cmd('plain', '', [])],
    });
    expect(out[0]!.content).toBe('body');
  });

  it('emits both fields when description and allowedTools are populated', () => {
    const out = generateCommands({
      ...emptyCanonical(),
      commands: [cmd('rich', 'desc', ['Bash(*)'])],
    });
    expect(out[0]!.content).toContain('description: desc');
    expect(out[0]!.content).toContain('allowedTools');
  });
});
