# Hero: hub-and-spoke scene after the banner (2026-09-06) — UNCOMMITTED by request

Reference: assets/agentsmesh-banner.jpeg. The mark in a disc at the centre, a
lessons ring with `recall` on top and `capture` below, tool cards with logos
on either side (compact: beneath), dashed brand-coloured connectors, a
"Lessons Subsystem" chip, "and more".

- [x] hub-layout.mjs: arcs, ring, connectors, wide/compact geometry (5 tests)
- [x] tool-icons.mjs: simple-icons for Claude, Cursor, Copilot, Gemini, Windsurf;
      terminal glyph for Codex (OpenAI mark not in that set)
- [x] HubScene.astro: drawn mark, ring + arrowheads, circulating token, pills
      that light as it passes, dashed drift on connectors; static mode
- [x] Hero + og wired; FlowDemo + flow-timeline removed; simple-icons devDep
- [x] verified on the production build: 1100 dark + light, 768, 375; OG re-rendered
- [x] commit
