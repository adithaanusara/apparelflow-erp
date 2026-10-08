// An isometric loop for the sign-in page. A worker at the start of the line
// lifts a bundle off a pallet and sets it on the conveyor. The belt carries it
// through the verification gate and tips it into a waiting lorry, which
// drives away while an empty one pulls in. As one bundle nears the lorry the
// worker is already placing the next, so the line never looks idle.
//
// Everything is positioned in 3D "world" units and projected to the screen by
// `project`, so moving a part along a world axis is a plain 2D translation.
// The keyframes are generated from the same numbers as the drawing, and the
// worker's limbs are aimed at his hands and feet for every step of the
// handling sequence, so nothing drifts out of alignment.

type Point = [x: number, y: number, z: number];
type Tones = { top: string; left: string; right: string };

const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
const round = (value: number) => Math.round(value * 100) / 100;

// Isometric projection. +X runs down-right, +Y down-left, +Z up.
function project([x, y, z]: Point): [number, number] {
  return [round((x - y) * COS), round((x + y) * SIN - z)];
}

const points = (...corners: Point[]) =>
  corners.map((corner) => project(corner).join(",")).join(" ");

// The screen translation equal to moving by (dx, dy, dz) in the world.
function shift(dx: number, dy: number, dz: number): string {
  return `translate(${round((dx - dy) * COS)}px, ${round((dx + dy) * SIN - dz)}px)`;
}

// --- Palette ---------------------------------------------------------------
// A restrained industrial scheme: brushed steel and slate for machinery, pearl
// white for the cab, kraft for the bundles, and three muted accents (signal
// blue, verified green, safety amber).

export const ACCENT = {
  blue: "#5b84c4",
  green: "#46a67f",
  amber: "#d9a14a",
  kraft: "#cfae82",
};

const STEEL: Tones = { top: "#cdd6e1", left: "#a5b2c3", right: "#8291a6" };
const STEEL_DARK: Tones = { top: "#66758b", left: "#4b5a70", right: "#38465a" };
const CHASSIS: Tones = { top: "#2c3a4f", left: "#1c2738", right: "#111a27" };
const BELT_FRAME: Tones = { top: "#172133", left: "#55647a", right: "#414f64" };
const DECK: Tones = { top: "#95a3b6", left: "#76869c", right: "#5c6c83" };
const BOARD: Tones = { top: "#bcc7d5", left: "#93a2b6", right: "#72839a" };
const CAB: Tones = { top: "#eef2f6", left: "#d3dbe5", right: "#b0bccb" };
const FAIRING: Tones = { top: "#dfe5ec", left: "#c2ccd8", right: "#9fadbd" };
const KRAFT: Tones = { top: "#dcc19b", left: "#c7a77c", right: "#ab8b60" };
const PALLET: Tones = { top: "#8a7b68", left: "#716452", right: "#5b5042" };
const SHIRT: Tones = { top: "#506c96", left: "#3f5a84", right: "#304a70" };
const VEST: Tones = { top: "#e3b25f", left: ACCENT.amber, right: "#b9842f" };

const GLASS = "#1d2f4a";
const GLASS_SHINE = "#3f5c85";
const TYRE = "#0b111c";
const TROUSERS = "#27354b";
const BOOT = "#101723";
const SKIN = "#e0ba99";
const HELMET = "#f3f5f8";
const HELMET_SHADE = "#c6cfda";

// --- Drawing helpers -------------------------------------------------------

function Face({ fill, corners }: { fill: string; corners: Point[] }) {
  // Fill and stroke match so neighbouring faces meet without a seam.
  return <polygon fill={fill} stroke={fill} points={points(...corners)} />;
}

// A box drawn as its three visible faces: the +Y side (screen left), the +X
// side (screen right) and the top.
function Cuboid({
  at: [x, y, z],
  size: [w, d, h],
  tones,
}: {
  at: Point;
  size: Point;
  tones: Tones;
}) {
  return (
    <>
      <Face
        fill={tones.left}
        corners={[
          [x, y + d, z],
          [x + w, y + d, z],
          [x + w, y + d, z + h],
          [x, y + d, z + h],
        ]}
      />
      <Face
        fill={tones.right}
        corners={[
          [x + w, y, z],
          [x + w, y + d, z],
          [x + w, y + d, z + h],
          [x + w, y, z + h],
        ]}
      />
      <Face
        fill={tones.top}
        corners={[
          [x, y, z + h],
          [x + w, y, z + h],
          [x + w, y + d, z + h],
          [x, y + d, z + h],
        ]}
      />
    </>
  );
}

// Shapes drawn flat on a vertical plane: `sideFace` on a plane of constant X
// (given as [y, z] pairs) and `frontFace` on a plane of constant Y ([x, z]).
const sideFace = (x: number, outline: [number, number][]): Point[] =>
  outline.map(([y, z]) => [x, y, z]);
const frontFace = (y: number, outline: [number, number][]): Point[] =>
  outline.map(([x, z]) => [x, y, z]);

// --- Scene layout (world units) --------------------------------------------

const BELT = { x0: -14, x1: 226, y0: 0, y1: 40, top: 30 };
const GATE_X = 114;

const CARTON_SIZE: Point = [16, 16, 14];
const CARTON_Y = 12;
// The slot on the pallet that the worker takes each bundle from.
const STACK = { x: -78, z: 18 };

// The worker waits between the pallet and the start of the belt, behind the
// line the bundle travels along, so the bundle passes in front of his body.
const WORKER = { x: -44, y: 9 };
const ARM_LENGTH = 16.5;
const LEG_LENGTH = 23;

// The lorry parks hard against the end of the belt. The rear of its load bed
// lines up with the belt, which keeps the cab clear of the loading point.
const LORRY = { x: 232, w: 48, travel: 300 };
const LORRY_SIDE = LORRY.x + LORRY.w;
const BED = { y0: 4, y1: 96, floor: 22, boardTop: 30 };
const CABIN = { y0: 98, y1: 136, base: 14, waist: 40, roof: 66, rake: 5 };
const WHEEL_R = 8.5;
const AXLES = [BED.y0 + 14, BED.y0 + 33, CABIN.y0 + 22];
// The stretch of lane that is inside the frame.
const LANE = { from: -50, to: 172 };

