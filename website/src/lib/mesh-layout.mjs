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

/** @typedef {{ node: Point, path: string }} MeshLoop */

/**
 * The lessons return loop. A rail runs from the top target straight down
 * through every target node, so each tool is on the path; from the bottom
 * target it sweeps under the fan through a node on `laneY` and lands on the
 * underside of the source. Pulses travel it in reverse of the fan, which is the
 * point: what every tool learns flows back into `.agentsmesh/`.
 * @param {MeshLayout} layout
 * @param {number} laneY
 * @param {number} [sourceInset] distance below the source centre to land on
 * @returns {MeshLoop | null}
 */
export function meshReturnLoop(layout, laneY, sourceInset = 0) {
  const first = layout.targets[0];
  const last = layout.targets.at(-1);
  if (first === undefined || last === undefined) return null;
  const { source } = layout;
  const node = { x: (source.x + last.x) / 2, y: laneY };
  const reach = (last.x - source.x) / 4;
  const landing = { x: source.x, y: source.y + sourceInset };
  const rail = first === last ? '' : ` L ${last.x} ${last.y}`;
  const path =
    `M ${first.x} ${first.y}${rail} C ${last.x} ${laneY}, ${node.x + reach} ${laneY}, ${node.x} ${node.y} ` +
    `C ${node.x - reach} ${laneY}, ${landing.x} ${laneY}, ${landing.x} ${landing.y}`;
  return { node, path };
}
