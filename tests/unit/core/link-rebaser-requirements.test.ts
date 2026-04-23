import { describe, expect, it } from 'vitest';
import { rewriteFileLinks } from '../../../src/core/reference/link-rebaser.js';

describe('rewriteFileLinks requirements alignment', () => {
  it('uses relative paths for file links into `.agentsmesh`', () => {
    const rewritten = rewriteFileLinks({
      content: 'Delegate to `.agentsmesh/agents/reviewer.md`.',
      projectRoot: '/proj',
      sourceFile: '/proj/.agents/rules/general.md',
      destinationFile: '/proj/.agents/rules/general.md',
      translatePath: (absolutePath) => absolutePath,
      pathExists: (absolutePath) => absolutePath === '/proj/.agentsmesh/agents/reviewer.md',
      rewriteBarePathTokens: true,
    });

    expect(rewritten.content).toBe('Delegate to `.agentsmesh/agents/reviewer.md`.');
    expect(rewritten.missing).toEqual([]);
  });

  it('uses target-root paths for non-markdown folder links sourced from `.agentsmesh`', () => {
    const rewritten = rewriteFileLinks({
      content: 'Use `.agentsmesh/skills/qa/` for shared QA routines.',
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) =>
        absolutePath === '/proj/.agentsmesh/skills/qa' ? '/proj/.claude/skills/qa' : absolutePath,
      pathExists: (absolutePath) => absolutePath === '/proj/.claude/skills/qa',
      pathIsDirectory: (absolutePath) => absolutePath === '/proj/.claude/skills/qa',
      rewriteBarePathTokens: true,
    });

    expect(rewritten.content).toBe('Use `.agentsmesh/skills/qa/` for shared QA routines.');
    expect(rewritten.missing).toEqual([]);
  });

  it('normalizes relative global-mode prose links to project-root standard links', () => {
    const translated: string[] = [];
    const checked: string[] = [];

    const rewritten = rewriteFileLinks({
      content: 'Project docs stay untouched: `../../docs/guide.md`.',
      projectRoot: '/home/user',
      sourceFile: '/home/user/.agentsmesh/rules/_root.md',
      destinationFile: '/home/user/.claude/CLAUDE.md',
      translatePath: (absolutePath) => {
        translated.push(absolutePath);
        return absolutePath;
      },
      pathExists: (absolutePath) => {
        checked.push(absolutePath);
        return absolutePath === '/home/user/docs/guide.md';
      },
      scope: 'global',
    });

    expect(rewritten.content).toBe('Project docs stay untouched: `docs/guide.md`.');
    expect(rewritten.missing).toEqual([]);
    expect(translated).toEqual(['/home/user/docs/guide.md']);
    expect(checked).toEqual(['/home/user/docs/guide.md', '/home/user/docs/guide.md']);
  });

  it('still rewrites markdown folder destinations as relative links', () => {
    const rewritten = rewriteFileLinks({
      content: 'Use [references](.agentsmesh/skills/qa/references/).',
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/.claude/skills/qa/SKILL.md',
      translatePath: (absolutePath) =>
        absolutePath === '/proj/.agentsmesh/skills/qa/references'
          ? '/proj/.claude/skills/qa/references'
          : absolutePath,
      pathExists: (absolutePath) => absolutePath === '/proj/.claude/skills/qa/references',
      pathIsDirectory: (absolutePath) => absolutePath === '/proj/.claude/skills/qa/references',
      rewriteBarePathTokens: true,
    });

    expect(rewritten.content).toBe('Use [references](./references/).');
    expect(rewritten.missing).toEqual([]);
  });
});
