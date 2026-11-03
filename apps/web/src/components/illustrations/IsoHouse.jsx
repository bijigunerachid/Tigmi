import { useId } from 'react';

/**
 * Isometric 3D-style house drawn entirely in code (no image file, ~2 KB of markup).
 * Geometry is defined in 3D units and projected with a true isometric projection, so walls,
 * roof and windows stay geometrically consistent. Decorative: always aria-hidden.
 *
 * Used as the lightweight hero on phones / reduced motion / no WebGL, as the instant placeholder
 * while the Three.js scene loads, and in empty states.
 */
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;
const S = 34; // pixels per unit

const iso = ([x, y, z]) => [(x - y) * COS30 * S, (x + y) * SIN30 * S - z * S];
const pts = (points) =>
  points
    .map(iso)
    .map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
    .join(' ');

// House body: x 0..4, y 0..3, z 0..2.4. Visible walls face +x (right) and +y (left).
const BODY = { x: 4, y: 3, z: 2.4 };
const RIDGE_Z = 3.7;
const OVER = 0.25; // roof overhang

const shapes = {
  slabTop: [
    [-1.4, -1.2, 0],
    [5.6, -1.2, 0],
    [5.6, 4.6, 0],
    [-1.4, 4.6, 0],
  ],
  slabFront: [
    [-1.4, 4.6, 0],
    [5.6, 4.6, 0],
    [5.6, 4.6, -0.45],
    [-1.4, 4.6, -0.45],
  ],
  slabSide: [
    [5.6, -1.2, 0],
    [5.6, 4.6, 0],
    [5.6, 4.6, -0.45],
    [5.6, -1.2, -0.45],
  ],
  wallLeft: [
    [0, BODY.y, 0],
    [BODY.x, BODY.y, 0],
    [BODY.x, BODY.y, BODY.z],
    [0, BODY.y, BODY.z],
  ],
  wallRight: [
    [BODY.x, 0, 0],
    [BODY.x, BODY.y, 0],
    [BODY.x, BODY.y, BODY.z],
    [BODY.x, BODY.y / 2, RIDGE_Z],
    [BODY.x, 0, BODY.z],
  ],
  roofFront: [
    [-OVER, BODY.y / 2, RIDGE_Z],
    [BODY.x + OVER, BODY.y / 2, RIDGE_Z],
    [BODY.x + OVER, BODY.y + OVER, BODY.z - 0.2],
    [-OVER, BODY.y + OVER, BODY.z - 0.2],
  ],
  roofEdge: [
    [BODY.x + OVER, BODY.y / 2, RIDGE_Z],
    [BODY.x + OVER, BODY.y + OVER, BODY.z - 0.2],
    [BODY.x + OVER, BODY.y + OVER, BODY.z - 0.42],
    [BODY.x + OVER, BODY.y / 2, RIDGE_Z - 0.22],
  ],
  windowLeftA: [
    [0.6, BODY.y, 0.95],
    [1.45, BODY.y, 0.95],
    [1.45, BODY.y, 1.75],
    [0.6, BODY.y, 1.75],
  ],
  windowLeftB: [
    [2.55, BODY.y, 0.95],
    [3.4, BODY.y, 0.95],
    [3.4, BODY.y, 1.75],
    [2.55, BODY.y, 1.75],
  ],
  door: [
    [BODY.x, 1.05, 0],
    [BODY.x, 1.95, 0],
    [BODY.x, 1.95, 1.45],
    [BODY.x, 1.05, 1.45],
  ],
  gableWindow: [
    [BODY.x, 1.25, 2.55],
    [BODY.x, 1.75, 2.55],
    [BODY.x, 1.75, 3.0],
    [BODY.x, 1.25, 3.0],
  ],
  path: [
    [BODY.x, 1.1, 0.01],
    [5.6, 1.25, 0.01],
    [5.6, 1.95, 0.01],
    [BODY.x, 1.9, 0.01],
  ],
};

// Small cone trees, drawn as flat iso triangles with a darker shadow side.
const TREES = [
  { x: -0.7, y: 3.8, h: 1.9, r: 0.55 },
  { x: -0.6, y: 0.2, h: 1.4, r: 0.42 },
];

