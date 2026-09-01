import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateCommands,
  generateAgents,
  generateSkills,
  generateHooks,
  generatePermissions,
} from '../../../../src/targets/openhands/generator.js';
import { serializeAntigravityAgent } from '../../../../src/targets/antigravity/agents-format.js';
import { generateEmbeddedSkills } from '../../../../src/targets/import/embedded-skill.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

describe('generateCommands (openhands)', () => {
  it('writes plugin commands with description and allowed-tools', () => {
    const outputs = generateCommands(
      makeCanonical({
        commands: [
          {
            source: '.agentsmesh/commands/review.md',
            name: 'review',
            description: 'Code review',
            allowedTools: ['Read', 'Grep'],
            body: 'Review changes.',
          },
        ],
      }),
    );
    expect(outputs).toEqual([
      {
        path: '.agents/plugins/agentsmesh/commands/review.md',
        content:
          '---\ndescription: Code review\nallowed-tools:\n  - Read\n  - Grep\n---\n\nReview changes.',
      },
    ]);
  });

  it('omits allowed-tools when canonical has none and never writes a name key', () => {
    const outputs = generateCommands(
      makeCanonical({
        commands: [
          {
            source: '.agentsmesh/commands/build.md',
            name: 'build',
            description: 'Build it',
            allowedTools: [],
            body: 'Run the build.',
          },
        ],
      }),
    );
    expect(outputs[0]!.content).toBe('---\ndescription: Build it\n---\n\nRun the build.');
  });
});

describe('generateAgents (openhands)', () => {
  const agent = {
    source: '.agentsmesh/agents/code-reviewer.md',
    name: 'code-reviewer',
    description: 'Code review specialist',
    tools: ['Read'],
    disallowedTools: ['Write'],
    model: 'sonnet',
    permissionMode: 'ask',
    maxTurns: 10,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: 'You are a reviewer.',
  };

  it('reuses the shared .agents/agents serializer byte for byte', () => {
    const outputs = generateAgents(makeCanonical({ agents: [agent] }));
    expect(outputs).toEqual([
      { path: '.agents/agents/code-reviewer.md', content: serializeAntigravityAgent(agent) },
    ]);
  });
});

describe('generateSkills (openhands)', () => {
  it('reuses the shared .agents/skills serializer byte for byte', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '.agentsmesh/skills/api/SKILL.md',
          name: 'api',
          description: 'API helper',
          body: 'Do the thing.',
          supportingFiles: [
            {
              relativePath: 'template.ts',
              absolutePath: '/tmp/template.ts',
              content: 'export {};',
            },
          ],
        },
      ],
    });
    expect(generateSkills(canonical)).toEqual(generateEmbeddedSkills(canonical, '.agents/skills'));
  });
});

describe('generateHooks (openhands)', () => {
  it('writes .openhands/hooks.json with snake_case event keys only', () => {
    const outputs = generateHooks(
      makeCanonical({
        hooks: { PostToolUse: [{ matcher: 'Write|Edit', command: 'prettier --write $FILE_PATH' }] },
      }),
    );
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.path).toBe('.openhands/hooks.json');
    const parsed = JSON.parse(outputs[0]!.content) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['post_tool_use']);
  });

  it('returns nothing when canonical has no hooks', () => {
    expect(generateHooks(makeCanonical())).toHaveLength(0);
    expect(generateHooks(makeCanonical({ hooks: {} }))).toHaveLength(0);
  });

  it('returns nothing when every hook event is unsupported', () => {
    expect(
      generateHooks(
        makeCanonical({ hooks: { Notification: [{ matcher: '*', command: 'echo' }] } }),
      ),
    ).toHaveLength(0);
  });
});

describe('generatePermissions (openhands)', () => {
  it('is a no-op stub: OpenHands has no permissions surface agentsmesh can own', () => {
    expect(
      generatePermissions(makeCanonical({ permissions: { allow: ['Read'], deny: [], ask: [] } })),
    ).toEqual([]);
  });
});
