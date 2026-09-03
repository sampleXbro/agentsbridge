---
'agentsmesh': patch
---

**`.roomodes` is no longer replaced wholesale — your hand-written Roo Code project modes survive.**

`.roomodes` is Roo Code's own project custom-modes store: Roo writes it whenever you create a mode at Project scope. `generateAgents` emitted the entire file from canonical, and the mode-scoped merger claimed only the Global twin (`~/.roo/settings/custom_modes.yaml`), so `.roomodes` fell through to whole-file replacement. Every mode you authored was deleted, and modes that shared a slug with a canonical agent lost `whenToUse`, `customInstructions`, `iconName` and the tuple group form (`- - edit` / `fileRegex`).

`.roomodes` was also in `project.managedOutputs.files`, the stale-cleanup delete list, so turning the `agents` feature off deleted the file outright.

`mergeRooCustomModesYaml` now claims both paths, and `.roomodes` moved to `coOwnedFiles`. Ownership is per mode, recorded by the `# agentsmesh:` marker comment the merger writes — the same convention `.aider.conf.yml` uses:

- a marked mode, or one whose slug canonical still owns, is agentsmesh's and is re-emitted;
- everything else is yours and is kept verbatim;
- within a re-emitted mode, fields canonical cannot express are carried over.

Only one path resolves per run — the global layout suppresses `.roomodes` and emits the settings file from `scopeExtras` — so claiming both scopes in one merger cannot collide.

**Also fixes a marker bug that affected the global file too.** Re-parsing the YAML moves the comment above the *first* sequence item onto the sequence node itself, so the first generated mode read back as unmarked. It was treated as the user's and never revoked — deleting that agent left its mode behind permanently. The merger now reads the marker from where the parser actually puts it. This was live in `~/.roo/settings/custom_modes.yaml` since the global merge shipped.

Two limits worth knowing:

- Deleting **every** agent leaves the last generated modes in place. `generateAgents` returns nothing for empty canonical, so the merger never runs — the same revocation-to-empty gap documented for the other co-owned files.
- A `.roomodes` that is not a YAML mapping is returned verbatim rather than rewritten, so generated modes are silently not applied to it.
