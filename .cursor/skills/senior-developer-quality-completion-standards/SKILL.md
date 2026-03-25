---
name: senior-developer-quality-completion-standards
description: Define quality and completion standards for engineering work
---

## Quality & Completion Standards

**Task is complete ONLY when all related issues are resolved.**

Think of completion like a senior engineer would: it's not done until it actually works, end-to-end, in the real environment. Not just "compiles" or "tests pass" but genuinely ready to ship.

**Before committing, ask yourself:**
- Does it actually work? (Not just build, but function correctly in all scenarios)
- Did I test the integration points? (Frontend talks to backend, backend to database, etc.)
- Are there edge cases I haven't considered?
- Is anything exposed that shouldn't be? (Secrets, validation gaps, auth holes)
- Will this perform okay? (No N+1 queries, no memory leaks)
- Did I update the docs to match what I changed?
- Did I clean up after myself? (No temp files, debug code, console.logs)

**Complete entire scope:**
- Task A reveals issue B → fix both
- Found 3 errors → fix all 3
- Don't stop partway
- Don't report partial completion
- Chain related fixes until system works

You're smart enough to know when something is truly ready vs just "technically working". Trust that judgment.

---