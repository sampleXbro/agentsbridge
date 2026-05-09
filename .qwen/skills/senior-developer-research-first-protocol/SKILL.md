---
name: senior-developer-research-first-protocol
description: Follow an 8-step research-first protocol before making changes
---

## Purpose

## Research-First Protocol

**Why:** Understanding prevents broken integrations, unintended side effects, wasted time fixing symptoms instead of root causes.

### When to Apply

**Complex work (use full protocol):**
Implementing features, fixing bugs (beyond syntax), dependency conflicts, debugging integrations, configuration changes, architectural modifications, data migrations, security implementations, cross-system integrations, new API endpoints.

**Simple operations (execute directly):**
Git operations on known repos, reading files with known exact paths, running known commands, port management on known ports, installing known dependencies, single known config updates.

**MUST use research protocol for:**
Finding files in unknown directories, searching without exact location, discovering what exists, any operation where "not found" is possible, exploring unfamiliar environments.

### The 8-Step Protocol

<research_protocol>

**Phase 1: Discovery**

1. **Find and read relevant notes/docs** - Search across workspace (notes/, docs/, README), ~/Documents/Documentation/, ~/Documents/Notes/, and project .md files. Use as context only; verify against actual code.

2. **Read additional documentation** - API docs, Confluence, Jira, wikis, official docs, in-code comments. Use for initial context; verify against actual code.

3. **Map complete system end-to-end**
   - Data Flow & Architecture: Request lifecycle, dependencies, integration points, architectural decisions, affected components
   - Data Structures & Schemas: Database schemas, API structures, validation rules, transformation patterns
   - Configuration & Dependencies: Environment variables, service dependencies, auth patterns, deployment configs
   - Existing Implementation: Search for similar/relevant features that already exist - can we leverage or expand them instead of creating new?

4. **Inspect and familiarize** - Study existing implementations before building new. Look for code that solves similar problems - expanding existing code is often better than creating from scratch. If leveraging existing code, trace all its dependencies first to ensure changes won't break other things.

**Phase 2: Verification**

5. **Verify understanding** - Explain the entire system flow, data structures, dependencies, impact. For complex multi-step problems requiring deeper reasoning, use structured thinking before executing: analyze approach, consider alternatives, identify potential issues. User can request extended thinking with phrases like "think hard" or "think harder" for additional reasoning depth.

6. **Check for blockers** - Ambiguous requirements? Security/risk concerns? Multiple valid architectural choices? Missing critical info only user can provide? If NO blockers: proceed to Phase 3. If blockers: briefly explain and get clarification.

**Phase 3: Execution**

7. **Proceed autonomously** - Execute immediately without asking permission. Default to action. Complete entire task chain—if task A reveals issue B, understand both, fix both before marking complete.

8. **Update documentation** - After completion, update existing notes/docs (not duplicates). Mark outdated info with dates. Add new findings. Reference code files/lines. Document assumptions needing verification.

</research_protocol>

<example_research_flow>
User: "Fix authentication timeout issue"

✅ Good: Check notes (context) → Read docs (intent) → Read actual auth code (verify) → Map flow: login → token gen → session → validation → timeout → Review error patterns → Verify understanding → Check blockers → Proceed: extend expiry, add rotation, update errors → Update notes + docs

❌ Bad: Jump to editing timeout → Trust outdated notes/README → Miss refresh token issue → Fix symptom not root cause → Don't verify or document
</example_research_flow>

---