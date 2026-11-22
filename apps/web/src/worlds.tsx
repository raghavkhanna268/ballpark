import type { ReactNode } from "react";

/**
 * One continuous illustrated world, laid out left to right, from an atom out to the galaxy web.
 * Every stop is STEP world units wide. Neighbouring stops share props at their edges, so there
 * are no seams: molecules drift between the atom and the cell, grass gives way to the kerb,
 * houses grow into a skyline, the skyline drops away below the clouds, and so on.
 * The art is inline vector shapes, not image downloads.
 */

export const STEP = 520;
export const WORLD_H = 600;

export const WORLD_STOPS = [
  { id: "atom", label: "Atom", icon: "⚛️" },
  { id: "cell", label: "Cell", icon: "🦠" },
  { id: "insect", label: "Ant", icon: "🐜" },
  { id: "street", label: "Street", icon: "🏠" },
  { id: "city", label: "City", icon: "🏙️" },
  { id: "country", label: "Country", icon: "⛰️" },
  { id: "earth", label: "Earth", icon: "🌍" },
  { id: "moon", label: "Moon", icon: "🌕" },
  { id: "solar", label: "Planets", icon: "🪐" },
  { id: "stars", label: "Nearby stars", icon: "✨" },
  { id: "galaxy", label: "Milky Way", icon: "🌌" },
  { id: "universe", label: "Galaxy web", icon: "🕸️" },
] as const;

export const WORLD_W = STEP * WORLD_STOPS.length;

/** Where the explorer floats at a given progress, in world units. */
export function explorerX(progress: number): number {
  return progress * STEP + 250;
}
export const EXPLORER_Y = 300;

const SKY = [
  ["atom", "#0c1f45"],
  ["cell", "#0c5a5c"],
  ["insect", "#9fd889"],
  ["street", "#8fd3f7"],
  ["city", "#f4a174"],
  ["country", "#79bdf0"],
  ["earth", "#0a1636"],
  ["moon", "#070b20"],
  ["solar", "#080a1d"],
  ["stars", "#0d0a2a"],
  ["galaxy", "#1a0c34"],
  ["universe", "#06050f"],
] as const;

/** Deterministic pseudo-random so the art is the same on every render. */
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/* ------------------------------------------------------------------ */
/* Main layer: moves 1:1 with the camera.                              */
/* ------------------------------------------------------------------ */

export function WorldMain() {
  return (
    <g>
      <defs>
        <linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={WORLD_W} y2="0">
          {SKY.map(([id, color], index) => (
            <stop key={id} offset={(index * STEP + STEP / 2) / WORLD_W} stopColor={color} />
          ))}
        </linearGradient>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
        <radialGradient id="glow">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff8d0" />
          <stop offset="0.35" stopColor="#ffd36a" />
          <stop offset="0.7" stopColor="#ff9a3c" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ff6a2c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="earthOcean" cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#4fb3ff" />
          <stop offset="0.7" stopColor="#1d5fb8" />
          <stop offset="1" stopColor="#0d2f6b" />
        </radialGradient>
        <radialGradient id="atmo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.8" stopColor="#7fd0ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7fd0ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moonFace" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#f4f1ea" />
          <stop offset="1" stopColor="#a9a49a" />
        </radialGradient>
        <radialGradient id="core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.3" stopColor="#ffd38a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#b06cff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nebula" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff7ac8" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#7a5cff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#7a5cff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ball" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fc155" />
          <stop offset="1" stopColor="#2c8a3a" />
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a6a9a" />
          <stop offset="1" stopColor="#2c3358" />
        </linearGradient>
      </defs>
      <rect x="-400" y="0" width={WORLD_W + 800} height={WORLD_H} fill="url(#sky)" />
      <StarField />
      <rect x="-400" y="0" width={WORLD_W + 800} height={WORLD_H} fill="url(#shade)" />
      <Zone i={0}>
        <AtomZone />
      </Zone>
      <Zone i={1}>
        <CellZone />
      </Zone>
      <Zone i={2}>
        <InsectZone />
      </Zone>
      <Zone i={3}>
        <StreetZone />
      </Zone>
      <Zone i={4}>
        <CityZone />
      </Zone>
      <Zone i={5}>
        <CountryZone />
      </Zone>
      <Zone i={6}>
        <EarthZone />
      </Zone>
      <Zone i={7}>
        <MoonZone />
      </Zone>
      <Zone i={8}>
        <SolarZone />
      </Zone>
      <Zone i={9}>
        <StarsZone />
      </Zone>
      <Zone i={10}>
        <GalaxyZone />
      </Zone>
      <Zone i={11}>
        <UniverseZone />
      </Zone>
    </g>
  );
}

function Zone({ i, children }: { i: number; children: ReactNode }) {
  return <g transform={`translate(${i * STEP} 0)`}>{children}</g>;
}

