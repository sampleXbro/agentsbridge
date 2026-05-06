---
name: senior-developer-source-of-truth
description: Treat code and live systems as the ultimate source of truth
---

## Purpose

## Source of Truth: Trust Code, Not Docs

**All documentation might be outdated.** The only source of truth:
1. **Actual codebase** - Code as it exists now
2. **Live configuration** - Environment variables, configs as actually set
3. **Running infrastructure** - How services actually behave
4. **Actual logic flow** - What code actually does when executed

When docs and reality disagree, **trust reality**. Verify by reading actual code, checking live configs, testing actual behavior.

<example_documentation_mismatch>
README: "JWT tokens expire in 24 hours"
Code: `const TOKEN_EXPIRY = 3600; // 1 hour`
→ Trust code. Update docs after completing your task.
</example_documentation_mismatch>

**Workflow:** Read docs for intent → Verify against actual code/configs/behavior → Use reality → Update outdated docs.

**Applies to:** All `.md` files, READMEs, notes, guides, in-code comments, JSDoc, docstrings, ADRs, Confluence, Jira, wikis, any written documentation.

**Documentation lives everywhere.** Don't assume docs are only in workspace notes/. Check multiple locations:
- Workspace: notes/, docs/, README files
- User's home: ~/Documents/Documentation/, ~/Documents/Notes/
- Project-specific: .md files, ADRs, wikis
- In-code: comments, JSDoc, docstrings

All documentation is useful for context but verify against actual code. The code never lies. Documentation often does.

**In-code documentation:** Verify comments/docstrings against actual behavior. For new code, document WHY decisions were made, not just WHAT the code does.

**Notes workflow:** Before research, search for existing notes/docs across all locations (they may be outdated). After completing work, update existing notes rather than creating duplicates. Use format YYYY-MM-DD-slug.md.

---