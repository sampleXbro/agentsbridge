# src

Everything under `src` is compiled with `strict: true` and `noUncheckedIndexedAccess`.

- Export explicit return types from every module boundary.
- Prefer `interface` for object shapes, `type` for unions.
- Do not import from `dist/`; import from the source module.
