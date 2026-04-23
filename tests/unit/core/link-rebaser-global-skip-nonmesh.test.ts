import { describe, expect, it } from 'vitest';
import { rewriteFileLinks } from '../../../src/core/reference/link-rebaser.js';

const homeRoot = '/home/user';

describe('rewriteFileLinks global scope: skip non-mesh, non-standard tokens', () => {
  it('leaves non-mesh tool config paths unchanged when token is not root-relative or ./../ relative', () => {
    const result = rewriteFileLinks({
      content: 'Editor config lives at `.vscode/settings.json`.',
      projectRoot: homeRoot,
      sourceFile: '/home/user/.agentsmesh/rules/_root.md',
      destinationFile: '/home/user/.claude/CLAUDE.md',
      translatePath: (p) => p,
      pathExists: (p) => p === '/home/user/.vscode/settings.json',
      scope: 'global',
      rewriteBarePathTokens: true,
    });

    expect(result.content).toBe('Editor config lives at `.vscode/settings.json`.');
    expect(result.missing).toEqual([]);
  });
});
