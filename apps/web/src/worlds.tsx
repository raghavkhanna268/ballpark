import type { ReactNode } from "react";

/**
 * One continuous world in a blueprint style: thin line drawings on dark ink, laid out left to right
 * from an atom to the galaxy web. Every stop is STEP world units wide and carries its real scale.
 * Neighbouring stops share drawings at their edges, so the camera never cuts between scenes.
 */

export const STEP = 520;
export const WORLD_H = 600;

export const WORLD_STOPS = [
  { id: "atom", label: "Atom", power: -10, size: "≈ 0.1 nm" },
  { id: "cell", label: "Cell", power: -5, size: "≈ 10 µm" },
  { id: "insect", label: "Ant", power: -3, size: "≈ 5 mm" },
  { id: "street", label: "Street", power: 1, size: "≈ 10 m" },
  { id: "city", label: "City", power: 4, size: "≈ 10 km" },
  { id: "country", label: "Country", power: 6, size: "≈ 1,000 km" },
  { id: "earth", label: "Earth", power: 7, size: "≈ 10,000 km" },
  { id: "moon", label: "Moon", power: 9, size: "≈ 1 light second out" },
  { id: "solar", label: "Solar system", power: 13, size: "≈ 9 billion km" },
  { id: "stars", label: "Nearby stars", power: 17, size: "≈ 4 light years" },
  { id: "galaxy", label: "Milky Way", power: 21, size: "≈ 100,000 light years" },
  { id: "universe", label: "Galaxy web", power: 26, size: "≈ 93 billion light years" },
] as const;

export const WORLD_W = STEP * WORLD_STOPS.length;

/** Where the probe floats at a given progress, in world units. */
export function explorerX(progress: number): number {
  return progress * STEP + 250;
}
export const EXPLORER_Y = 300;

export const INK = "#0a1020";
const LINE = "#8fd3ff";
const DIM = "rgba(143, 211, 255, 0.35)";
const FAINT = "rgba(143, 211, 255, 0.16)";
const AMBER = "#ffb347";

/** Deterministic pseudo-random so the art is the same on every render. */
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const line = { fill: "none", stroke: LINE, strokeWidth: 1.6, vectorEffect: "non-scaling-stroke" as const };
const dim = { fill: "none", stroke: DIM, strokeWidth: 1.2, vectorEffect: "non-scaling-stroke" as const };

/* ------------------------------------------------------------------ */
/* Main layer: moves 1:1 with the camera.                              */
/* ------------------------------------------------------------------ */

export function WorldMain() {
  return (
    <g>
      <defs>
        <linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={WORLD_W} y2="0">
          <stop offset="0" stopColor="#0b1428" />
          <stop offset="0.3" stopColor="#0a1324" />
          <stop offset="0.5" stopColor="#0a1020" />
          <stop offset="1" stopColor="#070a16" />
        </linearGradient>
        <radialGradient id="soft">
          <stop offset="0" stopColor={LINE} stopOpacity="0.14" />
          <stop offset="1" stopColor={LINE} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="-400" y="0" width={WORLD_W + 800} height={WORLD_H} fill="url(#ink)" />
      <StarDust />
      {WORLD_STOPS.map((stop, index) => (
        <Zone key={stop.id} i={index}>
          <ZoneArt id={stop.id} />
        </Zone>
      ))}
    </g>
  );
}

function Zone({ i, children }: { i: number; children: ReactNode }) {
  return <g transform={`translate(${i * STEP} 0)`}>{children}</g>;
}

export function toSuper(power: number): string {
  const map: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  return String(power)
    .split("")
    .map((char) => map[char] ?? char)
    .join("");
}

/** Stars thicken once the probe leaves the atmosphere. Before that, a faint particle haze. */
function StarDust() {
  const start = STEP * 5.6;
  return (
    <g>
      {Array.from({ length: 220 }, (_, index) => {
        const x = start + rand(index) * (WORLD_W - start + 200);
        const fade = Math.min(1, (x - start) / (STEP * 0.8));
        return <circle key={index} cx={x} cy={rand(index + 500) * WORLD_H} r={0.5 + rand(index + 900)} fill="#e8f1ff" opacity={(0.2 + 0.5 * rand(index + 77)) * fade} />;
      })}
      {Array.from({ length: 60 }, (_, index) => (
        <circle key={`d${index}`} cx={rand(index + 3000) * STEP * 3} cy={rand(index + 3100) * WORLD_H} r={0.8} fill={LINE} opacity={0.25} />
      ))}
    </g>
  );
}

