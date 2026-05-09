import { describe, it, expect } from 'vitest';
import { descriptor } from '../../../../src/targets/trae/index.js';
import {
  TRAE_PROJECT_RULES,
  TRAE_RULES_DIR,
  TRAE_SKILLS_DIR,
  TRAE_MCP_FILE,
  TRAE_IGNORE,
  TRAE_GLOBAL_ROOT_RULE,
  TRAE_GLOBAL_RULES_DIR,
  TRAE_GLOBAL_SKILLS_DIR,
  TRAE_GLOBAL_MCP_FILE,
} from '../../../../src/targets/trae/constants.js';

describe('trae descriptor global layout', () => {
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport.layout.rewriteGeneratedPath rewrites project_rules.md to global root', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(TRAE_PROJECT_RULES)).toBe(TRAE_GLOBAL_ROOT_RULE);
  });

  it('rewriteGeneratedPath rewrites .trae/rules/*.md to .trae/user_rules/*.md', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(`${TRAE_RULES_DIR}/typescript.md`)).toBe(
      `${TRAE_GLOBAL_RULES_DIR}/typescript.md`,
    );
  });

  it('rewriteGeneratedPath rewrites .trae/skills/ to .trae/skills/ (same path)', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(`${TRAE_SKILLS_DIR}/api-generator/SKILL.md`)).toBe(
      `${TRAE_GLOBAL_SKILLS_DIR}/api-generator/SKILL.md`,
    );
  });

  it('rewriteGeneratedPath rewrites mcp.json to global mcp.json', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(TRAE_MCP_FILE)).toBe(TRAE_GLOBAL_MCP_FILE);
  });

  it('rewriteGeneratedPath suppresses project-level ignore file in global mode', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(TRAE_IGNORE)).toBeNull();
  });

  it('globalSupport.capabilities has no commands, agents, hooks, or permissions', () => {
    const caps = descriptor.globalSupport!.capabilities;
    expect(caps.commands).toBe('none');
    expect(caps.agents).toBe('none');
    expect(caps.hooks).toBe('none');
    expect(caps.permissions).toBe('none');
  });

  it('globalSupport.capabilities has native rules, additionalRules, skills, mcp', () => {
    const caps = descriptor.globalSupport!.capabilities;
    expect(caps.rules).toBe('native');
    expect(caps.additionalRules).toBe('native');
    expect(caps.skills).toBe('native');
    expect(caps.mcp).toBe('native');
  });

  it('global layout has correct rootInstructionPath', () => {
    expect(descriptor.globalSupport!.layout.rootInstructionPath).toBe(TRAE_GLOBAL_ROOT_RULE);
  });
});
