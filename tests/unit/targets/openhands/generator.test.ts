import { describe, it, expect } from 'vitest';
import type { CanonicalFiles, CanonicalRule } from '../../../../src/core/types.js';
import { generateRules } from '../../../../src/targets/openhands/generator.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

function makeRule(slug: string, overrides: Partial<CanonicalRule> = {}): CanonicalRule {
  return {
    source: `.agentsmesh/rules/${slug}.md`,
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: `# ${slug}`,
    ...overrides,
  };
}

describe('generateRules (openhands)', () => {
  it('returns empty array when no rules', () => {
    expect(generateRules(makeCanonical())).toHaveLength(0);
  });

  it('writes the root rule to AGENTS.md with NO frontmatter', () => {
    const outputs = generateRules(
      makeCanonical({
        rules: [makeRule('_root', { root: true, description: 'Standards', body: '# Standards' })],
      }),
    );
    expect(outputs).toEqual([{ path: 'AGENTS.md', content: '# Standards' }]);
    expect(outputs[0]!.content.startsWith('---')).toBe(false);
  });

  it('drops an empty root rule body instead of writing a blank AGENTS.md', () => {
    const outputs = generateRules(
      makeCanonical({ rules: [makeRule('_root', { root: true, body: '   ' })] }),
    );
    expect(outputs.map((o) => o.path)).toEqual([]);
  });

  it('writes a path-scoped rule to .agents/skills/<slug>.md with the required paths key', () => {
    const outputs = generateRules(
      makeCanonical({
        rules: [
          makeRule('typescript', {
            description: 'TypeScript specific rules',
            globs: ['src/**/*.ts'],
            body: '# TypeScript',
          }),
        ],
      }),
    );
    expect(outputs).toEqual([
      {
        path: '.agents/skills/typescript.md',
        content:
          '---\ndescription: TypeScript specific rules\npaths:\n  - src/**/*.ts\n---\n\n# TypeScript',
      },
    ]);
  });

  it('omits paths for a rule with no globs so the file is always injected', () => {
    const outputs = generateRules(makeCanonical({ rules: [makeRule('style')] }));
    expect(outputs[0]!.content).toBe('# style');
  });

  it('skips rules targeted at other tools', () => {
    const outputs = generateRules(
      makeCanonical({ rules: [makeRule('other', { targets: ['claude-code'] })] }),
    );
    expect(outputs).toHaveLength(0);
  });

  it('keeps rules explicitly targeted at openhands', () => {
    const outputs = generateRules(
      makeCanonical({ rules: [makeRule('mine', { targets: ['openhands'] })] }),
    );
    expect(outputs.map((o) => o.path)).toEqual(['.agents/skills/mine.md']);
  });
});
