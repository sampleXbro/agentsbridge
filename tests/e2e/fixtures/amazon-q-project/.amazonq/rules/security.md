# Security Guidelines

Security requirements for all code changes:

- Never log or expose secrets, API keys, or credentials
- Sanitize all user inputs before processing or storage
- Use parameterized queries to prevent SQL injection
- Validate and parse environment variables at startup with explicit errors
- Review dependency updates for known CVEs before merging
