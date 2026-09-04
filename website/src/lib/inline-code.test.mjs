import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlineCode } from './inline-code.mjs';

test('inlineCode: wraps backtick spans in <code>', () => {
  assert.equal(inlineCode('One `.agentsmesh/` folder'), 'One <code>.agentsmesh/</code> folder');
});

test('inlineCode: escapes HTML before wrapping', () => {
  assert.equal(inlineCode('a <b> & `x<y`'), 'a &lt;b&gt; &amp; <code>x&lt;y</code>');
});

test('inlineCode: leaves plain text untouched and handles several spans', () => {
  assert.equal(inlineCode('plain'), 'plain');
  assert.equal(inlineCode('`a` and `b`'), '<code>a</code> and <code>b</code>');
});

test('inlineCode: empty and unbalanced backticks stay as escaped text', () => {
  assert.equal(inlineCode(''), '');
  assert.equal(inlineCode('a `b'), 'a `b');
  assert.equal(inlineCode('``'), '``');
});
