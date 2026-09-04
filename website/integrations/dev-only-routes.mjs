/**
 * Injects routes only while `astro dev` runs. Build and preview never see
 * them, so they are absent from `dist/` and from the sitemap.
 */

/** @typedef {{ pattern: string, entrypoint: string }} DevRoute */

/** @param {readonly DevRoute[]} routes */
export default function devOnlyRoutes(routes) {
  if (routes.length === 0) throw new Error('devOnlyRoutes: pass at least one route');
  return {
    name: 'agentsmesh-dev-only-routes',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') return;
        for (const route of routes) injectRoute(route);
      },
    },
  };
}
