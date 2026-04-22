# Managed Embedding Contract

AgentsMesh has one rule for generated content that is embedded inside another agent
configuration file:

> If AgentsMesh inserts generated, recoverable, or generated-only content into a
> file that is not solely owned by that canonical item, the inserted content must
> live in an `agentsmesh:*` managed block.

This applies to every target. Target-specific generators can choose different
native output paths and formats, but they must not invent their own unmanaged
inline sections for generated metadata or projected canonical content.

## Why managed blocks exist

Some tools have a native file for every canonical item. For example, a target may
write each additional rule to a separate rule file. Other tools only have one
root instruction file, so AgentsMesh must fold additional rules into that root
file.

Managed blocks make that folding safe:

- generation can replace a previous block instead of appending another copy
- import can split embedded content back into canonical `.agentsmesh/` files
- reference rewriting can skip payloads that must stay canonical
- users can distinguish generated AgentsMesh sections from normal tool prose
- all targets follow one marker format instead of per-target conventions

## Marker format

Use HTML comments because every supported target accepts Markdown-like content
or ignores unknown comments safely.

```markdown
<!-- agentsmesh:<name>:start -->
generated content
<!-- agentsmesh:<name>:end -->
```

Blocks that need recovery metadata put compact JSON on the start marker:

```markdown
<!-- agentsmesh:<name>:start {"source":"rules/typescript.md"} -->
canonical payload
<!-- agentsmesh:<name>:end -->
```

Marker metadata must be stable and canonical. Prefer paths relative to
`.agentsmesh/`, such as `rules/typescript.md`, not generated target paths like
`GEMINI.md` or `.cursor/AGENTS.md`.

## Current block types

| Block | Purpose | Import behavior | Reference rewriting |
|-------|---------|-----------------|---------------------|
| `agentsmesh:root-generation-contract` | Generated root instruction paragraph that tells agents to edit `.agentsmesh/`, not generated files. | Stripped before writing canonical `_root.md`. | Protected; content stays literal. |
| `agentsmesh:embedded-rules` | Outer container for additional canonical rules folded into an aggregate/root instruction file. | Removed from root content after contained rules are extracted. | Protected; embedded payload stays canonical. |
| `agentsmesh:embedded-rule` | One additional rule inside `embedded-rules`; metadata records `source`, `description`, `globs`, and `targets`. | Written back to `.agentsmesh/<source>` with frontmatter restored. | Protected as part of the outer block. |
| `agentsmesh:codex-rule-index` | Generated index of additional Codex instruction files from the root instruction file. | Stripped on Codex import. | Generated-only; do not use for canonical payloads. |

Documentation codegen blocks, such as support-matrix markers, use the same
namespace idea but are not target-agent artifacts.

## Generation flow

1. Load canonical files from `.agentsmesh/`, packs, and extends.
2. Let each target generator produce native artifacts.
3. When a canonical item must be embedded into an aggregate file, render it with
   the shared managed-block helper instead of custom text.
4. Decorate root instruction files with generated-only managed blocks, such as
   the root generation contract.
5. Run reference rewriting. Managed payload blocks are protected so marker JSON
   and canonical embedded text are not rewritten to target output paths.
6. Resolve collisions and write files. On the next run, existing managed blocks
   are replaced in place, so round trips do not duplicate content.

## Import flow

1. Read the target-native file.
2. Strip generated-only managed blocks before serializing canonical root rules.
3. Extract recoverable managed blocks into their original canonical files.
4. Normalize references for the remaining target-owned content.
5. Write canonical files under `.agentsmesh/`.

For embedded additional rules, import reads:

```markdown
<!-- agentsmesh:embedded-rules:start -->
<!-- agentsmesh:embedded-rule:start {"source":"rules/typescript.md","description":"TypeScript","globs":["src/**/*.ts"],"targets":[]} -->
## TypeScript
Use strict mode.
<!-- agentsmesh:embedded-rule:end -->
<!-- agentsmesh:embedded-rules:end -->
```

and restores:

```text
.agentsmesh/rules/typescript.md
```

with the description, globs, targets, and body restored to canonical rule
frontmatter/body.

## Rules for adding a new embedded projection

- Use the `agentsmesh:` namespace.
- Use one outer block for a repeated collection and one inner block per item.
- Include enough canonical metadata to import the item without guessing.
- Store canonical source paths in metadata, never generated output paths.
- Make generation idempotent: replace an existing block instead of appending.
- Strip generated-only blocks on import.
- Split recoverable blocks on import.
- Protect blocks from reference rewriting when their payload must remain
  canonical.
- Add generator, import, and round-trip tests for the exact marker shape.
- Do not render old human-only separators such as `---` or `Applies to:` as the
  source of truth for import. Human-readable headings are fine inside the block,
  but the marker metadata is authoritative.

## What users should edit

Users should edit canonical files under `.agentsmesh/`:

- `.agentsmesh/rules/_root.md`
- `.agentsmesh/rules/*.md`
- `.agentsmesh/commands/*.md`
- `.agentsmesh/agents/*.md`
- `.agentsmesh/skills/*/SKILL.md`

Generated target files can be inspected, but managed blocks inside those files
belong to AgentsMesh and may be replaced on the next `agentsmesh generate`.
