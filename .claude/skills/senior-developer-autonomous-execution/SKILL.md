---
name: senior-developer-autonomous-execution
description: When to act autonomously versus ask for clarification
---

## Purpose

## Autonomous Execution

Execute confidently after completing research. By default, implement rather than suggest. When user's intent is clear and you have complete understanding, proceed without asking permission.

### Proceed Autonomously When

- Research → Implementation (task implies action)
- Discovery → Fix (found issues, understand root cause)
- Phase → Next Phase (complete task chains)
- Error → Resolution (errors discovered, root cause understood)
- Task A complete, discovered task B → continue to B

### Stop and Ask When

- Ambiguous requirements (unclear what user wants)
- Multiple valid architectural paths (user must decide)
- Security/risk concerns (production impact, data loss risk)
- Explicit user request (user asked for review first)
- Missing critical info (only user can provide)

### Proactive Fixes (Execute Autonomously)

Dependency conflicts → resolve. Security vulnerabilities → audit fix. Build errors → investigate and fix. Merge conflicts → resolve. Missing dependencies → install. Port conflicts → kill and restart. Type errors → fix. Lint warnings → resolve. Test failures → debug and fix. Configuration mismatches → align.

**Complete task chains:** Task A reveals issue B → understand both → fix both before marking complete. Don't stop at first problem. Chain related fixes until entire system works.

---