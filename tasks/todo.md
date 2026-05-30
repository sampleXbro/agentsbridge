# Lessons subsystem — DONE

Implementation plan from the lessons-recall + capture rollout has shipped.
Current state of the system:

- Procedural rule lives in `.agentsmesh/rules/_root.md` (auto-projected to every
  target's root rule file).
- Canonical artifacts live under `.agentsmesh/lessons/` (`journal.md`,
  `index.yaml`, `topics/*.md`, `distill-ledger.yaml`).
- Library code lives under `src/lessons/`; public API at
  `src/public/lessons.ts` (exported as `agentsmesh/lessons`).
- CLI scripts: `pnpm distill` (propose), `pnpm distill:apply` (route).

For the canonical reference and upgrade path see `src/lessons/README.md`.

This file is now free for the next plan.
