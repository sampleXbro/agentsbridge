import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TEMPLATE_PATH = join(ROOT, 'homebrew', 'agentsmesh.rb.tmpl');

function readTemplate(): string {
  return readFileSync(TEMPLATE_PATH, 'utf8');
}

describe('homebrew/agentsmesh.rb.tmpl', () => {
  it('declares VERSION and SHA256 placeholders so CI sed substitution works', () => {
    const tmpl = readTemplate();
    expect(tmpl).toContain('{{VERSION}}');
    expect(tmpl).toContain('{{SHA256}}');
  });

  it('points the source URL at the npm registry tarball for the substituted version', () => {
    const tmpl = readTemplate();
    expect(tmpl).toMatch(
      /url\s+"https:\/\/registry\.npmjs\.org\/agentsmesh\/-\/agentsmesh-\{\{VERSION\}\}\.tgz"/,
    );
  });

  it('uses the canonical Homebrew Node CLI install pattern (npm + std_npm_args + bin symlink)', () => {
    const tmpl = readTemplate();
    expect(tmpl).toContain('depends_on "node"');
    expect(tmpl).toMatch(/system\s+"npm",\s+"install",\s+\*std_npm_args/);
    expect(tmpl).toContain('bin.install_symlink libexec.glob("bin/*")');
  });

  it('livecheck targets the npm registry "latest" endpoint, not the version-pinned tarball', () => {
    // url :stable resolves to the version-pinned tarball URL, which never lists newer versions.
    const tmpl = readTemplate();
    expect(tmpl).not.toMatch(/livecheck\s+do\s*\n\s*url\s+:stable/);
    expect(tmpl).toMatch(/livecheck\s+do[\s\S]+?url\s+"https:\/\/registry\.npmjs\.org\/agentsmesh/);
  });

  it('test block exercises agentsmesh init and asserts canonical scaffold paths exist', () => {
    const tmpl = readTemplate();
    expect(tmpl).toMatch(/test\s+do/);
    expect(tmpl).toContain('"init", "--yes"');
    expect(tmpl).toContain('.agentsmesh/rules/_root.md');
    expect(tmpl).toContain('agentsmesh.yaml');
  });

  it('renders to a placeholder-free file when both substitutions are applied', () => {
    const rendered = readTemplate()
      .replaceAll('{{VERSION}}', '1.2.3')
      .replaceAll('{{SHA256}}', 'a'.repeat(64));
    expect(rendered).not.toContain('{{');
    expect(rendered).toContain('agentsmesh-1.2.3.tgz');
    expect(rendered).toContain('a'.repeat(64));
  });
});
