---
'agentsmesh': patch
---

fix(reference): classify `(filename)` prose as bare-prose, not a Markdown link destination

`shouldRewritePathToken`'s `(`-branch in
`src/core/reference/link-token-context.ts` unconditionally treated any
token preceded by `(` as a Markdown link destination, regardless of
whether the `[label]` prefix was actually present. Prose mentions
like `Read the existing spec (SPEC.md or equivalent)` were routed to
the link-rewrite path; the rebaser then resolved `SPEC.md` against
the canonical pack's `commands/` dir (case-insensitive on macOS APFS
/ Windows NTFS) and emitted `(../../.agentsmesh/.../SPEC.md or
equivalent)` into every generated `.claude/commands/`,
`.gemini/commands/`, `.cursor/commands/` artifact (etc.). The leaked
path was wrong even by intent — the author meant the filename as a
documentary mention, not a link target.

The matching guard in `getTokenContext` (same file, line 64) already
encodes the correct rule: a token is `markdown-link-dest` only when
`]` sits directly before the `(`. This change propagates that rule
into `shouldRewritePathToken`:

- With `]` immediately before `(` → real Markdown link, accept any
  terminator (`)`, `#`, `?`, space, tab) — `[text](spec.md)`,
  `[text](spec.md#anchor)`, etc. continue to rewrite cleanly.
- Without it → fall through to the bare-token path-shape checks, so
  genuine paths inside parens (`(./commands/spec.md)`,
  `(.claude/skills/foo.md)`) still rewrite via the slash /
  root-relative branches, while bare filenames like
  `(SPEC.md or equivalent)` stay verbatim.

Verified end-to-end by regenerating against the
`addyosmani-agent-skills` pack: `(SPEC.md or equivalent)` is now
preserved in `.gemini/commands/planning.toml`,
`.claude/commands/planning.md`, `.cursor/commands/planning.md` and the
24 other targets. The same rule fires identically for `.md`, `.mdc`,
and `.toml` outputs — the engine is format-agnostic; only the
classifier's prose-vs-link distinction needed tightening.

Tests:
- New `tests/unit/core/link-token-classifier-prose-vs-md-link.test.ts`
  (8 cases) pins the prose-vs-link distinction.
- `tests/unit/core/link-rebaser-deep-branches.test.ts:396` updated:
  positive cases now require `](` prefix; a new sibling case pins the
  negative behavior for prose forms.