// --- Timeline (percent of one cycle) ---------------------------------------
// One bundle is placed, and one lorry is loaded and replaced, per cycle. A
// bundle is on the belt for a little longer than a cycle, so two are in
// flight at once: `iso-carton-line` carries it for its first cycle and
// `iso-carton-load` takes over, at the same spot, for the final stretch.

const CYCLE = "14s";
// The belt never stops. Distance it moves per percent of the cycle.
const BELT_SPEED = 2.1;
const BELT_RUN = BELT_SPEED * 100;
const STRIPE_COUNT = 10;
const STRIPE_PITCH = BELT_RUN / STRIPE_COUNT;

// Bundle positions along the line, as the X of its back edge.
const CARTON_X = {
  placed: -20,
  gate: 110,
  // Where it has got to when the cycle wraps: close to the lorry.
  wrap: -20 + BELT_RUN,
  beltEnd: 210,
  bed: LORRY.x + 6,
};

const onBelt = (x: number) => round((x - CARTON_X.placed) / BELT_SPEED);

const AT = {
  // The worker's sequence, which runs up to the end of the cycle...
  restocked: 46,
  leanIn: 70,
  reach: 74,
  gripped: 77,
  lifted: 81,
  atBelt: 92,
  placed: 100,
  // ...and finishes just after it wraps.
  armsDown: 4,
  workerBack: 12,
  // The bundle that was placed at the start of this cycle.
  gateEnter: onBelt(CARTON_X.gate - 13),
  verified: onBelt(CARTON_X.gate),
  // The bundle that was placed a cycle ago.
  beltEnd: round((CARTON_X.beltEnd - CARTON_X.wrap) / BELT_SPEED),
  inBed: 15,
  loaded: 17,
  departStart: 21,
  departEnd: 41,
  arriveStart: 34,
  arriveEnd: 88,
};

// Degrees a wheel turns while a lorry covers its travel distance.
const WHEEL_TURN = round((LORRY.travel / (2 * Math.PI * WHEEL_R)) * 360);

// --- The worker's handling sequence ----------------------------------------
// Worked out on a clock that runs from 70 to 112, i.e. past the end of the
// cycle, and then folded back onto 0-100 when the keyframes are written.

type Key = [at: number, value: number, linear?: boolean];

// A value that moves from key to key and holds outside the first and last.
// Each move eases in and out unless its end key is marked linear.
function track(keys: Key[]) {
  return (t: number): number => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let index = 1; index < keys.length; index++) {
      const [t0, v0] = keys[index - 1];
      const [t1, v1, linear] = keys[index];
      if (t <= t1) {
        const u = (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * (linear ? u : u * u * (3 - 2 * u));
      }
    }
    return keys[keys.length - 1][1];
  };
}

const SEQUENCE_END = 100 + AT.workerBack;

// He leans in to the pallet, pulls the top bundle to his chest, carries it to
// the belt, sets it down as the belt takes it, and walks back.
const workerX = track([
  [AT.leanIn, WORKER.x],
  [AT.reach, STACK.x + 22],
  [AT.gripped, STACK.x + 22],
  [AT.lifted, STACK.x + 26],
  [AT.atBelt, CARTON_X.placed - 9],
  [AT.placed, CARTON_X.placed - 4],
  [100 + AT.armsDown, CARTON_X.placed - 4],
  [SEQUENCE_END, WORKER.x],
]);
// The last stretch is linear at belt speed, so the bundle is already moving
// with the belt when he lets go.
const cartonX = track([
  [AT.gripped, STACK.x],
  [AT.lifted, STACK.x + 18],
  [AT.atBelt, CARTON_X.placed - (AT.placed - AT.atBelt) * BELT_SPEED],
  [AT.placed, CARTON_X.placed, true],
]);
const cartonZ = track([
  [AT.gripped, STACK.z],
  [AT.lifted, BELT.top + 3],
  [AT.atBelt, BELT.top + 3],
  [AT.placed, BELT.top],
]);
// 0 = arms at his sides, 1 = hands on the bundle.
const grip = track([
  [AT.reach, 0],
  [AT.gripped, 1],
  [AT.placed, 1],
  [100 + AT.armsDown, 0],
]);

// Forward and back foot travel while he walks.
function stride(t: number): number {
  const steps = (from: number, to: number) =>
    4 * Math.sin(4 * Math.PI * ((t - from) / (to - from)));
  if (t > AT.lifted && t < AT.atBelt) return steps(AT.lifted, AT.atBelt);
  if (t > 100 + AT.armsDown && t < SEQUENCE_END) {
    return -steps(100 + AT.armsDown, SEQUENCE_END);
  }
  return 0;
}

// The transform that stretches a limb drawn along +x from its joint to the
// point it should reach.
function limb(joint: Point, reach: Point, restLength: number): string {
  const [ax, ay] = project(joint);
  const [bx, by] = project(reach);
  // Kept in (-90, 270] so a limb pointing left never jumps between +180 and
  // -180 degrees from one keyframe to the next.
  let angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  if (angle <= -90) angle += 360;
  const stretch = Math.hypot(bx - ax, by - ay) / restLength;
  return `translate(${ax}px, ${ay}px) rotate(${round(angle)}deg) scaleX(${round(stretch)})`;
}

