/**
 * Global-scope output shape and revocation behaviour.
 *
 * Global generation runs through the engine with a temp directory standing in
 * for `$HOME`, so nothing touches the real home directory.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generate } from '../../../../src/core/generate/engine.js';
import { runGenerate } from '../../../../src/cli/commands/generate.js';
import { createCanonicalProject } from '../../../e2e/helpers/canonical.js';
import { cleanup } from '../../../e2e/helpers/setup.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  CODEBUFF_GLOBAL_ROOT_FILE,
  CODEBUFF_GLOBAL_MCP_FILE,
  CODEBUFF_GLOBAL_SKILLS_DIR,
  CODEBUFF_IGNORE_FILE,
  CODEBUFF_MCP_FILE,
} from '../../../../src/targets/codebuff/constants.js';

const CONFIG = `version: 1
targets: [codebuff]
features: [rules, commands, agents, skills, mcp, hooks, ignore, permissions]
`;

let dir = '';

afterEach(() => {
  if (dir) cleanup(dir);
  dir = '';
});

function config(): ValidatedConfig {
  return {
    version: 1,
    targets: ['codebuff'],
    features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'hooks', 'ignore', 'permissions'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

function canonical(): CanonicalFiles {
  return {
    rules: [
      {
        source: '/c/.agentsmesh/rules/_root.md',
        root: true,
        targets: [],
        description: '',
        globs: [],
        body: '# Standards',
      },
      {
        source: '/c/.agentsmesh/rules/typescript.md',
        root: false,
        targets: [],
        description: 'TypeScript',
        globs: ['src/**/*.ts'],
        body: '- No any',
      },
    ],
    commands: [
      {
        source: '/c/.agentsmesh/commands/review.md',
        name: 'review',
        description: 'Review',
        allowedTools: [],
        body: 'Review it.',
      },
    ],
    agents: [],
    skills: [
      {
        source: '/c/.agentsmesh/skills/api-generator/SKILL.md',
        name: 'api-generator',
        description: 'Generate routes',
        body: '# API',
        supportingFiles: [],
      },
    ],
    mcp: { mcpServers: { github: { command: 'npx', args: [], env: {}, headers: {} } } },
    permissions: null,
    hooks: null,
    ignore: ['dist/'],
  };
}

describe('codebuff global scope generation', () => {
  it('writes the home dotfile, shared skills and mcp — and nothing else', async () => {
    dir = createCanonicalProject(CONFIG);
    mkdirSync(join(dir, 'home'), { recursive: true });
    const home = join(dir, 'home');

    const results = await generate({
      config: config(),
      canonical: canonical(),
      projectRoot: home,
      scope: 'global',
    });

    expect(results.map((r) => r.path).sort()).toEqual([
      CODEBUFF_GLOBAL_ROOT_FILE,
      CODEBUFF_GLOBAL_MCP_FILE,
      `${CODEBUFF_GLOBAL_SKILLS_DIR}/am-command-review/SKILL.md`,
      `${CODEBUFF_GLOBAL_SKILLS_DIR}/api-generator/SKILL.md`,
    ]);
  });

  it('embeds the scoped rule into the single home knowledge file', async () => {
    dir = createCanonicalProject(CONFIG);
    mkdirSync(join(dir, 'home'), { recursive: true });

    const results = await generate({
      config: config(),
      canonical: canonical(),
      projectRoot: join(dir, 'home'),
      scope: 'global',
    });
    const root = results.find((r) => r.path === CODEBUFF_GLOBAL_ROOT_FILE);

    expect(root?.content).toContain('# Standards');
    expect(root?.content).toContain('<!-- agentsmesh:embedded-rules:start -->');
    expect(root?.content).toContain('- No any');
  });

  it('never emits a nested knowledge file or an ignore file at global scope', async () => {
    dir = createCanonicalProject(CONFIG);
    mkdirSync(join(dir, 'home'), { recursive: true });

    const results = await generate({
      config: config(),
      canonical: canonical(),
      projectRoot: join(dir, 'home'),
      scope: 'global',
    });

    expect(results.some((r) => r.path === 'src/AGENTS.md')).toBe(false);
    expect(results.some((r) => r.path === CODEBUFF_IGNORE_FILE)).toBe(false);
  });
});

