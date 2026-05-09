import { describe, it, expect } from 'vitest';
import { descriptor } from '../../../../src/targets/crush/index.js';
import {
  CRUSH_ROOT_FILE,
  CRUSH_SKILLS_DIR,
  CRUSH_CONFIG_FILE,
  CRUSH_IGNORE,
  CRUSH_GLOBAL_ROOT_FILE,
  CRUSH_GLOBAL_SKILLS_DIR,
  CRUSH_GLOBAL_CONFIG_FILE,
} from '../../../../src/targets/crush/constants.js';

describe('crush descriptor global layout', () => {
  it('descriptor.globalSupport is defined', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('descriptor.globalSupport.layout is defined', () => {
    expect(descriptor.globalSupport!.layout).toBeDefined();
  });

  it('global layout has correct rootInstructionPath', () => {
    expect(descriptor.globalSupport!.layout.rootInstructionPath).toBe(CRUSH_GLOBAL_ROOT_FILE);
  });

  it('global layout has correct skillDir', () => {
    expect(descriptor.globalSupport!.layout.skillDir).toBe(CRUSH_GLOBAL_SKILLS_DIR);
  });

  it('rewriteGeneratedPath transforms AGENTS.md to global path', () => {
    const rewriteGeneratedPath = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewriteGeneratedPath(CRUSH_ROOT_FILE);
    expect(result).toBe(CRUSH_GLOBAL_ROOT_FILE);
  });

  it('rewriteGeneratedPath transforms crush.json to global path', () => {
    const rewriteGeneratedPath = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewriteGeneratedPath(CRUSH_CONFIG_FILE);
    expect(result).toBe(CRUSH_GLOBAL_CONFIG_FILE);
  });

  it('rewriteGeneratedPath drops .crushignore in global mode', () => {
    const rewriteGeneratedPath = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewriteGeneratedPath(CRUSH_IGNORE);
    expect(result).toBeNull();
  });

  it('rewriteGeneratedPath transforms .crush/skills/ paths to global paths', () => {
    const rewriteGeneratedPath = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewriteGeneratedPath(`${CRUSH_SKILLS_DIR}/api-generator/SKILL.md`);
    expect(result).toBe(`${CRUSH_GLOBAL_SKILLS_DIR}/api-generator/SKILL.md`);
  });

  it('globalSupport detectionPaths includes global config', () => {
    const paths = descriptor.globalSupport!.detectionPaths;
    expect(paths).toContain(CRUSH_GLOBAL_ROOT_FILE);
    expect(paths).toContain(CRUSH_GLOBAL_CONFIG_FILE);
    expect(paths).toContain(CRUSH_GLOBAL_SKILLS_DIR);
  });

  it('rewriteGeneratedPath returns path unchanged for unknown files', () => {
    const rewriteGeneratedPath = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewriteGeneratedPath('unknown-file.txt');
    expect(result).toBe('unknown-file.txt');
  });

  it('global capabilities have correct values', () => {
    const caps = descriptor.globalSupport!.capabilities;
    expect(caps.rules).toBe('native');
    expect(caps.skills).toBe('native');
    expect(caps.mcp).toBe('native');
    expect(caps.hooks).toBe('native');
    expect(caps.ignore).toBe('none');
    expect(caps.permissions).toBe('none');
    expect(caps.commands).toBe('none');
    expect(caps.agents).toBe('none');
  });
});
