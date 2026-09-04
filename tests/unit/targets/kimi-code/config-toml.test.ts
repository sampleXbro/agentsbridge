import { describe, it, expect } from 'vitest';
import { parse as parseToml } from 'smol-toml';
import {
  buildKimiHookEntries,
  KIMI_CODE_HOOK_EVENTS,
  unmappedHookEntries,
} from '../../../../src/targets/kimi-code/hooks-format.js';
import {
  buildKimiPermissionRules,
  isValidKimiPermissionPattern,
  unmappedPermissionPatterns,
} from '../../../../src/targets/kimi-code/permissions-format.js';
import {
  parseKimiConfig,
  serializeKimiConfig,
} from '../../../../src/targets/kimi-code/config-toml.js';

const EXISTING_WITH_SECRETS = `[providers.kimi]
type = "kimi"
api_key = "sk-live-do-not-lose-me"

[permission]
mode = "manual"
`;

describe('buildKimiHookEntries', () => {
  it('emits only event/matcher/command/timeout, never extra keys', () => {
    const entries = buildKimiHookEntries({
      PostToolUse: [{ matcher: 'Write|Edit', command: 'prettier --write $FILE_PATH', timeout: 12 }],
    });
    expect(entries).toEqual([
      {
        event: 'PostToolUse',
        matcher: 'Write|Edit',
        command: 'prettier --write $FILE_PATH',
        timeout: 12,
      },
    ]);
  });

  it('omits matcher and timeout when they carry nothing', () => {
    const entries = buildKimiHookEntries({ Stop: [{ matcher: '', command: 'notify' }] });
    expect(entries).toEqual([{ event: 'Stop', command: 'notify' }]);
  });

  it('drops prompt hooks, unsupported events and out-of-range timeouts', () => {
    const hooks = {
      PostToolUse: [{ matcher: 'Write', command: 'fmt', timeout: 9000 }],
      PreCommit: [{ matcher: '', command: 'lint' }],
      Stop: [{ matcher: '', command: '', type: 'prompt' as const, prompt: 'summarize' }],
    };
    expect(buildKimiHookEntries(hooks)).toEqual([
      { event: 'PostToolUse', matcher: 'Write', command: 'fmt' },
    ]);
    expect(unmappedHookEntries(hooks)).toEqual({
      events: ['PreCommit'],
      promptEvents: ['Stop'],
      timeouts: ['PostToolUse'],
    });
  });

  it('reports nothing for absent, empty or malformed hook lists', () => {
    expect(buildKimiHookEntries(null)).toEqual([]);
    expect(unmappedHookEntries(null)).toEqual({ events: [], promptEvents: [], timeouts: [] });
    const malformed = { PostToolUse: [], PreCommit: undefined } as unknown as Parameters<
      typeof unmappedHookEntries
    >[0];
    expect(buildKimiHookEntries(malformed)).toEqual([]);
    expect(unmappedHookEntries(malformed)).toEqual({
      events: [],
      promptEvents: [],
      timeouts: [],
    });
  });

  it('drops a hook entry with no command', () => {
    expect(buildKimiHookEntries({ Stop: [{ matcher: 'x', command: '' }] })).toEqual([]);
  });

  it('covers every event the CLI documents', () => {
    expect(KIMI_CODE_HOOK_EVENTS).toContain('PreToolUse');
    expect(KIMI_CODE_HOOK_EVENTS).toContain('SessionEnd');
    expect(KIMI_CODE_HOOK_EVENTS).toHaveLength(20);
  });
});

describe('kimi permission patterns', () => {
  it('accepts every form parsePermissionPattern parses', () => {
    for (const pattern of ['Read', 'Grep', 'Bash(npm run test:*)', 'mcp__ctx7__*', 'Read()']) {
      expect(isValidKimiPermissionPattern(pattern)).toBe(true);
    }
  });

  it('rejects only the three inputs parsePermissionPattern throws on', () => {
    for (const pattern of ['', '  ', 'Bash(', '(Read)']) {
      expect(isValidKimiPermissionPattern(pattern)).toBe(false);
    }
  });

  it('builds decision-tagged rules and reports what it dropped', () => {
    const permissions = {
      allow: ['Read', 'Bash('],
      deny: ['Bash(rm -rf*)'],
      ask: ['WebFetch'],
    };
    expect(buildKimiPermissionRules(permissions)).toEqual([
      { decision: 'allow', pattern: 'Read' },
      { decision: 'ask', pattern: 'WebFetch' },
      { decision: 'deny', pattern: 'Bash(rm -rf*)' },
    ]);
    expect(unmappedPermissionPatterns(permissions)).toEqual(['Bash(']);
  });

  it('treats a missing ask list as empty and null permissions as nothing to say', () => {
    expect(buildKimiPermissionRules({ allow: [], deny: [] })).toEqual([]);
    expect(buildKimiPermissionRules(null)).toEqual([]);
    expect(unmappedPermissionPatterns(null)).toEqual([]);
    expect(unmappedPermissionPatterns({ allow: [], deny: [] })).toEqual([]);
  });
});

