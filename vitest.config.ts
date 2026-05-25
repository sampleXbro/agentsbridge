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
      // ─────────────────────────────────────────────────────────────────────
      // Coverage exclusions, grouped honestly by reason. The threshold below
      // applies to the REMAINING files. Coverage of excluded files is
      // verified via integration / e2e tests, NOT counted in this number.
      // Adding a file here must be justified by one of the documented
      // categories; "covered by integration tests" alone is insufficient
      // because integration tests aren't visible to the unit threshold.
      // ─────────────────────────────────────────────────────────────────────
      exclude: [
        // (1) Types-only or barrel modules: nothing to execute.
        'src/**/index.ts',
        'src/core/types.ts',
        'src/core/result-types.ts',
        'src/targets/catalog/base-target.ts',
        'src/targets/catalog/target.interface.ts',
        'src/targets/*/constants.ts',
        'src/cli/version.ts',

        // (2) Thin I/O wrappers over Node primitives; the branches are
        // ENOENT / EACCES guards verified inline by callers' integration
        // tests. No new business logic lives here.
        'src/utils/filesystem/fs.ts',
        'src/utils/crypto/hash.ts',
        'src/config/core/lock.ts',
        'src/install/core/yaml-writer.ts',

        // (3) Network / subprocess boundaries: vitest cannot instrument
        // forked subprocesses or live remote calls. Exercised end-to-end
        // via the `tests/e2e/` and `tests/integration/install-*` suites.
        'src/mcp/server.ts',
        'src/config/remote/remote-fetcher.ts',
        'src/install/source/git-pin.ts',
        'src/cli/commands/watch.ts',

        // (4) Per-target legacy linters / importers / format adapters whose
        // primary behavior is large fixture-driven branching: covered by
        // matrix / generate / import integration suites. Adding focused
        // unit tests here would duplicate fixture loading.
        'src/targets/cline/linter.ts',
        'src/targets/copilot/linter.ts',
        'src/targets/gemini-cli/linter.ts',
        'src/targets/codex-cli/linter.ts',
        'src/targets/windsurf/linter.ts',
        'src/targets/cursor/importer.ts',
        'src/targets/claude-code/importer.ts',
        'src/targets/cline/importer.ts',
        'src/targets/junie/generator.ts',
        'src/targets/junie/importer.ts',
        'src/targets/gemini-cli/policies-importer.ts',
        'src/targets/gemini-cli/importer.ts',
        'src/targets/windsurf/importer-workflows.ts',
        'src/targets/windsurf/generator.ts',
        'src/targets/windsurf/importer.ts',
        'src/targets/projection/projected-agent-skill.ts',

        // (5) Install-side per-target hint maps and large URL parser.
        // The hardcoded ladders in these files are tracked as a separate
        // refactor (descriptor-driven dispatch) — see `tasks/todo.md`.
        // Once refactored, the resulting smaller modules will be unit-testable
        // and should re-enter this threshold.
        'src/install/native/native-path-pick-infer.ts',
        'src/install/native/native-path-pick-infer-copilot.ts',
        'src/install/source/url-parser.ts',
        'src/install/core/install-manifest.ts',
        'src/install/core/install-conflicts.ts',
        'src/install/core/name-generator.ts',
        'src/install/core/install-entry-selection.ts',
        'src/install/core/prompts.ts',
        'src/install/run/run-install-resolve.ts',

        // (6) Lock-holding orchestration shells. Branching here is mostly
        // delegate-and-route; the underlying handlers (single-pack-install,
        // route-picker-result, run-install-marketplace, run-install-prompts)
        // ARE inside the threshold. Splitting this further would create
        // shells thinner than the harness around them.
        'src/install/run/run-install-locked.ts',
        'src/install/run/run-install-execute.ts',
        'src/install/manual/manual-install-scope.ts',
      ],
      thresholds: {
        // Threshold reflects coverage of the INCLUDED set above. New code in
        // those files must keep this number; new exclusions need a category.
        lines: 95,
        functions: 95,
        branches: 95,
      },
    },
  },
});
