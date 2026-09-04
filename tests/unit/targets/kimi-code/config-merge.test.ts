/**
 * What survives a generate into `~/.kimi-code/config.toml`.
 *
 * agentsmesh owns two keys outright — the top-level `hooks` array and
 * `permission.rules` — because revocation needs them rewritten. Everything else
 * in the file is the user's, and a rule the user annotated keeps that
 * annotation as long as canonical still carries the same decision + pattern.
 */

import { describe, it, expect } from 'vitest';
import { parse as parseToml } from 'smol-toml';
import { serializeKimiConfig } from '../../../../src/targets/kimi-code/config-toml.js';

const EXISTING = `default_model = "kimi-k2"

[providers.kimi]
api_key = "sk-live-123"

[permission]
dangerous_command_guard = true

[[permission.rules]]
decision = "deny"
pattern = "Bash(rm -rf*)"
reason = "hand written"
scope = "project"

[[permission.rules]]
decision = "allow"
pattern = "Grep"
`;

function merged(
  existing: string | null,
  rules: { decision: 'allow' | 'deny'; pattern: string }[],
): unknown {
  const content = serializeKimiConfig(existing, { permissionRules: rules });
  return parseToml(content ?? '');
}

describe('permission.rules merge', () => {
  it('keeps a user annotation on a rule canonical still carries', () => {
    const root = merged(EXISTING, [
      { decision: 'allow', pattern: 'Grep' },
      { decision: 'deny', pattern: 'Bash(rm -rf*)' },
    ]) as { permission: { rules: Record<string, unknown>[]; dangerous_command_guard: boolean } };

    expect(root.permission.rules).toEqual([
      { decision: 'allow', pattern: 'Grep' },
      { decision: 'deny', pattern: 'Bash(rm -rf*)', reason: 'hand written', scope: 'project' },
    ]);
    expect(root.permission.dangerous_command_guard).toBe(true);
  });

  it('drops the annotation with the rule it belonged to', () => {
    const root = merged(EXISTING, [{ decision: 'allow', pattern: 'Grep' }]) as {
      permission: { rules: Record<string, unknown>[] };
    };
    expect(root.permission.rules).toEqual([{ decision: 'allow', pattern: 'Grep' }]);
  });

  it('does not move an annotation onto a different decision', () => {
    const root = merged(EXISTING, [{ decision: 'allow', pattern: 'Bash(rm -rf*)' }]) as {
      permission: { rules: Record<string, unknown>[] };
    };
    expect(root.permission.rules).toEqual([{ decision: 'allow', pattern: 'Bash(rm -rf*)' }]);
  });

  it('ignores existing rules that are not records or lack the identity keys', () => {
    const existing = '[permission]\nrules = ["Bash", { decision = "deny" }]\n';
    const root = merged(existing, [{ decision: 'deny', pattern: 'Bash' }]) as {
      permission: { rules: Record<string, unknown>[] };
    };
    expect(root.permission.rules).toEqual([{ decision: 'deny', pattern: 'Bash' }]);
  });

  it('ignores a permission.rules value that is not an array', () => {
    const root = merged('[permission]\nrules = "none"\n', [
      { decision: 'deny', pattern: 'Bash' },
    ]) as { permission: { rules: Record<string, unknown>[] } };
    expect(root.permission.rules).toEqual([{ decision: 'deny', pattern: 'Bash' }]);
  });

  it('leaves the credentials and the user model untouched', () => {
    const content = serializeKimiConfig(EXISTING, { permissionRules: [] }) ?? '';
    expect(content).toContain('api_key = "sk-live-123"');
    expect(content).toContain('default_model = "kimi-k2"');
    expect(content).not.toContain('hand written');
  });
});
