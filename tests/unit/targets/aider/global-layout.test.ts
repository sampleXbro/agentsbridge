import { describe, it, expect } from 'vitest';
import { descriptor } from '../../../../src/targets/aider/index.js';
import {
  AIDER_CONVENTIONS,
  AIDER_IGNORE,
  AIDER_GLOBAL_CONVENTIONS,
  AIDER_GLOBAL_IGNORE,
  AIDER_SKILLS_DIR,
  AIDER_GLOBAL_SKILLS_DIR,
} from '../../../../src/targets/aider/constants.js';

describe('aider global layout', () => {
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms CONVENTIONS.md to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(AIDER_CONVENTIONS, '')).toBe(AIDER_GLOBAL_CONVENTIONS);
  });

  it('rewriteGeneratedPath transforms .aiderignore to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(AIDER_IGNORE, '')).toBe(AIDER_GLOBAL_IGNORE);
  });

  it('rewriteGeneratedPath transforms .aider/skills/ to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const skillPath = `${AIDER_SKILLS_DIR}/debugging/SKILL.md`;
    const expectedPath = `${AIDER_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`;
    expect(rewrite(skillPath, '')).toBe(expectedPath);
  });

  it('rewriteGeneratedPath passes through unknown paths unchanged', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite('some/unknown/path.txt', '')).toBe('some/unknown/path.txt');
  });

  it('globalSupport.capabilities matches project capabilities', () => {
    expect(descriptor.globalSupport!.capabilities).toEqual(descriptor.capabilities);
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(AIDER_GLOBAL_CONVENTIONS);
  });
});
