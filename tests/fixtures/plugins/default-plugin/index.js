/**
 * Default-export plugin fixture: descriptor exposed via `export default`.
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

export default {
  id: 'default-plugin',
  generators: {
    name: 'default-plugin',
    generateRules() { return [{ path: 'default-plugin.md', content: '# default' }]; },
    async importFrom() { return []; },
  },
  capabilities: baseCaps,
  emptyImportMessage: 'no default',
  lintRules: null,
  project: {
    managedOutputs: { dirs: [], files: ['default-plugin.md'] },
    paths: {
      rulePath() { return 'default-plugin.md'; },
      commandPath() { return null; },
      agentPath() { return null; },
    },
  },
  buildImportPaths: async () => {},
  detectionPaths: [],
};