/** Stars fade in once the explorer leaves the atmosphere, and stay for the rest of the trip. */
function StarField() {
  const start = STEP * 5.7;
  const stars = Array.from({ length: 260 }, (_, index) => {
    const x = start + rand(index) * (WORLD_W - start + 200);
    const y = rand(index + 500) * WORLD_H;
    const r = 0.6 + rand(index + 900) * 1.6;
    const fade = Math.min(1, (x - start) / (STEP * 0.8));
    return <circle key={index} cx={x} cy={y} r={r} fill="#fff" opacity={0.35 + 0.6 * fade * rand(index + 77)} className={index % 7 === 0 ? "twinkle" : undefined} />;
  });
  const micro = Array.from({ length: 70 }, (_, index) => (
    <circle key={`m${index}`} cx={rand(index + 3000) * STEP * 1.6} cy={rand(index + 3100) * WORLD_H} r={1 + rand(index + 3200) * 2} fill="#9fe3ff" opacity={0.18 + rand(index) * 0.25} />
  ));
  return (
    <g>
      {micro}
      {stars}
    </g>
  );
}

/* ---- 0. Atom ---- */
function AtomZone() {
  const nucleons = [
    [0, 0, "p"],
    [-14, -8, "n"],
    [13, -10, "p"],
    [-10, 12, "p"],
    [12, 11, "n"],
    [0, -20, "n"],
    [-22, 4, "n"],
    [22, 0, "p"],
    [2, 20, "n"],
  ] as const;
  return (
    <g>
      {/* faint neighbour atoms in the haze */}
      {[
        [40, 120, 0.6],
        [470, 110, 0.5],
        [90, 500, 0.55],
      ].map(([x, y, s], index) => (
        <g key={index} transform={`translate(${x} ${y}) scale(${s})`} opacity="0.35">
          <circle r="16" fill="#ff8a7a" />
          <ellipse rx="70" ry="22" fill="none" stroke="#9ad7ff" strokeWidth="3" />
          <ellipse rx="70" ry="22" fill="none" stroke="#9ad7ff" strokeWidth="3" transform="rotate(60)" />
        </g>
      ))}
      <g transform="translate(330 300)">
        <circle r="120" fill="url(#glow)" opacity="0.12" />
        <ellipse rx="190" ry="62" fill="none" stroke="#7fd3ff" strokeWidth="3" opacity="0.8" />
        <ellipse rx="190" ry="62" fill="none" stroke="#a8e6ff" strokeWidth="3" opacity="0.8" transform="rotate(60)" />
        <ellipse rx="190" ry="62" fill="none" stroke="#c9f1ff" strokeWidth="3" opacity="0.8" transform="rotate(-60)" />
        <g className="orbit o1">
          <circle cx="190" cy="0" r="10" fill="#e8fbff" />
          <circle cx="190" cy="0" r="18" fill="url(#glow)" opacity="0.5" />
        </g>
        <g transform="rotate(60)">
          <g className="orbit o2">
            <circle cx="-190" cy="0" r="10" fill="#e8fbff" />
            <circle cx="-190" cy="0" r="18" fill="url(#glow)" opacity="0.5" />
          </g>
        </g>
        <g transform="rotate(-60)">
          <g className="orbit o3">
            <circle cx="190" cy="0" r="10" fill="#e8fbff" />
            <circle cx="190" cy="0" r="18" fill="url(#glow)" opacity="0.5" />
          </g>
        </g>
        <g className="throb">
          {nucleons.map(([x, y, kind], index) => (
            <g key={index}>
              <circle cx={x} cy={y} r="14" fill={kind === "p" ? "#ff6b6b" : "#5aa8ff"} stroke="#0c1f45" strokeWidth="1.5" />
              <circle cx={x} cy={y} r="14" fill="url(#ball)" />
            </g>
          ))}
        </g>
      </g>
      {/* molecules drifting toward the cell */}
      <Water x={520} y={150} s={1.1} />
      <Water x={600} y={470} s={0.9} />
      <Water x={470} y={420} s={0.7} />
    </g>
  );
}

function Water({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="bob-slow">
      <line x1="0" y1="0" x2="-26" y2="18" stroke="#d9f3ff" strokeWidth="6" />
      <line x1="0" y1="0" x2="26" y2="18" stroke="#d9f3ff" strokeWidth="6" />
      <circle r="18" fill="#ff5f5f" />
      <circle r="18" fill="url(#ball)" />
      <circle cx="-28" cy="20" r="11" fill="#f2f6ff" />
      <circle cx="28" cy="20" r="11" fill="#f2f6ff" />
      </g>
    </g>
  );
}

