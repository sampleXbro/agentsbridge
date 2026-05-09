---
agent_requested: true
description: Security guidelines — apply when handling auth, secrets, or HTTP endpoints
globs:
  - "src/auth/**/*.ts"
  - "src/api/**/*.ts"
---

# Security Guidelines

Apply these guidelines when working on authentication, authorization, or HTTP endpoint code.

- Never log secrets, tokens, or passwords — use `[REDACTED]` placeholders in logs
- Validate all external input with Zod schemas before processing
- Use parameterized queries for all database interactions
- Store secrets in environment variables, never in source code

## HTTP Endpoints

All public endpoints must:
1. Validate request body against a schema
2. Return appropriate HTTP status codes (not always 200)
3. Include rate limiting headers
