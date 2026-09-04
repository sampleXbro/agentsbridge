import { test } from 'node:test';
import assert from 'node:assert/strict';
import devOnlyRoutes from './dev-only-routes.mjs';

const ROUTES = [{ pattern: '/og', entrypoint: './src/dev-pages/og.astro' }];

function runSetup(command) {
  const injected = [];
  const integration = devOnlyRoutes(ROUTES);
  integration.hooks['astro:config:setup']({ command, injectRoute: (r) => injected.push(r) });
  return injected;
}

test('dev-only-routes: has a stable integration name', () => {
  assert.equal(devOnlyRoutes(ROUTES).name, 'agentsmesh-dev-only-routes');
});

test('dev-only-routes: injects every route in dev', () => {
  assert.deepEqual(runSetup('dev'), ROUTES);
});

test('dev-only-routes: injects nothing for build or preview', () => {
  assert.deepEqual(runSetup('build'), []);
  assert.deepEqual(runSetup('preview'), []);
});

test('dev-only-routes: rejects an empty route list', () => {
  assert.throws(() => devOnlyRoutes([]), /at least one route/);
});
