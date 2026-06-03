---
'agentsmesh': patch
---

Fix qwen-code global-mode rule embedding. Rules were silently dropped when generating in global mode; they are now embedded inline using the same pattern as other global-mode targets.