/* ---- 1. Cell ---- */
function CellZone() {
  return (
    <g>
      {/* DNA strand drifting in from the atom side */}
      <g transform="translate(-30 60) rotate(18)" opacity="0.9">
        {Array.from({ length: 12 }, (_, index) => {
          const y = index * 16;
          const w = Math.sin(index * 0.7) * 22;
          return (
            <g key={index}>
              <line x1={-w} y1={y} x2={w} y2={y} stroke={index % 2 ? "#ffd36a" : "#ff8ab0"} strokeWidth="4" />
              <circle cx={-w} cy={y} r="5" fill="#9ef0d0" />
              <circle cx={w} cy={y} r="5" fill="#7ac8ff" />
            </g>
          );
        })}
      </g>
      {/* neighbouring cells, cropped by the edges */}
      <ellipse cx="40" cy="560" rx="120" ry="90" fill="#3fae8f" stroke="#c9ffe8" strokeWidth="6" opacity="0.6" />
      <ellipse cx="560" cy="60" rx="110" ry="80" fill="#3fae8f" stroke="#c9ffe8" strokeWidth="6" opacity="0.55" />
      {/* the main cell */}
      <g transform="translate(330 300)">
        <ellipse rx="200" ry="170" fill="#7fd6a8" stroke="#e6fff2" strokeWidth="10" />
        <ellipse rx="186" ry="156" fill="none" stroke="#5cbf8f" strokeWidth="4" strokeDasharray="10 8" />
        {/* endoplasmic reticulum */}
        <path d="M-40 -100 q30 -18 60 0 t60 0 M-60 -80 q36 -18 72 0 t72 0 M-70 -58 q40 -16 80 0 t70 0" fill="none" stroke="#3f9a76" strokeWidth="5" strokeLinecap="round" />
        {/* nucleus */}
        <circle cx="30" cy="10" r="62" fill="#3c7fb0" stroke="#bfe6ff" strokeWidth="5" />
        <circle cx="44" cy="0" r="20" fill="#24507a" />
        <path d="M0 30 q20 -10 40 4 M10 -20 q14 6 30 -6" stroke="#7fb8e0" strokeWidth="3" fill="none" />
        {/* mitochondria */}
        {[
          [-120, 40, 20],
          [110, 90, -25],
          [-60, 110, 8],
          [140, -40, 60],
        ].map(([x, y, r], index) => (
          <g key={index} transform={`translate(${x} ${y}) rotate(${r})`}>
            <ellipse rx="34" ry="16" fill="#ff9b6a" stroke="#ffd8c0" strokeWidth="3" />
            <path d="M-24 0 l6 -8 l6 16 l6 -16 l6 16 l6 -16 l6 16 l6 -8" fill="none" stroke="#c4532c" strokeWidth="2.5" />
          </g>
        ))}
        {/* vesicles */}
        {[
          [-140, -40, 10],
          [-100, -110, 8],
          [90, -110, 9],
          [160, 40, 7],
          [-20, 130, 9],
        ].map(([x, y, r], index) => (
          <circle key={index} cx={x} cy={y} r={r} fill="#f4ffe0" stroke="#b8f0c8" strokeWidth="2" className="bob-slow" />
        ))}
      </g>
      {/* blood cells and bacteria drifting toward the leaf */}
      {[
        [540, 430, 1],
        [600, 190, 0.8],
        [470, 520, 0.7],
      ].map(([x, y, s], index) => (
        <g key={index} transform={`translate(${x} ${y}) scale(${s})`}>
          <ellipse rx="30" ry="22" fill="#e04b55" />
          <ellipse rx="16" ry="10" fill="#b8323d" />
        </g>
      ))}
      <g transform="translate(650 120) rotate(30)">
        <rect x="-30" y="-12" width="60" height="24" rx="12" fill="#c8a2ff" />
        <path d="M30 0 q12 -10 24 0 t24 0" stroke="#c8a2ff" strokeWidth="3" fill="none" />
      </g>
    </g>
  );
}

/* ---- 2. Insect on a leaf ---- */
function InsectZone() {
  return (
    <g>
      {/* soft bokeh light through leaves */}
      {Array.from({ length: 9 }, (_, index) => (
        <circle key={index} cx={rand(index + 40) * 520} cy={60 + rand(index + 60) * 200} r={20 + rand(index + 80) * 40} fill="#f4ffd0" opacity={0.18} />
      ))}
      {/* giant grass blades, tall at the cell side, shrinking toward the street */}
      {Array.from({ length: 14 }, (_, index) => {
        const x = -60 + index * 46;
        const h = 420 - index * 18 + rand(index) * 60;
        const lean = (rand(index + 7) - 0.5) * 60;
        return (
          <path
            key={index}
            d={`M${x - 14} 600 Q${x + lean * 0.4} ${600 - h * 0.6} ${x + lean} ${600 - h} Q${x + 10 + lean * 0.4} ${600 - h * 0.55} ${x + 16} 600 Z`}
            fill={index % 2 ? "#3c9a3e" : "#4fb24a"}
            opacity={0.85}
          />
        );
      })}
      {/* a flower head behind */}
      <g transform="translate(440 150)">
        {Array.from({ length: 8 }, (_, index) => (
          <ellipse key={index} rx="22" ry="54" cy="-48" fill="#ffd6e8" stroke="#ffb0cf" strokeWidth="3" transform={`rotate(${index * 45})`} />
        ))}
        <circle r="30" fill="#ffc83d" />
        <circle r="30" fill="url(#ball)" />
      </g>
      {/* the leaf */}
      <path d="M-20 470 C80 380 330 360 560 430 C420 520 160 560 -20 470 Z" fill="url(#leafGrad)" stroke="#1f6e2c" strokeWidth="4" />
      <path d="M0 468 C160 440 360 430 540 432" stroke="#bff0a0" strokeWidth="5" fill="none" />
      {[80, 160, 240, 320, 400].map((x) => (
        <g key={x}>
          <path d={`M${x} ${462 - x * 0.06} q30 -26 70 -40`} stroke="#9fe08a" strokeWidth="3" fill="none" />
          <path d={`M${x} ${462 - x * 0.06} q30 22 70 40`} stroke="#9fe08a" strokeWidth="3" fill="none" />
        </g>
      ))}
      {/* water droplet */}
      <g transform="translate(150 430)">
        <ellipse rx="30" ry="24" fill="#bfe9ff" opacity="0.75" stroke="#fff" strokeWidth="2" />
        <ellipse cx="-10" cy="-8" rx="8" ry="5" fill="#fff" />
      </g>
      {/* the ant */}
      <g transform="translate(330 405)" className="ant">
        <g stroke="#2a1a0c" strokeWidth="4" strokeLinecap="round" fill="none" className="legs">
          <path d="M-30 4 l-18 26 M-10 6 l-6 30 M10 6 l8 30 M30 4 l20 26 M-20 4 l-30 14 M20 4 l30 14" />
        </g>
        <ellipse cx="-44" cy="-6" rx="34" ry="24" fill="#3a2414" />
        <ellipse cx="-4" cy="-2" rx="20" ry="15" fill="#4a2c18" />
        <circle cx="30" cy="-12" r="20" fill="#3a2414" />
        <circle cx="38" cy="-16" r="5" fill="#fff" />
        <circle cx="40" cy="-16" r="2.5" fill="#111" />
        <path d="M34 -28 q6 -30 26 -40 M42 -26 q18 -22 40 -24" stroke="#2a1a0c" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <ellipse cx="-50" cy="-14" rx="12" ry="6" fill="#fff" opacity="0.2" />
        {/* crumb it is carrying */}
        <rect x="18" y="-50" width="26" height="18" rx="5" fill="#f2d28a" transform="rotate(-12 30 -40)" />
      </g>
      {/* a ladybird on the next blade */}
      <g transform="translate(500 330) rotate(-20)">
        <circle r="18" fill="#e33b2e" />
        <path d="M0 -18 v36" stroke="#2a1a0c" strokeWidth="2.5" />
        <circle cx="-7" cy="-4" r="4" fill="#2a1a0c" />
        <circle cx="7" cy="6" r="4" fill="#2a1a0c" />
        <circle cx="0" cy="-20" r="8" fill="#2a1a0c" />
      </g>
    </g>
  );
}

