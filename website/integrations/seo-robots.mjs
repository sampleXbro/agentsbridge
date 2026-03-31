import { writeFileSync } from 'node:fs';

import { getCnameValue, resolveDeploySite } from '../site-url.mjs';

export function buildRobotsTxt(raw = null) {
  const { publicUrl } = resolveDeploySite(raw);
  return `User-agent: *
Allow: /

Sitemap: ${publicUrl}/sitemap-index.xml
`;
}

export function buildSeoArtifacts(raw = null) {
  const artifacts = [{ fileName: 'robots.txt', content: buildRobotsTxt(raw) }];
  const cname = getCnameValue(raw);
  if (cname) {
    artifacts.push({ fileName: 'CNAME', content: cname });
  }
  return artifacts;
}

/**
 * @param {() => string | null | undefined} getDeploySiteUrl Full public site URL
 */
export default function seoRobotsIntegration(getDeploySiteUrl) {
  return {
    name: 'seo-robots',
    hooks: {
      'astro:build:done': ({ dir }) => {
        for (const artifact of buildSeoArtifacts(getDeploySiteUrl())) {
          writeFileSync(new URL(artifact.fileName, dir), artifact.content, 'utf8');
        }
      },
    },
  };
}
