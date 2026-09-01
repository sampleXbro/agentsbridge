import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  AMAZON_Q_RULES_DIR,
  AMAZON_Q_MCP_FILE,
  AMAZON_Q_GLOBAL_RULES_DIR,
  AMAZON_Q_GLOBAL_MCP_FILE,
} from '../../../../src/targets/amazon-q/constants.js';

describe('amazon-q descriptor', () => {
  const descriptor = getBuiltinTargetDefinition('amazon-q')!;
  it('has correct id', () => {
    expect(descriptor.id).toBe('amazon-q');
  });

  it('declares native rules and mcp capabilities', () => {
    expect(descriptor.capabilities.rules).toBe('native');
    expect(descriptor.capabilities.mcp).toBe('native');
    // Non-root rules are emitted as separate .amazonq/rules/<slug>.md files and imported back.
    expect(descriptor.capabilities.additionalRules).toBe('native');
  });

  it('declares none for unsupported features and embedded for partially-supported ones', () => {
    // Commands are native: `/prompts` reads `.amazonq/prompts/<name>.md` (see commands.test.ts).
    expect(descriptor.capabilities.commands).toBe('native');
    expect(descriptor.capabilities.skills).toBe('none');
    // No ignore file exists in Q CLI; patterns ride in agent JSON toolsSettings.
    expect(descriptor.capabilities.ignore).toBe('embedded');
    expect(descriptor.capabilities.hooks).toBe('embedded');
    expect(descriptor.capabilities.permissions).toBe('embedded');
  });

  it('declares native agents capability', () => {
    expect(descriptor.capabilities.agents).toBe('native');
  });

  it('has correct project detection paths', () => {
    expect(descriptor.detectionPaths).toContain(AMAZON_Q_RULES_DIR);
    expect(descriptor.detectionPaths).toContain(AMAZON_Q_MCP_FILE);
  });

  it('has project managedOutputs for rules dir and mcp file', () => {
    expect(descriptor.project.managedOutputs?.dirs).toContain(AMAZON_Q_RULES_DIR);
    expect(descriptor.project.managedOutputs?.files).toContain(AMAZON_Q_MCP_FILE);
  });
});

describe('amazon-q global layout', () => {
  const descriptor = getBuiltinTargetDefinition('amazon-q')!;

  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('global capabilities declare embedded rules and native mcp', () => {
    // paths.rs `mod global` has no rules constant, so `.aws/amazonq/rules/*.md` is read
    // only via the `resources` glob in a generated agent JSON — embedded, not native.
    expect(descriptor.globalSupport?.capabilities.rules).toBe('embedded');
    expect(descriptor.globalSupport?.capabilities.additionalRules).toBe('embedded');
    expect(descriptor.globalSupport?.capabilities.mcp).toBe('native');
    expect(descriptor.globalSupport?.capabilities.ignore).toBe('embedded');
  });

  it('global detection paths include rules dir and mcp file', () => {
    expect(descriptor.globalSupport?.detectionPaths).toContain(AMAZON_Q_GLOBAL_RULES_DIR);
    expect(descriptor.globalSupport?.detectionPaths).toContain(AMAZON_Q_GLOBAL_MCP_FILE);
  });

  it('rewriteGeneratedPath transforms project rule paths to global', () => {
    const rewrite = descriptor.globalSupport?.layout.rewriteGeneratedPath;
    expect(rewrite).toBeDefined();
    const rewritten = rewrite!(`${AMAZON_Q_RULES_DIR}/typescript.md`);
    expect(rewritten).toBe(`${AMAZON_Q_GLOBAL_RULES_DIR}/typescript.md`);
  });

  it('rewriteGeneratedPath transforms mcp file path to global', () => {
    const rewrite = descriptor.globalSupport?.layout.rewriteGeneratedPath;
    expect(rewrite).toBeDefined();
    const rewritten = rewrite!(AMAZON_Q_MCP_FILE);
    expect(rewritten).toBe(AMAZON_Q_GLOBAL_MCP_FILE);
  });

  it('rewriteGeneratedPath passes through unknown paths', () => {
    const rewrite = descriptor.globalSupport?.layout.rewriteGeneratedPath;
    expect(rewrite).toBeDefined();
    const rewritten = rewrite!('some/other/file.txt');
    expect(rewritten).toBe('some/other/file.txt');
  });

  it('global layout rulePath resolves to global rules directory', () => {
    const rulePath = descriptor.globalSupport?.layout.paths.rulePath('security', {
      source: '',
      root: false,
      targets: [],
      description: '',
      globs: [],
      body: '',
    });
    expect(rulePath).toBe(`${AMAZON_Q_GLOBAL_RULES_DIR}/security.md`);
  });

  it('global managedOutputs include global rules dir and mcp file', () => {
    const managedOutputs = descriptor.globalSupport?.layout.managedOutputs;
    expect(managedOutputs?.dirs).toContain(AMAZON_Q_GLOBAL_RULES_DIR);
    expect(managedOutputs?.files).toContain(AMAZON_Q_GLOBAL_MCP_FILE);
  });
});

describe('amazon-q global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-amazon-q-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['amazon-q'],
      features: ['rules'],
      extends: [],
      overrides: {},
      collaboration: { strategy: 'merge', lock_features: [] },
    } as ValidatedConfig;
  }

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

  it('preserves rule body content in global mode', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: '',
            globs: [],
            body: 'Use TDD and strict TypeScript.',
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const rule = results.find(
      (r) => r.target === 'amazon-q' && r.path === `${AMAZON_Q_GLOBAL_RULES_DIR}/_root.md`,
    );
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('Use TDD and strict TypeScript.');
  });

  it('preserves MCP content in global mode (written to .aws/amazonq/mcp.json)', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['mcp'] } as ValidatedConfig,
      canonical: makeCanonical({
        mcp: {
          mcpServers: {
            'test-server': { type: 'stdio', command: 'npx', args: ['-y', '@test/mcp'], env: {} },
          },
        },
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const mcpFile = results.find(
      (r) => r.target === 'amazon-q' && r.path === AMAZON_Q_GLOBAL_MCP_FILE,
    );
    expect(mcpFile).toBeDefined();
    const parsed = JSON.parse(mcpFile!.content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('mcpServers');
    const servers = parsed.mcpServers as Record<string, unknown>;
    expect(servers).toHaveProperty('test-server');
    const server = servers['test-server'] as Record<string, unknown>;
    expect(server.command).toBe('npx');
    expect(server.args).toEqual(['-y', '@test/mcp']);
  });
});
