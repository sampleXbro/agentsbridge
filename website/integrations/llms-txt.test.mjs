import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLlmsTxt, extractPageMeta, pathToUrl } from './llms-txt.mjs';

test('extractPageMeta: reads the title without the site suffix and the meta description', () => {
  const html = `<html><head><title>agentsmesh init | AgentsMesh</title>
<meta name="description" content="Scaffold the &quot;canonical&quot; directory."></head></html>`;
  assert.deepEqual(extractPageMeta(html, 'AgentsMesh'), {
    title: 'agentsmesh init',
    description: 'Scaffold the "canonical" directory.',
  });
});

test('extractPageMeta: tolerates a missing description', () => {
  assert.deepEqual(extractPageMeta('<title>Only | AgentsMesh</title>', 'AgentsMesh'), {
    title: 'Only',
    description: '',
  });
});

test('pathToUrl: maps dist html paths to trailing-slash site URLs', () => {
  const root = '/build/dist';
  assert.equal(
    pathToUrl(root, '/build/dist/index.html', 'https://x.dev/agentsmesh/'),
    'https://x.dev/agentsmesh/',
  );
  assert.equal(
    pathToUrl(root, '/build/dist/cli/init/index.html', 'https://x.dev/agentsmesh/'),
    'https://x.dev/agentsmesh/cli/init/',
  );
  assert.equal(
    pathToUrl(
      root,
      '\\build\\dist\\cli\\index.html'.replaceAll('\\', '/'),
      'https://x.dev/agentsmesh/',
    ),
    'https://x.dev/agentsmesh/cli/',
  );
});

test('buildLlmsTxt: header, then one link line per page sorted by URL', () => {
  const out = buildLlmsTxt({
    siteName: 'AgentsMesh',
    description: 'One config for every AI coding tool.',
    pages: [
      {
        url: 'https://x.dev/agentsmesh/cli/',
        title: 'CLI Reference',
        description: 'Every command.',
      },
      { url: 'https://x.dev/agentsmesh/', title: 'Home', description: 'Landing page.' },
      { url: 'https://x.dev/agentsmesh/cli/init/', title: 'agentsmesh init', description: '' },
    ],
  });
  assert.equal(
    out,
    `# AgentsMesh

> One config for every AI coding tool.

## Pages

- [Home](https://x.dev/agentsmesh/): Landing page.
- [CLI Reference](https://x.dev/agentsmesh/cli/): Every command.
- [agentsmesh init](https://x.dev/agentsmesh/cli/init/)
`,
  );
});

test('buildLlmsTxt: skips the 404 page', () => {
  const out = buildLlmsTxt({
    siteName: 'S',
    description: 'D',
    pages: [
      { url: 'https://x.dev/404/', title: 'Page not found', description: '' },
      { url: 'https://x.dev/', title: 'H', description: '' },
    ],
  });
  assert.ok(!out.includes('404'));
});
