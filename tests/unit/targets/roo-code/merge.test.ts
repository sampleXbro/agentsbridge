import { describe, it, expect } from 'vitest';
import { mergeRooCodeSettings } from '../../../../src/targets/roo-code/merge.js';
import {
  ROO_CODE_VSCODE_SETTINGS,
  ROO_CODE_ALLOWED_COMMANDS_KEY,
  ROO_CODE_DENIED_COMMANDS_KEY,
} from '../../../../src/targets/roo-code/constants.js';

const NEW_CONTENT = JSON.stringify({
  [ROO_CODE_ALLOWED_COMMANDS_KEY]: ['git log'],
  [ROO_CODE_DENIED_COMMANDS_KEY]: ['rm -rf'],
});

describe('mergeRooCodeSettings (roo-code)', () => {
  it('returns null when resolvedPath is not .vscode/settings.json', () => {
    expect(mergeRooCodeSettings(null, undefined, NEW_CONTENT, 'other.json')).toBeNull();
  });

  it('merges allow/deny keys into existing settings, preserving unrelated keys', () => {
    const existing = JSON.stringify({ 'editor.tabSize': 2 });
    const result = mergeRooCodeSettings(existing, undefined, NEW_CONTENT, ROO_CODE_VSCODE_SETTINGS);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed['editor.tabSize']).toBe(2);
    expect(parsed[ROO_CODE_ALLOWED_COMMANDS_KEY]).toEqual(['git log']);
    expect(parsed[ROO_CODE_DENIED_COMMANDS_KEY]).toEqual(['rm -rf']);
  });

  it('prefers pending.content over existing as the merge base', () => {
    const existing = JSON.stringify({ from: 'existing' });
    const pending = {
      target: 'roo-code',
      path: ROO_CODE_VSCODE_SETTINGS,
      content: JSON.stringify({ from: 'pending', keepMe: true }),
      status: 'created' as const,
    };
    const result = mergeRooCodeSettings(existing, pending, NEW_CONTENT, ROO_CODE_VSCODE_SETTINGS);
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed.from).toBe('pending');
    expect(parsed.keepMe).toBe(true);
    expect(parsed[ROO_CODE_ALLOWED_COMMANDS_KEY]).toEqual(['git log']);
  });

  it('returns newContent when both existing and pending are absent', () => {
    expect(mergeRooCodeSettings(null, undefined, NEW_CONTENT, ROO_CODE_VSCODE_SETTINGS)).toBe(
      NEW_CONTENT,
    );
  });

  it('falls back to {} when the existing base JSON is invalid', () => {
    const result = mergeRooCodeSettings(
      '{not valid json',
      undefined,
      NEW_CONTENT,
      ROO_CODE_VSCODE_SETTINGS,
    );
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed).toEqual({
      [ROO_CODE_ALLOWED_COMMANDS_KEY]: ['git log'],
      [ROO_CODE_DENIED_COMMANDS_KEY]: ['rm -rf'],
    });
  });

  it('falls back to {} when the existing base JSON is an array', () => {
    const result = mergeRooCodeSettings(
      '["a","b"]',
      undefined,
      NEW_CONTENT,
      ROO_CODE_VSCODE_SETTINGS,
    );
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed).toEqual({
      [ROO_CODE_ALLOWED_COMMANDS_KEY]: ['git log'],
      [ROO_CODE_DENIED_COMMANDS_KEY]: ['rm -rf'],
    });
  });

  it('returns base unchanged when newContent is unparseable JSON (defensive: generator always emits valid JSON)', () => {
    const existing = JSON.stringify({ 'editor.tabSize': 2 });
    const result = mergeRooCodeSettings(
      existing,
      undefined,
      '{not valid json',
      ROO_CODE_VSCODE_SETTINGS,
    );
    expect(result).toBe(existing);
  });

  it('returns base unchanged when newContent parses to a non-object (array)', () => {
    const existing = JSON.stringify({ 'editor.tabSize': 2 });
    const result = mergeRooCodeSettings(existing, undefined, '["x"]', ROO_CODE_VSCODE_SETTINGS);
    expect(result).toBe(existing);
  });

  it('does not touch allow/deny keys when the overlay omits them', () => {
    const existing = JSON.stringify({
      [ROO_CODE_ALLOWED_COMMANDS_KEY]: ['keep'],
      other: true,
    });
    const result = mergeRooCodeSettings(
      existing,
      undefined,
      JSON.stringify({ unrelated: 1 }),
      ROO_CODE_VSCODE_SETTINGS,
    );
    const parsed = JSON.parse(result as string) as Record<string, unknown>;
    expect(parsed[ROO_CODE_ALLOWED_COMMANDS_KEY]).toEqual(['keep']);
    expect(parsed.other).toBe(true);
    expect(parsed[ROO_CODE_DENIED_COMMANDS_KEY]).toBeUndefined();
  });
});
