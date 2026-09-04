/**
 * Commands and agents project onto Replit Agent's skills surface.
 *
 * Replit documents a repo-committed, version-controlled skills surface at
 * `/.agents/skills`, each skill a folder holding `SKILL.md`, invoked by name
 * from the slash-command / "Use a skill" picker — the saved-prompt semantics of
 * the commands feature.
 *
 * `.agents/skills/` is a SHARED artifact owned by codex-cli, which replit-agent
 * consumes. Replit therefore reuses the shared serializers verbatim: byte-identical
 * output is what lets `resolveOutputCollisions` dedupe instead of throwing when
 * several targets are enabled, and it makes the shared skill importer round-trip
 * the projection back to canonical for free.
 */

import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import { generate } from '../../../../src/core/generate/engine.js';
import {
  generateCommands,
  generateAgents,
} from '../../../../src/targets/replit-agent/generator.js';
import { descriptor } from '../../../../src/targets/replit-agent/index.js';
import { serializeCommandSkill } from '../../../../src/targets/codex-cli/command-skill.js';
import { serializeProjectedAgentSkill } from '../../../../src/targets/projection/projected-agent-skill.js';
import { REPLIT_AGENT_SKILLS_DIR } from '../../../../src/targets/replit-agent/constants.js';

function baseConfig(overrides: Partial<ValidatedConfig> = {}): ValidatedConfig {
  return {
    version: 1,
    targets: ['replit-agent'],
    features: ['commands', 'agents'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
    ...overrides,
  } as ValidatedConfig;
}

function canonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

const review = {
  source: '/proj/.agentsmesh/commands/review.md',
  name: 'review',
  description: 'Review the diff',
  allowedTools: ['Bash(git diff:*)'],
  body: 'Review every change.',
};

const codeReviewer = {
  source: '/proj/.agentsmesh/agents/code-reviewer.md',
  name: 'code-reviewer',
  description: 'Reviews code',
  body: 'Review carefully.',
  tools: ['Read'],
  disallowedTools: [],
  model: 'claude-sonnet',
  permissionMode: '',
  maxTurns: 0,
  mcpServers: [],
  hooks: {},
  skills: [],
  memory: '',
};

describe('replit-agent skill projection', () => {
  it('emits one prefixed command skill bundle, byte-identical to the shared serializer', () => {
    expect(generateCommands(canonical({ commands: [review] }))).toEqual([
      {
        path: `${REPLIT_AGENT_SKILLS_DIR}/am-command-review/SKILL.md`,
        content: serializeCommandSkill(review),
      },
    ]);
  });

  it('emits one prefixed agent skill bundle, byte-identical to the shared serializer', () => {
    expect(generateAgents(canonical({ agents: [codeReviewer] }))).toEqual([
      {
        path: `${REPLIT_AGENT_SKILLS_DIR}/am-agent-code-reviewer/SKILL.md`,
        content: serializeProjectedAgentSkill(codeReviewer),
      },
    ]);
  });
});

describe('replit-agent projection through the generate engine', () => {
  it('writes both projections under .agents/skills', async () => {
    const results = await generate({
      config: baseConfig(),
      canonical: canonical({ commands: [review], agents: [codeReviewer] }),
      projectRoot: join(tmpdir(), 'am-replit-projection'),
    });

    expect(results.map((r) => r.path).sort()).toEqual([
      `${REPLIT_AGENT_SKILLS_DIR}/am-agent-code-reviewer/SKILL.md`,
      `${REPLIT_AGENT_SKILLS_DIR}/am-command-review/SKILL.md`,
    ]);
  });

  it('emits nothing when the user turns both conversions off', async () => {
    const results = await generate({
      config: baseConfig({
        conversions: {
          commands_to_skills: { 'replit-agent': false },
          agents_to_skills: { 'replit-agent': false },
        },
      } as Partial<ValidatedConfig>),
      canonical: canonical({ commands: [review], agents: [codeReviewer] }),
      projectRoot: join(tmpdir(), 'am-replit-projection-off'),
    });

    expect(results).toEqual([]);
  });
});

describe('replit-agent sharing .agents/skills with other targets', () => {
  it('dedupes command skills against codex-cli instead of failing on collision', async () => {
    const results = await generate({
      config: baseConfig({ targets: ['replit-agent', 'codex-cli'] }),
      canonical: canonical({ commands: [review] }),
      projectRoot: join(tmpdir(), 'am-replit-shared-codex'),
    });

    expect(results.map((r) => r.path)).toEqual([
      `${REPLIT_AGENT_SKILLS_DIR}/am-command-review/SKILL.md`,
    ]);
  });

  it('dedupes command and agent skills against goose instead of failing on collision', async () => {
    const results = await generate({
      config: baseConfig({ targets: ['replit-agent', 'goose'] }),
      canonical: canonical({ commands: [review], agents: [codeReviewer] }),
      projectRoot: join(tmpdir(), 'am-replit-shared-goose'),
    });

    expect(results.map((r) => r.path).sort()).toEqual([
      `${REPLIT_AGENT_SKILLS_DIR}/am-agent-code-reviewer/SKILL.md`,
      `${REPLIT_AGENT_SKILLS_DIR}/am-command-review/SKILL.md`,
    ]);
  });
});

describe('replit-agent conversion declarations', () => {
  it('declares the conversions so the matrix and the dispatcher agree', () => {
    expect(descriptor.supportsConversion).toEqual({ commands: true, agents: true });
    expect(descriptor.conversionDefaults).toEqual({
      commandsToSkills: true,
      agentsToSkills: true,
    });
  });

  it('returns null from the layout paths when the conversions are off', () => {
    const config = baseConfig({
      conversions: {
        commands_to_skills: { 'replit-agent': false },
        agents_to_skills: { 'replit-agent': false },
      },
    } as Partial<ValidatedConfig>);
    expect(descriptor.project.paths.commandPath('review', config)).toBeNull();
    expect(descriptor.project.paths.agentPath('code-reviewer', config)).toBeNull();
  });
});
