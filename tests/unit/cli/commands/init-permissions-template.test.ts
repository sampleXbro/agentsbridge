/**
 * `agentsmesh init` must not scaffold empty permission lists.
 *
 * An explicit `allow: []` is a real instruction — "grant nothing" — and targets
 * that project permissions into a shared config file apply it over whatever the
 * user already had. A user adopting agentsmesh with existing permissions in
 * `.claude/settings.json` lost them on the first generate, including their
 * `deny` entries. Absent keys mean "agentsmesh manages nothing here yet", which
 * is what a fresh init actually means.
 */
import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';
import { TEMPLATE_PERMISSIONS } from '../../../../src/cli/commands/init-templates.js';

describe('init permissions template', () => {
  it('declares no permission keys at all', () => {
    const parsed: unknown = parse(TEMPLATE_PERMISSIONS);
    expect(parsed).toBeNull();
  });

  it('has no uncommented list on any line', () => {
    const live = TEMPLATE_PERMISSIONS.split('\n').filter(
      (line) => line.trim() !== '' && !line.trimStart().startsWith('#'),
    );
    expect(live).toEqual([]);
  });

  it('still documents allow, deny and ask as commented examples', () => {
    expect(TEMPLATE_PERMISSIONS).toContain('# allow:');
    expect(TEMPLATE_PERMISSIONS).toContain('# deny:');
    expect(TEMPLATE_PERMISSIONS).toContain('# ask:');
  });
});
