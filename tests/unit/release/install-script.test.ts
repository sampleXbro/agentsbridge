import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT_PATH = join(ROOT, 'scripts', 'install.sh');

function readScript(): string {
  return readFileSync(SCRIPT_PATH, 'utf8');
}

describe('scripts/install.sh', () => {
  it('is a POSIX sh script with strict-mode error handling', () => {
    const script = readScript();
    expect(script.startsWith('#!/bin/sh')).toBe(true);
    expect(script).toMatch(/^set -eu\b/m);
  });

  it('is marked executable in the git index so curl|sh works after release upload', () => {
    // `statSync(...).mode & 0o111` is unreliable on Windows runners because NTFS
    // does not surface POSIX execute bits. The contract we actually need is that
    // git stores mode 100755 — that's what `gh release create` ships and what
    // every clone preserves. Querying the git index works identically on every OS.
    const out = execFileSync('git', ['ls-files', '--stage', 'scripts/install.sh'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(out).toMatch(/^100755 /);
  });

  it('uses fish-native syntax when emitting a PATH line into fish config', () => {
    // export PATH=... is bash/POSIX syntax and is a parse error in fish.
    // Required: fish_add_path or set -gx PATH for the fish branch.
    const script = readScript();
    expect(script).toMatch(/fish_add_path|set -gx PATH/);
  });

  it('looks up the SHA256 by exact filename match (awk $2 == TARGET), not loose grep', () => {
    // grep "$TARGET" is substring/regex; SHA256SUMS has "<hash>  <filename>" lines
    // so the exact-match form is awk -v t=$TARGET '$2==t {print $1}'.
    const script = readScript();
    expect(script).toMatch(/awk[^\n]*\$2\s*==/);
  });

  it('detects Rosetta 2 so Apple Silicon installs always pick arm64', () => {
    const script = readScript();
    expect(script).toContain('sysctl.proc_translated');
  });

  it('verifies the downloaded binary checksum against SHA256SUMS', () => {
    const script = readScript();
    expect(script).toContain('SHA256SUMS');
    expect(script).toMatch(/sha256sum|shasum -a 256|openssl dgst -sha256/);
  });

  it('installs to $AGENTSMESH_INSTALL/bin (default $HOME/.agentsmesh)', () => {
    const script = readScript();
    expect(script).toContain('AGENTSMESH_INSTALL');
    expect(script).toContain('$HOME/.agentsmesh');
  });

  it('creates an amsh alias symlink alongside agentsmesh', () => {
    const script = readScript();
    expect(script).toMatch(/ln\s+-sf[^\n]+amsh/);
  });

  it('fails closed when SHA256SUMS does not contain the platform target', () => {
    // CWE-345: a curl|sh installer must not silently install an unverified binary
    // when the checksum file is incomplete (partial upload, MITM-stripped, etc.).
    const script = readScript();
    expect(script).not.toMatch(/warn\s+"No checksum found for/);
    expect(script).toMatch(/error\s+"No checksum found for/);
  });

  it('fails closed when no checksum tool is available on the host', () => {
    // CWE-345: same as above — better to abort with a clear error than install unverified.
    const script = readScript();
    expect(script).not.toMatch(/warn\s+"No checksum tool/);
    expect(script).toMatch(/error\s+"No checksum tool/);
  });

  it('rejects $AGENTSMESH_INSTALL containing shell metacharacters', () => {
    // CWE-77/78: BIN_DIR is interpolated into the line written to ~/.zshrc | ~/.bashrc | fish config.
    // A wrapping process (Docker entrypoint, Makefile) that controls AGENTSMESH_INSTALL must
    // not be able to inject shell code into the user's rc file. Enforce a safe-path allowlist.
    const script = readScript();
    expect(script).toMatch(/AGENTSMESH_INSTALL[\s\S]{0,400}\[!a-zA-Z0-9/);
  });
});
