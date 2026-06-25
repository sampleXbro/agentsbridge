import { describe, it, expect } from 'vitest';
import {
  validateDescriptor,
  targetDescriptorSchema,
} from '../../../../src/targets/catalog/target-descriptor.schema.js';
import { BUILTIN_TARGETS } from '../../../../src/targets/catalog/builtin-targets.js';

const minimalDescriptor = {
  id: 'test-plugin',
  metadata: {
    displayName: 'Test Plugin',
    category: 'cli' as const,
    officialUrl: 'https://example.test/',
    shortDescription: 'Schema-test plugin descriptor',
  },
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

  it('rejects legacy global descriptor fields in plugin descriptors', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        globalCapabilities: minimalDescriptor.capabilities,
      }),
    ).toThrow(/globalSupport/);
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        globalDetectionPaths: ['.legacy'],
      }),
    ).toThrow(/globalSupport/);
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        global: minimalDescriptor.project,
      }),
    ).toThrow(/globalSupport/);
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        generateScopeExtras: async () => [],
      }),
    ).toThrow(/globalSupport/);
  });

  it('rejects descriptor missing id', () => {
    const { id: _id, ...noId } = minimalDescriptor;
    void _id;
    expect(() => targetDescriptorSchema.parse(noId)).toThrow();
  });

  it('rejects descriptor missing metadata (H6)', () => {
    const { metadata: _metadata, ...noMetadata } = minimalDescriptor;
    void _metadata;
    expect(() => targetDescriptorSchema.parse(noMetadata)).toThrow(/metadata/);
  });

  it('rejects descriptor whose metadata.category is not in the documented union', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        metadata: { ...minimalDescriptor.metadata, category: 'unknown-category' },
      }),
    ).toThrow();
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

  it('rejects non-none capabilities without a matching generator or sidecar emitter', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        capabilities: {
          ...minimalDescriptor.capabilities,
          commands: 'native',
        },
      }),
    ).toThrow(/generateCommands/);
  });

  it('rejects global non-none capabilities without a matching implementation path', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        globalSupport: {
          capabilities: {
            ...minimalDescriptor.capabilities,
            hooks: 'partial',
          },
          detectionPaths: ['.test-global'],
          layout: minimalDescriptor.project,
        },
      }),
    ).toThrow(/generateHooks/);
  });

  it('accepts settings-backed capabilities when a scoped settings emitter exists', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        capabilities: {
          ...minimalDescriptor.capabilities,
          mcp: 'native',
          hooks: 'partial',
        },
        emitScopedSettings: () => [],
      }),
    ).not.toThrow();
  });

  it('accepts a global settings-backed capability satisfied by scopeExtras', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        globalSupport: {
          capabilities: { ...minimalDescriptor.capabilities, permissions: 'native' },
          detectionPaths: ['.test-global'],
          layout: minimalDescriptor.project,
          scopeExtras: async () => [],
        },
      }),
    ).not.toThrow();
  });

  it('does not let scopeExtras satisfy a project-scope settings-backed capability', () => {
    // scopeExtras runs at global scope only, so a project-scope native permissions
    // capability still requires generatePermissions/emitScopedSettings.
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        capabilities: { ...minimalDescriptor.capabilities, permissions: 'native' },
        globalSupport: {
          capabilities: minimalDescriptor.capabilities,
          detectionPaths: ['.test-global'],
          layout: minimalDescriptor.project,
          scopeExtras: async () => [],
        },
      }),
    ).toThrow(/generatePermissions/);
  });

  it('rejects null lintRules replaced with non-function non-null', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        lintRules: 'not-a-function',
      }),
    ).toThrow();
  });

  it('accepts a descriptor with nativeInstall pickPaths', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        nativeInstall: {
          pickPaths: [
            {
              prefix: '.test/rules',
              feature: 'rules',
              strategy: { kind: 'basename', suffix: '.md' },
            },
            { prefix: '.test/skills', feature: 'skills', strategy: { kind: 'skillDir' } },
            { prefix: '.test/skills/', feature: 'skills', strategy: { kind: 'firstSegment' } },
          ],
          dialectHints: [{ frontmatterKey: 'alwaysApply' }],
        },
      }),
    ).not.toThrow();
  });

  it('accepts a descriptor with a nativeInstall.inferPick resolver', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        nativeInstall: { inferPick: async () => ({}) },
      }),
    ).not.toThrow();
  });

  it('rejects a nativeInstall pick strategy with an unknown kind', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        nativeInstall: {
          pickPaths: [{ prefix: '.test', feature: 'rules', strategy: { kind: 'bogus' } }],
        },
      }),
    ).toThrow();
  });

  it('rejects a basename strategy missing its suffix', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        nativeInstall: {
          pickPaths: [{ prefix: '.test', feature: 'rules', strategy: { kind: 'basename' } }],
        },
      }),
    ).toThrow();
  });

  it('rejects unknown keys inside nativeInstall (strict)', () => {
    expect(() =>
      validateDescriptor({
        ...minimalDescriptor,
        nativeInstall: { bogusKey: true },
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
    expect(descriptor.globalSupport.layout.rootInstructionPath).toBe('.rich/ROOT.md');
    expect(descriptor.globalSupport.layout.renderPrimaryRootInstruction).toBeTypeOf('function');
    expect(descriptor.globalSupport.capabilities.rules).toBe('native');
    expect(descriptor.globalSupport.detectionPaths).toHaveLength(3);
    expect(descriptor.lint.commands).toBeTypeOf('function');
    expect(descriptor.lint.mcp).toBeTypeOf('function');
    expect(descriptor.lint.permissions).toBeTypeOf('function');
    expect(descriptor.lint.hooks).toBeTypeOf('function');
    expect(descriptor.lint.ignore).toBeTypeOf('function');
    expect(descriptor.supportsConversion).toEqual({ commands: true, agents: true });
    expect(descriptor.globalSupport.scopeExtras).toBeTypeOf('function');
    expect(descriptor.sharedArtifacts).toEqual({ '.rich/skills/': 'owner' });
    expect(descriptor.emitScopedSettings).toBeTypeOf('function');
    expect(descriptor.postProcessHookOutputs).toBeTypeOf('function');
  });
});
