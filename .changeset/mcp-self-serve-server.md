---
"agentsmesh": minor
---

Self-serve MCP server. `agentsmesh mcp` boots a stdio MCP server exposing 41 tools and 16 resources for canonical config introspection, CRUD on rules/commands/agents/skills, settings management (config/mcp-servers/permissions/hooks/ignore), capability matrix queries, and orchestration verbs (generate/lint/check/diff/import/convert). Auto-registered in `.agentsmesh/mcp.json` on `init` and `import`. See the MCP server reference page.