function pose(t: number) {
  const x = workerX(t);
  const y = WORKER.y;
  const hold = grip(t);
  const cx = cartonX(t);
  const cz = cartonZ(t);
  const step = stride(t);
  const blend = (rest: Point, onCarton: Point): Point => [
    rest[0] + (onCarton[0] - rest[0]) * hold,
    rest[1] + (onCarton[1] - rest[1]) * hold,
    rest[2] + (onCarton[2] - rest[2]) * hold,
  ];

  return {
    body: shift(x - WORKER.x, 0, 0),
    // The far hand takes the hidden side of the bundle, the near hand the
    // side that faces the viewer.
    armFar: limb(
      [x - 6, y, 39.5],
      blend([x - 7, y + 1, 24], [cx - 0.5, CARTON_Y + 8, cz + 8]),
      ARM_LENGTH,
    ),
    armNear: limb(
      [x + 6, y, 39.5],
      blend([x + 7, y + 1, 24], [cx + 16.5, CARTON_Y + 8, cz + 8]),
      ARM_LENGTH,
    ),
    legFar: limb([x - 3, y - 2, 23], [x - 3 + step, y - 2, 0.5], LEG_LENGTH),
    legNear: limb([x + 3, y - 2, 23], [x + 3 - step, y - 2, 0.5], LEG_LENGTH),
    carton: shift(cx - STACK.x, 0, cz - STACK.z),
  };
}

type Part = keyof ReturnType<typeof pose>;

// Every whole percent the sequence covers, as [percent of cycle, clock time].
const SEQUENCE_STOPS: [number, number][] = [
  ...Array.from({ length: AT.workerBack + 1 }, (_, index): [number, number] => [
    index,
    100 + index,
  ]),
  ...Array.from({ length: 101 - AT.leanIn }, (_, index): [number, number] => [
    AT.leanIn + index,
    AT.leanIn + index,
  ]),
];

const sampled = (part: Part, from = 0, to = 100) =>
  SEQUENCE_STOPS.filter(([percent]) => percent >= from && percent <= to)
    .map(([percent, t]) => `${percent}% { transform: ${pose(t)[part]}; }`)
    .join("\n  ");

const workerKeyframes = (name: string, part: Part) => `
@keyframes ${name} {
  ${sampled(part)}
}`;

const REST = pose(AT.leanIn);
const lineFrom = CARTON_X.placed - CARTON_X.gate;
const lineTo = CARTON_X.wrap - CARTON_X.gate;
const toBeltEnd = CARTON_X.beltEnd - CARTON_X.wrap;
const toBed = CARTON_X.bed - CARTON_X.wrap;

