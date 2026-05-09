# TypeScript Standards

Apply these TypeScript-specific rules when editing `.ts` or `.tsx` files:

- Use `unknown` instead of `any` for untyped values
- Narrow types with runtime checks before accessing properties
- Use `interface` over `type` for object shapes
- Enable `noUncheckedIndexedAccess` to catch potential undefined access
- Prefer `const` assertions for literal arrays used as union types
