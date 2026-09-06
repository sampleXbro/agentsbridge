/**
 * Geometry for the hero hub scene: the AgentsMesh mark in a disc, a lessons
 * loop ringing it with `recall` on top and `capture` below, tool cards on
 * either side (wide) or in two columns beneath (compact), and a dashed
 * connector from every card to the rim of the hub.
 */

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ x: number, y: number, width: number, height: number, cx: number, cy: number }} Card */

const rad = (deg) => (deg * Math.PI) / 180;
const fmt = (n) => Number(n.toFixed(2));
const onCircle = (c, r, deg) => ({
  x: fmt(c.x + r * Math.cos(rad(deg))),
  y: fmt(c.y + r * Math.sin(rad(deg))),
});

/**
 * @param {Point} c
 * @param {number} r
 * @param {number} fromDeg angle in screen degrees (0 = right, 90 = down)
 * @param {number} toDeg
 */
export function arcPath(c, r, fromDeg, toDeg) {
  const a = onCircle(c, r, fromDeg);
  const b = onCircle(c, r, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

/** A full ring, starting at the bottom and climbing the left side first. */
export function loopPath(c, r) {
  return `M ${fmt(c.x)} ${fmt(c.y + r)} A ${r} ${r} 0 0 1 ${fmt(c.x)} ${fmt(c.y - r)} A ${r} ${r} 0 0 1 ${fmt(c.x)} ${fmt(c.y + r)}`;
}

/**
 * Cubic from a card's edge to the hub rim, leaving the card horizontally and
 * arriving along the radius.
 * @param {Point} from
 * @param {{ x: number, y: number, r: number }} hub
 */
export function connectorPath(from, hub) {
  const dx = hub.x - from.x;
  const dy = hub.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const end = { x: fmt(hub.x - (dx / len) * hub.r), y: fmt(hub.y - (dy / len) * hub.r) };
  const bend = Math.abs(end.x - from.x) * 0.45;
  const sign = dx >= 0 ? 1 : -1;
  const c1 = { x: fmt(from.x + sign * bend), y: from.y };
  const c2 = { x: fmt(end.x - (dx / len) * bend), y: fmt(end.y - (dy / len) * bend) };
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
}

const card = (cx, cy, width, height) => ({
  x: fmt(cx - width / 2),
  y: fmt(cy - height / 2),
  width,
  height,
  cx,
  cy,
});

/**
 * @param {'wide' | 'compact'} variant
 * @param {{ left: number, right: number }} counts
 */
export function hubLayout(variant, counts) {
  if (variant === 'wide') {
    const view = { width: 680, height: 500 };
    const hub = { x: 340, y: 246, r: 66 };
    const loop = { x: hub.x, y: hub.y, r: 128 };
    const rows = (n) => Array.from({ length: n }, (_, i) => 136 + i * 110);
    // Card inner edges stop short of the ring, so the middle row never crosses it.
    const left = rows(counts.left).map((y) => card(116, y, 186, 58));
    const right = rows(counts.right).map((y) => card(564, y, 186, 58));
    const connectors = [
      ...left.map((c) => connectorPath({ x: fmt(c.x + c.width), y: c.cy }, hub)),
      ...right.map((c) => connectorPath({ x: c.x, y: c.cy }, hub)),
    ];
    return {
      view,
      hub,
      loop,
      pills: {
        recall: { x: hub.x, y: hub.y - loop.r },
        capture: { x: hub.x, y: hub.y + loop.r },
        store: { x: hub.x, y: hub.y + hub.r + 24 },
      },
      left,
      right,
      more: card(hub.x, hub.y + loop.r + 74, 190, 46),
      connectors,
    };
  }
  const view = { width: 400, height: 640 };
  const hub = { x: 200, y: 150, r: 52 };
  const loop = { x: hub.x, y: hub.y, r: 116 };
  const rows = (n) => Array.from({ length: n }, (_, i) => 350 + i * 70);
  const left = rows(counts.left).map((y) => card(106, y, 176, 54));
  const right = rows(counts.right).map((y) => card(294, y, 176, 54));
  const connectors = [...left, ...right].map((c) => connectorPath({ x: c.cx, y: c.y }, hub));
  return {
    view,
    hub,
    loop,
    pills: {
      recall: { x: hub.x, y: hub.y - loop.r },
      capture: { x: hub.x, y: hub.y + loop.r },
      store: { x: hub.x, y: hub.y + hub.r + 26 },
    },
    left,
    right,
    more: card(hub.x, 350 + Math.max(counts.left, counts.right) * 70 + 4, 200, 48),
    connectors,
  };
}
