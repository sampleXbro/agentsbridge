import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60_000,
    hookTimeout: 10_000,
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/contract/**/*.test.ts',
      'tests/e2e/**/*.test.ts',
      'tests/agents-folder-structure-research.test.ts',
      'tests/import-generate-roundtrip.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/index.ts',
        'src/core/types.ts',
        'src/targets/base-target.ts',
        'src/targets/target.interface.ts',
        'src/targets/*/constants.ts',
        'src/targets/cline/linter.ts',
        'src/targets/copilot/linter.ts',
        'src/targets/gemini-cli/linter.ts',
        'src/targets/codex-cli/linter.ts',
        'src/targets/windsurf/linter.ts',
        'src/cli/version.ts',
        'src/targets/cursor/importer.ts',
        'src/targets/claude-code/importer.ts',
        'src/targets/cline/importer.ts',
        'src/cli/commands/watch.ts', // async watcher; covered by tests/integration/watch.integration.test.ts
        'src/config/remote/remote-fetcher.ts', // network/cache; covered by unit + integration
        'src/config/lock.ts', // file I/O; covered by unit + integration
        'src/utils/fs.ts', // file I/O wrapper; covered by unit tests
        'src/utils/hash.ts', // thin crypto wrapper
        'src/core/result-types.ts', // types-only module
        'src/install/git-pin.ts', // network/git plumbing path
        'src/install/local-source.ts', // local source helper with heavy I/O
        'src/install/native-path-pick-infer.ts', // install inference helper
        'src/install/native-path-pick-infer-copilot.ts', // copilot-specific inference helper
        'src/install/install-conflicts.ts', // install conflict resolver branch-heavy I/O
        'src/install/install-manifest.ts', // manifest persistence adapter
        'src/install/install-name-generator.ts', // naming helper
        'src/install/install-entry-selection.ts', // install selection helper
        'src/install/prompts.ts', // CLI prompt text helpers
        'src/install/run-install-resolve.ts', // orchestration glue
        'src/install/url-parser.ts', // input parser with broad legacy compatibility branches
        'src/install/yaml-writer.ts', // thin yaml write wrapper
        'src/targets/junie/generator.ts', // junie-specific format adapter
        'src/targets/junie/importer.ts', // junie-specific format adapter
        'src/targets/gemini-cli/policies-importer.ts', // gemini policies adapter
        'src/targets/gemini-cli/importer.ts', // gemini import adapter
        'src/targets/windsurf/importer-workflows.ts', // windsurf workflow import adapter
        'src/targets/windsurf/generator.ts', // windsurf format adapter
        'src/targets/windsurf/importer.ts', // windsurf import adapter
        'src/targets/projected-agent-skill.ts', // projected metadata adapter
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 83,
      },
    },
  },
});
