// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import seoRobotsIntegration from './integrations/seo-robots.mjs';
import { absoluteFromBase, fromBase, getSiteBase, getSiteOrigin, resolveDeploySite } from './site-url.mjs';

const deploySite = resolveDeploySite();
const site = getSiteOrigin();
const ogImage = absoluteFromBase('/og-image.png');
const docsRoot = absoluteFromBase('/');

const websiteJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'AgentsMesh',
  alternateName: 'AgentsMesh — AI Coding Config Sync',
  url: docsRoot,
  description:
    'Open-source AI coding config sync CLI and TypeScript library. One canonical .agentsmesh directory generates native configs for Claude Code, Cursor, GitHub Copilot, Gemini CLI, Windsurf, Codex CLI, Continue, Cline, Kiro, Junie, Roo Code, and Antigravity.',
  inLanguage: 'en-US',
  publisher: {
    '@type': 'Organization',
    name: 'AgentsMesh',
    url: docsRoot,
    logo: {
      '@type': 'ImageObject',
      url: ogImage,
    },
  },
});

const organizationJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AgentsMesh',
  url: docsRoot,
  logo: ogImage,
  sameAs: ['https://github.com/sampleXbro/agentsmesh', 'https://www.npmjs.com/package/agentsmesh'],
});

export default defineConfig({
  site,
  trailingSlash: 'always',
  base: getSiteBase(),
  integrations: [
    starlight({
      title: 'AgentsMesh',
      tagline: 'One config. Every AI coding tool. Zero drift.',
      description:
        'AgentsMesh is an open-source AI coding config sync CLI and TypeScript library for Claude Code, Cursor, GitHub Copilot, Gemini CLI, Windsurf, Codex CLI, and more.',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: true,
      },
      social: {
        github: 'https://github.com/sampleXbro/agentsmesh',
      },
      editLink: {
        baseUrl: 'https://github.com/sampleXbro/agentsmesh/edit/master/website/',
      },
      customCss: [
        './src/styles/custom.css',
        './src/styles/catalog-explorer.css',
        './src/styles/catalog-explorer-table.css',
      ],
      head: [
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: ogImage },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:image', content: ogImage },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:site', content: '@agentsmesh' },
        },
        {
          tag: 'link',
          attrs: { rel: 'icon', href: fromBase('/favicon.svg'), type: 'image/svg+xml' },
        },
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          content: websiteJsonLd,
        },
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          content: organizationJsonLd,
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
          ],
        },
        {
          label: 'Canonical Configuration',
          items: [
            { label: 'Overview', slug: 'canonical-config' },
            { label: 'Rules', slug: 'canonical-config/rules' },
            { label: 'Commands', slug: 'canonical-config/commands' },
            { label: 'Agents', slug: 'canonical-config/agents' },
            { label: 'Skills', slug: 'canonical-config/skills' },
            { label: 'MCP Servers', slug: 'canonical-config/mcp-servers' },
            { label: 'Hooks', slug: 'canonical-config/hooks' },
            { label: 'Ignore Patterns', slug: 'canonical-config/ignore-patterns' },
            { label: 'Permissions', slug: 'canonical-config/permissions' },
          ],
        },
        {
          label: 'CLI Reference',
          items: [
            { label: 'Overview', slug: 'cli' },
            { label: 'init', slug: 'cli/init' },
            { label: 'generate', slug: 'cli/generate' },
            { label: 'import', slug: 'cli/import' },
            { label: 'convert', slug: 'cli/convert' },
            { label: 'install', slug: 'cli/install' },
            { label: 'diff', slug: 'cli/diff' },
            { label: 'lint', slug: 'cli/lint' },
            { label: 'watch', slug: 'cli/watch' },
            { label: 'check', slug: 'cli/check' },
            { label: 'merge', slug: 'cli/merge' },
            { label: 'matrix', slug: 'cli/matrix' },
            { label: 'plugin', slug: 'cli/plugin' },
            { label: 'target', slug: 'cli/target' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { label: 'agentsmesh.yaml', slug: 'configuration/agentsmesh-yaml' },
            { label: 'Local Overrides', slug: 'configuration/local-overrides' },
            { label: 'Extends', slug: 'configuration/extends' },
            { label: 'Collaboration', slug: 'configuration/collaboration' },
            { label: 'Conversions', slug: 'configuration/conversions' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Adopting AgentsMesh', slug: 'guides/existing-project' },
            { label: 'Multi-Tool Teams', slug: 'guides/multi-tool-teams' },
            { label: 'Sharing Config Across Repos', slug: 'guides/sharing-config' },
            { label: 'CI Drift Detection', slug: 'guides/ci-drift-detection' },
            { label: 'Community Packs', slug: 'guides/community-packs' },
            { label: 'Building Plugins', slug: 'guides/building-plugins' },
            { label: 'Extending AgentsMesh', slug: 'guides/extending' },
            { label: 'Local Dev Overrides', slug: 'guides/local-overrides' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Supported Tools Matrix', slug: 'reference/supported-tools' },
            { label: 'Generation Pipeline', slug: 'reference/generation-pipeline' },
            { label: 'Managed Embedding', slug: 'reference/managed-embedding' },
            { label: 'Programmatic API', slug: 'reference/programmatic-api' },
          ],
        },
      ],
    }),
    seoRobotsIntegration(() => deploySite.publicUrl),
  ],
});