const STYLES = `
.iso-carton-load, .iso-loaded, .iso-lorry-in, .iso-lamp-amber, .iso-scan { opacity: 0; }
.iso-curtain { opacity: 0.12; }
.iso-badge { transform-box: fill-box; transform-origin: center; }
.iso-body { transform: ${REST.body}; }
.iso-arm-far { transform: ${REST.armFar}; }
.iso-arm-near { transform: ${REST.armNear}; }
.iso-leg-far { transform: ${REST.legFar}; }
.iso-leg-near { transform: ${REST.legNear}; }

@media (prefers-reduced-motion: no-preference) {
  .iso-carton-pick, .iso-carton-line, .iso-carton-load, .iso-tag, .iso-loaded,
  .iso-lorry-out, .iso-lorry-in, .iso-wheel, .iso-stripes, .iso-lamp-amber,
  .iso-lamp-green, .iso-curtain, .iso-scan, .iso-badge, .iso-body,
  .iso-arm-far, .iso-arm-near, .iso-leg-far, .iso-leg-near {
    animation-duration: ${CYCLE};
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
  .iso-carton-pick { animation-name: iso-carton-pick; }
  .iso-carton-line { animation-name: iso-carton-line; }
  .iso-carton-load { animation-name: iso-carton-load; }
  .iso-tag { animation-name: iso-tag; }
  .iso-loaded { animation-name: iso-loaded; }
  .iso-lorry-out { animation-name: iso-lorry-out; }
  .iso-lorry-in { animation-name: iso-lorry-in; }
  .iso-lorry-out .iso-wheel { animation-name: iso-wheel-out; }
  .iso-lorry-in .iso-wheel { animation-name: iso-wheel-in; }
  .iso-stripes { animation-name: iso-stripes; }
  .iso-lamp-amber { animation-name: iso-lamp-amber; }
  .iso-lamp-green { animation-name: iso-lamp-green; }
  .iso-curtain { animation-name: iso-curtain; }
  .iso-scan { animation-name: iso-scan; }
  .iso-badge { animation-name: iso-badge; }
  .iso-body { animation-name: iso-body; }
  .iso-arm-far { animation-name: iso-arm-far; }
  .iso-arm-near { animation-name: iso-arm-near; }
  .iso-leg-far { animation-name: iso-leg-far; }
  .iso-leg-near { animation-name: iso-leg-near; }
}

/* The next bundle appears on the pallet, waits, and is carried to the belt. */
@keyframes iso-carton-pick {
  0%, ${AT.restocked - 6}% { transform: ${shift(0, 0, 0)}; opacity: 0; }
  ${AT.restocked}%, ${AT.gripped}% { transform: ${shift(0, 0, 0)}; opacity: 1; }
  ${sampled("carton", AT.gripped + 1, 99)}
  100% { transform: ${pose(AT.placed).carton}; opacity: 1; }
}
/* On the belt, from the worker's hands to within reach of the lorry. */
@keyframes iso-carton-line {
  0% { transform: ${shift(lineFrom, 0, 0)}; }
  100% { transform: ${shift(lineTo, 0, 0)}; }
}
@keyframes iso-tag {
  0%, ${round(AT.verified - 0.1)}% { opacity: 0; }
  ${AT.verified}%, 100% { opacity: 1; }
}
/* The final stretch: off the end of the belt and into the load bed. */
@keyframes iso-carton-load {
  0% { transform: ${shift(0, 0, 0)}; opacity: 1; }
  ${AT.beltEnd}% { transform: ${shift(toBeltEnd, 0, 0)}; animation-timing-function: cubic-bezier(0.4, 0.16, 0.8, 0.7); }
  ${AT.inBed}% { transform: ${shift(toBed, 0, 0)}; animation-timing-function: ease-in; }
  ${AT.loaded}% { transform: ${shift(toBed, 0, BED.floor - BELT.top)}; opacity: 1; }
  ${AT.loaded + 0.01}%, 100% { transform: ${shift(toBed, 0, BED.floor - BELT.top)}; opacity: 0; }
}
@keyframes iso-loaded {
  0%, ${AT.loaded}% { opacity: 0; }
  ${AT.loaded + 0.01}%, 100% { opacity: 1; }
}
${workerKeyframes("iso-body", "body")}
${workerKeyframes("iso-arm-far", "armFar")}
${workerKeyframes("iso-arm-near", "armNear")}
${workerKeyframes("iso-leg-far", "legFar")}
${workerKeyframes("iso-leg-near", "legNear")}

/* The loaded lorry pulls away slowly and gathers speed. */
@keyframes iso-lorry-out {
  0%, ${AT.departStart}% { transform: ${shift(0, 0, 0)}; opacity: 1; animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.55); }
  ${AT.departEnd - 4}% { opacity: 1; }
  ${AT.departEnd}%, 100% { transform: ${shift(0, LORRY.travel, 0)}; opacity: 0; }
}
@keyframes iso-wheel-out {
  0%, ${AT.departStart}% { transform: rotate(0deg); animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.55); }
  ${AT.departEnd}%, 100% { transform: rotate(-${WHEEL_TURN}deg); }
}
/* The empty lorry takes its time: it rolls in and brakes gently to a stop. */
@keyframes iso-lorry-in {
  0%, ${AT.arriveStart}% { transform: ${shift(0, -LORRY.travel, 0)}; opacity: 0; animation-timing-function: cubic-bezier(0.3, 0.5, 0.35, 1); }
  ${AT.arriveStart + 4}% { opacity: 1; }
  ${AT.arriveEnd}%, 100% { transform: ${shift(0, 0, 0)}; opacity: 1; }
}
@keyframes iso-wheel-in {
  0%, ${AT.arriveStart}% { transform: rotate(${WHEEL_TURN}deg); animation-timing-function: cubic-bezier(0.3, 0.5, 0.35, 1); }
  ${AT.arriveEnd}%, 100% { transform: rotate(0deg); }
}

@keyframes iso-stripes {
  0% { transform: ${shift(0, 0, 0)}; }
  100% { transform: ${shift(BELT_RUN, 0, 0)}; }
}
@keyframes iso-lamp-amber {
  0%, ${round(AT.gateEnter - 0.1)}% { opacity: 0; }
  ${AT.gateEnter}%, ${round(AT.gateEnter + 2)}% { opacity: 1; }
  ${round(AT.gateEnter + 3)}% { opacity: 0.3; }
  ${round(AT.gateEnter + 4)}%, ${round(AT.verified - 0.1)}% { opacity: 1; }
  ${AT.verified}%, 100% { opacity: 0; }
}
@keyframes iso-lamp-green {
  0%, ${round(AT.verified - 0.1)}% { opacity: 0; }
  ${AT.verified}%, ${round(AT.verified + 9)}% { opacity: 1; }
  ${round(AT.verified + 12)}%, 100% { opacity: 0; }
}
@keyframes iso-curtain {
  0%, ${round(AT.gateEnter - 1)}% { opacity: 0.12; }
  ${round(AT.gateEnter + 1)}%, ${AT.verified}% { opacity: 0.42; }
  ${round(AT.verified + 4)}%, 100% { opacity: 0.12; }
}
@keyframes iso-scan {
  0%, ${AT.gateEnter}% { transform: translate(0, 0); opacity: 0; }
  ${round(AT.gateEnter + 0.5)}% { opacity: 1; }
  ${round(AT.verified - 0.5)}% { transform: translate(0, 34px); opacity: 1; }
  ${AT.verified}%, 100% { transform: translate(0, 34px); opacity: 0; }
}
@keyframes iso-badge {
  0%, ${round(AT.verified - 0.1)}% { transform: scale(0.2); opacity: 0; animation-timing-function: cubic-bezier(0.2, 1.6, 0.4, 1); }
  ${round(AT.verified + 2)}%, ${round(AT.verified + 9)}% { transform: scale(1); opacity: 1; }
  ${round(AT.verified + 12)}%, 100% { transform: scale(0.8); opacity: 0; }
}
`;

// --- Scene -----------------------------------------------------------------

