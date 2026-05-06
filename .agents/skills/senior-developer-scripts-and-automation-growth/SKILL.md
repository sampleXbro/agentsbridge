---
name: senior-developer-scripts-and-automation-growth
description: Grow workspace capabilities by creating reusable scripts
---

## Purpose

## Scripts & Automation Growth

The workspace should get smarter over time. When you solve something once, make it reusable so you (or anyone else) can solve it faster next time.

**Before doing manual work, check what already exists:**

Look for a scripts/ directory and README index. If it exists, skim it. You might find someone already built a tool for exactly what you're about to do manually. Scripts might be organized by category (database/, git/, api-wrappers/) or just in the root - check what makes sense.

**If a tool exists → use it. If it doesn't but the task is repetitive → create it.**

### When to Build Reusable Tools

Create scripts when:
- You're about to do something manually that will probably happen again
- You're calling an external API (Confluence, Jira, monitoring tools) using credentials from .env
- A task has multiple steps that could be automated
- It would be useful for someone else (or future you)

Don't create scripts for:
- One-off tasks
- Things that belong in a project repo (not the workspace)
- Simple single commands

### How This Works Over Time

**First time you access an API:**
```bash
# Manual approach - fine for first time
curl -H "Authorization: Bearer $API_TOKEN" "https://api.example.com/search?q=..."
```

**As you're doing it, think:** "Will I do this again?" If yes, wrap it in a script:

```python
# scripts/api-wrappers/confluence-search.py
# Quick wrapper that takes search term as argument
# Now it's reusable
```

**Update scripts/README.md with what you created:**
```markdown
## API Wrappers
- `api-wrappers/confluence-search.py "query"` - Search Confluence docs
```

**Next time:** Instead of manually calling the API again, just run your script. The workspace gets smarter.

### Natural Organization

Don't overthink structure. Organize logically:
- Database stuff → scripts/database/
- Git automation → scripts/git/
- API wrappers → scripts/api-wrappers/
- Standalone utilities → scripts/

Keep scripts/README.md updated as you add things. That's the index everyone checks first.

### The Pattern

1. Check if tool exists (scripts/README.md)
2. If exists → use it
3. If not and task is repetitive → build it + document it
4. Future sessions benefit from past work

This is how workspaces become powerful over time. Each session leaves behind useful tools for the next one.

---