import type { ReactNode } from "react";
import { SCALE_LEVELS, SPACE_STOP, reachedPhrase } from "@ballpark/shared";

/**
 * One tall world in a blueprint style: thin line drawings on dark ink, stacked from the launch pad
 * straight up to the Milky Way. Every stop is STEP world units above the last. The climber stays in
 * the middle column, so the art sits to the sides and the camera only ever moves up.
 */

export const STEP = 460;
/** Width of the drawn column. Wider screens see open sky on both sides. */
export const WORLD_W = 420;
/** Extra sky and ground drawn on each side for wide screens. */
export const SIDE = 900;

export const WORLD_STOPS = SCALE_LEVELS.map((level) => ({
  id: level.id,
  label: level.name,
  altitude: level.altitude,
  /** "the Moon", for sentences like "Reach the Moon". */
  phrase: reachedPhrase(level),
}));
export { SPACE_STOP };

const STOPS = WORLD_STOPS.length;
/** World y of the launch pad. y grows downward, so higher stops have smaller y. */
const BASE_Y = (STOPS - 1) * STEP + 600;
export const WORLD_H = BASE_Y + 260;
export const CLIMBER_X = WORLD_W / 2;

/** Where the climber floats at a given progress, in world units. */
export function climberY(progress: number): number {
  return BASE_Y - progress * STEP;
}

export const INK = "#0a1020";
const LINE = "#8fd3ff";
const DIM = "rgba(143, 211, 255, 0.35)";
const FAINT = "rgba(143, 211, 255, 0.16)";
const AMBER = "#ffb347";
const GROUND = BASE_Y + 46;

/** Deterministic pseudo-random so the art is the same on every render. */
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const line = { fill: "none", stroke: LINE, strokeWidth: 1.6, vectorEffect: "non-scaling-stroke" as const };
const dim = { fill: "none", stroke: DIM, strokeWidth: 1.2, vectorEffect: "non-scaling-stroke" as const };
const solid = { fill: INK, stroke: LINE, strokeWidth: 1.6, vectorEffect: "non-scaling-stroke" as const };

/* ------------------------------------------------------------------ */
/* Main layer: moves 1:1 with the camera.                              */
/* ------------------------------------------------------------------ */

export function WorldMain() {
  return (
    <g>
      <defs>
        {/* Day to night: bright blueprint blue at the ground, indigo by the stratosphere, black past the Kármán line. */}
        <linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1={WORLD_H} x2="0" y2="0">
          {SKY.map(([at, color]) => (
            <stop key={at} offset={skyOffset(at)} stopColor={color} />
          ))}
        </linearGradient>
        {/* The thin glow of the atmosphere just under the edge of space. */}
        <linearGradient id="airglow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={LINE} stopOpacity="0.3" />
          <stop offset="1" stopColor={LINE} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="soft">
          <stop offset="0" stopColor={LINE} stopOpacity="0.14" />
          <stop offset="1" stopColor={LINE} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={-SIDE} y="0" width={WORLD_W + SIDE * 2} height={WORLD_H} fill="url(#sky)" />
      <rect x={-SIDE} y={KARMAN_Y} width={WORLD_W + SIDE * 2} height="300" fill="url(#airglow)" />
      <Layers />
      <Stars />
      <Skyline />
      {WORLD_STOPS.map((stop, index) => (
        <g key={stop.id} transform={`translate(0 ${climberY(index)})`}>
          <ZoneArt id={stop.id} />
        </g>
      ))}
      <Ground />
    </g>
  );
}

/** World y of the Kármán line drawn at the edge of space. */
const KARMAN_Y = climberY(SPACE_STOP) + 40;

/**
 * Sky colour by progress (0 is the launch pad). It brightens the low stops so the climb
 * visibly darkens: blueprint blue, then indigo, then black from the Kármán line up.
 */
const SKY: Array<[number, string]> = [
  [-0.6, "#3070bd"],
  [1, "#2c66ae"],
  [2, "#275a9c"],
  [3, "#224d89"],
  [4, "#1c3f72"],
  [5, "#172b5a"],
  [5.6, "#0f1a3b"],
  [SPACE_STOP - 0.09, "#070b1c"],
  [7, "#03050c"],
  [STOPS - 1 + 1.3, "#020307"],
];

