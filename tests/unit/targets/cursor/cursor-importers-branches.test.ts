import { describe, it, expect } from 'vitest';
import { mapCursorCommandFile } from '../../../../src/targets/cursor/importer-mappers.js';

describe('mapCursorCommandFile — description-is-string branch (line 84 [0])', () => {
  it('passes string description into canonical command frontmatter', async () => {
    const mapping = await mapCursorCommandFile(
      'go.md',
      '/dest',
      () => '---\ndescription: "Run the build"\nallowedTools: ["Bash"]\n---\nbody',
    );
    expect(mapping.content).toContain('Run the build');
  });
});
