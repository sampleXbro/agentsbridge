/**
 * Writes `llms.txt` into the build output: a plain-text index of every page
 * (title, URL, description) for LLM-based crawlers and assistants.
 * https://llmstxt.org — pure helpers are exported for tests.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {{ url: string, title: string, description: string }} LlmsPage */

const ENTITIES = { '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&#39;': "'" };

/** @param {string} value */
function decode(value) {
  return value.replace(/&(quot|amp|lt|gt|#39);/g, (m) => ENTITIES[m] ?? m);
}

/**
 * @param {string} html
 * @param {string} siteName
 * @returns {{ title: string, description: string }}
 */
export function extractPageMeta(html, siteName) {
  const rawTitle = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  const suffix = new RegExp(`\\s*\\|\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
  const title = decode(rawTitle.replace(suffix, '').trim());
  const description = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
  return { title, description };
}

/**
 * @param {string} distRoot
 * @param {string} filePath
 * @param {string} siteUrl
 */
export function pathToUrl(distRoot, filePath, siteUrl) {
  const rel = relative(distRoot, filePath).replaceAll('\\', '/').replace(/index\.html$/, '');
  return `${siteUrl.replace(/\/$/, '')}/${rel}`;
}

/** @param {{ siteName: string, description: string, pages: readonly LlmsPage[] }} input */
export function buildLlmsTxt({ siteName, description, pages }) {
  const lines = [...pages]
    .filter((p) => !/\/404\/$/.test(p.url) && p.title !== 'Page not found')
    .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0))
    .map((p) => `- [${p.title}](${p.url})${p.description ? `: ${p.description}` : ''}`);
  return `# ${siteName}\n\n> ${description}\n\n## Pages\n\n${lines.join('\n')}\n`;
}

/** @param {string} dir */
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name === 'index.html' ? [path] : [];
  });
}

/**
 * @param {{ siteName: string, description: string, getSiteUrl: () => string }} options
 */
export default function llmsTxtIntegration({ siteName, description, getSiteUrl }) {
  return {
    name: 'agentsmesh-llms-txt',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const root = fileURLToPath(dir);
        const siteUrl = getSiteUrl();
        const pages = htmlFiles(root).map((file) => ({
          url: pathToUrl(root, file, siteUrl),
          ...extractPageMeta(readFileSync(file, 'utf8'), siteName),
        }));
        writeFileSync(join(root, 'llms.txt'), buildLlmsTxt({ siteName, description, pages }), 'utf8');
      },
    },
  };
}
