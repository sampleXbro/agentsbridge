import { describe, it, expect } from 'vitest';
import { descriptor } from '../../../../src/targets/zed/index.js';
import {
  ZED_SETTINGS_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/zed/constants.js';

describe('zed global layout', () => {
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms .zed/settings.json to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(ZED_SETTINGS_FILE)).toBe(ZED_GLOBAL_SETTINGS_FILE);
  });

  it('rewriteGeneratedPath passes through unknown paths', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite('some/other/file.md')).toBe('some/other/file.md');
  });

  it('globalSupport.capabilities differs from project capabilities', () => {
    expect(descriptor.globalSupport!.capabilities.rules).toBe('none');
    expect(descriptor.globalSupport!.capabilities.mcp).toBe('native');
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths).toHaveLength(1);
    expect(descriptor.globalSupport!.detectionPaths).toContain(ZED_GLOBAL_SETTINGS_FILE);
  });

  it('project capabilities have native rules and mcp', () => {
    expect(descriptor.capabilities.rules).toBe('native');
    expect(descriptor.capabilities.additionalRules).toBe('embedded');
    expect(descriptor.capabilities.mcp).toBe('native');
  });

  it('does not declare supportsConversion', () => {
    expect(descriptor.supportsConversion).toBeUndefined();
  });

  it('does not declare sharedArtifacts', () => {
    expect(descriptor.sharedArtifacts).toBeUndefined();
  });
});
