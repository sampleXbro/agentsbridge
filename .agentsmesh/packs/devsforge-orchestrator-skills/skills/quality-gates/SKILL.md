---
name: quality-gates
description: Expert knowledge in quality assurance gates, code quality standards, and automated checks. Use when enforcing quality standards.
allowed-tools: Read, Bash, Glob, Grep
---

# Quality Gates Skill

Automated quality checkpoints that ensure code meets standards before proceeding.

## Gate Levels

### 1. Pre-Commit Gate
Runs before code is committed.

```bash
# TypeScript check
npx tsc --noEmit

# Lint check
npx eslint . --max-warnings 0

# Format check
npx prettier --check .
```

### 2. Pre-Push Gate
Runs before code is pushed.

```bash
# All pre-commit checks +
npm test -- --passWithNoTests

# Build check
npm run build
```

### 3. CI Gate
Runs in CI pipeline.

```bash
# All previous checks +
npm test -- --coverage

# Coverage threshold
# Fail if coverage < 70%
```

### 4. Pre-Deployment Gate
Runs before deployment.

```bash
# All CI checks +
# E2E tests
npx playwright test

# Security audit
npm audit --audit-level=high

# Performance check
npx lighthouse-ci
```

## Gate Definitions

### TypeScript Gate
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

**Pass Criteria:** Zero errors

### ESLint Gate
```json
// .eslintrc
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "@typescript-eslint/strict"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "no-console": "warn"
  }
}
```

**Pass Criteria:** Zero errors, zero warnings

### Prettier Gate
```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

**Pass Criteria:** All files formatted

### Test Gate
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
    },
  },
});
```

**Pass Criteria:**
- All tests pass
- Coverage meets thresholds

### Build Gate
```bash
npm run build
```

**Pass Criteria:** Build succeeds without errors

### Security Gate
```bash
# Dependency vulnerabilities
npm audit --audit-level=high

# Exit codes:
# 0 = No vulnerabilities
# 1 = Vulnerabilities found
```

**Pass Criteria:** No high/critical vulnerabilities

## Gate Implementation

### Husky Pre-Commit Hook
```bash
#!/bin/sh
# .husky/pre-commit

npx lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

### GitHub Actions Gate
```yaml
name: Quality Gate

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: TypeScript
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test -- --coverage

      - name: Build
        run: npm run build
```

## Quality Metrics

### Code Quality
| Metric | Threshold | Tool |
|--------|-----------|------|
| Type Coverage | 100% | TypeScript |
| Lint Errors | 0 | ESLint |
| Code Smells | < 5 | SonarQube |
| Duplications | < 3% | SonarQube |

### Test Quality
| Metric | Threshold | Tool |
|--------|-----------|------|
| Statement Coverage | > 70% | Vitest |
| Branch Coverage | > 65% | Vitest |
| Test Pass Rate | 100% | Vitest |

### Security
| Metric | Threshold | Tool |
|--------|-----------|------|
| Critical Vulns | 0 | npm audit |
| High Vulns | 0 | npm audit |
| Secrets | 0 | secretlint |

### Performance
| Metric | Threshold | Tool |
|--------|-----------|------|
| Bundle Size | < 500KB | vite |
| LCP | < 2.5s | Lighthouse |
| FID | < 100ms | Lighthouse |

## Gate Commands

```bash
# Run all gates
npm run quality

# Individual gates
npm run quality:types     # TypeScript
npm run quality:lint      # ESLint
npm run quality:test      # Tests
npm run quality:build     # Build
npm run quality:security  # Security audit
```

## Gate Failure Handling

### TypeScript Errors
1. Read error message
2. Fix type issue
3. Re-run `npx tsc --noEmit`

### Lint Errors
1. Try auto-fix: `npx eslint . --fix`
2. Manually fix remaining
3. Re-run lint

### Test Failures
1. Check failed test output
2. Fix code or test
3. Re-run tests

### Build Failures
1. Check build output
2. Fix import/config issues
3. Re-run build

### Security Failures
1. Run `npm audit`
2. Update vulnerable packages
3. If can't update, document exception