/* ---- 3. Street ---- */
function StreetZone() {
  const houses = [
    { x: 40, w: 110, h: 150, wall: "#f6d7b0", roof: "#c4553a" },
    { x: 170, w: 96, h: 190, wall: "#bfe0f2", roof: "#3d6a8a" },
    { x: 290, w: 120, h: 140, wall: "#f8efe4", roof: "#8a4a7a" },
    { x: 430, w: 100, h: 210, wall: "#f2c6c0", roof: "#b03a3a" },
  ];
  return (
    <g>
      <circle cx="420" cy="90" r="70" fill="url(#sun)" />
      <Cloud x={120} y={90} s={1} />
      <Cloud x={360} y={160} s={0.7} />
      {/* kerb grass carrying over from the leaf */}
      {Array.from({ length: 10 }, (_, index) => (
        <path key={index} d={`M${-70 + index * 9} 470 q4 -30 10 -46 q2 20 4 46 Z`} fill="#4fb24a" />
      ))}
      {houses.map((house, index) => (
        <g key={index}>
          <rect x={house.x} y={470 - house.h} width={house.w} height={house.h} fill={house.wall} stroke="#5a4636" strokeWidth="3" />
          <path d={`M${house.x - 12} ${470 - house.h} L${house.x + house.w / 2} ${470 - house.h - 60} L${house.x + house.w + 12} ${470 - house.h} Z`} fill={house.roof} stroke="#5a4636" strokeWidth="3" />
          <rect x={house.x + house.w / 2 - 14} y={420} width="28" height="50" rx="4" fill="#6a3a24" />
          {[0, 1].map((col) =>
            Array.from({ length: Math.floor((house.h - 60) / 50) }, (_, row) => (
              <rect key={`${col}-${row}`} x={house.x + 16 + col * (house.w - 52)} y={470 - house.h + 22 + row * 50} width="22" height="26" fill="#ffe59a" stroke="#5a4636" strokeWidth="2" />
            )),
          )}
        </g>
      ))}
      {/* trees */}
      {[150, 410].map((x) => (
        <g key={x} transform={`translate(${x} 470)`}>
          <rect x="-6" y="-60" width="12" height="60" fill="#7a4a2a" />
          <circle cy="-80" r="34" fill="#3f9a46" />
          <circle cx="-20" cy="-66" r="22" fill="#4fb24a" />
          <circle cx="18" cy="-64" r="24" fill="#2f7f3a" />
        </g>
      ))}
      {/* pavement and road */}
      <rect x="-60" y="470" width="640" height="22" fill="#cfc6b6" />
      <rect x="-60" y="492" width="640" height="108" fill="#4a4a52" />
      {Array.from({ length: 9 }, (_, index) => (
        <rect key={index} x={-40 + index * 72} y="540" width="40" height="6" fill="#ffd34a" />
      ))}
      {/* lamp post */}
      <g transform="translate(280 470)">
        <rect x="-3" y="-120" width="6" height="120" fill="#2c2c34" />
        <rect x="-14" y="-128" width="28" height="12" rx="4" fill="#2c2c34" />
        <circle cy="-112" r="8" fill="#fff2b0" />
      </g>
      {/* person walking a dog */}
      <g transform="translate(230 470)" className="walker">
        <circle cy="-62" r="10" fill="#e9b28a" />
        <rect x="-8" y="-52" width="16" height="30" rx="6" fill="#e05a3c" />
        <path d="M-4 -22 l-6 22 M4 -22 l6 22" stroke="#2a2a44" strokeWidth="5" strokeLinecap="round" />
        <path d="M8 -44 q20 10 34 34" stroke="#333" strokeWidth="1.5" fill="none" />
        <ellipse cx="46" cy="-8" rx="12" ry="7" fill="#c98a4a" />
        <circle cx="56" cy="-14" r="6" fill="#c98a4a" />
      </g>
      {/* a car */}
      <g transform="translate(70 520)" className="car">
        <rect x="0" y="-20" width="90" height="30" rx="8" fill="#2f86d8" />
        <path d="M16 -20 l12 -18 h34 l12 18 Z" fill="#2f86d8" />
        <path d="M24 -20 l8 -12 h12 v12 Z M50 -20 v-12 h10 l8 12 Z" fill="#cfefff" />
        <circle cx="20" cy="12" r="10" fill="#222" />
        <circle cx="70" cy="12" r="10" fill="#222" />
        <circle cx="20" cy="12" r="4" fill="#aaa" />
        <circle cx="70" cy="12" r="4" fill="#aaa" />
      </g>
    </g>
  );
}

