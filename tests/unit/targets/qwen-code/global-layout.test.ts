import { describe, it, expect } from 'vitest';
import { descriptor } from '../../../../src/targets/qwen-code/index.js';
import {
  QWEN_ROOT,
  QWEN_IGNORE,
  QWEN_SETTINGS,
  QWEN_COMMANDS_DIR,
  QWEN_AGENTS_DIR,
  QWEN_SKILLS_DIR,
  QWEN_GLOBAL_ROOT,
  QWEN_GLOBAL_SETTINGS,
  QWEN_GLOBAL_COMMANDS_DIR,
  QWEN_GLOBAL_AGENTS_DIR,
  QWEN_GLOBAL_SKILLS_DIR,
} from '../../../../src/targets/qwen-code/constants.js';

describe('qwen-code global layout', () => {
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms QWEN.md to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(QWEN_ROOT, '')).toBe(QWEN_GLOBAL_ROOT);
  });

  it('rewriteGeneratedPath transforms .qwen/settings.json to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(QWEN_SETTINGS, '')).toBe(QWEN_GLOBAL_SETTINGS);
  });

  it('rewriteGeneratedPath transforms .qwen/commands to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${QWEN_COMMANDS_DIR}/review.md`, '');
    expect(result).toBe(`${QWEN_GLOBAL_COMMANDS_DIR}/review.md`);
  });

  it('rewriteGeneratedPath transforms .qwen/agents to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${QWEN_AGENTS_DIR}/researcher.md`, '');
    expect(result).toBe(`${QWEN_GLOBAL_AGENTS_DIR}/researcher.md`);
  });

  it('rewriteGeneratedPath transforms .qwen/skills to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${QWEN_SKILLS_DIR}/api-generator/SKILL.md`, '');
    expect(result).toBe(`${QWEN_GLOBAL_SKILLS_DIR}/api-generator/SKILL.md`);
  });

  it('rewriteGeneratedPath returns null for .qwenignore in global mode', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(QWEN_IGNORE, '')).toBeNull();
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(QWEN_GLOBAL_ROOT);
  });
});
