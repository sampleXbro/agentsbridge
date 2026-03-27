# Utils Domain

## Responsibility

Provide low-level helpers that are reused across domains and intentionally stay free of business policy.

## Subdomains

- `utils/filesystem`
- `utils/text`
- `utils/output`
- `utils/crypto`

## Owns

- file IO helpers
- markdown/frontmatter helpers
- glob matching
- console logging
- hashing helpers

## Should not own

- config semantics
- canonical semantics
- target-specific logic
- install policy

## Dependency rule

`utils` should be leaf-most. Higher domains may depend on it; `utils` should not depend on higher domains.