export function LogisticsAnimation({ className }: { className?: string }) {
  const [badgeX, badgeY] = project([GATE_X + 4, 19.5, 100]);
  const laneStart = project([LORRY.x + LORRY.w / 2, LANE.from, 0]);
  const laneEnd = project([LORRY.x + LORRY.w / 2, LANE.to, 0]);
  const lane = [LORRY.x - 4, LORRY_SIDE + 6];
  const stripes = Array.from(
    { length: Math.ceil((BELT.x1 - BELT.x0 + BELT_RUN) / STRIPE_PITCH) + 1 },
    (_, index) => BELT.x1 - index * STRIPE_PITCH,
  );

  return (
    <svg
      viewBox="-142 -86 404 302"
      role="img"
      aria-label="Animation: a worker lifts a bundle from a pallet onto a conveyor. It is verified at a gate and carried into a lorry, which drives away as an empty lorry pulls in."
      className={className}
      strokeWidth="0.5"
      strokeLinejoin="round"
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <defs>
        {["iso-lane", "iso-lane-edge"].map((id, index) => (
          <linearGradient
            key={id}
            id={id}
            gradientUnits="userSpaceOnUse"
            x1={laneStart[0]}
            y1={laneStart[1]}
            x2={laneEnd[0]}
            y2={laneEnd[1]}
          >
            {[0, 0.28, 0.72, 1].map((offset) => (
              <stop
                key={offset}
                offset={offset}
                stopColor="white"
                stopOpacity={
                  offset === 0 || offset === 1 ? 0 : index === 0 ? 0.07 : 0.26
                }
              />
            ))}
          </linearGradient>
        ))}
        <clipPath id="iso-belt-top">
          <polygon
            points={points(
              [BELT.x0, BELT.y0 + 2, BELT.top],
              [BELT.x1, BELT.y0 + 2, BELT.top],
              [BELT.x1, BELT.y1 - 2, BELT.top],
              [BELT.x0, BELT.y1 - 2, BELT.top],
            )}
          />
        </clipPath>
      </defs>

      {/* Floor: the platform under the line and the lane the lorries use,
          which fades out towards both ends of the frame. */}
      <polygon
        fill="white"
        fillOpacity="0.045"
        stroke="white"
        strokeOpacity="0.14"
        points={points(
          [-108, -22, 0],
          [224, -22, 0],
          [224, 54, 0],
          [-108, 54, 0],
        )}
      />
      <polygon
        fill="url(#iso-lane)"
        stroke="none"
        points={points(
          [lane[0], LANE.from, 0],
          [lane[1], LANE.from, 0],
          [lane[1], LANE.to, 0],
          [lane[0], LANE.to, 0],
        )}
      />
      {lane.map((x) => (
        <polyline
          key={x}
          fill="none"
          stroke="url(#iso-lane-edge)"
          strokeWidth="1"
          strokeDasharray="8 7"
          points={points([x, LANE.from, 0], [x, LANE.to, 0])}
        />
      ))}

      {/* Bundles waiting on a pallet at the head of the line. */}
      <Cuboid at={[STACK.x - 22, 7, 0]} size={[42, 26, 4]} tones={PALLET} />
      <Cuboid
        at={[STACK.x - 18, CARTON_Y, 4]}
        size={CARTON_SIZE}
        tones={KRAFT}
      />
      <Cuboid at={[STACK.x, CARTON_Y, 4]} size={CARTON_SIZE} tones={KRAFT} />
      <Cuboid
        at={[STACK.x - 18, CARTON_Y, STACK.z]}
        size={CARTON_SIZE}
        tones={KRAFT}
      />

      {/* The worker is drawn before the conveyor: he stands beyond its end,
          so the belt covers his legs when he steps up to it. */}
      <WorkerBody />

      <Conveyor stripes={stripes} />

      {/* Verification gate, far side: post, light curtain and scan line. */}
      <Cuboid at={[GATE_X, -9, 0]} size={[8, 5, 72]} tones={STEEL} />
      <polygon
        className="iso-curtain"
        fill={ACCENT.blue}
        stroke="none"
        points={points(
          [GATE_X + 4, -4, BELT.top],
          [GATE_X + 4, 43, BELT.top],
          [GATE_X + 4, 43, 68],
          [GATE_X + 4, -4, 68],
        )}
      />
      <polyline
        className="iso-scan"
        fill="none"
        stroke="#dbe6f5"
        strokeWidth="1.6"
        points={points([GATE_X + 4, -4, 66], [GATE_X + 4, 43, 66])}
      />

      {/* Lorries, far side: one leaving, its replacement arriving. */}
      <g className="iso-lorry-out">
        <LorryBack />
      </g>
      <g className="iso-lorry-in">
        <LorryBack />
      </g>

      {/* The three stages of a bundle's journey. */}
      <g className="iso-carton-load">
        <Carton at={[CARTON_X.wrap, CARTON_Y, BELT.top]} verified />
      </g>
      <g className="iso-carton-line">
        <Carton at={[CARTON_X.gate, CARTON_Y, BELT.top]} />
      </g>
      <g className="iso-carton-pick">
        <Carton at={[STACK.x, CARTON_Y, STACK.z]} plain />
      </g>

      {/* The worker's near arm reaches in front of the bundle. */}
      <Limb
        className="iso-arm-near"
        length={ARM_LENGTH}
        width={4}
        colour={SHIRT.left}
        tip={SKIN}
      />

      <GateFront badge={[badgeX, badgeY]} />

      {/* Lorries, near side, with the loaded bundle between the two halves. */}
      <g className="iso-lorry-out">
        <g className="iso-loaded">
          <Carton at={[CARTON_X.bed, CARTON_Y, BED.floor]} verified />
        </g>
        <LorryFront />
      </g>
      <g className="iso-lorry-in">
        <LorryFront />
      </g>
    </svg>
  );
}

function Conveyor({ stripes }: { stripes: number[] }) {
  const length = BELT.x1 - BELT.x0;
  const width = BELT.y1 - BELT.y0;

  return (
    <>
      {[0, 106, 214].flatMap((x) =>
        [4, 32].map((y) => (
          <Cuboid
            key={`${x}-${y}`}
            at={[x, y, 0]}
            size={[4, 4, 23]}
            tones={STEEL_DARK}
          />
        )),
      )}
      <Cuboid
        at={[BELT.x0, BELT.y0, 23]}
        size={[length, width, 7]}
        tones={BELT_FRAME}
      />
      <g clipPath="url(#iso-belt-top)">
        <g className="iso-stripes">
          {stripes.map((x) => (
            <polyline
              key={x}
              fill="none"
              stroke="#3a4a64"
              strokeWidth="1.3"
              points={points([x, BELT.y0, BELT.top], [x, BELT.y1, BELT.top])}
            />
          ))}
        </g>
      </g>
      {/* Brushed steel side rails. */}
      {[BELT.y0, BELT.y1 - 2].map((y) => (
        <Face
          key={y}
          fill={STEEL.left}
          corners={[
            [BELT.x0, y, BELT.top],
            [BELT.x1, y, BELT.top],
            [BELT.x1, y + 2, BELT.top],
            [BELT.x0, y + 2, BELT.top],
          ]}
        />
      ))}
    </>
  );
}

