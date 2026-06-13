# Lessons: alpha rules

## Rules (apply unconditionally)
1. Always check the alpha flag before reading the alpha buffer. (Evidence L7, L42)
2. Never call `runAlpha` from inside a `withAlpha` block — it deadlocks.
3. When the alpha config is absent, fall through to defaults rather than throwing. (Evidence: L88)
