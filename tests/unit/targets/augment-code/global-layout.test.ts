import { describe, it, expect } from 'vitest';
import { descriptor } from '../../../../src/targets/augment-code/index.js';
import {
  AUGMENT_CODE_RULES_DIR,
  AUGMENT_CODE_COMMANDS_DIR,
  AUGMENT_CODE_SKILLS_DIR,
  AUGMENT_CODE_SETTINGS_FILE,
  AUGMENT_CODE_IGNORE_FILE,
  AUGMENT_CODE_GLOBAL_RULES_DIR,
  AUGMENT_CODE_GLOBAL_COMMANDS_DIR,
  AUGMENT_CODE_GLOBAL_SKILLS_DIR,
  AUGMENT_CODE_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/augment-code/constants.js';

describe('augment-code global layout', () => {
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport.layout.rewriteGeneratedPath rewrites rules dir', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${AUGMENT_CODE_RULES_DIR}/typescript.md`);
    expect(result).toBe(`${AUGMENT_CODE_GLOBAL_RULES_DIR}/typescript.md`);
  });

  it('globalSupport.layout.rewriteGeneratedPath rewrites commands dir', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${AUGMENT_CODE_COMMANDS_DIR}/review.md`);
    expect(result).toBe(`${AUGMENT_CODE_GLOBAL_COMMANDS_DIR}/review.md`);
  });

  it('globalSupport.layout.rewriteGeneratedPath rewrites skills dir', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${AUGMENT_CODE_SKILLS_DIR}/api-generator/SKILL.md`);
    expect(result).toBe(`${AUGMENT_CODE_GLOBAL_SKILLS_DIR}/api-generator/SKILL.md`);
  });

  it('globalSupport.layout.rewriteGeneratedPath rewrites settings.json', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(AUGMENT_CODE_SETTINGS_FILE);
    expect(result).toBe(AUGMENT_CODE_GLOBAL_SETTINGS_FILE);
  });

  it('globalSupport.layout.rewriteGeneratedPath returns null for .augmentignore', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(AUGMENT_CODE_IGNORE_FILE);
    expect(result).toBeNull();
  });

  it('globalSupport.capabilities has hooks: none', () => {
    expect(descriptor.globalSupport!.capabilities.hooks).toBe('none');
  });

  it('globalSupport.capabilities has ignore: none', () => {
    expect(descriptor.globalSupport!.capabilities.ignore).toBe('none');
  });

  it('globalSupport.capabilities has rules: native', () => {
    expect(descriptor.globalSupport!.capabilities.rules).toBe('native');
  });

  it('globalSupport.capabilities has skills: native', () => {
    expect(descriptor.globalSupport!.capabilities.skills).toBe('native');
  });

  it('globalSupport.capabilities has mcp: native', () => {
    expect(descriptor.globalSupport!.capabilities.mcp).toBe('native');
  });

  it('globalSupport.detectionPaths includes global dirs', () => {
    const paths = descriptor.globalSupport!.detectionPaths;
    expect(paths).toContain(AUGMENT_CODE_GLOBAL_RULES_DIR);
    expect(paths).toContain(AUGMENT_CODE_GLOBAL_SKILLS_DIR);
    expect(paths).toContain(AUGMENT_CODE_GLOBAL_SETTINGS_FILE);
  });
});
