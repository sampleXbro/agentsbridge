import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meshLayout } from './mesh-layout.mjs';

const box = { width: 400, height: 300 };

test('meshLayout: source sits at the vertical centre on the left', () => {
  const { source } = meshLayout(3, box);
  assert.deepEqual(source, { x: 40, y: 150 });
});

test('meshLayout: zero targets yields no nodes and no edges', () => {
  const { targets, edges } = meshLayout(0, box);
  assert.deepEqual(targets, []);
  assert.deepEqual(edges, []);
});

test('meshLayout: one target is centred vertically on the right', () => {
  const { targets } = meshLayout(1, box);
  assert.deepEqual(targets, [{ x: 360, y: 150 }]);
});

test('meshLayout: targets are evenly spaced and symmetric around the centre', () => {
  const { targets } = meshLayout(5, box);
  assert.equal(targets.length, 5);
  const ys = targets.map((t) => t.y);
  assert.deepEqual(ys, [30, 90, 150, 210, 270]);
  assert.ok(targets.every((t) => t.x === 360));
});

test('meshLayout: one cubic edge path per target, starting at the source', () => {
  const { source, targets, edges } = meshLayout(4, box);
  assert.equal(edges.length, targets.length);
  for (const [i, d] of edges.entries()) {
    assert.ok(d.startsWith(`M ${source.x} ${source.y} C `), d);
    assert.ok(d.endsWith(`${targets[i].x} ${targets[i].y}`), d);
  }
});

test('meshLayout: honours custom margins', () => {
  const { source, targets } = meshLayout(2, { width: 200, height: 100, padX: 10, padY: 20 });
  assert.deepEqual(source, { x: 10, y: 50 });
  assert.deepEqual(targets, [
    { x: 190, y: 20 },
    { x: 190, y: 80 },
  ]);
});

test('meshLayout: two targets sit on the vertical margins; negative counts yield nothing', () => {
  const { targets } = meshLayout(2, box);
  assert.deepEqual(targets, [
    { x: 360, y: 30 },
    { x: 360, y: 270 },
  ]);
  assert.deepEqual(meshLayout(-3, box).targets, []);
});
