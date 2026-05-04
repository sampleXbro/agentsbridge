import { describe, it, expect } from 'vitest';
import { descriptor } from '../../../../src/targets/amp/index.js';
import {
  AMP_ROOT_FILE,
  AMP_MCP_FILE,
  AMP_SKILLS_DIR,
  AMP_GLOBAL_ROOT_FILE,
  AMP_GLOBAL_MCP_FILE,
  AMP_GLOBAL_SKILLS_DIR,
} from '../../../../src/targets/amp/constants.js';

describe('amp global layout', () => {
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms AGENTS.md to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(AMP_ROOT_FILE)).toBe(AMP_GLOBAL_ROOT_FILE);
  });

  it('rewriteGeneratedPath transforms .amp/settings.json to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(AMP_MCP_FILE)).toBe(AMP_GLOBAL_MCP_FILE);
  });

  it('rewriteGeneratedPath transforms .agents/skills/ to global skills path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const skillPath = `${AMP_SKILLS_DIR}/debugging/SKILL.md`;
    expect(rewrite(skillPath)).toBe(`${AMP_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`);
  });

  it('globalSupport.capabilities matches project capabilities', () => {
    expect(descriptor.globalSupport!.capabilities).toEqual(descriptor.capabilities);
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(AMP_GLOBAL_ROOT_FILE);
    expect(descriptor.globalSupport!.detectionPaths).toContain(AMP_GLOBAL_MCP_FILE);
  });

  it('descriptor declares shared artifacts as consumer', () => {
    expect(descriptor.sharedArtifacts).toEqual({ '.agents/skills/': 'consumer' });
  });

  it('descriptor supports conversion for commands and agents', () => {
    expect(descriptor.supportsConversion).toEqual({ commands: true, agents: true });
  });
});