describe('codebuff revocation', () => {
  // `.agents/mcp.json` lives in the user-scaffolded `.agents/` tree and is
  // hand-authored, so it is co-owned: emptying canonical stops writing servers
  // into it but must never delete the file. Revoking to EMPTY is the same
  // documented gap every co-owned file has — the run emits nothing, so there is
  // nothing to merge a revocation into.
  it('keeps .agents/mcp.json when the last canonical server is removed', async () => {
    dir = createCanonicalProject(CONFIG);
    expect((await runGenerate({ targets: 'codebuff' }, dir, { printMatrix: false })).exitCode).toBe(
      0,
    );
    expect(existsSync(join(dir, CODEBUFF_MCP_FILE))).toBe(true);

    writeFileSync(join(dir, '.agentsmesh/mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2));
    expect((await runGenerate({ targets: 'codebuff' }, dir, { printMatrix: false })).exitCode).toBe(
      0,
    );

    expect(existsSync(join(dir, CODEBUFF_MCP_FILE))).toBe(true);
  });

  it('deletes .codebuffignore when the canonical ignore file is emptied', async () => {
    dir = createCanonicalProject(CONFIG);
    expect((await runGenerate({ targets: 'codebuff' }, dir, { printMatrix: false })).exitCode).toBe(
      0,
    );
    expect(existsSync(join(dir, CODEBUFF_IGNORE_FILE))).toBe(true);

    writeFileSync(join(dir, '.agentsmesh/ignore'), '');
    expect((await runGenerate({ targets: 'codebuff' }, dir, { printMatrix: false })).exitCode).toBe(
      0,
    );

    expect(existsSync(join(dir, CODEBUFF_IGNORE_FILE))).toBe(false);
  });

  it('removes a stale projected skill but leaves user agent modules in .agents alone', async () => {
    dir = createCanonicalProject(CONFIG);
    expect((await runGenerate({ targets: 'codebuff' }, dir, { printMatrix: false })).exitCode).toBe(
      0,
    );

    const staleSkill = join(dir, '.agents/skills/stale-skill/SKILL.md');
    mkdirSync(join(dir, '.agents/skills/stale-skill'), { recursive: true });
    writeFileSync(staleSkill, '---\nname: stale-skill\n---\n# Stale');
    const userAgent = join(dir, '.agents/my-custom-agent.ts');
    writeFileSync(userAgent, 'export default {} as never;\n');
    mkdirSync(join(dir, '.agents/types'), { recursive: true });
    writeFileSync(join(dir, '.agents/types/agent-definition.ts'), 'export type A = never;\n');

    expect((await runGenerate({ targets: 'codebuff' }, dir, { printMatrix: false })).exitCode).toBe(
      0,
    );

    expect(existsSync(staleSkill)).toBe(false);
    expect(readFileSync(userAgent, 'utf-8')).toContain('export default');
    expect(existsSync(join(dir, '.agents/types/agent-definition.ts'))).toBe(true);
  });

  it('leaves a nested knowledge file behind when its rule is deleted (documented limitation)', async () => {
    dir = createCanonicalProject(CONFIG);
    expect((await runGenerate({ targets: 'codebuff' }, dir, { printMatrix: false })).exitCode).toBe(
      0,
    );
    expect(existsSync(join(dir, 'src/AGENTS.md'))).toBe(true);

    rmSync(join(dir, '.agentsmesh/rules/typescript.md'), { force: true });
    expect((await runGenerate({ targets: 'codebuff' }, dir, { printMatrix: false })).exitCode).toBe(
      0,
    );

    // Nested files live in user source directories, so no cleanup rule can
    // claim them without risking user content. Same limitation as codex-cli.
    expect(existsSync(join(dir, 'src/AGENTS.md'))).toBe(true);
  });
});