function GateFront({ badge: [x, y] }: { badge: [number, number] }) {
  const lamp = { at: [GATE_X + 8, 13, 73] as Point, size: [3, 13, 6] as Point };

  return (
    <>
      <Cuboid at={[GATE_X, 43, 0]} size={[8, 5, 72]} tones={STEEL} />
      <Cuboid at={[GATE_X, -9, 72]} size={[8, 57, 8]} tones={STEEL} />
      {/* A signal-blue strip along the beam. */}
      <Face
        fill={ACCENT.blue}
        corners={sideFace(GATE_X + 8, [
          [-7, 74],
          [9, 74],
          [9, 78],
          [-7, 78],
        ])}
      />
      <Face
        fill={ACCENT.blue}
        corners={sideFace(GATE_X + 8, [
          [30, 74],
          [46, 74],
          [46, 78],
          [30, 78],
        ])}
      />
      <Cuboid {...lamp} tones={STEEL_DARK} />
      <g className="iso-lamp-amber">
        <Cuboid {...lamp} tones={VEST} />
      </g>
      <g className="iso-lamp-green">
        <Cuboid
          {...lamp}
          tones={{ top: "#8fd4b6", left: "#63bd98", right: ACCENT.green }}
        />
      </g>
      <g className="iso-badge">
        <circle
          cx={x}
          cy={y}
          r="10"
          fill={ACCENT.green}
          stroke="#eef2f6"
          strokeWidth="1.5"
        />
        <path
          d={`M${x - 4.5} ${y + 0.5}l3 3.2 6-6.6`}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
    </>
  );
}

// A bundle. It carries a green "verified" label once it has passed the gate:
// `verified` shows the label always, `plain` never, and otherwise it appears
// at the moment of verification.
function Carton({
  at,
  verified = false,
  plain = false,
}: {
  at: Point;
  verified?: boolean;
  plain?: boolean;
}) {
  const [x, y, z] = at;
  const [w, d, h] = CARTON_SIZE;
  const side = x + w;

  return (
    <>
      <Cuboid at={at} size={CARTON_SIZE} tones={KRAFT} />
      {/* Packing tape over the top and down the near side. */}
      <polyline
        fill="none"
        stroke="#9a7c55"
        strokeWidth="1.1"
        points={points(
          [x + w / 2, y, z + h],
          [x + w / 2, y + d, z + h],
          [x + w / 2, y + d, z + h - 5],
        )}
      />
      {!plain && (
        <g className={verified ? undefined : "iso-tag"}>
          <polygon
            fill={ACCENT.green}
            stroke="#2f7d5e"
            points={points(
              ...sideFace(side, [
                [y + 3, z + 3],
                [y + d - 3, z + 3],
                [y + d - 3, z + h - 3],
                [y + 3, z + h - 3],
              ]),
            )}
          />
          <polyline
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.4"
            strokeLinecap="round"
            points={points(
              ...sideFace(side, [
                [y + 11.5, z + 7.5],
                [y + 9, z + 5],
                [y + 5, z + 10],
              ]),
            )}
          />
        </g>
      )}
    </>
  );
}

// --- Worker ----------------------------------------------------------------

// A limb is drawn along +x from the origin; its class supplies the transform
// that moves it to its joint and aims it (see `limb`).
function Limb({
  className,
  length,
  width,
  colour,
  tip,
}: {
  className: string;
  length: number;
  width: number;
  colour: string;
  tip: string;
}) {
  return (
    <g className={className}>
      <line
        x1="0"
        y1="0"
        x2={length}
        y2="0"
        stroke={colour}
        strokeWidth={width}
        strokeLinecap="round"
      />
      <circle cx={length} cy="0" r={width * 0.6} fill={tip} stroke="none" />
    </g>
  );
}

// Everything except the near arm, which is drawn later so that it passes in
// front of the bundle he is holding.
function WorkerBody() {
  const { x, y } = WORKER;
  const [footX, footY] = project([x, y - 2, 0]);
  const [headX, headY] = project([x, y - 2.5, 47.5]);

  return (
    <>
      <g className="iso-body">
        <ellipse
          cx={footX}
          cy={footY}
          rx="10"
          ry="4.5"
          fill="#020617"
          fillOpacity="0.4"
          stroke="none"
        />
      </g>
      <Limb
        className="iso-leg-far"
        length={LEG_LENGTH}
        width={4.8}
        colour={TROUSERS}
        tip={BOOT}
      />
      <Limb
        className="iso-leg-near"
        length={LEG_LENGTH}
        width={4.8}
        colour={TROUSERS}
        tip={BOOT}
      />
      <g className="iso-body">
        <Cuboid
          at={[x - 6, y - 5, 21]}
          size={[12, 5, 4]}
          tones={{ top: TROUSERS, left: TROUSERS, right: "#1d2839" }}
        />
        <Cuboid at={[x - 6.5, y - 5, 25]} size={[13, 5, 16]} tones={SHIRT} />
        {/* Hi-vis vest with a reflective band and an open collar. */}
        <Face
          fill={VEST.right}
          corners={sideFace(x + 6.5, [
            [y - 5, 26],
            [y, 26],
            [y, 41],
            [y - 5, 41],
          ])}
        />
        <Face
          fill={VEST.left}
          corners={frontFace(y, [
            [x - 6.5, 26],
            [x + 6.5, 26],
            [x + 6.5, 41],
            [x - 6.5, 41],
          ])}
        />
        <Face
          fill={SHIRT.left}
          corners={frontFace(y, [
            [x - 2.4, 41],
            [x + 2.4, 41],
            [x, 35.5],
          ])}
        />
        <Face
          fill="#e9eef4"
          corners={frontFace(y, [
            [x - 6.5, 30],
            [x + 6.5, 30],
            [x + 6.5, 32],
            [x - 6.5, 32],
          ])}
        />
        <Face
          fill="#c9d2dd"
          corners={sideFace(x + 6.5, [
            [y - 5, 30],
            [y, 30],
            [y, 32],
            [y - 5, 32],
          ])}
        />
        {/* Head and hard hat. */}
        <rect
          x={headX - 1.8}
          y={headY + 2}
          width="3.6"
          height="5"
          fill="#c9a384"
          stroke="none"
        />
        <circle cx={headX} cy={headY} r="4.7" fill={SKIN} stroke="none" />
        <path
          d={`M${headX - 5.2} ${headY - 0.8}a5.2 5.6 0 0 1 10.4 0z`}
          fill={HELMET}
          stroke={HELMET_SHADE}
        />
        <path
          d={`M${headX - 6.2} ${headY - 0.6}h12.6`}
          fill="none"
          stroke={HELMET_SHADE}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
      <Limb
        className="iso-arm-far"
        length={ARM_LENGTH}
        width={4}
        colour={SHIRT.right}
        tip={SKIN}
      />
    </>
  );
}