/** Where a progress value sits on the sky gradient, which runs from the bottom of the world (0) to the top (1). */
function skyOffset(progress: number): number {
  return Math.max(0, Math.min(1, 1 - climberY(progress) / WORLD_H));
}

/** Dashed boundaries between the layers of the atmosphere, labelled like a chart. */
function Layers() {
  const lines = [
    { y: climberY(4) - 210, text: "TROPOPAUSE · STRATOSPHERE BEGINS" },
    { y: climberY(5) - 110, text: "STRATOPAUSE · MESOSPHERE BEGINS" },
  ];
  return (
    <g>
      {lines.map((item) => (
        <g key={item.text}>
          <line x1={-SIDE} y1={item.y} x2={WORLD_W + SIDE} y2={item.y} stroke={LINE} strokeOpacity="0.5" strokeDasharray="6 6" />
          <text x="16" y={item.y - 8} fill={LINE} fillOpacity="0.85" fontSize="11" className="mono" letterSpacing="2">
            {item.text}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Stars fade in above the mountains and thicken in space. */
function Stars() {
  const lowest = climberY(4.4);
  return (
    <g>
      {Array.from({ length: 320 }, (_, index) => {
        const y = rand(index + 500) * lowest;
        const fade = Math.min(1, (lowest - y) / (STEP * 1.6));
        return (
          <circle
            key={index}
            cx={-SIDE + rand(index) * (WORLD_W + SIDE * 2)}
            cy={y}
            r={0.5 + rand(index + 900) * 1.1}
            fill="#e8f1ff"
            opacity={(0.2 + 0.55 * rand(index + 77)) * fade}
            className={index % 9 === 0 ? "twinkle" : undefined}
          />
        );
      })}
    </g>
  );
}

function Ground() {
  return (
    <g>
      {/* Solid ground under the bright low sky, so the launch pad reads as standing on something. */}
      <rect x={-SIDE} y={GROUND} width={WORLD_W + SIDE * 2} height={WORLD_H - GROUND} fill={INK} />
      <line x1={-SIDE} y1={GROUND} x2={WORLD_W + SIDE} y2={GROUND} stroke={LINE} strokeWidth="1.6" />
      {Array.from({ length: 70 }, (_, index) => {
        const x = -SIDE + index * 34;
        return <line key={index} x1={x} y1={GROUND + 4} x2={x - 18} y2={GROUND + 22} stroke={FAINT} />;
      })}
    </g>
  );
}

/** Houses and towers stand on the ground; their roofs and spires are the next two stops up. */
function Skyline() {
  const roof = climberY(1) + 110;
  const spire = climberY(2) + 70;
  const towers = [
    { x: -150, w: 70, top: spire + 60 },
    { x: -60, w: 56, top: spire },
    { x: 330, w: 64, top: spire + 30 },
    { x: 420, w: 80, top: spire + 90 },
  ];
  const houses = [
    { x: -40, w: 110 },
    { x: 300, w: 120 },
  ];
  return (
    <g>
      {towers.map((tower, index) => (
        <g key={`t${index}`}>
          <rect x={tower.x} y={tower.top} width={tower.w} height={GROUND - tower.top} {...solid} stroke={DIM} />
          {Array.from({ length: Math.floor((GROUND - tower.top) / 30) }, (_, row) =>
            Array.from({ length: Math.floor(tower.w / 16) - 1 }, (_, col) =>
              rand(index * 97 + row * 11 + col) > 0.78 ? (
                <rect key={`${row}-${col}`} x={tower.x + 9 + col * 16} y={tower.top + 14 + row * 30} width="5" height="9" fill={AMBER} opacity="0.7" />
              ) : null,
            ),
          )}
          <line x1={tower.x + tower.w / 2} y1={tower.top} x2={tower.x + tower.w / 2} y2={tower.top - 60} stroke={LINE} />
          <circle cx={tower.x + tower.w / 2} cy={tower.top - 62} r="3" fill={AMBER} className="twinkle" />
        </g>
      ))}
      {houses.map((house, index) => (
        <g key={`h${index}`}>
          <rect x={house.x} y={roof} width={house.w} height={GROUND - roof} {...solid} />
          <path d={`M${house.x - 10} ${roof} L${house.x + house.w / 2} ${roof - 54} L${house.x + house.w + 10} ${roof} Z`} {...solid} />
          <rect x={house.x + house.w - 30} y={roof - 40} width="12" height="26" {...solid} />
          {Array.from({ length: Math.floor((GROUND - roof - 40) / 70) }, (_, row) =>
            [0, 1].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={house.x + 16 + col * (house.w - 50)}
                y={roof + 26 + row * 70}
                width="18"
                height="24"
                fill={rand(index * 10 + row * 2 + col) > 0.45 ? AMBER : "none"}
                fillOpacity="0.7"
                stroke={DIM}
              />
            )),
          )}
        </g>
      ))}
    </g>
  );
}

function ZoneArt({ id }: { id: string }) {
  if (id === "launch") return <LaunchPad />;
  if (id === "rooftops") return <Rooftops />;
  if (id === "skyscrapers") return <Spires />;
  if (id === "clouds") return <Clouds />;
  if (id === "peaks") return <Peaks />;
  if (id === "stratosphere") return <Stratosphere />;
  if (id === "space") return <EdgeOfSpace />;
  if (id === "station") return <Station />;
  if (id === "moon") return <Moon />;
  if (id === "planets") return <Planets />;
  return <Galaxy />;
}

function Label({ x, y, text, to, amber }: { x: number; y: number; text: string; to?: [number, number]; amber?: boolean }) {
  return (
    <g>
      {to ? <line x1={to[0]} y1={to[1]} x2={x - 4} y2={y - 4} stroke={DIM} /> : null}
      <text x={x} y={y} fill={amber ? AMBER : DIM} fontSize="11" className="mono">
        {text}
      </text>
    </g>
  );
}

/* Zone art is drawn around (210, 0), the climber's spot at that stop. Keep the middle column clear. */

/* ---- 0. Launch pad ---- */
function LaunchPad() {
  return (
    <g>
      {/* the gantry */}
      <g transform="translate(110 46)">
        <line x1="0" y1="0" x2="0" y2="-250" {...line} />
        <line x1="26" y1="0" x2="26" y2="-250" {...line} />
        {Array.from({ length: 6 }, (_, index) => (
          <path key={index} d={`M0 ${-index * 42} L26 ${-(index + 1) * 42} M26 ${-index * 42} L0 ${-(index + 1) * 42}`} {...dim} />
        ))}
        <line x1="26" y1="-70" x2="64" y2="-70" {...line} />
        <circle cx="13" cy="-256" r="3" fill={AMBER} className="twinkle" />
      </g>
      {/* the pad */}
      <path d="M150 40 h120 l-10 6 h-100 Z" {...solid} />
      <text x="210" y="62" textAnchor="middle" fill={AMBER} fontSize="10" className="mono" letterSpacing="2">
        PAD 01
      </text>
      {/* trees */}
      {[318, 352, 384].map((x, index) => (
        <g key={x}>
          <line x1={x} y1="46" x2={x} y2={20 - index * 4} {...line} />
          <circle cx={x} cy={8 - index * 6} r={16 + index * 3} {...dim} />
        </g>
      ))}
    </g>
  );
}

/* ---- 1. Rooftops ---- */
function Rooftops() {
  return (
    <g>
      {/* aerials and a line of birds */}
      <path d="M346 70 v-50 M334 34 h24 M338 44 h16" {...line} />
      {[
        [70, -40],
        [96, -58],
        [120, -36],
        [330, -120],
        [352, -134],
      ].map(([x, y], index) => (
        <path key={index} d={`M${x! - 8} ${y} q4 -6 8 0 q4 -6 8 0`} {...line} className="bob-slow" />
      ))}
    </g>
  );
}

/* ---- 2. Skyscraper tops ---- */
function Spires() {
  return (
    <g>
      {/* a tower crane on the right */}
      <g transform="translate(340 160)">
        <line x1="0" y1="0" x2="0" y2="-200" {...line} />
        <line x1="10" y1="0" x2="10" y2="-200" {...line} />
        {Array.from({ length: 5 }, (_, index) => (
          <path key={index} d={`M0 ${-index * 40} L10 ${-(index + 1) * 40}`} {...dim} />
        ))}
        <line x1="-120" y1="-200" x2="60" y2="-200" {...line} />
        <line x1="-100" y1="-200" x2="-100" y2="-140" {...dim} />
        <rect x="-108" y="-140" width="16" height="10" {...dim} />
      </g>
    </g>
  );
}

function Cloud({ x, y, w, front }: { x: number; y: number; w: number; front?: boolean }) {
  const h = w * 0.32;
  return (
    <path
      d={`M${x} ${y} a${h * 0.6} ${h * 0.6} 0 0 1 ${w * 0.22} ${-h * 0.5} a${h * 0.8} ${h * 0.8} 0 0 1 ${w * 0.38} ${-h * 0.2} a${h * 0.6} ${h * 0.6} 0 0 1 ${w * 0.4} ${h * 0.7} Z`}
      fill={front ? "rgba(10, 16, 32, 0.6)" : "none"}
      stroke={front ? LINE : DIM}
      strokeWidth={front ? 1.6 : 1.2}
    />
  );
}

/* ---- 3. Clouds ---- */
function Clouds() {
  return (
    <g>
      <Cloud x={-80} y={150} w={240} />
      <Cloud x={280} y={120} w={220} />
      <Cloud x={20} y={-120} w={150} />
      <Cloud x={300} y={-60} w={160} />
      <Cloud x={-120} y={230} w={300} front />
      <Cloud x={250} y={240} w={300} front />
      {/* a small plane crossing below */}
      <g transform="translate(70 70)">
        <path d="M0 0 h44 l8 -4 M18 0 l-10 -14 M24 0 l-10 12 M44 0 l4 -10" {...line} />
        <line x1="-6" y1="0" x2="-80" y2="0" stroke={DIM} strokeDasharray="4 6" />
      </g>
    </g>
  );
}

/* ---- 4. Mountain peaks, above the clouds ---- */
function Peaks() {
  return (
    <g>
      <path d="M-200 230 L-60 70 L0 120 L60 20 L120 140 L150 110 L170 160" {...line} />
      <path d="M260 160 L300 40 L330 80 L380 -30 L470 120 L600 230" {...line} />
      <path d="M44 40 L60 20 L76 46 M282 92 L300 40 L314 60 M362 10 L380 -30 L398 16" fill="none" stroke={AMBER} strokeWidth="1.4" />
      {/* a flag on the highest summit */}
      <path d="M380 -30 v-26 l16 6 l-16 6" fill="none" stroke={AMBER} strokeWidth="1.4" />
      <Cloud x={-120} y={232} w={320} front />
      <Cloud x={260} y={236} w={320} front />
      {/* an airliner a little higher up, on its contrail */}
      <g transform="translate(40 -170)">
        <path d="M0 0 h56 l10 -5 M22 0 l-12 -18 M30 0 l-12 15 M56 0 l5 -12" {...line} />
        <line x1="-8" y1="0" x2="-160" y2="0" stroke={DIM} strokeDasharray="5 7" />
      </g>
    </g>
  );
}

/* ---- 5. Stratosphere ---- */
function Stratosphere() {
  return (
    <g>
      {/* Earth's curve shows for the first time */}
      <path d={`M-200 250 Q210 150 620 250`} {...line} />
      <path d={`M-200 262 Q210 166 620 262`} {...dim} />
      {/* a weather balloon */}
      <g transform="translate(340 -70)" className="bob-slow">
        <circle r="34" {...line} />
        <path d="M-24 22 Q0 40 24 22" {...dim} />
        <line x1="0" y1="34" x2="0" y2="90" stroke={DIM} />
        <rect x="-8" y="90" width="16" height="12" {...line} />
      </g>
      <path d="M-200 60 q40 -10 80 0 t80 0 t80 0 t80 0 t80 0 t80 0" stroke={AMBER} strokeOpacity="0.4" fill="none" />
      <Label x={20} y={50} text="ozone layer" amber />
    </g>
  );
}

/* ---- 6. Edge of space: the Kármán line ---- */
function EdgeOfSpace() {
  return (
    <g>
      <path d={`M-200 300 Q210 170 620 300`} {...line} />
      {/* aurora */}
      {[0, 1, 2].map((band) => (
        <path
          key={band}
          d={`M-120 ${150 + band * 14} q40 -30 80 0 t80 0 t80 0 t80 0 t80 0 t80 0`}
          fill="none"
          stroke={band === 1 ? AMBER : LINE}
          strokeOpacity={0.25 + band * 0.1}
        />
      ))}
      <line x1={-SIDE} y1="40" x2={WORLD_W + SIDE} y2="40" stroke={AMBER} strokeDasharray="10 8" strokeWidth="1.4" />
      <text x="16" y="32" fill={AMBER} fontSize="11" className="mono" letterSpacing="2">
        KÁRMÁN LINE · 100 km · SPACE STARTS HERE
      </text>
    </g>
  );
}

/* ---- 7. Space station ---- */
function Station() {
  const panel = (x: number, y: number) => (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="22" height="54" {...line} fill="rgba(255, 179, 71, 0.08)" />
      <line x1="11" y1="0" x2="11" y2="54" stroke={DIM} />
      {[13, 27, 40].map((yy) => (
        <line key={yy} x1="0" y1={yy} x2="22" y2={yy} stroke={DIM} />
      ))}
    </g>
  );
  return (
    <g>
      <g transform="translate(20 -170)" className="drift">
        <line x1="0" y1="27" x2="130" y2="27" {...line} />
        {panel(0, 0)}
        {panel(26, 0)}
        {panel(104, 0)}
        {panel(128, 0)}
        <rect x="52" y="18" width="46" height="18" rx="6" {...solid} />
        <rect x="64" y="36" width="20" height="14" rx="4" {...solid} />
      </g>
      {/* a satellite on the other side */}
      <g transform="translate(350 90) rotate(20)">
        <rect x="-8" y="-6" width="16" height="12" {...line} />
        <rect x="-36" y="-4" width="24" height="8" {...dim} />
        <rect x="12" y="-4" width="24" height="8" {...dim} />
        <path d="M0 -6 v-10 m-8 0 a8 4 0 0 0 16 0" {...line} />
      </g>
    </g>
  );
}

/* ---- 8. The Moon ---- */
function Moon() {
  return (
    <g>
      <g transform="translate(350 -70)">
        <circle r="120" fill="url(#soft)" />
        <circle r="100" {...solid} />
        {[
          [-40, -30, 20],
          [26, 22, 26],
          [-46, 44, 14],
          [48, -46, 12],
          [0, -6, 9],
        ].map(([x, y, r], index) => (
          <g key={index}>
            <circle cx={x} cy={y} r={r} {...dim} />
            <circle cx={x! + r! * 0.18} cy={y! + r! * 0.18} r={r! * 0.6} {...dim} />
          </g>
        ))}
      </g>
      {/* Earth, small and far below */}
      <g transform="translate(60 170)">
        <circle r="26" {...solid} />
        <path d="M-16 -8 C-8 -18 6 -14 6 -4 C6 6 -8 6 -12 12" fill="none" stroke={AMBER} strokeWidth="1.2" />
        <ellipse rx="26" ry="5" {...dim} />
      </g>
    </g>
  );
}

/* ---- 9. The planets ---- */
function Planets() {
  return (
    <g>
      {/* Mars */}
      <circle cx="70" cy="110" r="16" {...line} />
      <path d="M58 104 q10 -4 22 2" fill="none" stroke={AMBER} />
      {/* Jupiter */}
      <g transform="translate(370 60)">
        <circle r="64" {...solid} />
        {[-40, -20, 0, 18, 38].map((y) => {
          const w = Math.sqrt(64 * 64 - y * y);
          return <line key={y} x1={-w} y1={y} x2={w} y2={y} stroke={DIM} />;
        })}
        <ellipse cx="20" cy="22" rx="13" ry="6" fill="none" stroke={AMBER} />
      </g>
      {/* Saturn */}
      <g transform="translate(70 -140) rotate(-16)">
        <circle r="36" {...solid} />
        <ellipse rx="80" ry="18" {...line} />
        <ellipse rx="64" ry="13" {...dim} />
        <path d="M-80 0 A80 18 0 0 0 80 0" fill="none" stroke={LINE} strokeWidth="1.6" />
      </g>
      {Array.from({ length: 26 }, (_, index) => (
        <circle key={index} cx={rand(index + 40) * WORLD_W} cy={-40 + rand(index + 80) * 60 + index} r="1.4" fill={DIM} />
      ))}
    </g>
  );
}

/* ---- 10. The Milky Way ---- */
function Galaxy() {
  const arm = (offset: number) =>
    Array.from({ length: 60 }, (_, index) => {
      const t = index / 60;
      const angle = offset + t * Math.PI * 2.3;
      const radius = 14 + t * 190;
      return `${index ? "L" : "M"}${(Math.cos(angle) * radius).toFixed(1)} ${(Math.sin(angle) * radius * 0.5).toFixed(1)}`;
    }).join(" ");
  return (
    <g>
      <g transform="translate(210 -190) rotate(-12)">
        <g className="galaxy-spin">
          <path d={arm(0)} {...line} />
          <path d={arm(Math.PI)} {...line} />
          <path d={arm(Math.PI / 2)} {...dim} />
          <path d={arm(Math.PI * 1.5)} {...dim} />
          {Array.from({ length: 120 }, (_, index) => {
            const t = rand(index);
            const angle = (index % 2 ? 0 : Math.PI) + t * Math.PI * 2.3 + (rand(index + 9) - 0.5) * 0.4;
            const radius = 14 + t * 190;
            return <circle key={index} cx={Math.cos(angle) * radius} cy={Math.sin(angle) * radius * 0.5} r="1.2" fill={LINE} opacity="0.6" />;
          })}
        </g>
        <ellipse rx="26" ry="14" fill="none" stroke={AMBER} strokeWidth="1.6" />
      </g>
      {/* the nearest stars, passed on the way */}
      {[
        [60, 170, "proxima centauri"],
        [330, 120, "sirius"],
      ].map(([x, y, name]) => (
        <g key={name as string}>
          <circle cx={x} cy={y} r="3.5" fill={LINE} />
          <circle cx={x} cy={y} r="11" {...dim} />
          <text x={(x as number) + 14} y={(y as number) - 12} fill={DIM} fontSize="11" className="mono">
            {name}
          </text>
        </g>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Far layer: a drafting grid that moves at FAR_RATE of the camera.    */
/* ------------------------------------------------------------------ */

export const FAR_RATE = 0.4;
export const FAR_H = WORLD_H * FAR_RATE + 1400;

export function WorldFar() {
  return (
    <g>
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0 H0 V40" fill="none" stroke={LINE} strokeOpacity="0.06" />
        </pattern>
        <pattern id="grid5" width="200" height="200" patternUnits="userSpaceOnUse">
          <path d="M200 0 H0 V200" fill="none" stroke={LINE} strokeOpacity="0.1" />
        </pattern>
      </defs>
      <rect x={-SIDE} y="0" width={WORLD_W + SIDE * 2} height={FAR_H} fill="url(#grid)" />
      <rect x={-SIDE} y="0" width={WORLD_W + SIDE * 2} height={FAR_H} fill="url(#grid5)" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Front layer: registration marks that move faster than the camera.   */
/* ------------------------------------------------------------------ */

export const FRONT_RATE = 1.3;
export const FRONT_H = WORLD_H * FRONT_RATE + 1400;

export function WorldFront() {
  const marks: ReactNode[] = [];
  for (let index = 0; index < 90; index += 1) {
    const left = rand(index + 7000) > 0.5;
    const x = left ? 10 + rand(index + 7200) * 60 : WORLD_W - 70 + rand(index + 7300) * 60;
    const y = rand(index + 7100) * FRONT_H;
    marks.push(
      <g key={index} transform={`translate(${x} ${y})`} opacity="0.45">
        <line x1="-7" y1="0" x2="7" y2="0" stroke={LINE} />
        <line x1="0" y1="-7" x2="0" y2="7" stroke={LINE} />
      </g>,
    );
  }
  return <g>{marks}</g>;
}

/** Index of the stop the climber is standing at. */
export function stopAt(progress: number): number {
  return Math.max(0, Math.min(STOPS - 1, Math.round(progress)));
}
