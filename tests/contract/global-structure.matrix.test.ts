// P2-1: Consolidated global-mode structure matrix.
// Replaces 12 per-target tests/unit/targets/{target}/global-structure-validation.test.ts
// files. One parametrized run per target that declares globalSupport.
//
// Assertions per target:
//   1. generate() returns at least one file.
//   2. If the global layout declares rootInstructionPath, it is emitted.
//   3. If the layout agentPath is declared null (agent suppression),
//      no agent files surface in the output.
//   4. Every generated file has a non-empty path and string content.
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from '../../src/core/generate/engine.js';
import type { CanonicalFiles } from '../../src/core/types.js';
import type { ValidatedConfig } from '../../src/config/core/schema.js';
import {
  getBuiltinTargetDefinition,
  getTargetLayout,
} from '../../src/targets/catalog/builtin-targets.js';
import { TARGET_IDS, type BuiltinTargetId } from '../../src/targets/catalog/target-ids.js';

function makeCanonical(testDir: string): CanonicalFiles {
  return {
    rules: [
      {
        source: join(testDir, '.agentsmesh/rules/_root.md'),
        root: true,
        targets: [],
        description: 'Root rules',
        globs: [],
        body: '# Project Rules\n\nUse TypeScript strict mode.',
      },
      {
        source: join(testDir, '.agentsmesh/rules/typescript.md'),
        root: false,
        targets: [],
        description: 'TypeScript rules',
        globs: ['**/*.ts'],
        body: 'Prefer interfaces over types.',
      },
    ],
    commands: [
      {
        source: join(testDir, '.agentsmesh/commands/test.md'),
        name: 'test',
        description: 'Run tests',
        allowedTools: ['Bash'],
        body: 'Run the project test suite.',
      },
    ],
    agents: [
      {
        source: join(testDir, '.agentsmesh/agents/reviewer.md'),
        name: 'reviewer',
        description: 'Code reviewer',
        tools: [],
        disallowedTools: [],
        model: '',
        permissionMode: '',
        maxTurns: 0,
        mcpServers: [],
        hooks: {},
        skills: [],
        memory: '',
        body: 'Review code for correctness.',
      },
    ],
    skills: [
      {
        source: join(testDir, '.agentsmesh/skills/api-gen/SKILL.md'),
        name: 'api-gen',
        description: 'Generate APIs',
        body: '# API Generation\n\nCreate REST endpoints.',
        supportingFiles: [],
      },
    ],
    mcp: {
      mcpServers: {
        filesystem: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          env: {},
        },
      },
    },
    permissions: null,
    hooks: null,
    ignore: ['node_modules/', '.env'],
  };
}

function makeConfig(target: BuiltinTargetId): ValidatedConfig {
  return {
    version: 1,
    targets: [target],
    features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'permissions', 'hooks', 'ignore'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

const GLOBAL_TARGETS = TARGET_IDS.filter(
  (id) => getBuiltinTargetDefinition(id)?.globalSupport !== undefined,
);

describe('global-mode structure matrix', () => {
  it('every builtin target declares globalSupport', () => {
    expect(GLOBAL_TARGETS).toEqual([...TARGET_IDS]);
  });

  it.each(GLOBAL_TARGETS)(
    'generate(scope=global) produces expected shape for %s',
    async (target) => {
      const testDir = mkdtempSync(join(tmpdir(), `am-global-matrix-${target}-`));
      try {
        mkdirSync(testDir, { recursive: true });
        const files = await generate({
          config: makeConfig(target),
          canonical: makeCanonical(testDir),
          projectRoot: testDir,
          scope: 'global',
        });

        expect(files.length, `${target} emitted no files`).toBeGreaterThan(0);

        for (const f of files) {
          expect(typeof f.path).toBe('string');
          expect(f.path.length).toBeGreaterThan(0);
          expect(typeof f.content === 'string' || Buffer.isBuffer(f.content)).toBe(true);
        }

        const layout = getTargetLayout(target, 'global');
        if (layout?.rootInstructionPath) {
          const hit = files.find((f) => f.path === layout.rootInstructionPath);
          expect(
            hit,
            `${target} missing rootInstructionPath ${layout.rootInstructionPath}`,
          ).toBeDefined();
        }

        const suppressedAgent =
          layout?.paths?.agentPath?.('reviewer', makeConfig(target) as never) === null;
        if (suppressedAgent) {
          const agentFiles = files.filter((f) => /\/agents\/[^/]+\.(md|toml)$/i.test(f.path));
          expect(agentFiles, `${target} should suppress agents in global mode`).toEqual([]);
        }
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    },
  );
});
