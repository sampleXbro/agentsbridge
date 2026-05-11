---
'agentsmesh': minor
---

Add a required `metadata` field to `TargetDescriptor` and a new `TARGET_REGISTRY` aggregator that drives every user-facing target listing in README and the website. Plugin and built-in targets now declare display name, category, official URL, and a one-line description in a single place; the TypeScript compiler enforces completeness.

**New public surface**

- `TargetMetadata` interface (`displayName`, `category: 'cli' | 'ide' | 'agent-platform'`, `officialUrl`, `shortDescription`) exported from `src/targets/catalog/target-descriptor.ts`.
- `TARGET_REGISTRY: Readonly<Record<BuiltinTargetId, TargetEntry>>` plus `listTargets()`, `targetsByCategory()`, and `primaryImportRoot()` helpers exported from `src/targets/catalog/target-metadata-registry.ts`.
- Every `TargetDescriptor.metadata` is required at compile time; the field is now part of the contract for plugin authors.

**Plugin authors — what to do**

If you ship a `TargetDescriptor` from a plugin package, add the `metadata` block immediately after `id:`:

```typescript
export const descriptor = {
  id: 'my-tool',
  metadata: {
    displayName: 'My Tool',
    category: 'cli',
    officialUrl: 'https://example.com',
    shortDescription: "One-line description used in tool lists",
  },
  // ...rest unchanged
} satisfies TargetDescriptor;
```

The TypeScript compiler will fail if any field is missing or mistyped. The metadata appears in any auto-generated tool list a consumer renders — there is no separate registration step.

**Tooling updates**

- `agentsmesh target scaffold <id>` now emits a `metadata` block with `TODO(agentsmesh-scaffold)` markers that fail to compile until the author fills them in.
- The `add-agent-target` skill and `target-addition-checklist.md` reference list the metadata fields in Phase 1 research; the `add-new-target-playbook.md` walks through filling them.
