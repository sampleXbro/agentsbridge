import { writeFileSync } from 'node:fs';

/**
 * @param {() => string} getOrigin Host-only HTTPS URL, no trailing slash
 */
export default function seoRobotsIntegration(getOrigin) {
  return {
    name: 'seo-robots',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const origin = getOrigin().replace(/\/$/, '');
        const body = `User-agent: *
Allow: /

Sitemap: ${origin}/agentsmesh/sitemap-index.xml
`;
        writeFileSync(new URL('robots.txt', dir), body, 'utf8');
      },
    },
  };
}
