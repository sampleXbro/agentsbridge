/**
 * Fan-out geometry for the hero mesh: one source node on the left, N target
 * nodes stacked on the right, and a cubic edge from the source to each target.
 */

/** @typedef {{ x: number, y: number }} Point */
/**
 * `inletHeight` reserves a band above the fan for the inputs that flow INTO the
 * source (imported configs, installed packs); the fan is pushed down by it.
 * @typedef {{ width: number, height: number, padX?: number, padY?: number, inletHeight?: number }} MeshBox
 */
/** @typedef {{ source: Point, targets: Point[], edges: string[], inputs: Point[] }} MeshLayout */

const DEFAULT_PAD_X = 40;
const DEFAULT_PAD_Y = 30;
/** Vertical margin inside the inlet band, above the first and below the last input. */
const INLET_PAD = 12;

/**
 * @param {number} count
 * @param {MeshBox} box
 * @param {{ inputs?: number }} [extras]
 * @returns {MeshLayout}
 */
export function meshLayout(count, box, extras = {}) {
  const padX = box.padX ?? DEFAULT_PAD_X;
  const padY = box.padY ?? DEFAULT_PAD_Y;
  const inputCount = extras.inputs ?? 0;
  const inlet = inputCount > 0 ? (box.inletHeight ?? 0) : 0;
  const source = { x: padX, y: inlet + box.height / 2 };
  const targetX = box.width - padX;
  const targets = spread(count, inlet + padY, inlet + box.height - padY).map((y) => ({
    x: targetX,
    y,
  }));
  const bend = (targetX - source.x) / 2;
  const edges = targets.map(
    (t) =>
      `M ${source.x} ${source.y} C ${source.x + bend} ${source.y}, ${t.x - bend} ${t.y}, ${t.x} ${t.y}`,
  );
  const inputs = spread(inputCount, INLET_PAD, inlet - INLET_PAD).map((y) => ({ x: source.x, y }));
  return { source, targets, edges, inputs };
}

/**
 * The inlet: one straight rail from the first input, through every input, down
 * to the top of the source — the mirror of the lessons rail on the far side.
 * Pulses on it travel into `.agentsmesh/`: imports and installs.
 * @param {MeshLayout} layout
 * @param {number} [sourceInset] distance above the source centre to land on
 * @returns {string | null}
 */
export function meshInlet(layout, sourceInset = 0) {
  const first = layout.inputs[0];
  if (first === undefined) return null;
  const { source } = layout;
  return `M ${first.x} ${first.y} L ${source.x} ${source.y - sourceInset}`;
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
