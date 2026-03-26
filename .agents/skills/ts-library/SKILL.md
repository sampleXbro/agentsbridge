---
name: ts-library
description: Use when authoring TypeScript libraries or npm packages - covers project setup, package.json exports, build tooling (tsdown/unbuild), API design patterns, type inference tricks, testing, and publishing to npm. Use when bundling, configuring dual CJS/ESM output, or setting up release workflows.
---

# TypeScript Library Development

Patterns for authoring high-quality TypeScript libraries, extracted from studying unocss, shiki, unplugin, vite, vitest, vueuse, zod, trpc, drizzle-orm, and more.

## When to Use

- Starting a new TypeScript library (single or monorepo)
- Setting up package.json exports for dual CJS/ESM
- Configuring tsconfig for library development
- Choosing build tools (tsdown, unbuild)
- Designing type-safe APIs (builder, factory, plugin patterns)
- Writing advanced TypeScript types
- Setting up vitest for library testing
- Configuring release workflow and CI

**For Nuxt module development:** use `nuxt-modules` skill

## Quick Reference

| Working on...         | Load file                                                          |
| --------------------- | ------------------------------------------------------------------ |
| New project setup     | [.agents/skills/ts-library/references/project-setup.md](.agents/skills/ts-library/references/project-setup.md)         |
| Package exports       | [.agents/skills/ts-library/references/package-exports.md](.agents/skills/ts-library/references/package-exports.md)     |
| tsconfig options      | [.agents/skills/ts-library/references/typescript-config.md](.agents/skills/ts-library/references/typescript-config.md) |
| Build configuration   | [.agents/skills/ts-library/references/build-tooling.md](.agents/skills/ts-library/references/build-tooling.md)         |
| ESLint config         | [.agents/skills/ts-library/references/eslint-config.md](.agents/skills/ts-library/references/eslint-config.md)         |
| API design patterns   | [.agents/skills/ts-library/references/api-design.md](.agents/skills/ts-library/references/api-design.md)               |
| Type inference tricks | [.agents/skills/ts-library/references/type-patterns.md](.agents/skills/ts-library/references/type-patterns.md)         |
| Testing setup         | [.agents/skills/ts-library/references/testing.md](.agents/skills/ts-library/references/testing.md)                     |
| Release workflow      | [.agents/skills/ts-library/references/release.md](.agents/skills/ts-library/references/release.md)                     |
| CI/CD setup           | [.agents/skills/ts-library/references/ci-workflows.md](.agents/skills/ts-library/references/ci-workflows.md)           |

## Loading Files

**Consider loading these reference files based on your task:**

- [ ] [.agents/skills/ts-library/references/project-setup.md](.agents/skills/ts-library/references/project-setup.md) - if starting a new TypeScript library project
- [ ] [.agents/skills/ts-library/references/package-exports.md](.agents/skills/ts-library/references/package-exports.md) - if configuring package.json exports or dual CJS/ESM
- [ ] [.agents/skills/ts-library/references/typescript-config.md](.agents/skills/ts-library/references/typescript-config.md) - if setting up or modifying tsconfig.json
- [ ] [.agents/skills/ts-library/references/build-tooling.md](.agents/skills/ts-library/references/build-tooling.md) - if configuring tsdown, unbuild, or build scripts
- [ ] [.agents/skills/ts-library/references/eslint-config.md](.agents/skills/ts-library/references/eslint-config.md) - if setting up ESLint for library development
- [ ] [.agents/skills/ts-library/references/api-design.md](.agents/skills/ts-library/references/api-design.md) - if designing public APIs, builder patterns, or plugin systems
- [ ] [.agents/skills/ts-library/references/type-patterns.md](.agents/skills/ts-library/references/type-patterns.md) - if working with advanced TypeScript types or type inference
- [ ] [.agents/skills/ts-library/references/testing.md](.agents/skills/ts-library/references/testing.md) - if setting up vitest or writing tests for library code
- [ ] [.agents/skills/ts-library/references/release.md](.agents/skills/ts-library/references/release.md) - if configuring release workflow or versioning
- [ ] [.agents/skills/ts-library/references/ci-workflows.md](.agents/skills/ts-library/references/ci-workflows.md) - if setting up GitHub Actions or CI/CD pipelines

**DO NOT load all files at once.** Load only what's relevant to your current task.

## New Library Workflow

1. Create project structure → load [.agents/skills/ts-library/references/project-setup.md](.agents/skills/ts-library/references/project-setup.md)
2. Configure `package.json` exports → load [.agents/skills/ts-library/references/package-exports.md](.agents/skills/ts-library/references/package-exports.md)
3. Set up build with tsdown → load [.agents/skills/ts-library/references/build-tooling.md](.agents/skills/ts-library/references/build-tooling.md)
4. Verify build: `pnpm build && pnpm pack --dry-run` — check output includes `.mjs`, `.cjs`, `.d.ts`
5. Add tests → load [.agents/skills/ts-library/references/testing.md](.agents/skills/ts-library/references/testing.md)
6. Configure release → load [.agents/skills/ts-library/references/release.md](.agents/skills/ts-library/references/release.md)

## Quick Start

```json
// package.json (minimal)
{
  "name": "my-lib",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist"]
}
```

```ts
// tsdown.config.ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
})
```

## Key Principles

- ESM-first: `"type": "module"` with `.mjs` outputs
- Dual format: always support both CJS and ESM consumers
- `moduleResolution: "Bundler"` for modern TypeScript
- tsdown for most builds, unbuild for complex cases
- Smart defaults: detect environment, don't force config
- Tree-shakeable: lazy getters, proper `sideEffects: false`

_Token efficiency: Main skill ~300 tokens, each reference ~800-1200 tokens_