function ZoneArt({ id }: { id: string }) {
  if (id === "atom") return <Atom />;
  if (id === "cell") return <Cell />;
  if (id === "insect") return <Ant />;
  if (id === "street") return <Street />;
  if (id === "city") return <City />;
  if (id === "country") return <Country />;
  if (id === "earth") return <Earth />;
  if (id === "moon") return <Moon />;
  if (id === "solar") return <Planets />;
  if (id === "stars") return <Stars />;
  if (id === "galaxy") return <Galaxy />;
  return <Web />;
}

function Label({ x, y, text, to }: { x: number; y: number; text: string; to?: [number, number] }) {
  return (
    <g>
      {to ? <line x1={to[0]} y1={to[1]} x2={x - 4} y2={y - 4} stroke={DIM} /> : null}
      <text x={x} y={y} fill={DIM} fontSize="11" className="mono">
        {text}
      </text>
    </g>
  );
}

/* ---- 0. Atom ---- */
function Atom() {
  const nucleons = [
    [0, 0],
    [-13, -8],
    [12, -10],
    [-10, 12],
    [12, 11],
    [0, -19],
    [-21, 3],
    [21, 1],
    [1, 20],
  ];
  return (
    <g>
      <g transform="translate(330 290)">
        <circle r="110" fill="url(#soft)" />
        <ellipse rx="180" ry="56" {...line} />
        <ellipse rx="180" ry="56" {...line} transform="rotate(60)" />
        <ellipse rx="180" ry="56" {...line} transform="rotate(-60)" />
        <g className="orbit o1">
          <circle cx="180" cy="0" r="5" fill={LINE} />
        </g>
        <g transform="rotate(60)">
          <g className="orbit o2">
            <circle cx="-180" cy="0" r="5" fill={LINE} />
          </g>
        </g>
        <g transform="rotate(-60)">
          <g className="orbit o3">
            <circle cx="180" cy="0" r="5" fill={LINE} />
          </g>
        </g>
        {nucleons.map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r="11" fill={INK} stroke={index % 2 ? LINE : AMBER} strokeWidth="1.6" />
        ))}
      </g>
      <Label x={400} y={170} text="electron" to={[372, 196]} />
      <Label x={380} y={400} text="nucleus" to={[345, 312]} />
      {/* a water molecule drifting toward the cell */}
      <g transform="translate(560 140)" className="bob-slow">
        <circle r="16" {...line} />
        <circle cx="-26" cy="18" r="10" {...dim} />
        <circle cx="26" cy="18" r="10" {...dim} />
        <line x1="-12" y1="9" x2="-18" y2="13" stroke={LINE} />
        <line x1="12" y1="9" x2="18" y2="13" stroke={LINE} />
      </g>
      <Label x={540} y={190} text="H₂O" />
    </g>
  );
}

/* ---- 1. Cell ---- */
function Cell() {
  const mito = [
    [-120, 40, 20],
    [100, 90, -25],
    [-50, 110, 8],
    [140, 10, 70],
  ];
  return (
    <g>
      {/* DNA strand arriving from the atom side */}
      <g transform="translate(-40 360) rotate(-20)">
        {Array.from({ length: 12 }, (_, index) => {
          const y = index * 14;
          const w = Math.sin(index * 0.7) * 18;
          return <line key={index} x1={-w} y1={y} x2={w} y2={y} stroke={index % 3 ? DIM : AMBER} strokeWidth="1.4" />;
        })}
        <path d={Array.from({ length: 12 }, (_, i) => `${i ? "L" : "M"}${-Math.sin(i * 0.7) * 18} ${i * 14}`).join(" ")} {...line} />
        <path d={Array.from({ length: 12 }, (_, i) => `${i ? "L" : "M"}${Math.sin(i * 0.7) * 18} ${i * 14}`).join(" ")} {...line} />
      </g>
      <g transform="translate(320 290)">
        <ellipse rx="190" ry="160" {...line} />
        <ellipse rx="178" ry="148" {...dim} strokeDasharray="5 6" />
        <path d="M-90 -100 q22 -12 44 0 t44 0 t44 0 M-100 -80 q26 -12 52 0 t52 0 t40 0" {...dim} />
        <circle cx="20" cy="0" r="54" {...line} />
        <circle cx="34" cy="-10" r="16" fill={FAINT} stroke={LINE} strokeWidth="1.4" />
        {mito.map(([x, y, r], index) => (
          <g key={index} transform={`translate(${x} ${y}) rotate(${r})`}>
            <ellipse rx="28" ry="12" {...line} />
            <path d="M-20 0 l5 -6 l5 12 l5 -12 l5 12 l5 -12 l5 12 l5 -6" fill="none" stroke={AMBER} strokeOpacity="0.8" strokeWidth="1.2" />
          </g>
        ))}
        {[
          [-140, -40],
          [-90, -120],
          [110, -100],
          [160, 60],
          [-10, 120],
        ].map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r="6" {...dim} />
        ))}
      </g>
      <Label x={380} y={220} text="nucleus" to={[360, 250]} />
      <Label x={130} y={470} text="mitochondrion" to={[190, 345]} />
    </g>
  );
}