// --- Lorry -----------------------------------------------------------------

// The windscreen leans back: the cab's front edge at a given height.
function cabFront(z: number): number {
  const { y1, waist, roof, rake } = CABIN;
  return z <= waist ? y1 : y1 - (rake * (z - waist)) / (roof - waist);
}

function Wheel({ plane, y }: { plane: number; y: number }) {
  // Maps a circle drawn in (y, z) onto the vertical plane at X = `plane`.
  const onPlane = `matrix(${round(-COS)} ${SIN} 0 -1 ${round(plane * COS)} ${round(plane * SIN)})`;

  return (
    <g transform={onPlane}>
      <g transform={`translate(${y} ${WHEEL_R})`} stroke="none">
        <circle r={WHEEL_R} fill={TYRE} />
        <circle
          r={WHEEL_R - 1.8}
          fill="none"
          stroke="#273244"
          strokeWidth="0.8"
        />
        <circle r="5.2" fill={STEEL.right} />
        <circle r="4.1" fill={STEEL.top} />
        <circle r="2.9" fill={STEEL.left} />
        {/* Wheel nuts, which make the rotation visible. */}
        <g className="iso-wheel">
          {[0, 1, 2, 3, 4, 5].map((nut) => (
            <circle
              key={nut}
              cx={round(2.1 * Math.cos((nut * Math.PI) / 3))}
              cy={round(2.1 * Math.sin((nut * Math.PI) / 3))}
              r="0.55"
              fill={CHASSIS.left}
            />
          ))}
          <rect x="-3.6" y="-0.35" width="7.2" height="0.7" fill="#8fa0b5" />
        </g>
        <circle r="1.1" fill={STEEL_DARK.left} />
      </g>
    </g>
  );
}

// A mudguard: a band following the top of a wheel on the lorry's near side.
function WheelArch({ y }: { y: number }) {
  const arc = (radius: number, from: number, to: number) =>
    Array.from({ length: 9 }, (_, index): [number, number] => {
      const angle = ((from + ((to - from) * index) / 8) * Math.PI) / 180;
      return [y + radius * Math.cos(angle), WHEEL_R + radius * Math.sin(angle)];
    });

  return (
    <Face
      fill={CHASSIS.left}
      corners={sideFace(LORRY_SIDE, [
        ...arc(WHEEL_R + 3.2, 0, 180),
        ...arc(WHEEL_R + 1.2, 180, 0),
      ])}
    />
  );
}

// The parts of the lorry that sit behind its load: shadow, far wheels,
// chassis, the load deck and the two far boards.
function LorryBack() {
  const { x, w } = LORRY;
  const length = BED.y1 - BED.y0;

  return (
    <>
      <polygon
        fill="#020617"
        fillOpacity="0.42"
        stroke="none"
        points={points(
          [x - 2, BED.y0 - 2, 0],
          [LORRY_SIDE + 4, BED.y0 - 2, 0],
          [LORRY_SIDE + 4, CABIN.y1 + 5, 0],
          [x - 2, CABIN.y1 + 5, 0],
        )}
      />
      {AXLES.map((y) => (
        <Wheel key={y} plane={x + 7} y={y} />
      ))}
      <Cuboid
        at={[x + 6, BED.y0 + 3, 9]}
        size={[w - 12, CABIN.y1 - BED.y0 - 5, 6]}
        tones={CHASSIS}
      />
      <Cuboid
        at={[x, BED.y0, 15]}
        size={[w, length, BED.floor - 15]}
        tones={DECK}
      />
      {/* Deck planks. */}
      {[12, 24, 36].map((offset) => (
        <polyline
          key={offset}
          fill="none"
          stroke={DECK.right}
          strokeWidth="0.6"
          points={points(
            [x + offset, BED.y0 + 2, BED.floor],
            [x + offset, BED.y1 - 2, BED.floor],
          )}
        />
      ))}
      <Cuboid
        at={[x, BED.y0, BED.floor]}
        size={[2, length, BED.boardTop - BED.floor]}
        tones={BOARD}
      />
      <Cuboid
        at={[x, BED.y0, BED.floor]}
        size={[w, 2, BED.boardTop - BED.floor]}
        tones={BOARD}
      />
    </>
  );
}

