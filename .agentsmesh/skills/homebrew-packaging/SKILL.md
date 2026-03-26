---
name: homebrew-packaging
description: Use when preparing or maintaining Homebrew distribution for a CLI associated with a TypeScript library, including formula updates, archive naming, checksums, and release compatibility.
---

# Homebrew Packaging

You are responsible for Homebrew distribution of a CLI or executable package that may be implemented in TypeScript/Node.

## Goals

- Ensure Homebrew installation is reproducible.
- Keep formula updates correct and easy to review.
- Align GitHub release assets with Homebrew expectations.
- Avoid brew distribution when the package is not a real CLI product.

## Applicability

Use this skill only when the project distributes an actual command-line tool or executable artifact.
If the project is only an importable npm library, do not recommend Homebrew as a primary distribution channel.

## Packaging principles

1. Homebrew is for installable tools.
2. Release assets must be stable and versioned clearly.
3. Checksums must match the exact published archive.
4. Installation instructions must be tested on a clean macOS environment where possible.

## Checklist

Verify:
- the package exposes a real CLI entry point
- GitHub release assets are versioned consistently
- archive naming is predictable
- SHA256 is computed from the final release artifact
- formula URLs match the release layout
- install step places binaries correctly
- `brew install` and `brew test` paths are valid

## Formula guidance

When generating or updating a formula:
- use stable release URLs
- update version and checksum together
- keep dependencies explicit
- include a meaningful `test do` block
- avoid brittle install logic when possible

## Node/TS-specific concerns

For Node-based CLIs, check whether you are distributing:
- raw source requiring Node at install/runtime
- bundled JS output
- standalone binary via a packager

Document runtime requirements clearly.

## Output format
When assisting with brew packaging, provide:
1. Whether Homebrew is appropriate
2. Required release asset format
3. Formula changes
4. Validation steps
5. User-facing install instructions

Do not overcomplicate the formula. Optimize for stable installs.
