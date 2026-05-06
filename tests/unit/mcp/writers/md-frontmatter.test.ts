import { describe, it, expect } from 'vitest';
import { parseMd, serializeMd } from '../../../../src/mcp/writers/md-frontmatter.js';

describe('md-frontmatter', () => {
  it('round-trips frontmatter + body', () => {
    const src = '---\nname: foo\ndescription: x\n---\n\nbody here\n';
    const parsed = parseMd(src);
    expect(parsed.frontmatter).toEqual({ name: 'foo', description: 'x' });
    expect(parsed.body).toBe('body here\n');
    expect(serializeMd(parsed.frontmatter, parsed.body)).toBe(src);
  });
  it('handles missing frontmatter', () => {
    expect(parseMd('plain body\n')).toEqual({ frontmatter: {}, body: 'plain body\n' });
  });
});
