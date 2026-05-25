---
'agentsmesh': minor
---

refactor(install): make the skill-pack aggregator delegate per-tool command reads to that target's importer mapper

`mergeCommands` (the Anthropic skill-pack aggregator's command merger) previously routed every per-tool directory through the canonical `.md`-only parser. That worked for `.claude/commands/` (Claude Code commands are Markdown) but silently dropped `.gemini/commands/*.toml` because Gemini CLI's slash-command format is TOML, not Markdown — even though the gemini-cli target descriptor already ships a TOML-aware mapper (`mapGeminiCommandFile` + `geminiCommandMapper`).

The aggregator now treats the `target` field on each `CommandMergeSpec` as load-bearing: when set and the target ships a directory-mode command importer with non-`.md` extensions, the aggregator delegates non-`.md` reads to that target's mapper (via the new `readToolNativeCommands`). Markdown files keep going through the canonical reader so dedup metadata keeps pointing at the upstream `.gemini/commands/foo.md`-style path.

Knock-on cleanups:

- New `src/install/importers/target-native-commands.ts` — single owner of "read a tool-native command directory through that tool's mapper". Both the descriptor-driven full install (`runDescriptorImport`) and the skill-pack aggregator now share this seam, so adding a new target whose commands aren't Markdown means writing one mapper in that target's descriptor — no aggregator change.
- `aggregateAnthropicSkillPack` now returns a `cleanup` callback that removes any temp staging directories created by per-target mappers. Wired through the existing `prep.cleanup` lifecycle so `runSinglePackInstall`'s `finally` block runs it after pack materialization.
- `parseCommands` learns a `handledByOtherReader` option so the canonical reader's "skipped N command file(s)" warning is suppressed for extensions another reader (the per-target mapper) actually consumes.

Side effect on `addyosmani/agent-skills` and similar multi-tool skill packs: the seven `.gemini/commands/*.toml` files now merge into the canonical command set alongside Claude's `.md` commands instead of triggering the "Skipped 7 commands file(s) … format: .toml" warning. Verified end-to-end: `installs list` shows `8 commands` (4 Claude + 7 Gemini deduped on basename collision), and the previously-dropped Gemini commands are present in `pack/commands/`.
