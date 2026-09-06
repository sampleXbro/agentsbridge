# Hero: rework the flow animation as a product story (2026-09-06)

Concept: a looping UI scene, not a node graph. Step rail (Write once /
Generate everywhere / Stay in sync / Learn from failures), a terminal line
typing the real command per step, a stage with the .agentsmesh/ folder and a
grid of tool cards, one drift-and-repair beat, then a real lesson captured and
recalled. 16s loop. Static finished state for reduced motion and the OG card.

- [x] flow-timeline.mjs: seconds -> keyframe percentages, showBetween windows,
      typing segments, stylesheet builder; tests first
- [x] home.ts: HOME_DEMO_SCENES / TOOLS / SOURCE_FILES / LESSON; drop HOME_MESH_*
- [x] FlowDemo.astro: markup, generated keyframes, scoped CSS, static mode
- [x] Hero.astro + og.astro use FlowDemo; delete MeshDiagram + mesh-layout
- [x] tokens.css: --am-warn for the drift beat
- [x] verify on the production build at 1100 / 768 / 375, mid-scene frames
- [x] OG re-render (static), commit, push
