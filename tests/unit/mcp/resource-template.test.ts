import { describe, it, expect } from 'vitest';
import { matchResourceTemplate } from '../../../src/mcp/resource-template.js';

describe('matchResourceTemplate', () => {
  it('matches a literal URI with no params', () => {
    expect(matchResourceTemplate('agentsmesh://capabilities', 'agentsmesh://capabilities')).toEqual(
      {},
    );
    expect(
      matchResourceTemplate('agentsmesh://capabilities', 'agentsmesh://capabilities/x'),
    ).toBeNull();
  });

  it('binds placeholders; a trailing one may span slashes (schemas reject bad names)', () => {
    expect(matchResourceTemplate('a://rules/{name}', 'a://rules/_root')).toEqual({ name: '_root' });
    expect(matchResourceTemplate('a://rules/{name}', 'a://rules/x/y')).toEqual({ name: 'x/y' });
    expect(matchResourceTemplate('a://x/{a}/{b}', 'a://x/1/2/3')).toEqual({ a: '1', b: '2/3' });
  });

  it('lets the last placeholder span nested paths', () => {
    expect(
      matchResourceTemplate(
        'a://skills/{name}/files/{path}',
        'a://skills/foo/files/references/api.md',
      ),
    ).toEqual({ name: 'foo', path: 'references/api.md' });
  });

  it('escapes regex metacharacters in literal segments', () => {
    expect(matchResourceTemplate('a://x.y/{name}', 'a://xzy/q')).toBeNull();
    expect(matchResourceTemplate('a://x.y/{name}', 'a://x.y/q')).toEqual({ name: 'q' });
  });
});
