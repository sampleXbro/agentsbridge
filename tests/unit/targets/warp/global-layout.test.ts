import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  WARP_SKILLS_DIR,
  WARP_GLOBAL_SKILLS_DIR,
  WARP_GLOBAL_MCP_FILE,
  WARP_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/warp/constants.js';

describe('warp global layout', () => {
  const descriptor = getBuiltinTargetDefinition('warp')!;
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms .warp/skills/ to global skills path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const skillPath = `${WARP_SKILLS_DIR}/debugging/SKILL.md`;
    expect(rewrite(skillPath)).toBe(`${WARP_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`);
  });

  it('globalSupport.capabilities differs from project capabilities', () => {
    expect(descriptor.globalSupport!.capabilities.ignore).toBe('partial');
    expect(descriptor.globalSupport!.capabilities.permissions).toBe('native');
    expect(descriptor.globalSupport!.capabilities.skills).toBe('native');
    expect(descriptor.capabilities.ignore).toBe('native');
    expect(descriptor.capabilities.permissions).toBe('partial');
  });

  it('uses the documented macOS settings.toml path for global permissions', () => {
    expect(WARP_GLOBAL_SETTINGS_FILE).toBe('.warp/settings.toml');
  });

  it('keeps settings.toml out of managed outputs so stale cleanup never deletes it', () => {
    expect(descriptor.globalSupport!.layout.managedOutputs!.files).not.toContain(
      WARP_GLOBAL_SETTINGS_FILE,
    );
  });

  it('globalSupport.capabilities has mcp native (project also native)', () => {
    expect(descriptor.globalSupport!.capabilities.mcp).toBe('native');
    expect(descriptor.capabilities.mcp).toBe('native');
  });

  it('rewriteGeneratedPath passes through the global mcp path unchanged', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(WARP_GLOBAL_MCP_FILE)).toBe(WARP_GLOBAL_MCP_FILE);
  });

  it('managedOutputs.files includes the global mcp file', () => {
    expect(descriptor.globalSupport!.layout.managedOutputs.files).toContain(WARP_GLOBAL_MCP_FILE);
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(WARP_GLOBAL_SKILLS_DIR);
  });

  it('descriptor supports conversion for commands and agents', () => {
    expect(descriptor.supportsConversion).toEqual({ commands: true, agents: true });
  });

  it('does not declare sharedArtifacts', () => {
    // `~/.agents/AGENTS.md` sits under the `.agents/` prefix codex-cli shares,
    // but codex-cli owns `.agents/skills/` only, and no other target writes
    // `.agents/AGENTS.md`. The reference rewriter therefore already falls back
    // to warp's own artifact map; claiming ownership of a leaf file would
    // hijack that map from any future target emitting there.
    expect(descriptor).not.toHaveProperty('sharedArtifacts');
  });
});

describe('warp global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-warp-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['warp'],
      features: ['skills'],
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

  it('preserves embedded skill frontmatter in global mode', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        skills: [
          {
            source: '/proj/.agentsmesh/skills/debugging/SKILL.md',
            name: 'debugging',
            description: 'Debug workflow',
            body: '# Debugging\n\nReproduce first.',
            supportingFiles: [],
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const skill = results.find(
      (r) => r.target === 'warp' && r.path === `${WARP_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
    );
    expect(skill).toBeDefined();
    expect(skill!.content).toContain('name: debugging');
    expect(skill!.content).toContain('description: Debug workflow');
    expect(skill!.content).toContain('# Debugging');
  });

  it('emits ~/.warp/.mcp.json from canonical MCP servers in global mode', async () => {
    const results = await generate({
      config: {
        version: 1,
        targets: ['warp'],
        features: ['mcp'],
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      } as ValidatedConfig,
      canonical: makeCanonical({
        mcp: {
          mcpServers: {
            context7: { type: 'stdio', command: 'npx', args: ['-y', 'context7'], env: {} },
          },
        },
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const mcp = results.find((r) => r.target === 'warp' && r.path === WARP_GLOBAL_MCP_FILE);
    expect(mcp).toBeDefined();
    const parsed = JSON.parse(mcp!.content) as Record<string, Record<string, unknown>>;
    expect(parsed.mcpServers).toHaveProperty('context7');
  });
});
