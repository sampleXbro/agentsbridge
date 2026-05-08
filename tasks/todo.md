# Security & Functional Gap Remediation

Driven by senior-architect review. Each batch is one commit. TDD throughout: failing test → implement → typecheck/lint/test gate.

## Batch 1 — MCP write-tool schema hardening (C1, H1, M4, M5, L1, L5)
- Strict Zod for `add_mcp_server`/`update_mcp_server` server payload (type enum, command shape, args/env)
- Strict Zod for `update_hooks` mirroring `HookEntry`
- Per-entry format check for `update_permissions` allow/deny/ask
- `NAME_RE` drops `/` (flat names only)
- Apply `ABSOLUTE_PATH_RE` redaction in `server.ts` non-`McpError` fallback
- `canonical-factory.ts` IO_ERROR passes underlying errno code

## Batch 2 — Hook script generation hardening (H2, H3, L3)
- Strip `\r\n` from event/matcher/command before embedding in shell wrappers
- Thread `mode` through `writeFileAtomic`; set `0o755` for `.sh`/`.bash`/`.zsh`
- Add `set -u` to generated wrappers

## Batch 3 — Remote fetch hardening (M2, M3, L2)
- Content-Length cap + streaming size guard for tarball (500 MiB)
- Reject git ref/clone-url starting with `-`
- Validate `AGENTSMESH_CACHE` env override

## Batch 4 — Canonical parser path safety (M1, F4, F5)
- Wire `findWindowsPathIssues` into canonical parsers
- `parseAgents` flag duplicate basenames in nested directories
- `parseSkills` use `sanitizeSkillName` (align with `parseSkillDirectory`)

## Batch 5 — Link rebaser hardening (L4)
- Reject `file:///` + escape-out-of-root absolute paths from generated artifacts

## Batch 6 — Plugin strictness (F3)
- Per-plugin `strict: boolean` option; failed-load → error not warning when set

## Batch 7 — File-size budget (F1, partial)
- Split top 4 offenders only:
  - `src/mcp/register.ts` (407)
  - `src/cli/commands/target-scaffold/templates.ts` (315)
  - `src/utils/filesystem/fs.ts` (289)
  - `src/mcp/handlers/orchestrate.ts` (265)

## Deferred with rationale
- **F2 (process lock cross-host eviction)**: behavior change with possibly intentional design. Document in CHANGELOG/issue rather than silently flip.
- **L4 (link rebaser strips `file://` outside project root)**: existing tests at `tests/unit/core/link-rebaser-edge-cases.test.ts:70-73` and `link-rebaser-skill-absolute-links.test.ts:298, 527` explicitly assert the contract "preserve `file://` URIs verbatim as protected schemes." Flipping this contract is a behavior change requiring product-owner sign-off. Recommended follow-up: add an opt-in `neutralizeFileUris` rebaser flag and a lint warning when canonical content emits `file://` links.

## Verification cadence
- After each batch: `pnpm typecheck` + `pnpm lint` + relevant `pnpm test`
- Build (`pnpm build`) before any CLI/integration/e2e slice
- Final gate: full `pnpm test` + `pnpm build && pnpm test:e2e`

## Lessons applied
- L37: explicit `!== null` / `!== undefined` (no `!= null`)
- L62: separate runtime/dev install commands when changing deps
- L101/L102: never run two CLI test commands in parallel; rebuild before integration/e2e slices
- L67/L68/L113: rerun typecheck immediately after refactor that touches typed test fixtures
- L188/L190: per-target import mappers stay in `*-mappers.ts`; flatFile won't model multi-file merge
