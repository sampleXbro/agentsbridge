import { describe, expect, it } from 'vitest';
import { rewriteFileLinks } from '../../../src/core/reference/link-rebaser.js';

const homeRoot = '/home/user';
const sourceFile = '/home/user/.agentsmesh/rules/_root.md';
const destinationFile = '/home/user/.claude/CLAUDE.md';

interface ParityCase {
  name: string;
  content: string;
  sourceRel: string;
  destinationRel: string;
  existingRel: readonly string[];
  directoryRel?: readonly string[];
  translate?: (root: string, absolutePath: string) => string;
}

function runParityCase(root: string, scope: 'project' | 'global', item: ParityCase): string {
  const existing = new Set(item.existingRel.map((rel) => `${root}/${rel}`));
  const directories = new Set(item.directoryRel?.map((rel) => `${root}/${rel}`) ?? []);
  return rewriteFileLinks({
    content: item.content,
    projectRoot: root,
    sourceFile: `${root}/${item.sourceRel}`,
    destinationFile: `${root}/${item.destinationRel}`,
    translatePath: (p) => item.translate?.(root, p) ?? p,
    pathExists: (p) => existing.has(p),
    pathIsDirectory: (p) => directories.has(p),
    explicitCurrentDirLinks: true,
    rewriteBarePathTokens: true,
    scope,
  }).content;
}

describe('link-rebaser global readability contract', () => {
  it('rewrites .agentsmesh prose anchors to colocated target paths in global generated output', () => {
    // Updated contract (2026-05): when a `.agentsmesh/...` token resolves to a
    // generated global counterpart that exists on disk, the rebaser projects
    // to the target-colocated path so the link resolves at the destination
    // location instead of forcing the reader back into `.agentsmesh/`.
    const result = rewriteFileLinks({
      content: 'Use `.agentsmesh/skills/qa/` for shared QA routines.',
      projectRoot: homeRoot,
      sourceFile,
      destinationFile,
      translatePath: (p) =>
        p === '/home/user/.agentsmesh/skills/qa' ? '/home/user/.claude/skills/qa' : p,
      pathExists: (p) => p === '/home/user/.claude/skills/qa',
      pathIsDirectory: (p) => p === '/home/user/.claude/skills/qa',
      rewriteBarePathTokens: true,
      scope: 'global',
    });

    expect(result.content).toBe('Use `.claude/skills/qa/` for shared QA routines.');
    expect(result.missing).toEqual([]);
  });

  it('keeps global markdown destinations clickable and destination-relative', () => {
    const result = rewriteFileLinks({
      content: 'Open [QA](.agentsmesh/skills/qa/).',
      projectRoot: homeRoot,
      sourceFile,
      destinationFile,
      translatePath: (p) =>
        p === '/home/user/.agentsmesh/skills/qa' ? '/home/user/.claude/skills/qa' : p,
      pathExists: (p) => p === '/home/user/.claude/skills/qa',
      pathIsDirectory: (p) => p === '/home/user/.claude/skills/qa',
      rewriteBarePathTokens: true,
      scope: 'global',
    });

    expect(result.content).toBe('Open [QA](./skills/qa/).');
    expect(result.missing).toEqual([]);
  });

  it('normalizes global relative prose links to project-root standard links', () => {
    const result = rewriteFileLinks({
      content: 'Project code stays untouched: `../../src/cli/index.ts`.',
      projectRoot: homeRoot,
      sourceFile,
      destinationFile,
      translatePath: (p) => p,
      pathExists: (p) => p === '/home/user/src/cli/index.ts',
      scope: 'global',
    });

    expect(result.content).toBe('Project code stays untouched: `src/cli/index.ts`.');
    expect(result.missing).toEqual([]);
  });

  it.each<ParityCase>([
    {
      name: 'target-native file links',
      content: 'Use `.claude/commands/review.md`.',
      sourceRel: '.claude/CLAUDE.md',
      destinationRel: '.agentsmesh/rules/_root.md',
      existingRel: ['.agentsmesh/commands/review.md'],
      translate: (root, p) =>
        p === `${root}/.claude/commands/review.md` ? `${root}/.agentsmesh/commands/review.md` : p,
    },
    {
      name: 'target-native directory links',
      content: 'Use `.claude/skills/qa/`.',
      sourceRel: '.claude/CLAUDE.md',
      destinationRel: '.agentsmesh/rules/_root.md',
      existingRel: ['.agentsmesh/skills/qa'],
      directoryRel: ['.agentsmesh/skills/qa'],
      translate: (root, p) =>
        p === `${root}/.claude/skills/qa` ? `${root}/.agentsmesh/skills/qa` : p,
    },
    {
      name: 'markdown destinations',
      content: 'Use [review](.claude/commands/review.md).',
      sourceRel: '.claude/CLAUDE.md',
      destinationRel: '.agentsmesh/rules/_root.md',
      existingRel: ['.agentsmesh/commands/review.md'],
      translate: (root, p) =>
        p === `${root}/.claude/commands/review.md` ? `${root}/.agentsmesh/commands/review.md` : p,
    },
    {
      name: 'project prose links',
      content: 'Project code stays standard: `../../src/cli/index.ts`.',
      sourceRel: '.agentsmesh/skills/figma/SKILL.md',
      destinationRel: '.agentsmesh/skills/figma/SKILL.md',
      existingRel: ['src/cli/index.ts'],
    },
  ])('matches project behavior for $name when destination is inside .agentsmesh', (item) => {
    const projectOutput = runParityCase('/proj', 'project', item);
    const globalOutput = runParityCase(homeRoot, 'global', item);

    expect(globalOutput).toBe(projectOutput);
  });
});
