import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type MarkdownKind = 'agents' | 'commands' | 'rules';

export interface MarkdownCase {
  kind: MarkdownKind;
  files: Record<string, string>;
  expectedPackFiles: string[];
  expectedGeneratedFiles: string[];
}

export const MARKDOWN_CASES: MarkdownCase[] = [
  {
    kind: 'agents',
    files: {
      'api-architect.md':
        '---\ndescription: API architect\ntools: Read, Grep, Write\n---\n\nDesign APIs.\n',
      'backend-developer.md':
        '---\ndescription: Backend developer\ntools: Read, Grep, Write\n---\n\nBuild services.\n',
    },
    expectedPackFiles: ['api-architect.md', 'backend-developer.md'],
    expectedGeneratedFiles: ['CLAUDE.md', 'agents/api-architect.md', 'agents/backend-developer.md'],
  },
  {
    kind: 'commands',
    files: {
      'review.md': '---\ndescription: Review\n---\n\nReview code.\n',
      'nested/test.md': '---\ndescription: Test\n---\n\nRun tests.\n',
    },
    expectedPackFiles: ['review.md', 'test.md'],
    expectedGeneratedFiles: ['CLAUDE.md', 'commands/review.md', 'commands/test.md'],
  },
  {
    kind: 'rules',
    files: {
      '_root.md': '---\nroot: true\n---\n# Shared Root\n',
      'quality.md': '# Quality\n',
      'testing.md': '# Testing\n',
    },
    expectedPackFiles: ['_root.md', 'quality.md', 'testing.md'],
    expectedGeneratedFiles: ['CLAUDE.md', 'rules/quality.md', 'rules/testing.md'],
  },
];

export function manifestFeatures(kind: MarkdownKind): string[] {
  return [kind];
}

export function seedProject(project: string, kind: MarkdownKind): void {
  const projectFeatures = kind === 'rules' ? ['rules'] : ['rules', kind];
  mkdirSync(join(project, '.agentsbridge', 'rules'), { recursive: true });
  writeFileSync(
    join(project, 'agentsbridge.yaml'),
    `version: 1\ntargets: [claude-code]\nfeatures: [${projectFeatures.join(',')}]\nextends: []\n`,
  );
  writeFileSync(
    join(project, '.agentsbridge', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Project Root\n',
  );
}

export function seedCollection(root: string, files: Record<string, string>): void {
  for (const [relPath, content] of Object.entries(files)) {
    const absPath = join(root, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, content);
  }
}

export function pickedNames(files: string[]): string[] {
  return files.map((file) => file.replace(/\.md$/i, '').split('/').at(-1)!).sort();
}
