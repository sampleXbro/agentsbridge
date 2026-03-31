import test from 'node:test';
import assert from 'node:assert/strict';

import {
  absoluteFromBase,
  fromBase,
  getCnameValue,
  resolveDeploySite,
} from './site-url.mjs';

test('resolveDeploySite keeps the GitHub Pages project path as base', () => {
  const deploySite = resolveDeploySite('https://samplexbro.github.io/agentsmesh/');

  assert.deepEqual(deploySite, {
    origin: 'https://samplexbro.github.io',
    basePath: '/agentsmesh',
    publicUrl: 'https://samplexbro.github.io/agentsmesh',
    hostname: 'samplexbro.github.io',
  });
});

test('resolveDeploySite supports a custom domain at the site root', () => {
  const deploySite = resolveDeploySite('https://docs.agentsmesh.dev/');

  assert.deepEqual(deploySite, {
    origin: 'https://docs.agentsmesh.dev',
    basePath: '/',
    publicUrl: 'https://docs.agentsmesh.dev',
    hostname: 'docs.agentsmesh.dev',
  });
});

test('fromBase and absoluteFromBase honor the resolved base path', () => {
  assert.equal(fromBase('/favicon.svg', 'https://samplexbro.github.io/agentsmesh/'), '/agentsmesh/favicon.svg');
  assert.equal(fromBase('/favicon.svg', 'https://docs.agentsmesh.dev/'), '/favicon.svg');
  assert.equal(
    absoluteFromBase('/og-image.png', 'https://docs.agentsmesh.dev/'),
    'https://docs.agentsmesh.dev/og-image.png',
  );
});

test('getCnameValue only emits a CNAME record for custom domains', () => {
  assert.equal(getCnameValue('https://samplexbro.github.io/agentsmesh/'), null);
  assert.equal(getCnameValue('https://docs.agentsmesh.dev/'), 'docs.agentsmesh.dev\n');
});
