import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSeoArtifacts, buildRobotsTxt } from './seo-robots.mjs';

test('buildRobotsTxt points crawlers at the public sitemap URL', () => {
  assert.equal(
    buildRobotsTxt('https://samplexbro.github.io/agentsmesh/'),
    `User-agent: *
Allow: /

Sitemap: https://samplexbro.github.io/agentsmesh/sitemap-index.xml
`,
  );
});

test('buildSeoArtifacts adds CNAME for custom domains and skips it for github.io', () => {
  assert.deepEqual(buildSeoArtifacts('https://samplexbro.github.io/agentsmesh/'), [
    {
      fileName: 'robots.txt',
      content: `User-agent: *
Allow: /

Sitemap: https://samplexbro.github.io/agentsmesh/sitemap-index.xml
`,
    },
  ]);

  assert.deepEqual(buildSeoArtifacts('https://docs.agentsmesh.dev/'), [
    {
      fileName: 'robots.txt',
      content: `User-agent: *
Allow: /

Sitemap: https://docs.agentsmesh.dev/sitemap-index.xml
`,
    },
    {
      fileName: 'CNAME',
      content: 'docs.agentsmesh.dev\n',
    },
  ]);
});