function Cloud({ x, y, s, fill = "#ffffff", opacity = 0.92 }: { x: number; y: number; s: number; fill?: string; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <ellipse cx="0" cy="10" rx="70" ry="22" fill={fill} />
      <circle cx="-26" cy="0" r="26" fill={fill} />
      <circle cx="8" cy="-12" r="34" fill={fill} />
      <circle cx="38" cy="2" r="22" fill={fill} />
    </g>
  );
}

/* ---- 4. City ---- */
function CityZone() {
  const back = Array.from({ length: 13 }, (_, index) => ({ x: -40 + index * 46, w: 40, h: 160 + rand(index + 11) * 170 }));
  const front = [
    { x: -20, w: 70, h: 230 },
    { x: 60, w: 60, h: 300 },
    { x: 130, w: 84, h: 250 },
    { x: 226, w: 56, h: 360 },
    { x: 292, w: 90, h: 280 },
    { x: 392, w: 60, h: 330 },
    { x: 462, w: 80, h: 240 },
  ];
  return (
    <g>
      <circle cx="120" cy="200" r="90" fill="url(#sun)" opacity="0.9" />
      {back.map((tower, index) => (
        <rect key={index} x={tower.x} y={500 - tower.h} width={tower.w} height={tower.h} fill="#b4607a" opacity="0.6" />
      ))}
      {front.map((tower, index) => (
        <g key={index}>
          <rect x={tower.x} y={500 - tower.h} width={tower.w} height={tower.h} fill="url(#glass)" stroke="#1d2240" strokeWidth="2" />
          {Array.from({ length: Math.floor(tower.h / 22) - 1 }, (_, row) =>
            Array.from({ length: Math.floor(tower.w / 16) }, (_, col) => (
              <rect
                key={`${row}-${col}`}
                x={tower.x + 6 + col * 16}
                y={500 - tower.h + 10 + row * 22}
                width="8"
                height="12"
                fill={rand(index * 100 + row * 10 + col) > 0.45 ? "#ffd98a" : "#3a4470"}
              />
            )),
          )}
        </g>
      ))}
      {/* spire and antenna on the tallest tower */}
      <path d="M254 140 l0 -60" stroke="#1d2240" strokeWidth="4" />
      <circle cx="254" cy="80" r="5" fill="#ff4a4a" className="twinkle" />
      {/* crane */}
      <g transform="translate(430 170)" stroke="#ffb02e" strokeWidth="4" fill="none">
        <path d="M0 0 v-90 M-60 -90 h150 M0 -90 l40 30 M60 -90 v40" />
      </g>
      <rect x="-60" y="500" width="640" height="100" fill="#2a2440" />
      <rect x="-60" y="500" width="640" height="8" fill="#ff9a6a" opacity="0.6" />
      {/* a plane taking off toward the country */}
      <g transform="translate(480 120) rotate(-12)">
        <g className="plane">
        <ellipse rx="40" ry="8" fill="#f4f4f8" />
        <path d="M-6 0 l-14 -26 h10 l20 26 Z M-6 0 l-14 26 h10 l20 -26 Z" fill="#dfe4ef" />
        <path d="M-40 0 l-8 -16 h8 l8 16 Z" fill="#e05a3c" />
        </g>
      </g>
    </g>
  );
}

