# Core Domain

## Responsibility

Implement target-agnostic transformation logic once canonical state is loaded.

## Subdomains

- `core/generate`
  generation engine and optional feature orchestration
- `core/reference`
  reference mapping and rewrite behavior
- `core/lint`
  shared lint orchestration
- `core/matrix`
  compatibility reporting

## Owns

- target-independent generation loop
- reference rewriting from canonical and pack paths to target-relative artifacts
- collision handling and root instruction decoration
- matrix view of target capability support

## Should not own

- target-specific path heuristics outside target metadata
- config resolution
- install source behavior

## Main boundary

Core may ask target metadata which generator/capability applies, but should not branch on target names for business behavior unless the behavior is already centralized in target metadata helpers.
