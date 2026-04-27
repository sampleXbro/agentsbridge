/**
 * Windows filesystem safety contract: every generated artifact path emitted
 * by every builtin target — in both project and global scope — must survive
 * a Windows clone/checkout/write cycle, and no two outputs may differ only
 * by case (which silently overwrite each other on default NTFS / APFS).
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from '../../src/core/generate/engine.js';
import type { CanonicalFiles } from '../../src/core/types.js';
import type { ValidatedConfig } from '../../src/config/core/schema.js';
import type { TargetLayoutScope } from '../../src/targets/catalog/target-descriptor.js';
import { TARGET_IDS, type BuiltinTargetId } from '../../src/targets/catalog/target-ids.js';
import { findWindowsPathIssues } from '../../src/utils/filesystem/windows-path-safety.js';

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

async function collectOutputs(
  target: BuiltinTargetId,
  scope: TargetLayoutScope,
): Promise<readonly { path: string }[]> {
  const testDir = mkdtempSync(join(tmpdir(), `am-windows-paths-${target}-${scope}-`));
  try {
    mkdirSync(testDir, { recursive: true });
    return await generate({
      config: makeConfig(target),
      canonical: makeCanonical(testDir),
      projectRoot: testDir,
      scope,
    });
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
}

const SCOPES: readonly TargetLayoutScope[] = ['project', 'global'];

describe('Windows path safety contract', () => {
  for (const scope of SCOPES) {
    describe(`scope=${scope}`, () => {
      it.each(TARGET_IDS)('every generated path for %s is Windows-safe', async (target) => {
        const outputs = await collectOutputs(target, scope);
        expect(outputs.length, `${target}/${scope} produced no outputs`).toBeGreaterThan(0);

        const offenders = outputs
          .map((output) => ({
            path: output.path,
            issues: findWindowsPathIssues(output.path),
          }))
          .filter((entry) => entry.issues.length > 0);

        expect(
          offenders,
          `Windows-unsafe paths from ${target}/${scope}: ${JSON.stringify(offenders, null, 2)}`,
        ).toEqual([]);
      });

      it.each(TARGET_IDS)(
        'no two outputs for %s differ only by case (case-insensitive collision)',
        async (target) => {
          const outputs = await collectOutputs(target, scope);
          const seen = new Map<string, string>();
          const collisions: Array<[string, string]> = [];
          for (const { path } of outputs) {
            const key = path.toLowerCase();
            const prior = seen.get(key);
            if (prior !== undefined && prior !== path) {
              collisions.push([prior, path]);
            } else if (prior === undefined) {
              seen.set(key, path);
            }
          }
          expect(
            collisions,
            `case-only collisions from ${target}/${scope}: ${JSON.stringify(collisions)}`,
          ).toEqual([]);
        },
      );
    });
  }
});
