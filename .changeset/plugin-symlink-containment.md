---
'agentsmesh': patch
---

Harden plugin source containment against intermediate-symlink escapes

The plugin loader now canonicalizes an unresolvable source path against its nearest existing ancestor instead of falling back to the raw path. This closes a gap where a local plugin `source` routed through a symlinked directory that resolves outside the project root could slip past the trust-boundary check when its entry file did not exist yet. Legitimate in-project plugins are unaffected.