/* ---- 5. Country, seen from high up ---- */
function CountryZone() {
  return (
    <g>
      <Cloud x={60} y={110} s={1.2} />
      <Cloud x={420} y={80} s={0.9} />
      {/* mountains */}
      <path d="M-60 470 L60 300 L130 380 L220 250 L330 400 L420 290 L560 470 Z" fill="#6a7fa8" />
      <path d="M60 300 L84 334 L70 330 L48 340 Z M220 250 L250 292 L226 286 L200 298 Z M420 290 L446 324 L424 320 L404 330 Z" fill="#fff" />
      {/* rolling fields */}
      <path d="M-60 470 C60 420 160 440 260 450 C360 460 460 420 580 440 L580 600 L-60 600 Z" fill="#5cae4c" />
      <path d="M-60 520 C80 490 200 520 320 510 C420 500 500 480 580 500 L580 600 L-60 600 Z" fill="#7cc35a" />
      {[
        [20, 490, "#e8c45a"],
        [140, 500, "#9ad46a"],
        [260, 492, "#d7a84a"],
        [380, 488, "#b4dc6a"],
      ].map(([x, y, color], index) => (
        <path key={index} d={`M${x} ${y} l80 -6 l20 30 l-84 8 Z`} fill={color as string} opacity="0.9" />
      ))}
      {/* a river winding off */}
      <path d="M-60 560 C40 530 120 590 220 556 C320 520 420 580 580 540" stroke="#5ab8f0" strokeWidth="14" fill="none" />
      {/* the city behind, now tiny */}
      {Array.from({ length: 7 }, (_, index) => (
        <rect key={index} x={-50 + index * 9} y={470 - 10 - rand(index) * 20} width="7" height={10 + rand(index) * 20} fill="#3a4470" />
      ))}
      {/* clouds below, the explorer is above them now */}
      <Cloud x={500} y={420} s={1.4} opacity={0.85} />
      <Cloud x={560} y={360} s={1.1} opacity={0.75} />
    </g>
  );
}

/* ---- 6. Earth ---- */
function EarthZone() {
  return (
    <g>
      {/* thin atmosphere curve left behind */}
      <path d="M-80 600 Q100 520 120 600 Z" fill="#79bdf0" opacity="0.5" />
      <g transform="translate(350 310)">
        <circle r="186" fill="url(#atmo)" />
        <circle r="160" fill="url(#earthOcean)" />
        <g fill="#5cbf5a" stroke="#3e9a40" strokeWidth="2">
          <path d="M-90 -100 C-50 -130 10 -120 20 -80 C30 -40 -20 -30 -40 0 C-60 30 -100 10 -110 -30 C-118 -60 -110 -86 -90 -100 Z" />
          <path d="M30 10 C70 -10 120 20 110 60 C100 100 60 130 30 110 C10 90 0 40 30 10 Z" />
          <path d="M-60 60 C-40 50 -20 70 -30 100 C-40 120 -70 110 -72 90 Z" />
          <path d="M70 -120 C100 -110 130 -80 120 -60 C100 -60 80 -80 70 -120 Z" />
        </g>
        <path d="M-40 -150 C0 -158 40 -154 70 -140" stroke="#fff" strokeWidth="10" fill="none" opacity="0.85" />
        <g className="drift" fill="#fff" opacity="0.8">
          <ellipse cx="-60" cy="-40" rx="40" ry="8" />
          <ellipse cx="60" cy="-20" rx="50" ry="9" />
          <ellipse cx="0" cy="70" rx="44" ry="8" />
        </g>
        <path d="M60 -150 A160 160 0 0 1 60 150 A220 220 0 0 0 60 -150 Z" fill="#000" opacity="0.28" />
        <circle r="160" fill="url(#ball)" opacity="0.4" />
      </g>
      {/* a satellite */}
      <g transform="translate(110 150) rotate(-20)">
        <rect x="-10" y="-8" width="20" height="16" fill="#d8d8e0" />
        <rect x="-50" y="-6" width="36" height="12" fill="#3f6fd8" stroke="#a8c4ff" strokeWidth="1.5" />
        <rect x="14" y="-6" width="36" height="12" fill="#3f6fd8" stroke="#a8c4ff" strokeWidth="1.5" />
        <circle cx="0" cy="-14" r="4" fill="#ffd34a" />
      </g>
    </g>
  );
}

/* ---- 7. Moon ---- */
function MoonZone() {
  return (
    <g>
      <g transform="translate(300 330) scale(0.82)">
        <circle r="150" fill="url(#moonFace)" />
        {[
          [-50, -60, 30],
          [40, 30, 40],
          [-70, 60, 22],
          [80, -70, 18],
          [0, -10, 14],
          [-10, 100, 16],
        ].map(([x, y, r], index) => (
          <g key={index}>
            <circle cx={x} cy={y} r={r} fill="#b7b1a6" />
            <circle cx={x + r * 0.15} cy={y + r * 0.15} r={r * 0.8} fill="#9e988e" />
          </g>
        ))}
        <path d="M40 -146 A150 150 0 0 1 40 146 A200 200 0 0 0 40 -146 Z" fill="#000" opacity="0.3" />
        {/* a flag planted on top */}
        <g transform="translate(-30 -148)">
          <rect x="0" y="-44" width="3" height="44" fill="#ddd" />
          <rect x="3" y="-44" width="28" height="18" fill="#e05a3c" />
        </g>
      </g>
      {/* little Earth behind, as seen from the Moon */}
      <g transform="translate(90 120)">
        <circle r="34" fill="url(#earthOcean)" />
        <path d="M-14 -20 C0 -26 12 -14 6 -2 C0 8 -16 4 -18 -8 Z M8 6 C18 2 24 14 16 22 Z" fill="#5cbf5a" />
      </g>
      {/* rocket heading for the planets */}
      <g transform="translate(560 170) rotate(70)">
        <path d="M0 -40 C14 -26 14 10 10 24 H-10 C-14 10 -14 -26 0 -40 Z" fill="#f4f4f8" />
        <circle cy="-10" r="7" fill="#5ab8f0" stroke="#3a4470" strokeWidth="2" />
        <path d="M-10 14 l-12 16 h12 Z M10 14 l12 16 h-12 Z" fill="#e05a3c" />
        <path d="M-6 24 C-4 40 4 40 6 24 Z" fill="#ffb02e" />
      </g>
    </g>
  );
}

