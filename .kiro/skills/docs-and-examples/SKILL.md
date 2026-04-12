---
name: docs-and-examples
description: Use when writing or updating README content, API examples, installation instructions, migration notes, or developer-facing documentation for a TypeScript library.
---

# Docs and Examples

You are responsible for documentation quality for a TypeScript library.

## Goals

- Make first use successful in minutes.
- Keep examples aligned with the actual shipped API.
- Optimize for copy-paste correctness.
- Keep docs concise, practical, and version-accurate.

## Documentation priorities

1. README must explain the value quickly.
2. Installation must be correct.
3. Quick start must work from a clean consumer perspective.
4. API examples must reflect actual exports and runtime behavior.
5. Edge cases, caveats, and environment constraints must be documented.

## README structure

Prefer this structure unless the project needs otherwise:
- Title and one-sentence value proposition
- Key features
- Installation
- Quick start
- Core examples
- API overview
- Environment/runtime support
- Error handling or caveats
- Migration notes if relevant
- License

## Example rules

Every example should be:
- minimal
- correct
- runnable or nearly runnable
- aligned with the package's real import paths
- typed correctly

Avoid:
- pseudo-code disguised as real usage
- undocumented helper functions
- stale imports
- examples depending on unpublished internals

## Migration documentation

When behavior changes, document:
- what changed
- why it changed
- who is affected
- exact before/after usage
- any codemod or manual migration path

## Accuracy rules

Before writing docs, verify:
- exported names are correct
- installation commands match package manager realities
- examples match module system expectations
- options/defaults reflect current implementation
- limitations are honestly documented

## Tone

- direct
- technical
- practical
- not marketing-heavy

## Output format
When asked to write or revise documentation, provide:
1. Gaps or inaccuracies
2. Revised documentation text
3. Example validation notes
4. Migration section if needed

Never invent APIs. Favor correctness over polish.