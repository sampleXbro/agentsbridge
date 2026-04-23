import { describe, expect, it } from 'vitest';
import { rewriteFileLinks } from '../../../src/core/reference/link-rebaser.js';

const projectRoot = '/proj';
const sourceFile = '/proj/.agentsmesh/skills/add-agent-target/SKILL.md';
const destinationFile = '/proj/.claude/skills/add-agent-target/SKILL.md';
const identityTranslate = (p: string): string => p;

describe('link-rebaser absolute and home anchors', () => {
  it('does not partially rewrite home-relative .agentsmesh paths', () => {
    const content = 'Global config stays at `~/.agentsmesh/rules/example.md`.';
    const result = rewriteFileLinks({
      content,
      projectRoot,
      sourceFile,
      destinationFile,
      translatePath: identityTranslate,
      pathExists: (p) => p === '/proj/.agentsmesh/rules/example.md',
    });

    expect(result.content).toBe(content);
  });

  it('preserves Windows drive-letter paths as external absolute references', () => {
    const content = 'Windows path stays `C:\\Users\\dev\\file.md`.';
    const result = rewriteFileLinks({
      content,
      projectRoot,
      sourceFile,
      destinationFile,
      translatePath: identityTranslate,
      pathExists: () => false,
    });

    expect(result.content).toBe(content);
  });

  it('preserves in-project Windows drive-letter paths in prose', () => {
    const result = rewriteFileLinks({
      content: 'Path: `C:\\proj\\src\\handler.ts`',
      projectRoot: 'C:\\proj',
      sourceFile: 'C:\\proj\\.agentsmesh\\rules\\_root.md',
      destinationFile: 'C:\\proj\\CLAUDE.md',
      translatePath: identityTranslate,
      pathExists: (p) => p === 'C:\\proj\\src\\handler.ts',
    });

    expect(result.content).toBe('Path: `C:\\proj\\src\\handler.ts`');
  });
});
