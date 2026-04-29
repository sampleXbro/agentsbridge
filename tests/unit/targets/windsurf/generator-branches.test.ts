import { describe, expect, it } from 'vitest';
import { generateHooks } from '../../../../src/targets/windsurf/generator/hooks.js';
import { generateSkills } from '../../../../src/targets/windsurf/generator/skills.js';
import type { CanonicalFiles, CanonicalSkill } from '../../../../src/core/types.js';

function makeCanonical(partial: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...partial,
  };
}

function makeSkill(partial: Partial<CanonicalSkill> = {}): CanonicalSkill {
  return {
    source: '.agentsmesh/skills/foo/SKILL.md',
    name: 'foo',
    description: '',
    body: '',
    supportingFiles: [],
    ...partial,
  };
}

describe('windsurf generator/hooks', () => {
  it('returns [] when canonical hooks is null', () => {
    expect(generateHooks(makeCanonical({ hooks: null }))).toEqual([]);
  });

  it('returns [] when canonical hooks is empty object', () => {
    expect(generateHooks(makeCanonical({ hooks: {} }))).toEqual([]);
  });

  it('skips events whose entries are not arrays', () => {
    const out = generateHooks(
      makeCanonical({
        hooks: {
          // @ts-expect-error - testing runtime guard
          PreToolUse: 'not-an-array',
        },
      }),
    );
    expect(out).toEqual([]);
  });

  it('skips entries with no command/prompt text', () => {
    const out = generateHooks(
      makeCanonical({
        hooks: {
          PreToolUse: [{ matcher: '*', type: 'command', command: '   ' }],
        },
      }),
    );
    expect(out).toEqual([]);
  });

  it('uses prompt for type=prompt entries (falls back to command if missing)', () => {
    const out = generateHooks(
      makeCanonical({
        hooks: {
          PostToolUse: [{ matcher: '*', type: 'prompt', prompt: 'Do thing' }],
          UserPromptSubmit: [{ matcher: '*', type: 'prompt', command: 'fallback when no prompt' }],
        },
      }),
    );
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]!.content) as {
      hooks: Record<string, Array<{ command: string; show_output: boolean }>>;
    };
    expect(parsed.hooks.post_tool_use).toEqual([{ command: 'Do thing', show_output: true }]);
    expect(parsed.hooks.user_prompt_submit).toEqual([
      { command: 'fallback when no prompt', show_output: true },
    ]);
  });

  it('maps known canonical events to windsurf snake_case names', () => {
    const out = generateHooks(
      makeCanonical({
        hooks: {
          PreToolUse: [{ matcher: '*', type: 'command', command: 'a' }],
          PostToolUse: [{ matcher: '*', type: 'command', command: 'b' }],
          Notification: [{ matcher: '*', type: 'command', command: 'c' }],
          UserPromptSubmit: [{ matcher: '*', type: 'command', command: 'd' }],
          SubagentStart: [{ matcher: '*', type: 'command', command: 'e' }],
          SubagentStop: [{ matcher: '*', type: 'command', command: 'f' }],
        },
      }),
    );
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]!.content) as {
      hooks: Record<string, unknown>;
    };
    expect(Object.keys(parsed.hooks).sort()).toEqual(
      [
        'pre_tool_use',
        'post_tool_use',
        'notification',
        'user_prompt_submit',
        'subagent_start',
        'subagent_stop',
      ].sort(),
    );
  });

  it('falls back to camelCase->snake_case conversion for unknown events', () => {
    const out = generateHooks(
      makeCanonical({
        hooks: {
          // Custom non-standard event
          CustomEvent: [{ matcher: '*', type: 'command', command: 'x' }],
          // Hyphen-separated event
          'my-event': [{ matcher: '*', type: 'command', command: 'y' }],
        },
      }),
    );
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]!.content) as { hooks: Record<string, unknown> };
    expect(Object.keys(parsed.hooks)).toContain('custom_event');
    expect(Object.keys(parsed.hooks)).toContain('my_event');
  });

  it('returns [] when all entries get filtered out', () => {
    const out = generateHooks(
      makeCanonical({
        hooks: {
          PreToolUse: [
            { matcher: '*', type: 'command', command: '   ' },
            { matcher: '*', type: 'prompt', prompt: '' },
          ],
        },
      }),
    );
    expect(out).toEqual([]);
  });
});

describe('windsurf generator/skills', () => {
  it('emits SKILL.md plus supporting files for each skill', () => {
    const out = generateSkills(
      makeCanonical({
        skills: [
          makeSkill({
            name: 'api-gen',
            description: 'API generator',
            body: 'body content',
            supportingFiles: [
              {
                relativePath: 'references/check.md',
                absolutePath: '/abs/check.md',
                content: '# check',
              },
            ],
          }),
        ],
      }),
    );

    expect(out.map((o) => o.path)).toEqual([
      '.windsurf/skills/api-gen/SKILL.md',
      '.windsurf/skills/api-gen/references/check.md',
    ]);
    expect(out[0]!.content).toContain('description: API generator');
    expect(out[0]!.content).toContain('body content');
    expect(out[1]!.content).toBe('# check');
  });

  it('omits description from frontmatter when empty', () => {
    const out = generateSkills(
      makeCanonical({
        skills: [makeSkill({ name: 'no-desc', description: '', body: 'b' })],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.content).not.toContain('description:');
    expect(out[0]!.content).toContain('name: no-desc');
  });

  it('handles empty body correctly', () => {
    const out = generateSkills(
      makeCanonical({
        skills: [makeSkill({ name: 'empty-body', description: 'd', body: '' })],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.content).toContain('description: d');
  });

  it('returns [] when no skills', () => {
    expect(generateSkills(makeCanonical({ skills: [] }))).toEqual([]);
  });
});