/* ---- 2. Ant on a leaf ---- */
function Ant() {
  return (
    <g>
      {/* blades of grass, tall at the cell side */}
      {Array.from({ length: 9 }, (_, index) => {
        const x = -40 + index * 22;
        const h = 360 - index * 22;
        return <path key={index} d={`M${x} 600 Q${x + 10} ${600 - h * 0.6} ${x + 24} ${600 - h}`} {...dim} />;
      })}
      {/* the leaf */}
      <path d="M40 470 C140 380 360 370 540 430 C420 510 200 540 40 470 Z" {...line} />
      <path d="M50 468 C180 440 360 430 530 432" {...line} />
      {[120, 200, 280, 360, 440].map((x) => (
        <g key={x}>
          <path d={`M${x} ${458 - (x - 50) * 0.06} q30 -24 60 -34`} {...dim} />
          <path d={`M${x} ${458 - (x - 50) * 0.06} q30 22 60 32`} {...dim} />
        </g>
      ))}
      {/* the ant, drawn as a technical side view */}
      <g transform="translate(320 400)">
        <g className="legs">
          <path d="M-30 4 l-18 26 M-10 6 l-6 30 M10 6 l8 30 M30 4 l20 26 M-20 4 l-30 14 M20 4 l30 14" {...line} />
        </g>
        <ellipse cx="-44" cy="-6" rx="32" ry="22" fill={INK} stroke={LINE} strokeWidth="1.6" />
        <ellipse cx="-4" cy="-2" rx="18" ry="13" fill={INK} stroke={LINE} strokeWidth="1.6" />
        <circle cx="28" cy="-12" r="18" fill={INK} stroke={LINE} strokeWidth="1.6" />
        <circle cx="36" cy="-16" r="3" fill={AMBER} />
        <path d="M32 -28 q6 -28 24 -38 M40 -26 q16 -20 36 -22" {...line} />
      </g>
      <Label x={380} y={330} text="Formica rufa" to={[350, 380]} />
      <line x1="270" y1="360" x2="380" y2="360" stroke={AMBER} strokeOpacity="0.6" />
      <text x="325" y="352" textAnchor="middle" fill={AMBER} fontSize="11" className="mono">
        5 mm
      </text>
    </g>
  );
}

/* ---- 3. Street ---- */
function Street() {
  const houses = [
    { x: 30, w: 100, h: 150 },
    { x: 150, w: 90, h: 190 },
    { x: 330, w: 110, h: 140 },
    { x: 450, w: 90, h: 200 },
  ];
  return (
    <g>
      {/* last blades of grass at the kerb */}
      {Array.from({ length: 6 }, (_, index) => (
        <path key={index} d={`M${-60 + index * 10} 470 q4 -24 10 -38`} {...dim} />
      ))}
      {houses.map((house, index) => (
        <g key={index}>
          <rect x={house.x} y={470 - house.h} width={house.w} height={house.h} {...line} fill={INK} />
          <path d={`M${house.x - 8} ${470 - house.h} L${house.x + house.w / 2} ${470 - house.h - 50} L${house.x + house.w + 8} ${470 - house.h}`} {...line} />
          <rect x={house.x + house.w / 2 - 12} y={426} width="24" height="44" {...dim} />
          {Array.from({ length: Math.floor((house.h - 60) / 46) }, (_, row) =>
            [0, 1].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={house.x + 14 + col * (house.w - 46)}
                y={470 - house.h + 20 + row * 46}
                width="18"
                height="22"
                fill={rand(index * 10 + row * 2 + col) > 0.5 ? AMBER : "none"}
                fillOpacity="0.75"
                stroke={DIM}
              />
            )),
          )}
        </g>
      ))}
      {/* a person, for scale */}
      <g transform="translate(285 470)">
        <circle cy="-62" r="8" {...line} />
        <path d="M0 -54 v30 M0 -24 l-8 24 M0 -24 l8 24 M0 -46 l-12 14 M0 -46 l12 14" {...line} />
        <line x1="22" y1="0" x2="22" y2="-70" stroke={AMBER} strokeOpacity="0.7" />
        <line x1="18" y1="-70" x2="26" y2="-70" stroke={AMBER} strokeOpacity="0.7" />
        <text x="28" y="-34" fill={AMBER} fontSize="11" className="mono">
          1.7 m
        </text>
      </g>
      <line x1="-60" y1="470" x2="580" y2="470" stroke={LINE} strokeWidth="1.6" />
      <line x1="-60" y1="490" x2="580" y2="490" stroke={DIM} strokeDasharray="22 16" />
    </g>
  );
}

