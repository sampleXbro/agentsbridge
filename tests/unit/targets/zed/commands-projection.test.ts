/**
 * Commands project onto Zed's skills surface.
 *
 * Zed has no command file format (extension slash commands were removed), but
 * `docs/src/ai/skills.md` documents skills as `/skill-name` slash commands and
 * `rules.md` describes Zed migrating user-invocable Rules into `~/.agents/skills/`.
 *
 * `.agents/skills/` is a SHARED artifact owned by codex-cli, which zed consumes.
 * Zed therefore reuses the shared command-skill serializer verbatim: byte-identical
 * output is what lets `resolveOutputCollisions` dedupe instead of throwing when
 * both targets are enabled, and it makes the shared skill importer round-trip the
 * projection back to a canonical command for free.
 */

import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import { generate } from '../../../../src/core/generate/engine.js';
import { generateCommands } from '../../../../src/targets/zed/generator.js';
import { descriptor } from '../../../../src/targets/zed/index.js';
import { serializeCommandSkill } from '../../../../src/targets/codex-cli/command-skill.js';
import { ZED_SKILLS_DIR, ZED_GLOBAL_SKILLS_DIR } from '../../../../src/targets/zed/constants.js';

function baseConfig(overrides: Partial<ValidatedConfig> = {}): ValidatedConfig {
  return {
    version: 1,
    targets: ['zed'],
    features: ['commands'],
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

describe('zed generateCommands', () => {
  it('emits one prefixed skill bundle per canonical command', () => {
    const outputs = generateCommands(canonical({ commands: [review] }));
    expect(outputs).toEqual([
      {
        path: `${ZED_SKILLS_DIR}/am-command-review/SKILL.md`,
        content: serializeCommandSkill(review),
      },
    ]);
  });

  it('emits nothing when there are no commands', () => {
    expect(generateCommands(canonical())).toEqual([]);
  });
});

describe('zed command paths', () => {
  it('project and global both resolve into .agents/skills', () => {
    expect(descriptor.project.paths.commandPath('review', baseConfig())).toBe(
      `${ZED_SKILLS_DIR}/am-command-review/SKILL.md`,
    );
    expect(descriptor.globalSupport!.layout.paths.commandPath('review', baseConfig())).toBe(
      `${ZED_GLOBAL_SKILLS_DIR}/am-command-review/SKILL.md`,
    );
  });

  it('returns null when the user turns the conversion off', () => {
    const config = baseConfig({
      conversions: { commands_to_skills: { zed: false } },
    } as Partial<ValidatedConfig>);
    expect(descriptor.project.paths.commandPath('review', config)).toBeNull();
    expect(descriptor.globalSupport!.layout.paths.commandPath('review', config)).toBeNull();
  });

  it('declares the conversion so the matrix and the dispatcher agree', () => {
    expect(descriptor.supportsConversion).toEqual({ commands: true });
    expect(descriptor.conversionDefaults).toEqual({ commandsToSkills: true });
  });
});

describe('zed + codex-cli in one generate pass', () => {
  it('produces one deduped command skill instead of a conflicting-output error', async () => {
    const results = await generate({
      config: baseConfig({ targets: ['zed', 'codex-cli'] }),
      canonical: canonical({ commands: [review] }),
      projectRoot: join(tmpdir(), 'am-zed-shared-skills'),
    });

    const skillFiles = results.filter((r) => r.path.startsWith(`${ZED_SKILLS_DIR}/`));
    expect(skillFiles.map((r) => r.path)).toEqual([`${ZED_SKILLS_DIR}/am-command-review/SKILL.md`]);
  });
});
