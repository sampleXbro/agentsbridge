const DEFAULT_DEPLOY_SITE_URL = 'https://samplexbro.github.io/agentsmesh/';

function normalizeBasePath(pathname) {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Single source of truth for the docs site's public URL.
 * Set DEPLOY_SITE_URL in CI to the exact indexed website URL:
 * - GitHub Pages project site: https://samplexbro.github.io/agentsmesh/
 * - Custom domain at root: https://docs.agentsmesh.dev/
 */
export function resolveDeploySite(raw = null) {
  const value =
    raw?.trim() ||
    process.env.DEPLOY_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    DEFAULT_DEPLOY_SITE_URL;
  const url = new URL(value);
  const basePath = normalizeBasePath(url.pathname);
  const publicUrl = `${url.origin}${basePath === '/' ? '' : basePath}`;

  return {
    origin: url.origin,
    basePath,
    publicUrl,
    hostname: url.hostname,
  };
}

/** @returns {string} e.g. https://samplexbro.github.io */
export function getSiteOrigin(raw = null) {
  return resolveDeploySite(raw).origin;
}

/** @returns {string} e.g. /agentsmesh or / */
export function getSiteBase(raw = null) {
  return resolveDeploySite(raw).basePath;
}

/** @param {string} pathWithLeadingSlash path after base, e.g. /og-image.png */
export function fromBase(pathWithLeadingSlash, raw = null) {
  const suffix = pathWithLeadingSlash.startsWith('/')
    ? pathWithLeadingSlash
    : `/${pathWithLeadingSlash}`;
  const basePath = getSiteBase(raw);
  return basePath === '/' ? suffix : `${basePath}${suffix}`;
}

/** @param {string} pathWithLeadingSlash path after base, e.g. /og-image.png */
export function absoluteFromBase(pathWithLeadingSlash, raw = null) {
  const suffix = pathWithLeadingSlash.startsWith('/')
    ? pathWithLeadingSlash
    : `/${pathWithLeadingSlash}`;
  return `${resolveDeploySite(raw).publicUrl}${suffix}`;
}

export function getCnameValue(raw = null) {
  const { hostname } = resolveDeploySite(raw);
  return hostname.endsWith('.github.io') ? null : `${hostname}\n`;
}
