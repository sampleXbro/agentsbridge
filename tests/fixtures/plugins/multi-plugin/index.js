/**
 * Multi-descriptor plugin fixture (exports `descriptors` array).
 */

/* eslint-disable no-unused-vars */

const baseCaps = {
  rules: 'native',
  additionalRules: 'none',
  commands: 'none',
  agents: 'none',
  skills: 'none',
  mcp: 'none',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

function makeDescriptor(id) {
  return {
    id,
    generators: {
      name: id,
      generateRules() { return [{ path: `${id}.md`, content: `# ${id}` }]; },
      async importFrom() { return []; },
    },
    capabilities: baseCaps,
    emptyImportMessage: `no ${id}`,
    lintRules: null,
    project: {
      managedOutputs: { dirs: [], files: [`${id}.md`] },
      paths: {
        rulePath() { return `${id}.md`; },
        commandPath() { return null; },
        agentPath() { return null; },
      },
    },
    buildImportPaths: async () => {},
    detectionPaths: [],
  };
}

export const descriptors = [makeDescriptor('multi-a'), makeDescriptor('multi-b')];