/* ---- 4. City ---- */
function City() {
  const towers = [
    { x: -20, w: 60, h: 180 },
    { x: 50, w: 54, h: 260 },
    { x: 114, w: 74, h: 220 },
    { x: 198, w: 48, h: 330 },
    { x: 256, w: 80, h: 250 },
    { x: 346, w: 54, h: 300 },
    { x: 410, w: 70, h: 210 },
    { x: 490, w: 50, h: 150 },
  ];
  return (
    <g>
      {towers.map((tower, index) => (
        <g key={index}>
          <rect x={tower.x} y={470 - tower.h} width={tower.w} height={tower.h} {...line} fill={INK} />
          {Array.from({ length: Math.floor(tower.h / 24) - 1 }, (_, row) =>
            Array.from({ length: Math.floor(tower.w / 14) - 1 }, (_, col) =>
              rand(index * 97 + row * 11 + col) > 0.72 ? (
                <rect key={`${row}-${col}`} x={tower.x + 8 + col * 14} y={470 - tower.h + 12 + row * 24} width="5" height="8" fill={AMBER} opacity="0.8" />
              ) : null,
            ),
          )}
        </g>
      ))}
      <line x1="222" y1="140" x2="222" y2="96" stroke={LINE} />
      <circle cx="222" cy="94" r="3" fill={AMBER} className="twinkle" />
      <line x1="-60" y1="470" x2="580" y2="470" stroke={LINE} strokeWidth="1.6" />
    </g>
  );
}

/* ---- 5. Country, as a contour map ---- */
function Country() {
  return (
    <g>
      {[0, 1, 2, 3, 4, 5].map((ring) => (
        <path
          key={ring}
          d={`M${60 + ring * 22} ${440 - ring * 4} C${120 + ring * 10} ${330 - ring * 24} ${260} ${260 + ring * 14} ${340 - ring * 10} ${310 + ring * 18} S${470 - ring * 20} ${420 - ring * 10} ${480 - ring * 26} ${450 - ring * 6} Z`}
          fill="none"
          stroke={ring === 5 ? AMBER : ring % 2 ? DIM : LINE}
          strokeWidth={ring === 5 ? 1.6 : 1.2}
        />
      ))}
      <path d="M-60 520 C40 490 120 540 220 506 C320 470 420 530 580 490" fill="none" stroke={LINE} strokeWidth="2" strokeDasharray="1 0" />
      <Label x={250} y={498} text="river" />
      <Label x={360} y={250} text="summit" to={[300, 330]} />
      {/* the city, now a dot */}
      <circle cx="40" cy="470" r="4" fill={AMBER} />
      <Label x={50} y={492} text="city" />
    </g>
  );
}

