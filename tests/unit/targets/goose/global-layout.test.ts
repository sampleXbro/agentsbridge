import { describe, it, expect } from 'vitest';
import { descriptor } from '../../../../src/targets/goose/index.js';
import {
  GOOSE_ROOT_FILE,
  GOOSE_IGNORE,
  GOOSE_GLOBAL_ROOT_FILE,
  GOOSE_GLOBAL_IGNORE,
  GOOSE_SKILLS_DIR,
} from '../../../../src/targets/goose/constants.js';

describe('goose global layout', () => {
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms .goosehints to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(GOOSE_ROOT_FILE, '')).toBe(GOOSE_GLOBAL_ROOT_FILE);
  });

  it('rewriteGeneratedPath transforms .gooseignore to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(GOOSE_IGNORE, '')).toBe(GOOSE_GLOBAL_IGNORE);
  });

  it('rewriteGeneratedPath preserves .agents/skills/ paths', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const skillPath = `${GOOSE_SKILLS_DIR}/debugging/SKILL.md`;
    expect(rewrite(skillPath, '')).toBe(skillPath);
  });

  it('globalSupport.capabilities matches project capabilities', () => {
    expect(descriptor.globalSupport!.capabilities).toEqual(descriptor.capabilities);
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(GOOSE_GLOBAL_ROOT_FILE);
  });
});
