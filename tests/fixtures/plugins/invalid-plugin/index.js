/**
 * Invalid-descriptor plugin fixture: exports a `descriptor` that fails
 * validateDescriptor (id missing required shape). Exercises the per-descriptor
 * try/catch in loadPlugin — the loader must surface the source in the error.
 */

export const descriptor = {
  id: 'BAD ID WITH SPACES',
  generators: {},
  capabilities: {},
  emptyImportMessage: '',
  lintRules: null,
  project: { paths: {} },
  buildImportPaths: async () => {},
  detectionPaths: [],
};
