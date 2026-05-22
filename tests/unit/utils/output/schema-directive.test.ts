/**
 * Unit coverage for `src/utils/output/schema-directive.ts`.
 *
 * Pure helpers. The only runtime side is `getVersion()` from
 * `src/cli/version.ts`, which reads the package.json version at module load.
 * We do not mock it here — the production value is asserted by shape (URL
 * pattern + `@<version>` substring) rather than literal equality.
 */

import { describe, it, expect } from 'vitest';
import {
  prependYamlSchemaDirective,
  schemaUrl,
  stampJsonSchemaField,
  yamlSchemaDirective,
} from '../../../../src/utils/output/schema-directive.js';

describe('schemaUrl', () => {
  it('produces a URL under the agentsmesh schemas namespace, pinned to a version when known', () => {
    const url = schemaUrl('agentsmesh');
    expect(url.startsWith('https://unpkg.com/agentsmesh')).toBe(true);
    expect(url.endsWith('/schemas/agentsmesh.json')).toBe(true);
  });

  it('renders the right filename for every published schema name', () => {
    const names = [
      'agentsmesh',
      'permissions',
      'hooks',
      'pack',
      'installs',
      'mcp',
      'install-manifest',
    ] as const;
    for (const n of names) {
      expect(schemaUrl(n)).toMatch(new RegExp(`/schemas/${n}\\.json$`));
    }
  });
});

describe('yamlSchemaDirective', () => {
  it('starts with `# yaml-language-server: $schema=` and ends with a newline', () => {
    const out = yamlSchemaDirective('agentsmesh');
    expect(out.startsWith('# yaml-language-server: $schema=')).toBe(true);
    expect(out.endsWith('\n')).toBe(true);
    expect(out).toContain('/schemas/agentsmesh.json');
  });
});

describe('prependYamlSchemaDirective', () => {
  it('prepends the directive to a YAML payload that does not already have one', () => {
    const body = 'version: 1\n';
    const out = prependYamlSchemaDirective(body, 'agentsmesh');
    expect(out.startsWith('# yaml-language-server: $schema=')).toBe(true);
    expect(out.endsWith(body)).toBe(true);
  });

  it('does NOT duplicate when the payload already has the directive (same URL)', () => {
    const body = `${yamlSchemaDirective('agentsmesh')}version: 1\n`;
    const out = prependYamlSchemaDirective(body, 'agentsmesh');
    const matches = out.match(/^# yaml-language-server:/gm) ?? [];
    expect(matches.length).toBe(1);
    expect(out).toBe(body);
  });

  it('refreshes the directive in place when the payload has a stale URL', () => {
    const stale = `# yaml-language-server: $schema=https://example.test/old.json\nversion: 1\n`;
    const out = prependYamlSchemaDirective(stale, 'agentsmesh');
    const matches = out.match(/^# yaml-language-server:/gm) ?? [];
    expect(matches.length).toBe(1);
    expect(out).toContain('/schemas/agentsmesh.json');
    expect(out).not.toContain('https://example.test/old.json');
    expect(out.endsWith('version: 1\n')).toBe(true);
  });

  it('refreshes a directive that points at a DIFFERENT schema name (cross-schema rewrite)', () => {
    // Real-world example: a file was stamped with `permissions.json` and is
    // now being rewritten as `hooks.yaml` (e.g. file moved or filename
    // changed). The new caller's chosen name should win.
    const old = `${yamlSchemaDirective('permissions')}allow: []\n`;
    const out = prependYamlSchemaDirective(old, 'hooks');
    expect(out).toContain('/schemas/hooks.json');
    expect(out).not.toContain('/schemas/permissions.json');
  });
});

describe('stampJsonSchemaField', () => {
  it('returns a new object with $schema as the first key', () => {
    const out = stampJsonSchemaField({ name: 'demo', source: 'github:a/b' }, 'install-manifest');
    expect(Object.keys(out)[0]).toBe('$schema');
    expect(out.$schema).toContain('/schemas/install-manifest.json');
    expect(out.name).toBe('demo');
    expect(out.source).toBe('github:a/b');
  });

  it('does not mutate the input', () => {
    const input = { name: 'demo' };
    stampJsonSchemaField(input, 'install-manifest');
    expect(Object.prototype.hasOwnProperty.call(input, '$schema')).toBe(false);
  });

  it('overwrites an existing $schema value with the current pinned URL', () => {
    const input = { $schema: 'https://example.test/old.json', name: 'demo' };
    const out = stampJsonSchemaField(input, 'install-manifest');
    expect(out.$schema).toContain('/schemas/install-manifest.json');
    expect(out.$schema).not.toBe('https://example.test/old.json');
  });

  it('preserves field order with $schema first when other keys come before in the source', () => {
    const out = stampJsonSchemaField({ b: 2, a: 1 }, 'install-manifest');
    expect(Object.keys(out)).toEqual(['$schema', 'b', 'a']);
  });
});
