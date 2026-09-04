import { describe, expect, it } from 'vitest';
import { mergeOwnedJsonKeys } from '../../../../src/core/generate/json-owned-keys.js';

describe('mergeOwnedJsonKeys', () => {
  it('replaces only the owned key and keeps every other key', () => {
    const merged = mergeOwnedJsonKeys(
      '{"inputs":[{"id":"tok"}],"servers":{"stale":{}}}',
      '{"servers":{"fetch":{"command":"npx"}}}',
      ['servers'],
    );
    expect(merged).toBe(
      JSON.stringify({ inputs: [{ id: 'tok' }], servers: { fetch: { command: 'npx' } } }, null, 2),
    );
  });

  it('keeps the base value and ignores unowned keys when the owned key is absent', () => {
    expect(mergeOwnedJsonKeys('{"servers":{"kept":{}}}', '{"other":1}', ['servers'])).toBe(
      JSON.stringify({ servers: { kept: {} } }, null, 2),
    );
  });

  it('returns null when there is no base', () => {
    expect(mergeOwnedJsonKeys(null, '{"servers":{}}', ['servers'])).toBeNull();
  });

  // A base we cannot parse is preserved, not replaced: returning null falls
  // through to the default policy, which overwrites the whole file. JSONC
  // comments are legal in `.vscode/mcp.json` and `.qwen/settings.json`.
  it('preserves a base that is not parseable JSON (JSONC comments)', () => {
    const base = '// note\n{"servers":{}}';
    expect(mergeOwnedJsonKeys(base, '{"servers":{}}', ['servers'])).toBe(base);
  });

  it('preserves a base that is a JSON array', () => {
    expect(mergeOwnedJsonKeys('[1,2]', '{"servers":{}}', ['servers'])).toBe('[1,2]');
  });

  it('preserves a base that is JSON null', () => {
    expect(mergeOwnedJsonKeys('null', '{"servers":{}}', ['servers'])).toBe('null');
  });

  it('returns null for a blank base so the generated file is created', () => {
    expect(mergeOwnedJsonKeys('   \n', '{"servers":{}}', ['servers'])).toBeNull();
  });

  it('returns null when the generated content is not a JSON object', () => {
    expect(mergeOwnedJsonKeys('{"a":1}', 'not json', ['servers'])).toBeNull();
  });
});
