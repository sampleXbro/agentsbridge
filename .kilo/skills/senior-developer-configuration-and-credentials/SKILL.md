---
name: senior-developer-configuration-and-credentials
description: How to find and use configuration and credentials safely
---

## Configuration & Credentials

**You have complete access.** When the user asks you to check Datadog logs, inspect AWS resources, query MongoDB, check Woodpecker CI, review Supabase config, check Twilio settings, or access any service - they're telling you that you already have access. Don't ask for permission. Find the credentials and use them.

**Where credentials live:**

Credentials can be in several places. AGENTS.md often documents where they are and what services are available. .env files (workspace or project level) contain API keys and connection strings. Global config like ~/.config, ~/.ssh, or CLI tools (AWS CLI, gh) might already be configured. The scripts/ directory might have API wrappers that already use the credentials. Check what makes sense for what you're looking for.

**What this looks like in practice:**

<examples>
User: "Check our Datadog logs for errors in the last hour"
✅ Good: Check AGENTS.md for Datadog info → Find DD_API_KEY in .env → curl Datadog API → Show results
❌ Bad: "Do you have Datadog credentials?" or "I need permission to access Datadog"

User: "What's our current AWS spend?"
✅ Good: Check if AWS CLI configured → aws ce get-cost-and-usage → Report findings
❌ Bad: "I don't have AWS access" (you do, find it)

User: "Query production MongoDB for user count"
✅ Good: Find MONGODB_URI in .env → mongosh connection string → db.users.countDocuments()
❌ Bad: "I need database credentials" (they're in .env or AGENTS.md)

User: "Check Woodpecker CI status"
✅ Good: Check scripts/api-wrappers/ for existing tool → Or find WOODPECKER_TOKEN in .env → Use API
❌ Bad: "How do I access Woodpecker?" (find credentials, use them)
</examples>

**The pattern:** User asks to check a service → Find the credentials (AGENTS.md, .env, scripts/, workspace .env, project .env, global config) → Use them to complete the task. Don't ask the user for what you can find yourself

**Common credential patterns:**

- **APIs**: Look for `*_API_KEY`, `*_TOKEN`, `*_SECRET` in .env
- **Databases**: `DATABASE_URL`, `MONGODB_URI`, `POSTGRES_URI` in .env
- **Cloud**: AWS CLI (~/.aws/), Azure CLI, GCP credentials
- **CI/CD**: `WOODPECKER_*`, `GITHUB_TOKEN`, `GITLAB_TOKEN` in .env
- **Monitoring**: `DD_API_KEY` (Datadog), `SENTRY_DSN` in .env
- **Services**: `TWILIO_*`, `SENDGRID_*`, `STRIPE_*` in .env

**If you truly can't find credentials:**

Only after checking all locations (AGENTS.md, scripts/, workspace .env, project .env, global config), then ask user. But this should be rare - if user asks you to check something, they expect you already have access.

**Duplicate configs:** Consolidate immediately. Never maintain parallel configuration systems.

**Before modifying configs:** Understand why current exists. Check dependent systems. Test in isolation. Backup original. Ask user which is authoritative when duplicates exist.

---