/**
 * Fan-out geometry for the hero mesh: one source node on the left, N target
 * nodes stacked on the right, and a cubic edge from the source to each target.
 */

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ width: number, height: number, padX?: number, padY?: number }} MeshBox */
/** @typedef {{ source: Point, targets: Point[], edges: string[] }} MeshLayout */

const DEFAULT_PAD_X = 40;
const DEFAULT_PAD_Y = 30;

/**
 * @param {number} count
 * @param {MeshBox} box
 * @returns {MeshLayout}
 */
export function meshLayout(count, box) {
  const padX = box.padX ?? DEFAULT_PAD_X;
  const padY = box.padY ?? DEFAULT_PAD_Y;
  const source = { x: padX, y: box.height / 2 };
  const targetX = box.width - padX;
  const targets = spread(count, padY, box.height - padY).map((y) => ({ x: targetX, y }));
  const bend = (targetX - source.x) / 2;
  const edges = targets.map(
    (t) =>
      `M ${source.x} ${source.y} C ${source.x + bend} ${source.y}, ${t.x - bend} ${t.y}, ${t.x} ${t.y}`,
  );
  return { source, targets, edges };
}

/**
 * Evenly spread `count` values between `from` and `to` (inclusive); a single
 * value lands in the middle.
 * @param {number} count
 * @param {number} from
 * @param {number} to
 * @returns {number[]}
 */
function spread(count, from, to) {
  if (count <= 0) return [];
  if (count === 1) return [(from + to) / 2];
  const step = (to - from) / (count - 1);
  return Array.from({ length: count }, (_, i) => from + i * step);
}
