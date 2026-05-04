import { describe, it, expect } from 'vitest';
import { descriptor } from '../../../../src/targets/warp/index.js';
import { WARP_SKILLS_DIR, WARP_GLOBAL_SKILLS_DIR } from '../../../../src/targets/warp/constants.js';

describe('warp global layout', () => {
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
    expect(descriptor.globalSupport!.capabilities.rules).toBe('none');
    expect(descriptor.globalSupport!.capabilities.skills).toBe('native');
    expect(descriptor.capabilities.rules).toBe('native');
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(WARP_GLOBAL_SKILLS_DIR);
  });

  it('descriptor supports conversion for commands and agents', () => {
    expect(descriptor.supportsConversion).toEqual({ commands: true, agents: true });
  });

  it('does not declare sharedArtifacts', () => {
    expect(descriptor).not.toHaveProperty('sharedArtifacts');
  });
});