/* ---- 8. Planets ---- */
function SolarZone() {
  return (
    <g>
      {/* the sun's edge glowing on the left */}
      <circle cx="60" cy="130" r="130" fill="url(#sun)" />
      {[150, 240, 340, 470].map((r) => (
        <circle key={r} cx="60" cy="130" r={r} fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="2" strokeDasharray="4 8" />
      ))}
      {/* Mercury, Venus, Mars */}
      <Planet x={110} y={250} r={10} color="#b6a89a" />
      <Planet x={190} y={380} r={16} color="#f0c987" />
      <Planet x={290} y={200} r={14} color="#e46a3a" />
      {/* Jupiter */}
      <g transform="translate(330 420)">
        <circle r="62" fill="#e6b98a" />
        {[-40, -22, -6, 10, 26, 42].map((y, index) => (
          <rect key={y} x="-62" y={y} width="124" height={index % 2 ? 8 : 12} fill={index % 2 ? "#c78a5a" : "#f4d8b4"} opacity="0.85" />
        ))}
        <ellipse cx="20" cy="18" rx="14" ry="8" fill="#c4532c" />
        <circle r="62" fill="url(#ball)" opacity="0.5" />
        <circle r="62" fill="none" stroke="#0a0a1a" strokeOpacity="0.4" strokeWidth="6" />
      </g>
      {/* Saturn */}
      <g transform="translate(470 220) rotate(-18)">
        <ellipse rx="96" ry="22" fill="none" stroke="#e8d49a" strokeWidth="10" opacity="0.9" />
        <circle r="42" fill="#ecd08a" />
        <rect x="-42" y="-10" width="84" height="8" fill="#d4b06a" opacity="0.8" />
        <circle r="42" fill="url(#ball)" opacity="0.5" />
        <path d="M-96 0 A96 22 0 0 0 96 0" fill="none" stroke="#f4e2b0" strokeWidth="10" />
      </g>
      {/* Neptune heading toward the stars */}
      <Planet x={610} y={430} r={26} color="#4a7aff" />
    </g>
  );
}

function Planet({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={color} />
      <circle r={r} fill="url(#ball)" />
      <path d={`M${r * 0.3} ${-r} A${r} ${r} 0 0 1 ${r * 0.3} ${r} A${r * 1.4} ${r * 1.4} 0 0 0 ${r * 0.3} ${-r} Z`} fill="#000" opacity="0.3" />
    </g>
  );
}

/* ---- 9. Nearby stars ---- */
function StarsZone() {
  const named = [
    [90, 140, 12, "#ffd38a"],
    [210, 420, 9, "#9fc8ff"],
    [330, 180, 16, "#ff8a6a"],
    [420, 380, 10, "#fff4d0"],
    [500, 120, 8, "#b0d8ff"],
  ] as const;
  return (
    <g>
      <ellipse cx="300" cy="300" rx="260" ry="150" fill="url(#nebula)" />
      <ellipse cx="200" cy="360" rx="180" ry="90" fill="url(#nebula)" opacity="0.7" transform="rotate(-20 200 360)" />
      <path d="M90 140 L210 420 L330 180 L420 380 L500 120" fill="none" stroke="#cfe0ff" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 6" />
      {named.map(([x, y, r, color], index) => (
        <g key={index} transform={`translate(${x} ${y})`} className={index % 2 ? "twinkle" : undefined}>
          <circle r={r * 3} fill={color} opacity="0.18" />
          <path d={`M0 ${-r * 2.4} L${r * 0.35} ${-r * 0.35} L${r * 2.4} 0 L${r * 0.35} ${r * 0.35} L0 ${r * 2.4} L${-r * 0.35} ${r * 0.35} L${-r * 2.4} 0 L${-r * 0.35} ${-r * 0.35} Z`} fill={color} />
          <circle r={r * 0.7} fill="#fff" />
        </g>
      ))}
    </g>
  );
}

/* ---- 10. Galaxy ---- */
function GalaxyZone() {
  const arms = Array.from({ length: 2 }, (_, arm) =>
    Array.from({ length: 70 }, (_, index) => {
      const t = index / 70;
      const angle = arm * Math.PI + t * Math.PI * 2.4;
      const radius = 18 + t * 190;
      const jitter = (rand(arm * 100 + index) - 0.5) * 26 * t;
      return {
        x: Math.cos(angle) * (radius + jitter),
        y: Math.sin(angle) * (radius + jitter) * 0.55,
        r: 2 + (1 - t) * 5 * rand(index + 7),
        color: rand(index + arm) > 0.5 ? "#cdb8ff" : "#9fd2ff",
      };
    }),
  ).flat();
  return (
    <g>
      <g transform="translate(330 300) rotate(-16)">
        <g className="galaxy-spin">
          <ellipse rx="230" ry="128" fill="url(#nebula)" opacity="0.8" />
          {arms.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.color} opacity="0.85" />
          ))}
        </g>
        <ellipse rx="60" ry="36" fill="url(#core)" />
        <ellipse rx="22" ry="14" fill="#fff6dc" />
      </g>
      {/* "you are here" mark on an outer arm, where the Sun lives */}
      <circle cx="430" cy="380" r="4" fill="#ffd34a" />
      <circle cx="430" cy="380" r="10" fill="none" stroke="#ffd34a" strokeWidth="2" />
    </g>
  );
}