// The parts in front of the load: the near board, the cab and the wheels.
function LorryFront() {
  const { x, w } = LORRY;
  const side = LORRY_SIDE;
  const { y0, y1, base, waist, roof } = CABIN;
  const length = BED.y1 - BED.y0;
  // Points on the raked windscreen, `u` running from its base to the roof.
  const screen = (px: number, u: number): Point => {
    const z = waist + (roof - waist) * u;
    return [px, cabFront(z), z];
  };

  return (
    <>
      {/* Fuel tank between the axles. */}
      <Cuboid
        at={[side - 8, BED.y0 + 50, 7]}
        size={[8, 30, 7]}
        tones={STEEL_DARK}
      />

      {/* Drop-side board with stanchions and reflectors. */}
      <Cuboid
        at={[side - 2, BED.y0, BED.floor]}
        size={[2, length, BED.boardTop - BED.floor]}
        tones={BOARD}
      />
      <Face
        fill={DECK.right}
        corners={sideFace(side, [
          [BED.y0, 15],
          [BED.y1, 15],
          [BED.y1, BED.floor],
          [BED.y0, BED.floor],
        ])}
      />
      {[BED.y0, BED.y0 + 22, BED.y0 + 44, BED.y0 + 66, BED.y1 - 3].map((y) => (
        <Cuboid
          key={y}
          at={[side, y, 19]}
          size={[1, 3, BED.boardTop - 18]}
          tones={STEEL}
        />
      ))}
      {[BED.y0 + 8, BED.y0 + 30, BED.y0 + 52, BED.y0 + 74].map((y, index) => (
        <Face
          key={y}
          fill={index % 2 === 1 ? "#e9eef4" : ACCENT.amber}
          corners={sideFace(side + 0.05, [
            [y, 16.5],
            [y + 8, 16.5],
            [y + 8, 18.5],
            [y, 18.5],
          ])}
        />
      ))}
      {/* Headboard behind the cab. */}
      <Cuboid at={[x, BED.y1 - 2, BED.floor]} size={[w, 2, 22]} tones={BOARD} />

      {/* Cab: side profile, front panel, raked windscreen and roof. */}
      <Face
        fill={CAB.right}
        corners={sideFace(side, [
          [y0, base],
          [y1, base],
          [y1, waist],
          [cabFront(roof), roof],
          [y0, roof],
        ])}
      />
      <Face
        fill={CAB.left}
        corners={frontFace(y1, [
          [x, base],
          [side, base],
          [side, waist],
          [x, waist],
        ])}
      />
      <Face
        fill="#dde4ec"
        corners={[screen(x, 0), screen(side, 0), screen(side, 1), screen(x, 1)]}
      />
      <Face
        fill={CAB.top}
        corners={[
          [x, y0, roof],
          [side, y0, roof],
          [side, cabFront(roof), roof],
          [x, cabFront(roof), roof],
        ]}
      />

      {/* Livery stripe around the cab. */}
      <Face
        fill={ACCENT.blue}
        corners={frontFace(y1, [
          [x, 28],
          [side, 28],
          [side, 32],
          [x, 32],
        ])}
      />
      <Face
        fill="#46689f"
        corners={sideFace(side, [
          [y0, 28],
          [y1, 28],
          [y1, 32],
          [y0, 32],
        ])}
      />

      {/* Glazing: windscreen with a reflection, and the door window. */}
      <Face
        fill={GLASS}
        corners={[
          screen(x + 4, 0.12),
          screen(side - 4, 0.12),
          screen(side - 4, 0.86),
          screen(x + 4, 0.86),
        ]}
      />
      <Face
        fill={GLASS_SHINE}
        corners={[
          screen(x + 9, 0.12),
          screen(x + 17, 0.12),
          screen(x + 26, 0.86),
          screen(x + 18, 0.86),
        ]}
      />
      <Face
        fill={GLASS}
        corners={sideFace(side, [
          [y0 + 12, 43],
          [cabFront(43) - 2.4, 43],
          [cabFront(61) - 2.4, 61],
          [y0 + 12, 61],
        ])}
      />
      <Face
        fill={GLASS_SHINE}
        corners={sideFace(side, [
          [y0 + 15, 43],
          [y0 + 20, 43],
          [y0 + 26, 61],
          [y0 + 21, 61],
        ])}
      />

      {/* Door seam and handle. */}
      <polyline
        fill="none"
        stroke="#8795a8"
        strokeWidth="0.6"
        points={points(
          ...sideFace(side, [
            [cabFront(40) - 1.2, 40],
            [cabFront(40) - 1.2, 17],
            [y0 + 9, 17],
            [y0 + 9, 63.5],
          ]),
        )}
      />
      <Face
        fill="#55647a"
        corners={sideFace(side, [
          [y0 + 12, 36],
          [y0 + 16.5, 36],
          [y0 + 16.5, 37.4],
          [y0 + 12, 37.4],
        ])}
      />

      {/* Grille, headlights and indicators. */}
      <Face
        fill="#27344a"
        corners={frontFace(y1, [
          [x + 11, 16.5],
          [side - 11, 16.5],
          [side - 11, 25.5],
          [x + 11, 25.5],
        ])}
      />
      {[19, 21.5, 24].map((z) => (
        <polyline
          key={z}
          fill="none"
          stroke="#6f7f96"
          strokeWidth="0.7"
          points={points([x + 12.5, y1, z], [side - 12.5, y1, z])}
        />
      ))}
      {[x + 2.5, side - 9.5].map((lampX) => (
        <Face
          key={lampX}
          fill="#f1e7c9"
          corners={frontFace(y1, [
            [lampX, 17.5],
            [lampX + 7, 17.5],
            [lampX + 7, 23],
            [lampX, 23],
          ])}
        />
      ))}
      {[x + 2.5, side - 5].map((lampX) => (
        <Face
          key={lampX}
          fill={ACCENT.amber}
          corners={frontFace(y1, [
            [lampX, 24],
            [lampX + 2.5, 24],
            [lampX + 2.5, 26],
            [lampX, 26],
          ])}
        />
      ))}

      {/* Bumper with number plate, roof fairing and wing mirror. */}
      <Cuboid at={[x - 0.5, y1, 8]} size={[w + 1, 3, 7]} tones={STEEL_DARK} />
      <Face
        fill="#e9eef4"
        corners={frontFace(y1 + 3, [
          [x + 19, 10],
          [side - 19, 10],
          [side - 19, 13.4],
          [x + 19, 13.4],
        ])}
      />
      <Cuboid
        at={[x + 6, y0 + 3, roof]}
        size={[w - 12, 22, 5]}
        tones={FAIRING}
      />
      <Cuboid at={[side, y1 - 6, 51]} size={[2.4, 1, 1]} tones={STEEL_DARK} />
      <Cuboid at={[side + 2, y1 - 7, 46]} size={[1.4, 3, 10]} tones={CHASSIS} />

      {/* Mudguards and wheels. */}
      <Cuboid
        at={[side - 1.5, AXLES[0] - 12, 18.2]}
        size={[2, AXLES[1] - AXLES[0] + 24, 1.6]}
        tones={CHASSIS}
      />
      <Face
        fill={CHASSIS.right}
        corners={sideFace(side + 0.5, [
          [AXLES[0] - 13.5, 6],
          [AXLES[0] - 12, 6],
          [AXLES[0] - 12, 18.2],
          [AXLES[0] - 13.5, 18.2],
        ])}
      />
      <WheelArch y={AXLES[2]} />
      {AXLES.map((y) => (
        <Wheel key={y} plane={side + 0.5} y={y} />
      ))}
    </>
  );
}