describe('serializeKimiConfig', () => {
  it('merges owned keys and never touches provider credentials', () => {
    const content = serializeKimiConfig(EXISTING_WITH_SECRETS, {
      hooks: [{ event: 'PostToolUse', matcher: 'Write', command: 'fmt' }],
      permissionRules: [{ decision: 'allow', pattern: 'Read' }],
    });
    expect(content).not.toBeNull();
    const parsed = parseToml(content!) as Record<string, unknown>;
    expect(parsed.providers).toEqual({
      kimi: { type: 'kimi', api_key: 'sk-live-do-not-lose-me' },
    });
    expect(parsed.permission).toEqual({
      mode: 'manual',
      rules: [{ decision: 'allow', pattern: 'Read' }],
    });
    expect(parsed.hooks).toEqual([{ event: 'PostToolUse', matcher: 'Write', command: 'fmt' }]);
  });

  it('clears a revoked key instead of leaving stale entries behind', () => {
    const seeded = serializeKimiConfig(EXISTING_WITH_SECRETS, {
      hooks: [{ event: 'Stop', command: 'notify' }],
      permissionRules: [{ decision: 'deny', pattern: 'WebFetch' }],
    })!;
    const cleared = serializeKimiConfig(seeded, { hooks: [], permissionRules: [] })!;
    const parsed = parseToml(cleared) as Record<string, unknown>;
    expect(parsed.hooks).toBeUndefined();
    expect(parsed.permission).toEqual({ mode: 'manual' });
    expect(parsed.providers).toBeDefined();
  });

  it('leaves keys of disabled features exactly as they are', () => {
    const seeded = serializeKimiConfig(EXISTING_WITH_SECRETS, {
      hooks: [{ event: 'Stop', command: 'notify' }],
      permissionRules: [{ decision: 'deny', pattern: 'WebFetch' }],
    })!;
    const onlyHooks = serializeKimiConfig(seeded, { hooks: [] })!;
    const parsed = parseToml(onlyHooks) as Record<string, unknown>;
    expect(parsed.hooks).toBeUndefined();
    expect(parsed.permission).toEqual({
      mode: 'manual',
      rules: [{ decision: 'deny', pattern: 'WebFetch' }],
    });
  });

  it('refuses to rewrite a config it cannot parse, so credentials survive', () => {
    expect(serializeKimiConfig('[providers.kimi\napi_key = "sk-live"', { hooks: [] })).toBeNull();
  });

  it('writes a fresh file when none exists and there is something to say', () => {
    const content = serializeKimiConfig(null, {
      hooks: [{ event: 'Stop', command: 'notify' }],
      permissionRules: [],
    });
    expect(parseToml(content!)).toEqual({ hooks: [{ event: 'Stop', command: 'notify' }] });
  });

  it('leaves the disk alone when there is nothing to write or clear', () => {
    expect(serializeKimiConfig(null, { hooks: [], permissionRules: [] })).toBeNull();
    expect(serializeKimiConfig(EXISTING_WITH_SECRETS, {})).toBeNull();
  });
});

describe('parseKimiConfig', () => {
  it('yields empty lists for an unparsable or key-less document', () => {
    expect(parseKimiConfig('[providers.kimi\n')).toEqual({ hooks: [], permissionRules: [] });
    expect(parseKimiConfig('[providers.kimi]\ntype = "kimi"\n')).toEqual({
      hooks: [],
      permissionRules: [],
    });
  });

  it('ignores a permission table with no rules array', () => {
    expect(parseKimiConfig('[permission]\nmode = "manual"\n').permissionRules).toEqual([]);
  });
});
