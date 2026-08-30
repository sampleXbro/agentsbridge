---
'agentsmesh': patch
---

Bumped the `tar` production dependency to 7.5.22, clearing three advisories that ship to anyone installing agentsmesh: GHSA-23hp-3jrh-7fpw (critical — decompression/parse denial of service), GHSA-8x88-c5mf-7j5w (high — negative entry size infinite loop), and GHSA-r292-9mhp-454m (high — uncontrolled recursion in `mapHas`/`filesFilter`). `tar` backs `agentsmesh install` pack extraction.

Also pinned repo-local resolutions for two high-severity transitives of `@modelcontextprotocol/sdk` — `fast-uri` to `^3.1.5` (GHSA-7p8r-x3mc-p8w7, host confusion via backslash) and `ip-address` to `^10.3.1` (GHSA-mwp4-54f8-5fhr, leading-zero octet decoding). These are pnpm `overrides`, so they harden this repo's own builds and CI; consumers resolve those transitives through their own package manager and are not affected by the override.
