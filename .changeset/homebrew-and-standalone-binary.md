---
"agentsmesh": minor
---

Homebrew tap and standalone-binary distribution. `brew tap samplexbro/agentsmesh && brew install agentsmesh` installs from a Homebrew formula auto-rendered against the published npm tarball; `curl -fsSL https://github.com/sampleXbro/agentsmesh/releases/latest/download/install.sh | sh` downloads a Node-free Bun-compiled binary for macOS (arm64/x64) and Linux (arm64/x64), verifies SHA256, installs to `~/.agentsmesh/bin`, and adds it to PATH for zsh, bash, and fish. The release workflow builds binaries for every supported platform on each `master` push, attaches them to a GitHub Release alongside `SHA256SUMS`, and pushes the formula to the tap repo; `workflow_dispatch` re-runs rebuild assets against an existing tag. Installer fails closed on missing/unverifiable checksums and rejects shell-unsafe `AGENTSMESH_INSTALL` paths.
