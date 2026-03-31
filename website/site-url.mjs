/**
 * Single source of truth for the docs site origin. Set DEPLOY_SITE_URL in CI
 * (GitHub repository variable) to your indexed hostname — e.g. apex HTTPS URL
 * with no trailing slash. Configure DNS/CDN to 301 the non-canonical host (www vs apex).
 */

/** @returns {string} e.g. https://samplexbro.github.io */
export function getSiteOrigin() {
  const raw =
    process.env.DEPLOY_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    'https://samplexbro.github.io';
  return raw.replace(/\/$/, '');
}

/** @param {string} pathWithLeadingSlash path after base, e.g. /og-image.png */
export function absoluteFromBase(pathWithLeadingSlash) {
  const origin = getSiteOrigin();
  const suffix = pathWithLeadingSlash.startsWith('/')
    ? pathWithLeadingSlash
    : `/${pathWithLeadingSlash}`;
  return `${origin}/agentsmesh${suffix}`;
}
