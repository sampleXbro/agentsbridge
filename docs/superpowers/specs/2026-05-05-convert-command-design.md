# Convert Command Design

Direct tool-to-tool conversion without going through canonical setup.
Lowest-friction way for users to try AgentsMesh.

## Command Interface

```
agentsmesh convert --from <source> --to <target> [--dry-run] [--json]
```

- `--from` (required): source tool ID (e.g. `cursor`, `claude-code`)
- `--to` (required): destination tool ID (e.g. `claude-code`, `cursor`)
- `--dry-run`: preview what would be written without writing
- `--json`: machine-readable output (same envelope as other commands)
- Project-scope only (no `--global`)

### Validation

- Both `--from` and `--to` must be valid target IDs (builtin or plugin-provided)
- `--from` and `--to` must differ
- Source tool must have files to import (info message if empty, not an error)

## Architecture

Approach A: temp directory with symlinks. Zero changes to existing import/generate code.

### Data Flow

```
Real project root                    Temp dir
┌─────────────────┐                 ┌─────────────────┐
│ CLAUDE.md  ──────symlink──────>   │ CLAUDE.md        │
│ .cursor/   ──────symlink──────>   │ .cursor/         │
│ .agentsmesh/  (SKIPPED)           │                  │
│ src/       ──────symlink──────>   │ src/             │
│ ...                               │ ...              │
└─────────────────────────────────  └──────────────────┘
                                         │
                                    1. importFrom(tempDir)
                                         │
                                         ▼
                                    ┌──────────────┐
                                    │ tempDir/     │
                                    │ .agentsmesh/ │  (written by import)
                                    └──────┬───────┘
                                           │
                                    2. loadCanonicalFiles(tempDir)
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │ CanonicalFiles│  (in memory)
                                    └──────┬───────┘
                                           │
                                    3. generate({ canonical,
                                         projectRoot: realRoot,
                                         targetFilter: [to] })
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │GenerateResult[]│ (in memory)
                                    └──────┬───────┘
                                           │
                                    4. Write results to real project root
                                           │
                                    5. rm tempDir
```

### Synthetic Config

Minimal `ValidatedConfig` with all features enabled and only the `--to` target:

- Builtins go in `targets`
- Plugin targets go in `pluginTargets`
- No extends, no collaboration, no overrides

### Key Invariant

The real `.agentsmesh/` directory is never read, written, or symlinked.
The temp dir gets its own fresh canonical from the import step.

### Plugin Target Support

If `--from` or `--to` is not a builtin, the real `agentsmesh.yaml` is loaded
to bootstrap plugins (so their descriptors register). Only for plugin resolution,
not for canonical files.

## Result Type

```typescript
interface ConvertData {
  from: string;
  to: string;
  mode: 'convert' | 'dry-run';
  files: Array<{ path: string; target: string; status: 'created' | 'updated' | 'unchanged' }>;
  summary: { created: number; updated: number; unchanged: number };
}

interface ConvertCommandResult {
  exitCode: number;
  data: ConvertData;
}
```

## Output

### Human

```
# Normal mode:
created .cursor/rules/root.mdc
created .cursor/rules/typescript.mdc
Converted from claude-code → cursor: 2 created, 0 updated, 0 unchanged

# Dry-run mode:
[dry-run] created .cursor/rules/root.mdc (cursor)
[dry-run] created .cursor/rules/typescript.mdc (cursor)

# Empty:
No files found to convert from claude-code.
```

### JSON

Same envelope as other commands:

```json
{ "command": "convert", "success": true, "data": { "from": "claude-code", "to": "cursor", ... } }
```

### Errors

- Unknown target: `Error: Unknown target "foo". Supported: claude-code, cursor, ...`
- Same source/dest: `Error: --from and --to must be different targets.`
- No source files: exit 0 with info message

## File Structure

### New files

- `src/cli/commands/convert.ts` — `runConvert()` (~80 lines)
- `src/cli/renderers/convert.ts` — `renderConvert()` (~30 lines)

### Modified files

- `src/cli/command-handlers.ts` — add `convert` entry
- `src/cli/command-result.ts` — add `ConvertData` type

### Unchanged

- Import runner / descriptor-import-runner
- Generate engine
- Any target descriptor
- Any existing command

## Testing

### Unit tests

**`tests/unit/cli/commands/convert.test.ts`** — `runConvert()`:

- Errors when `--from` missing
- Errors when `--to` missing
- Errors when `--from === --to`
- Errors for unknown `--from` / `--to`
- Calls import on temp dir, not real project root
- Loads canonical from temp dir
- Generates with synthetic config filtered to `--to`
- Writes created/updated results to real project root
- `--dry-run` skips file writing
- Temp dir cleaned up even on error
- Real `.agentsmesh/` never touched

**`tests/unit/cli/renderers/convert.test.ts`** — `renderConvert()`:

- Shows created/updated file paths
- Summary line "Converted from X → Y"
- Dry-run prefixes with `[dry-run]`
- Empty results message

**`tests/unit/cli/command-handlers.test.ts`** — add convert handler:

- Delegates to `runConvert(flags)`
- JSON mode emits envelope

### Integration tests

**`tests/integration/convert.integration.test.ts`**:

- claude-code → cursor: exact output files
- cursor → claude-code: exact output files
- `--dry-run` produces no files
- `--json` returns valid `ConvertData`
- No `.agentsmesh/` created
- Existing `.agentsmesh/` untouched
- Source files preserved
- Exact file counts and paths (strict artifact assertions)

### E2E tests

**`tests/e2e/convert.e2e.test.ts`** — via `runCli()`:

- claude-code → cursor with `claude-code-project` fixture
- cursor → claude-code with `cursor-project` fixture
- Requires `--from` (exit 1)
- Requires `--to` (exit 1)
- Rejects unknown target (exit 1)
- Rejects `--from === --to` (exit 1)
- `--dry-run`: no files written, output contains `[dry-run]`
- `--json`: valid JSON envelope
- No `.agentsmesh/` created (`fileNotExists`)
- Existing `.agentsmesh/` untouched (`assertDirsEquivalent`)
- Source files preserved
- Content fidelity: rule body from source appears in destination