/* ---- 6. Earth ---- */
function Earth() {
  return (
    <g>
      <g transform="translate(340 290)">
        <circle r="170" fill="url(#soft)" />
        <circle r="150" {...line} fill={INK} />
        {[-100, -50, 0, 50, 100].map((y) => {
          const w = Math.sqrt(150 * 150 - y * y);
          return <ellipse key={y} cy={y} rx={w} ry={w * 0.12} {...dim} />;
        })}
        {[30, 70, 110].map((w) => (
          <ellipse key={w} rx={w} ry="150" {...dim} />
        ))}
        <path d="M-90 -90 C-50 -120 10 -110 20 -76 C30 -40 -20 -30 -40 0 C-60 26 -96 10 -106 -28 C-112 -56 -106 -80 -90 -90 Z" fill="none" stroke={AMBER} strokeWidth="1.6" />
        <path d="M30 14 C68 -6 112 22 104 58 C94 96 56 118 30 100 C10 84 2 40 30 14 Z" fill="none" stroke={AMBER} strokeWidth="1.6" />
      </g>
      {/* satellite on a low orbit */}
      <ellipse cx="340" cy="290" rx="210" ry="60" {...dim} strokeDasharray="3 6" transform="rotate(-14 340 290)" />
      <g transform="translate(140 300)">
        <rect x="-5" y="-4" width="10" height="8" {...line} />
        <rect x="-24" y="-3" width="16" height="6" {...dim} />
        <rect x="8" y="-3" width="16" height="6" {...dim} />
      </g>
    </g>
  );
}

/* ---- 7. Moon ---- */
function Moon() {
  return (
    <g>
      <path d="M-180 300 C40 120 200 140 300 290" {...dim} strokeDasharray="3 7" />
      <g transform="translate(320 300)">
        <circle r="110" {...line} fill={INK} />
        {[
          [-40, -40, 22],
          [30, 24, 30],
          [-50, 50, 16],
          [56, -50, 12],
          [0, -8, 10],
        ].map(([x, y, r], index) => (
          <g key={index}>
            <circle cx={x} cy={y} r={r} {...dim} />
            <circle cx={x! + r! * 0.18} cy={y! + r! * 0.18} r={r! * 0.6} {...dim} />
          </g>
        ))}
      </g>
      <Label x={110} y={180} text="1 light second from Earth" />
    </g>
  );
}

/* ---- 8. Planets ---- */
function Planets() {
  return (
    <g>
      <circle cx="40" cy="120" r="90" fill="none" stroke={AMBER} strokeWidth="1.6" />
      <circle cx="40" cy="120" r="70" fill="none" stroke={AMBER} strokeOpacity="0.35" />
      {[150, 240, 340, 470].map((r) => (
        <circle key={r} cx="40" cy="120" r={r} {...dim} strokeDasharray="2 7" />
      ))}
      <circle cx="160" cy="230" r="8" {...line} />
      <circle cx="210" cy="330" r="11" {...line} />
      <g transform="translate(300 420)">
        <circle r="56" {...line} fill={INK} />
        {[-36, -18, 0, 16, 34].map((y) => {
          const w = Math.sqrt(56 * 56 - y * y);
          return <line key={y} x1={-w} y1={y} x2={w} y2={y} stroke={DIM} />;
        })}
        <ellipse cx="18" cy="18" rx="12" ry="6" fill="none" stroke={AMBER} />
      </g>
      <Label x={360} y={490} text="jupiter" />
      <g transform="translate(450 230) rotate(-16)">
        <circle r="40" {...line} fill={INK} />
        <ellipse rx="90" ry="20" {...line} />
        <ellipse rx="72" ry="15" {...dim} />
        <path d="M-90 0 A90 20 0 0 0 90 0" fill="none" stroke={LINE} strokeWidth="1.6" />
      </g>
      <Label x={470} y={300} text="saturn" />
    </g>
  );
}

/* ---- 9. Nearby stars ---- */
function Stars() {
  const named = [
    [90, 160, "sun"],
    [210, 400, "proxima centauri"],
    [330, 190, "barnard's star"],
    [420, 360, "sirius"],
    [500, 130, "wolf 359"],
  ] as const;
  return (
    <g>
      <path d="M90 160 L210 400 L330 190 L420 360 L500 130" {...dim} strokeDasharray="4 6" />
      {named.map(([x, y, name], index) => (
        <g key={name}>
          <circle cx={x} cy={y} r={index === 0 ? 5 : 3.5} fill={index === 0 ? AMBER : LINE} className={index % 2 ? "twinkle" : undefined} />
          <circle cx={x} cy={y} r="12" {...dim} />
          <line x1={x - 18} y1={y} x2={x - 8} y2={y} stroke={DIM} />
          <line x1={x + 8} y1={y} x2={x + 18} y2={y} stroke={DIM} />
          <text x={x + 14} y={y - 14} fill={DIM} fontSize="11" className="mono">
            {name}
          </text>
        </g>
      ))}
      <text x="150" y="270" fill={AMBER} fontSize="11" className="mono" transform="rotate(63 150 270)">
        4.2 ly
      </text>
    </g>
  );
}

