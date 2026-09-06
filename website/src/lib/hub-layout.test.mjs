import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcPath, connectorPath, hubLayout, loopPath } from './hub-layout.mjs';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('arcPath: an SVG arc between two angles on a circle, clockwise on screen', () => {
  assert.equal(arcPath({ x: 100, y: 100 }, 50, 90, 270), 'M 100 150 A 50 50 0 0 1 100 50');
  assert.equal(arcPath({ x: 0, y: 0 }, 10, -90, 90), 'M 0 -10 A 10 10 0 0 1 0 10');
});

test('loopPath: a full circle starting at the bottom, so a token climbs the left side first', () => {
  assert.equal(loopPath({ x: 0, y: 0 }, 10), 'M 0 10 A 10 10 0 0 1 0 -10 A 10 10 0 0 1 0 10');
});

test('connectorPath: leaves the card edge and lands on the hub rim', () => {
  const hub = { x: 300, y: 200, r: 60 };
  const d = connectorPath({ x: 100, y: 120 }, hub);
  assert.ok(d.startsWith('M 100 120 C '), d);
  const [ex, ey] = d.split(', ').at(-1).split(' ').map(Number);
  assert.ok(Math.abs(dist({ x: ex, y: ey }, hub) - hub.r) < 0.01, `${ex},${ey}`);
  assert.ok(ex < hub.x, 'lands on the near side of the rim');
});

test('hubLayout(wide): hub centred, three cards each side clear of the loop, connectors for every card', () => {
  const l = hubLayout('wide', { left: 3, right: 3 });
  assert.equal(l.hub.x, l.view.width / 2);
  assert.equal(l.left.length, 3);
  assert.equal(l.right.length, 3);
  for (const c of l.left)
    assert.ok(c.x + c.width < l.loop.x - l.loop.r, 'left card clear of the loop');
  for (const c of l.right) assert.ok(c.x > l.loop.x + l.loop.r, 'right card clear of the loop');
  assert.equal(l.connectors.length, 6);
  assert.ok(l.pills.recall.y < l.hub.y && l.pills.capture.y > l.hub.y);
  assert.ok(l.more.y > l.pills.capture.y, 'the "and more" card sits below the loop');
});

test('hubLayout(compact): loop on top, cards in two columns below it, connectors rising to the hub', () => {
  const l = hubLayout('compact', { left: 3, right: 3 });
  const cards = [...l.left, ...l.right];
  assert.equal(cards.length, 6);
  for (const c of cards) assert.ok(c.y > l.loop.y + l.loop.r, 'cards below the loop');
  assert.equal(new Set(cards.map((c) => c.x)).size, 2, 'two columns');
  assert.equal(l.connectors.length, 6);
  for (const d of l.connectors) assert.ok(d.startsWith('M '), d);
});
