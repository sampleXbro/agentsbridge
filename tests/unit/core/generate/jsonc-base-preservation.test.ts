/**
 * A merger that cannot parse the user's file must preserve it, never replace it.
 *
 * `.vscode/settings.json`, `kilo.jsonc` and `.qwen/settings.json` are all
 * comment-legal — VS Code ships its settings commented and "jsonc" literally
 * means JSON-with-comments. Every merger here coerced an unparsable base to
 * `{}` and then serialised its own keys over the top, so a single `//` line cost
 * the user every setting in the file.
 *
 * `mergeOwnedJsonKeys` already established the rule (preserve, never replace);
 * these four sites never routed through it.
 */
import { describe, it, expect } from 'vitest';
import { mergeRooCodeSettings } from '../../../../src/targets/roo-code/merge.js';
import { mergeKiloConfig } from '../../../../src/targets/kilo-code/merge.js';
import {
  mergeSettingsJson,
  mergeGeminiSettingsJson,
  mergeCrushConfigJson,
} from '../../../../src/core/generate/settings.js';

const JSONC = ['{', '  // my editor prefs', '  "editor.fontSize": 14', '}'].join('\n');

describe('roo-code .vscode/settings.json', () => {
  it('preserves a commented base instead of replacing the whole file', () => {
    const merged = mergeRooCodeSettings(
      JSONC,
      undefined,
      JSON.stringify({ 'roo-cline.allowedCommands': ['ls'] }),
      '.vscode/settings.json',
    );
    expect(merged).toBe(JSONC);
  });

  it('still merges its own keys into a well-formed base', () => {
    const base = JSON.stringify({ 'editor.fontSize': 14 });
    const merged = mergeRooCodeSettings(
      base,
      undefined,
      JSON.stringify({ 'roo-cline.allowedCommands': ['ls'] }),
      '.vscode/settings.json',
    );
    expect(JSON.parse(merged as string)).toEqual({
      'editor.fontSize': 14,
      'roo-cline.allowedCommands': ['ls'],
    });
  });
});

describe('kilo-code kilo.jsonc', () => {
  it('preserves a commented base — the format name means JSON-with-comments', () => {
    const merged = mergeKiloConfig(
      JSONC,
      undefined,
      JSON.stringify({ permission: { read: 'allow' } }),
      'kilo.jsonc',
    );
    expect(merged).toBe(JSONC);
  });

  it('still merges its own keys into a well-formed base', () => {
    const merged = mergeKiloConfig(
      JSON.stringify({ theme: 'dark' }),
      undefined,
      JSON.stringify({ permission: { read: 'allow' } }),
      'kilo.jsonc',
    );
    expect(JSON.parse(merged as string)).toEqual({
      theme: 'dark',
      permission: { read: 'allow' },
    });
  });
});

describe('shared settings mergers', () => {
  it('mergeSettingsJson preserves a commented base', () => {
    expect(mergeSettingsJson(JSONC, JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }))).toBe(
      JSONC,
    );
  });

  it('mergeGeminiSettingsJson preserves a commented base', () => {
    expect(mergeGeminiSettingsJson(JSONC, JSON.stringify({ mcpServers: { a: {} } }))).toBe(JSONC);
  });

  it('mergeCrushConfigJson preserves a commented base', () => {
    expect(mergeCrushConfigJson(JSONC, JSON.stringify({ mcp: { a: {} } }))).toBe(JSONC);
  });

  it('mergeSettingsJson still merges into a well-formed base', () => {
    const merged = mergeSettingsJson(
      JSON.stringify({ model: 'opus' }),
      JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }),
    );
    expect(JSON.parse(merged)).toMatchObject({
      model: 'opus',
      permissions: { allow: ['Bash(ls)'] },
    });
  });
});
