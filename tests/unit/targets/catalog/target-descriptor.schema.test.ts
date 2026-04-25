import { describe, it, expect } from 'vitest';
import {
  validateDescriptor,
  targetDescriptorSchema,
} from '../../../../src/targets/catalog/target-descriptor.schema.js';
import { BUILTIN_TARGETS } from '../../../../src/targets/catalog/builtin-targets.js';

const minimalDescriptor = {
  id: 'test-plugin',
  generators: {
    name: 'test-plugin',
    generateRules: () => [],
    importFrom: async () => [],
  },
  capabilities: {
    rules: 'native',
    additionalRules: 'none',
    commands: 'none',
    agents: 'none',
    skills: 'none',
    mcp: 'none',
    hooks: 'none',
    ignore: 'none',
    permissions: 'none',
  },
  emptyImportMessage: 'No test config found.',
  lintRules: null,
  project: {
    paths: {
      rulePath: (slug: string) => slug,
      commandPath: () => null,
      agentPath: () => null,
    },
  },
  buildImportPaths: async () => {},
  detectionPaths: [],
};

describe('targetDescriptorSchema', () => {
  it('validates every built-in descriptor without throwing', () => {
    for (const descriptor of BUILTIN_TARGETS) {
      expect(() => validateDescriptor(descriptor)).not.toThrow();
    }
  });

  it('validates a minimal plugin descriptor', () => {
    expect(() => validateDescriptor(minimalDescriptor)).not.toThrow();
  });

  it('rejects descriptor missing id', () => {
    const { id: _id, ...noId } = minimalDescriptor;
    void _id;
    expect(() => targetDescriptorSchema.parse(noId)).toThrow();
  });

  it('rejects descriptor with invalid id (uppercase)', () => {
    expect(() => validateDescriptor({ ...minimalDescriptor, id: 'BadId' })).toThrow();
  });

  it('rejects descriptor missing generateRules', () => {
    const { generateRules: _gr, ...noGenRules } = minimalDescriptor.generators;
    void _gr;
    expect(() =>
      validateDescriptor({ ...minimalDescriptor, generators: { ...noGenRules } }),
    ).toThrow();
  });

  it('rejects descriptor with invalid capability level', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        capabilities: {
          ...minimalDescriptor.capabilities,
          rules: 'unsupported-level',
        },
      }),
    ).toThrow();
  });

  it('accepts capability as object with level field', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        capabilities: {
          ...minimalDescriptor.capabilities,
          rules: { level: 'native', flavor: 'custom' },
        },
      }),
    ).not.toThrow();
  });

  it('rejects null lintRules replaced with non-function non-null', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        lintRules: 'not-a-function',
      }),
    ).toThrow();
  });

  it('validates the rich-plugin descriptor with all optional fields', async () => {
    const { descriptor } = await import('../../../../tests/fixtures/plugins/rich-plugin/index.js');
    expect(() => validateDescriptor(descriptor)).not.toThrow();

    // Verify key structural fields are present (passthrough allows them)
    expect(descriptor.id).toBe('rich-plugin');
    expect(descriptor.generators.primaryRootInstructionPath).toBe('.rich/ROOT.md');
    expect(descriptor.project.rootInstructionPath).toBe('.rich/ROOT.md');
    expect(descriptor.project.skillDir).toBe('.rich/skills');
    expect(descriptor.project.outputFamilies).toHaveLength(3);
    expect(descriptor.global.rootInstructionPath).toBe('.rich/ROOT.md');
    expect(descriptor.global.renderPrimaryRootInstruction).toBeTypeOf('function');
    expect(descriptor.globalCapabilities.rules).toBe('native');
    expect(descriptor.globalDetectionPaths).toHaveLength(3);
    expect(descriptor.lint.commands).toBeTypeOf('function');
    expect(descriptor.lint.mcp).toBeTypeOf('function');
    expect(descriptor.lint.permissions).toBeTypeOf('function');
    expect(descriptor.lint.hooks).toBeTypeOf('function');
    expect(descriptor.lint.ignore).toBeTypeOf('function');
    expect(descriptor.supportsConversion).toEqual({ commands: true, agents: true });
    expect(descriptor.generateScopeExtras).toBeTypeOf('function');
    expect(descriptor.sharedArtifacts).toEqual({ '.rich/skills/': 'owner' });
    expect(descriptor.emitScopedSettings).toBeTypeOf('function');
    expect(descriptor.postProcessHookOutputs).toBeTypeOf('function');
  });
});
