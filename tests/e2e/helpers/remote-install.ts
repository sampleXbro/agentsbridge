import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as tar from 'tar';

export async function createGithubRemoteStub(root: string): Promise<Record<string, string>> {
  const sha = '1234567890abcdef1234567890abcdef12345678';
  const repoTop = `example-demo-${sha.slice(0, 7)}`;
  const archiveRoot = join(root, 'archive-src', repoTop);
  mkdirSync(join(archiveRoot, 'skills', 'shared', 'alpha'), { recursive: true });
  mkdirSync(join(archiveRoot, 'skills', 'shared', 'beta'), { recursive: true });
  writeFileSync(
    join(archiveRoot, 'skills', 'shared', 'alpha', 'SKILL.md'),
    '---\ndescription: Alpha\n---\n# Alpha\n',
  );
  writeFileSync(
    join(archiveRoot, 'skills', 'shared', 'beta', 'SKILL.md'),
    '---\ndescription: Beta\n---\n# Beta\n',
  );

  const tarball = join(root, 'github-demo.tar.gz');
  await tar.c({ cwd: join(root, 'archive-src'), gzip: true, file: tarball }, [repoTop]);

  const binDir = join(root, 'bin');
  mkdirSync(binDir, { recursive: true });
  writeFileSync(
    join(binDir, 'git'),
    `#!/usr/bin/env node
const args = process.argv.slice(2);
const sha = process.env.AM_GITHUB_SHA;
if (args[0] === '--version') {
  console.log('git version 2.44.0');
  process.exit(0);
}
if (args[0] === 'ls-remote') {
  const ref = args[2] || 'HEAD';
  if (['HEAD', 'main', 'refs/heads/main'].includes(ref)) {
    const target = ref === 'HEAD' ? 'HEAD' : 'refs/heads/main';
    console.log(\`\${sha}\\t\${target}\`);
    process.exit(0);
  }
}
console.error('Unexpected git args:', args.join(' '));
process.exit(1);
`,
    { mode: 0o755 },
  );

  const preload = join(root, 'fetch-github-stub.cjs');
  writeFileSync(
    preload,
    `const fs = require('node:fs');
const tarball = process.env.AM_GITHUB_TARBALL;
const expected = process.env.AM_GITHUB_SHA;
global.fetch = async (url) => {
  const text = String(url);
  if (text === \`https://github.com/example/demo/tarball/\${expected}\`) {
    const buf = fs.readFileSync(tarball);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
  }
  throw new Error(\`Unexpected fetch: \${text}\`);
};
`,
  );

  return {
    AM_GITHUB_SHA: sha,
    AM_GITHUB_TARBALL: tarball,
    NODE_OPTIONS: `--require=${preload}`,
    PATH: `${binDir}:${process.env.PATH ?? ''}`,
  };
}
