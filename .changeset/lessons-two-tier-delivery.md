---
'agentsmesh': minor
---

feat(lessons): two-tier delivery — trimmed always-on trigger + on-demand `lessons` skill

The lessons recall/capture contract now ships in two tiers, using agentsmesh's
native primitives (rules + skills) rather than a single oversized root paragraph:

- **Tier 1 — always-on trigger.** `LESSONS_PROCEDURAL_RULE` is trimmed to the
  binding essentials (both commands, the BLOCKING framing, the recall scope
  including read-only, the broad capture scope, the graph path, the MCP
  fallback). It is still injected into `.agentsmesh/rules/_root.md` as a managed
  block, so it reaches every target through canonical rule generation.
- **Tier 2 — on-demand manual.** `agentsmesh init --lessons` now also seeds
  `.agentsmesh/skills/lessons/SKILL.md`, a `lessons` skill carrying the full
  operating manual (complete command set, topic workflow, trigger-flag
  mechanics, the exhaustive rejected-excuse enumeration). It generates to every
  skill-capable target and can grow without bloating always-on context.
- **Graceful degradation.** Targets without skills still receive the Tier-1
  trigger, so the binding contract stays universal.

The skill is **create-if-missing** — once present it is your canonical,
user-owned content and is never clobbered. Projects generated with the previous
single-tier block upgrade to the trimmed block exactly once on the next
`generate`/scaffold (legacy form retained for clean strip/upgrade).