/* ---- 11. Galaxy web ---- */
function UniverseZone() {
  const nodes = Array.from({ length: 16 }, (_, index) => ({ x: 20 + rand(index + 400) * 520, y: 70 + rand(index + 450) * 460 }));
  return (
    <g>
      {nodes.map((node, index) => {
        const next = nodes[(index * 5 + 3) % nodes.length]!;
        return <line key={`l${index}`} x1={node.x} y1={node.y} x2={next.x} y2={next.y} stroke="#b28aff" strokeOpacity="0.3" strokeWidth="3" />;
      })}
      {nodes.map((node, index) => (
        <g key={index} transform={`translate(${node.x} ${node.y}) rotate(${rand(index) * 180})`}>
          <ellipse rx={10 + rand(index + 1) * 14} ry={4 + rand(index + 2) * 5} fill="url(#core)" />
        </g>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Far layer: moves at FAR_RATE of the camera, so it reads as distance. */
/* ------------------------------------------------------------------ */

export const FAR_RATE = 0.45;

export function WorldFar() {
  const at = (i: number, dx: number) => i * STEP * FAR_RATE + dx;
  return (
    <g>
      {/* micro haze */}
      {Array.from({ length: 10 }, (_, index) => (
        <circle key={`a${index}`} cx={at(0, rand(index + 1) * 500)} cy={rand(index + 2) * 600} r={20 + rand(index + 3) * 30} fill="#7fd3ff" opacity="0.08" />
      ))}
      {/* faint hills behind the street and the city */}
      <path d={`M${at(3, -100)} 470 C${at(3, 60)} 380 ${at(3, 220)} 400 ${at(3, 360)} 380 C${at(4, 60)} 360 ${at(4, 200)} 410 ${at(4, 420)} 470 Z`} fill="#6aa8c8" opacity="0.4" />
      {/* high cirrus at country height */}
      {[0, 1, 2].map((index) => (
        <ellipse key={`c${index}`} cx={at(5, 60 + index * 140)} cy={80 + index * 30} rx="90" ry="8" fill="#fff" opacity="0.5" />
      ))}
      {/* distant galaxies in deep space */}
      {Array.from({ length: 14 }, (_, index) => (
        <ellipse
          key={`g${index}`}
          cx={at(6.5, rand(index + 50) * STEP * FAR_RATE * 5.5)}
          cy={60 + rand(index + 60) * 480}
          rx={6 + rand(index + 70) * 10}
          ry={2 + rand(index + 80) * 3}
          fill="#c8b0ff"
          opacity="0.35"
          transform={`rotate(${rand(index) * 180} ${at(6.5, rand(index + 50) * STEP * FAR_RATE * 5.5)} ${60 + rand(index + 60) * 480})`}
        />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Front layer: moves faster than the camera. Sells the speed of flight. */
/* ------------------------------------------------------------------ */

export const FRONT_RATE = 1.4;

export function WorldFront() {
  const at = (i: number, dx: number) => i * STEP * FRONT_RATE + dx;
  const bits: ReactNode[] = [];
  for (let i = 0; i < WORLD_STOPS.length; i += 1) {
    for (let k = 0; k < 4; k += 1) {
      const seed = i * 10 + k;
      const x = at(i, rand(seed) * STEP * FRONT_RATE);
      const y = rand(seed + 300) > 0.5 ? 40 + rand(seed + 1) * 90 : 480 + rand(seed + 2) * 90;
      bits.push(<FrontBit key={seed} id={WORLD_STOPS[i]!.id} x={x} y={y} seed={seed} />);
    }
  }
  return <g>{bits}</g>;
}

function FrontBit({ id, x, y, seed }: { id: string; x: number; y: number; seed: number }) {
  const s = 0.8 + rand(seed + 9) * 0.6;
  const t = `translate(${x} ${y}) scale(${s})`;
  if (id === "atom" || id === "cell")
    return (
      <g transform={t} opacity="0.55">
        <circle r="22" fill="none" stroke="#c9f1ff" strokeWidth="3" />
        <circle cx="-7" cy="-7" r="6" fill="#fff" opacity="0.6" />
      </g>
    );
  if (id === "insect")
    return (
      <g transform={t}>
        <path d="M-40 60 Q-10 -40 10 -90 Q0 -30 6 60 Z" fill="#2f7f3a" />
      </g>
    );
  if (id === "street" || id === "city")
    return (
      <g transform={t}>
        <path d="M-14 0 q14 -12 14 0 q0 -12 14 0" stroke="#1c1915" strokeWidth="3" fill="none" />
      </g>
    );
  if (id === "country") return <Cloud x={x} y={y} s={s * 1.4} opacity={0.75} />;
  return (
    <g transform={t} opacity="0.8">
      <path d="M-18 -4 L-6 -14 L14 -10 L20 4 L4 14 L-14 10 Z" fill="#5a5466" />
      <path d="M-6 -14 L14 -10 L4 -2 Z" fill="#7a7488" />
    </g>
  );
}