export function IsoHouse({ className = '', glow = true }) {
  const id = useId();
  const all = Object.values(shapes).flat().map(iso);
  const xs = all.map(([x]) => x);
  const ys = all.map(([, y]) => y);
  const pad = 24;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad - 30;
  const width = Math.max(...xs) - minX + pad;
  const height = Math.max(...ys) - minY + pad;
  const g = (name) => `url(#${id}-${name})`;

  return (
    <svg
      viewBox={`${minX.toFixed(0)} ${minY.toFixed(0)} ${width.toFixed(0)} ${height.toFixed(0)}`}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-wallL`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24408f" />
          <stop offset="1" stopColor="#152a63" />
        </linearGradient>
        <linearGradient id={`${id}-wallR`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2f6b" />
          <stop offset="1" stopColor="#0f1d47" />
        </linearGradient>
        <linearGradient id={`${id}-roof`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="0.55" stopColor="#2563eb" />
          <stop offset="1" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id={`${id}-slab`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16223f" />
          <stop offset="1" stopColor="#0d1530" />
        </linearGradient>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a5f3fc" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.45" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ground slab */}
      <polygon points={pts(shapes.slabFront)} fill="#0a1024" />
      <polygon points={pts(shapes.slabSide)} fill="#080d1d" />
      <polygon points={pts(shapes.slabTop)} fill={g('slab')} stroke="rgb(255 255 255 / 0.06)" />
      <polygon points={pts(shapes.path)} fill="rgb(148 163 184 / 0.16)" />

      {/* Light spilling from the door onto the ground */}
      {glow && (
        <ellipse
          cx={iso([BODY.x + 0.9, 1.5, 0])[0]}
          cy={iso([BODY.x + 0.9, 1.5, 0])[1]}
          rx="58"
          ry="26"
          fill={g('glow')}
        />
      )}

      {/* Trees behind / beside the house */}
      {TREES.map((tree) => {
        const base = iso([tree.x, tree.y, 0]);
        const top = iso([tree.x, tree.y, tree.h]);
        const r = tree.r * S;
        return (
          <g key={`${tree.x}-${tree.y}`}>
            <ellipse
              cx={base[0]}
              cy={base[1]}
              rx={r * 0.9}
              ry={r * 0.45}
              fill="rgb(0 0 0 / 0.25)"
            />
            <polygon
              points={`${base[0] - r},${base[1] - 4} ${top[0]},${top[1]} ${base[0]},${base[1] + 2}`}
              fill="#0f766e"
            />
            <polygon
              points={`${base[0]},${base[1] + 2} ${top[0]},${top[1]} ${base[0] + r},${base[1] - 4}`}
              fill="#115e59"
            />
          </g>
        );
      })}

      {/* Walls */}
      <polygon points={pts(shapes.wallLeft)} fill={g('wallL')} />
      <polygon points={pts(shapes.wallRight)} fill={g('wallR')} />

      {/* Windows and door: the warm life inside the home */}
      {['windowLeftA', 'windowLeftB', 'gableWindow'].map((name) => (
        <polygon key={name} points={pts(shapes[name])} fill={g('light')} opacity="0.92" />
      ))}
      <polygon points={pts(shapes.door)} fill="#93c5fd" opacity="0.85" />

      {/* Roof */}
      <polygon points={pts(shapes.roofFront)} fill={g('roof')} />
      <polygon points={pts(shapes.roofEdge)} fill="#1e3a8a" />
      <polyline
        points={pts([
          [-OVER, BODY.y / 2, RIDGE_Z],
          [BODY.x + OVER, BODY.y / 2, RIDGE_Z],
        ])}
        stroke="rgb(255 255 255 / 0.35)"
        strokeWidth="1.5"
        fill="none"
      />

      {/* A few quiet points of light */}
      {[
        [-1.2, 1, 4.6],
        [5.2, 3.6, 3.9],
        [2.2, -1, 5.2],
      ].map((p) => {
        const [cx, cy] = iso(p);
        return <circle key={p.join()} cx={cx} cy={cy} r="2.2" fill="#a5f3fc" opacity="0.6" />;
      })}
    </svg>
  );
}