/* ---- 10. Milky Way ---- */
function Galaxy() {
  const arm = (offset: number) =>
    Array.from({ length: 60 }, (_, index) => {
      const t = index / 60;
      const angle = offset + t * Math.PI * 2.3;
      const radius = 16 + t * 200;
      return `${index ? "L" : "M"}${(Math.cos(angle) * radius).toFixed(1)} ${(Math.sin(angle) * radius * 0.5).toFixed(1)}`;
    }).join(" ");
  return (
    <g>
      <g transform="translate(320 290) rotate(-14)">
        <g className="galaxy-spin">
          <path d={arm(0)} {...line} />
          <path d={arm(Math.PI)} {...line} />
          <path d={arm(Math.PI / 2)} {...dim} />
          <path d={arm(Math.PI * 1.5)} {...dim} />
          {Array.from({ length: 120 }, (_, index) => {
            const t = rand(index);
            const angle = (index % 2 ? 0 : Math.PI) + t * Math.PI * 2.3 + (rand(index + 9) - 0.5) * 0.4;
            const radius = 16 + t * 200;
            return <circle key={index} cx={Math.cos(angle) * radius} cy={Math.sin(angle) * radius * 0.5} r="1.2" fill={LINE} opacity="0.6" />;
          })}
        </g>
        <ellipse rx="28" ry="16" fill="none" stroke={AMBER} strokeWidth="1.6" />
      </g>
      <circle cx="430" cy="370" r="3" fill={AMBER} />
      <circle cx="430" cy="370" r="10" fill="none" stroke={AMBER} />
      <Label x={444} y={392} text="you are here" />
    </g>
  );
}

/* ---- 11. Galaxy web ---- */
function Web() {
  const nodes = Array.from({ length: 18 }, (_, index) => ({ x: 20 + rand(index + 400) * 500, y: 70 + rand(index + 450) * 420 }));
  return (
    <g>
      {nodes.map((node, index) => {
        const next = nodes[(index * 5 + 3) % nodes.length]!;
        return <line key={`l${index}`} x1={node.x} y1={node.y} x2={next.x} y2={next.y} stroke={DIM} />;
      })}
      {nodes.map((node, index) => (
        <ellipse key={index} cx={node.x} cy={node.y} rx={6 + rand(index) * 8} ry={3} fill="none" stroke={index % 4 ? LINE : AMBER} transform={`rotate(${rand(index + 5) * 180} ${node.x} ${node.y})`} />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Far layer: a drafting grid that moves at FAR_RATE of the camera.    */
/* ------------------------------------------------------------------ */

export const FAR_RATE = 0.45;

export function WorldFar() {
  const width = WORLD_W * FAR_RATE + 800;
  const cols = Math.ceil(width / 40);
  return (
    <g>
      {Array.from({ length: cols }, (_, index) => (
        <line key={`v${index}`} x1={-400 + index * 40} y1="0" x2={-400 + index * 40} y2={WORLD_H} stroke={LINE} strokeOpacity={index % 5 ? 0.05 : 0.1} />
      ))}
      {Array.from({ length: 16 }, (_, index) => (
        <line key={`h${index}`} x1="-400" y1={index * 40} x2={width} y2={index * 40} stroke={LINE} strokeOpacity={index % 5 ? 0.05 : 0.1} />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Front layer: registration marks that move faster than the camera.   */
/* ------------------------------------------------------------------ */

export const FRONT_RATE = 1.4;

export function WorldFront() {
  const marks: ReactNode[] = [];
  const span = WORLD_W * FRONT_RATE;
  for (let index = 0; index < 70; index += 1) {
    const x = rand(index + 7000) * span;
    const y = rand(index + 7100) > 0.5 ? 30 + rand(index + 7200) * 80 : 470 + rand(index + 7300) * 100;
    marks.push(
      <g key={index} transform={`translate(${x} ${y})`} opacity="0.5">
        <line x1="-7" y1="0" x2="7" y2="0" stroke={LINE} />
        <line x1="0" y1="-7" x2="0" y2="7" stroke={LINE} />
      </g>,
    );
  }
  return <g>{marks}</g>;
}
