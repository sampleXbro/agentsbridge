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
  });

  it('declares none for unsupported features', () => {
    expect(descriptor.capabilities.commands).toBe('none');
    expect(descriptor.capabilities.agents).toBe('none');
    expect(descriptor.capabilities.skills).toBe('none');
    expect(descriptor.capabilities.hooks).toBe('none');
    expect(descriptor.capabilities.ignore).toBe('none');
    expect(descriptor.capabilities.permissions).toBe('none');
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

  it('global capabilities declare native rules and mcp', () => {
    expect(descriptor.globalSupport?.capabilities.rules).toBe('native');
    expect(descriptor.globalSupport?.capabilities.mcp).toBe('native');
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
});
