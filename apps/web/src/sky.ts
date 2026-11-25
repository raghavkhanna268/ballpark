import { MILESTONES, formatDistance } from "@ballpark/shared";

/**
 * The climb, drawn on a canvas: a sky that darkens into space as the rocket rises, real landmarks at their real
 * heights, and one of three sceneries on the ground. The scenery changes each day, the same for everyone.
 *
 * Heights here are in "stops": two per unit of journey progress, so a perfect run (progress 10) is 20 stops up.
 * One stop is a little under a screen height.
 */

export type Scenery = "city" | "coast" | "peaks";
export const SCENERIES: readonly Scenery[] = ["city", "coast", "peaks"];

/** City night, Sunset coast and Himalaya take turns by puzzle number. */
export function sceneryFor(puzzleNumber: number): Scenery {
  return SCENERIES[(((puzzleNumber - 1) % SCENERIES.length) + SCENERIES.length) % SCENERIES.length];
}

/** Liftoff, Orbit, Moonshot, Deep space, Supernova. */
export const TIER_COLORS = ["#c8946a", "#62b6ff", "#ffd04a", "#4fe3a6", "#ff6fd8"] as const;
export const MISS_COLOR = "#8b93a8";

/** A tier from 0 (Liftoff) to 4 (Supernova), or -1 for a miss. */
export function tierColor(tier: number): string {
  return tier >= 0 ? TIER_COLORS[Math.min(TIER_COLORS.length - 1, tier)] : MISS_COLOR;
}

/** One answer's stretch of the climb, in journey progress, coloured by its tier. */
export type SkyTrail = { from: number; to: number; tier: number };
/** A rocket's paint job from the Hangar: the body's gradient left to right, the nose and fins, and the window. */
export type RocketPaint = { body: [string, string, string]; accent: string; window: string; pattern?: "stripes" | "stars" | "craters" };

export const CLASSIC_PAINT: RocketPaint = { body: ["#98a1bb", "#ffffff", "#b3bbd2"], accent: "#e8505b", window: "#22305e" };

/** Another climber's height: your best, today's average and best, or a friend you are racing (in their paint job). */
export type SkyGhost = { progress: number; label: string; color: string; paint?: RocketPaint };
/** Where the rocket is this frame, for the labels the page draws over the canvas. */
export type SkyFrame = { progress: number; from: number; x: number; y: number; climbing: boolean };
/** `boost` is the Afterburner: a hotter, bigger burn. */
export type ClimbOptions = { from: number; to: number; tier: number; replay?: boolean; boost?: boolean; onLand?: () => void };

export type Sky = {
  resize(width: number, height: number, wide: boolean): void;
  setScene(scene: Scenery): void;
  /** Where the rocket rests, as a share of the screen height from the top. */
  setAnchor(share: number): void;
  setTrail(trail: SkyTrail[]): void;
  setGhosts(ghosts: SkyGhost[]): void;
  setPaint(paint: RocketPaint): void;
  /** Draws one frame now, with the camera on the rocket. For a still sky that runs no animation loop, like the postcard. */
  draw(): void;
  /** Puts the rocket at a height with no animation. */
  jump(progress: number): void;
  climb(options: ClimbOptions): void;
  progress(): number;
  destroy(): void;
  onFrame: ((frame: SkyFrame) => void) | null;
  /** Called with a landmark's index in MILESTONES as the rocket passes it. */
  onMilestone: ((index: number) => void) | null;
};

const STOP = 2;

/** How long one answer's climb plays, in ms, after a short ignition: a miss sputters for 1.5 s, a Supernova climbs for about 4. */
export function climbMs(travel: number): number {
  return travel <= 0 ? 1500 : Math.round(1300 + 950 * travel * STOP);
}
/** How long the end screen's replay of the whole climb lasts, in ms. */
export function replayMs(progress: number): number {
  return Math.round(Math.min(3600, 1200 + Math.max(0, progress) * STOP * 160));
}
/** The pause between locking in and the burner lighting. */
export const IGNITION_MS = 250;
const MILES = MILESTONES.map((milestone) => ({ at: milestone.at * STOP, km: milestone.km, name: milestone.name }));
const LABEL_FONT = '600 10px Outfit, "Avenir Next", system-ui, sans-serif';
const GHOST_FONT = '600 10px Outfit, "Avenir Next", system-ui, sans-serif';
/** How hard the burner fires for each tier. */
const POWER = [0.55, 0.8, 1.05, 1.35, 1.75];

function rng(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

const STARS = (() => {
  const r = rng(3);
  return Array.from({ length: 170 }, () => ({ x: r(), y: r(), s: r() * 1.4 + 0.4, tw: r() * 6.3 }));
})();
const GAL = (() => {
  const r = rng(9);
  return Array.from({ length: 420 }, () => ({ u: r(), v: (r() + r() + r()) / 3 - 0.5, s: r() * 1.3 + 0.3, c: r() }));
})();
const CLOUDS = [
  { h: 1.0, x: 0.12, s: 1.15 },
  { h: 1.22, x: 0.78, s: 1.35 },
  { h: 1.46, x: 0.4, s: 0.9 },
  { h: 1.7, x: 0.9, s: 1.05 },
  { h: 1.95, x: 0.18, s: 1.25 },
  { h: 2.2, x: 0.62, s: 0.85 },
];
const ROCKS = (() => {
  const r = rng(21);
  const rocks: Array<{ h: number; x: number; r: number }> = [];
  for (let i = 0; i < 14; i++) rocks.push({ h: 13.4 + r() * 1.1, x: r(), r: 2 + r() * 6 });
  for (let i = 0; i < 24; i++) rocks.push({ h: 15.8 + r() * 0.9, x: r(), r: 1.5 + r() * 4 });
  return rocks;
})();

const SKY: Record<Scenery, Array<[number, string]>> = {
  city: [[0, "#22306a"], [0.8, "#18225a"], [2.5, "#0f173f"], [5, "#080d28"], [7, "#04061a"], [20, "#02030c"]],
  coast: [[0, "#ffb27a"], [0.35, "#f58c7c"], [1, "#ba6390"], [2.2, "#60418c"], [3.8, "#2d2669"], [5.5, "#15123f"], [7, "#07071d"], [20, "#02020c"]],
  peaks: [[0, "#f8dcc6"], [0.45, "#e6d0e3"], [1.3, "#abc4eb"], [2.8, "#5d88d2"], [4.6, "#2b4b9e"], [6.4, "#101e52"], [7.6, "#050a21"], [20, "#02030c"]],
};
const STAR_ALPHA: Record<Scenery, Array<[number, number]>> = {
  city: [[0, 0.4], [4, 0.7], [7, 1]],
  coast: [[0, 0], [2, 0.08], [4.5, 0.6], [7, 1]],
  peaks: [[0, 0], [3, 0.12], [5.5, 0.6], [7.5, 1]],
};
const GROUND: Record<Scenery, string> = { city: "#060918", coast: "#2b1631", peaks: "#1d1f3f" };

function hex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function mixColor(a: string, b: string, k: number): string {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(",")})`;
}
function colorAt(stops: Array<[number, string]>, x: number): string {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (x < stops[i + 1][0]) return mixColor(stops[i][1], stops[i + 1][1], (x - stops[i][0]) / (stops[i + 1][0] - stops[i][0]));
  }
  return stops[stops.length - 1][1];
}
function numberAt(stops: Array<[number, number]>, x: number): number {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (x < stops[i + 1][0]) return stops[i][1] + (stops[i + 1][1] - stops[i][1]) * ((x - stops[i][0]) / (stops[i + 1][0] - stops[i][0]));
  }
  return stops[stops.length - 1][1];
}
function wrap(v: number, m: number): number {
  return ((v % m) + m) % m;
}
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function ease(q: number): number {
  return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
}
/** Two hex digits of alpha for a #rrggbb colour. */
function alphaHex(a: number): string {
  return Math.max(0, Math.min(255, Math.round(a))).toString(16).padStart(2, "0");
}

type Building = { x: number; w: number; h: number; win: Array<[number, number, number]> };
type Ridge = Array<[number, number]>;
type SceneData = {
  id: Scenery;
  far: Building[];
  mid: Building[];
  r1: Ridge;
  r2: Ridge;
  r3: Ridge;
  pines: Array<{ x: number; s: number }>;
  isl: Array<[number, number, number]>;
};
type Climb = {
  from: number;
  d: number;
  t0: number;
  dur: number;
  tier: number;
  miss: boolean;
  replay: boolean;
  boost: boolean;
  v: number;
  p: number;
  onLand?: () => void;
};

/** The rocket's body, nose up, with its base at 0. */
const BODY_PATH = "M0 -58 C12 -46 12 -24 9 -6 L-9 -6 C-12 -24 -12 -46 0 -58Z";

/** `still` draws only when asked to, at `pixelRatio`, with no animation loop. */
export function createSky(canvas: HTMLCanvasElement, reduce: boolean, options: { still?: boolean; pixelRatio?: number } = {}): Sky {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  const ctx = context;
  const BODY = new Path2D(BODY_PATH);
  let W = 390;
  let H = 760;
  let P = 700;
  let RX = 195;
  let wide = false;
  let anc = 0.84;
  let ancTarget = 0.84;
  let anchored = false;
  let SC: SceneData = emptyScene("city");
  let cam = 0;
  let h = 0;
  let lastFrom = 0;
  let passedIdx = 0;
  let lastTier = -1;
  let climb: Climb | null = null;
  let trail: SkyTrail[] = [];
  let ghosts: SkyGhost[] = [];
  let paint: RocketPaint = CLASSIC_PAINT;
  const sparks: Array<{ x: number; y: number; vx: number; vy: number; life: number; c: string }> = [];
  const exhaust: Array<{ x: number; y: number; vx: number; vy: number; life: number; s: number; c: string }> = [];
  let ring: { t0: number; c: string } | null = null;
  let last = performance.now();
  let raf = 0;
  let dirty = true;

  const sy = (x: number) => H * anc - (x - cam) * P;
  const gl = (z: number) => H * anc + cam * P * z;
  const hAtY = (y: number) => cam + (H * anc - y) / P;

  function emptyScene(id: Scenery): SceneData {
    return { id, far: [], mid: [], r1: [], r2: [], r3: [], pines: [], isl: [] };
  }

  function row(r: () => number, wmin: number, wmax: number, hmin: number, hmax: number, lit: number): Building[] {
    const out: Building[] = [];
    let x = -12;
    while (x < W + 12) {
      const w = wmin + r() * (wmax - wmin);
      const hh = hmin + r() * (hmax - hmin);
      const win: Array<[number, number, number]> = [];
      for (let yy = 8; yy < hh - 6; yy += 7) for (let xx = 4; xx < w - 4; xx += 6) if (r() < lit) win.push([xx, yy, r()]);
      out.push({ x, w, h: hh, win });
      x += w + 1 + r() * 4;
    }
    return out;
  }

  function ridge(r: () => number, n: number, hmin: number, hmax: number): Ridge {
    const points: Ridge = [];
    for (let i = 0; i <= n; i++) points.push([(i - 0.5 + r() * 0.4) / (n - 1), (hmin + r() * (hmax - hmin)) * (i % 2 ? 1 : 0.62)]);
    return points;
  }

  function buildScene(id: Scenery) {
    const r = rng(17 + SCENERIES.indexOf(id) * 31);
    const next = emptyScene(id);
    if (id === "city") {
      next.far = row(r, 14, 30, 36, 100, 0.12);
      next.mid = row(r, 22, 50, 60, 170, 0.2);
    }
    if (id === "peaks") {
      next.r1 = ridge(r, 7, 170, 290);
      next.r2 = ridge(r, 9, 110, 190);
      next.r3 = ridge(r, 11, 60, 120);
      next.pines = Array.from({ length: 22 }, () => ({ x: r(), s: 0.6 + r() * 0.7 }));
    }
    if (id === "coast") next.isl = [[0.12, 0.28, 26], [0.62, 0.9, 18]];
    SC = next;
  }

  function line(x1: number, y1: number, x2: number, y2: number) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function circ(x: number, y: number, r: number) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, 6.283);
    ctx.fill();
  }

  /* ---------- sky and space ---------- */
  function paintSky(t: number) {
    const stops = SKY[SC.id];
    const hTop = cam + (anc * H) / P;
    const hBot = cam - ((1 - anc) * H) / P;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    for (let i = 0; i <= 4; i++) {
      const k = i / 4;
      g.addColorStop(k, colorAt(stops, hTop + (hBot - hTop) * k));
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const a = numberAt(STAR_ALPHA[SC.id], cam);
    if (a > 0.01) {
      for (const s of STARS) {
        const y = wrap(s.y * H * 1.3 + cam * P * 0.06, H * 1.3) - H * 0.15;
        const tw = t ? 0.65 + 0.35 * Math.sin(t * 0.002 + s.tw) : 1;
        ctx.fillStyle = `rgba(255,255,255,${a * tw * (0.35 + s.s * 0.4)})`;
        ctx.fillRect(s.x * W, y, s.s, s.s);
      }
    }
  }

  function paintSpace(t: number) {
    const T = t || 0;
    // High cirrus
    for (let k = 0; k < 8; k++) {
      const y = sy(2.45 + k * 0.38);
      if (y < -20 || y > H + 20) continue;
      const x = wrap(k * 0.37 * W + T * 0.006, W + 220) - 110;
      ctx.strokeStyle = SC.id === "coast" && cam < 3 ? "rgba(255,220,200,.35)" : "rgba(255,255,255,.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 40, y - 8, x + 90, y + 6, x + 150, y - 4);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 20, y + 7);
      ctx.bezierCurveTo(x + 60, y + 1, x + 100, y + 11, x + 130, y + 5);
      ctx.stroke();
    }
    // Meteors
    for (let k = 0; k < 4; k++) {
      const y0 = sy(5.75 + k * 0.2);
      if (y0 < -60 || y0 > H + 60) continue;
      const ph = wrap(T * 0.00035 + k * 0.29, 1);
      if (ph > 0.3 && T) continue;
      const q = T ? ph / 0.3 : 0.5;
      const x = W * (0.9 - 0.25 * k) - q * 170;
      const y = y0 + q * 70;
      const g = ctx.createLinearGradient(x, y, x + 60, y - 25);
      g.addColorStop(0, "rgba(255,255,255,.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      line(x, y, x + 60, y - 25);
    }
    // Asteroid belt
    for (const rock of ROCKS) {
      const y = sy(rock.h);
      if (y < -10 || y > H + 10) continue;
      ctx.fillStyle = "#8a8296";
      circ(rock.x * W, y, rock.r);
      ctx.fillStyle = "#5d566a";
      circ(rock.x * W + rock.r * 0.3, y + rock.r * 0.3, rock.r * 0.7);
    }
    // Comet
    {
      const y = sy(18.3);
      if (y > -80 && y < H + 80) {
        const x = W * 0.68;
        const g = ctx.createLinearGradient(x, y, x - 130, y - 70);
        g.addColorStop(0, "rgba(200,240,255,.8)");
        g.addColorStop(1, "rgba(200,240,255,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 6;
        line(x, y, x - 130, y - 70);
        ctx.fillStyle = "#effaff";
        circ(x, y, 4.5);
      }
    }
    // Aurora
    for (let i = 0; i < 3; i++) {
      const y = sy(5.7 + i * 0.22);
      if (y < -140 || y > H + 60) continue;
      const cols = ["79,227,166", "160,120,255", "98,182,255"];
      for (let x = -10; x < W + 10; x += 5) {
        const yy = y + Math.sin(x * 0.018 + T * 0.0006 + i * 2) * 16;
        const g = ctx.createLinearGradient(0, yy - 90, 0, yy);
        g.addColorStop(0, `rgba(${cols[i]},0)`);
        g.addColorStop(1, `rgba(${cols[i]},.16)`);
        ctx.fillStyle = g;
        ctx.fillRect(x, yy - 90, 4, 90);
      }
    }
    // The curve of the Earth below, once you are in space
    const ek = clamp01((cam - 6.2) / 1.3);
    const yT = H + 40 - ek * (0.12 * H + 40) + Math.max(0, cam - 9) * P * 0.18;
    if (ek > 0 && yT < H + 30) {
      const R = W * 2.6;
      ctx.save();
      const g = ctx.createRadialGradient(W / 2, yT + R, R * 0.85, W / 2, yT + R, R);
      g.addColorStop(0, "#0c2a66");
      g.addColorStop(1, "#2d6fc4");
      ctx.fillStyle = g;
      circ(W / 2, yT + R, R);
      ctx.strokeStyle = "rgba(140,210,255,.35)";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(W / 2, yT + R, R + 5, 0, 6.283);
      ctx.stroke();
      ctx.strokeStyle = "rgba(190,235,255,.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(W / 2, yT + R, R, 0, 6.283);
      ctx.stroke();
      ctx.restore();
    }
    // Weather balloon
    let y = sy(4.6);
    if (y > -60 && y < H + 60) {
      const x = W * (wide ? 0.2 : 0.24) + Math.sin(T * 0.001) * 4;
      ctx.fillStyle = "#f4f4f8";
      circ(x, y - 30, 15);
      ctx.strokeStyle = "rgba(255,255,255,.6)";
      ctx.lineWidth = 1;
      line(x, y - 15, x, y + 6);
      ctx.fillStyle = "#ff7a59";
      ctx.fillRect(x - 4, y + 6, 8, 7);
    }
    // Space station
    y = sy(8.4);
    if (y > -40 && y < H + 40) {
      const x = W * 0.72 + Math.sin(T * 0.0003) * 10;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "#2c57c4";
      ctx.strokeStyle = "#9cb8ff";
      ctx.lineWidth = 0.8;
      for (const dx of [-34, -20, 10, 24]) {
        ctx.fillRect(dx, -12, 10, 9);
        ctx.strokeRect(dx, -12, 10, 9);
        ctx.fillRect(dx, 3, 10, 9);
        ctx.strokeRect(dx, 3, 10, 9);
      }
      ctx.fillStyle = "#e9edf5";
      ctx.fillRect(-10, -4, 20, 8);
      ctx.fillRect(-4, -10, 8, 20);
      ctx.restore();
    }
    // TV satellites
    for (const [hh, xx] of [[9.1, 0.18], [9.7, 0.84], [10.1, 0.25], [10.7, 0.78], [11.3, 0.42], [11.9, 0.7]]) {
      y = sy(hh);
      if (y < -30 || y > H + 30) continue;
      const x = xx * W;
      ctx.fillStyle = "#2c57c4";
      ctx.fillRect(x - 20, y - 4, 12, 8);
      ctx.fillRect(x + 8, y - 4, 12, 8);
      ctx.fillStyle = "#e8c35a";
      ctx.fillRect(x - 6, y - 6, 12, 12);
    }
    // The Moon
    y = sy(12.6);
    if (y > -90 && y < H + 90) {
      const x = W * (wide ? 0.78 : 0.3);
      const g = ctx.createRadialGradient(x - 18, y - 18, 8, x, y, 58);
      g.addColorStop(0, "#fbf8ef");
      g.addColorStop(1, "#bdb6a6");
      ctx.fillStyle = g;
      circ(x, y, 56);
      ctx.fillStyle = "rgba(120,112,98,.35)";
      for (const [a, b, r] of [[-16, -10, 9], [14, 12, 12], [18, -20, 6], [-8, 22, 7], [-28, 8, 5]]) circ(x + a, y + b, r);
    }
    // Mars
    y = sy(15);
    if (y > -60 && y < H + 60) {
      const x = W * 0.72;
      const g = ctx.createRadialGradient(x - 10, y - 10, 4, x, y, 34);
      g.addColorStop(0, "#f3a072");
      g.addColorStop(1, "#9c3b22");
      ctx.fillStyle = g;
      circ(x, y, 32);
    }
    // Saturn
    y = sy(17.4);
    if (y > -70 && y < H + 70) {
      const x = W * (wide ? 0.22 : 0.32);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.35);
      ctx.strokeStyle = "rgba(230,205,150,.8)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 58, 14, 0, Math.PI, 6.283);
      ctx.stroke();
      const g = ctx.createRadialGradient(-8, -8, 4, 0, 0, 28);
      g.addColorStop(0, "#f6e2b0");
      g.addColorStop(1, "#b8904a");
      ctx.fillStyle = g;
      circ(0, 0, 27);
      ctx.beginPath();
      ctx.ellipse(0, 0, 58, 14, 0, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    }
    // The Milky Way
    const yc = sy(19.0);
    if (yc > -H && yc < H * 2) {
      ctx.save();
      ctx.translate(W / 2, yc);
      ctx.rotate(-0.5);
      for (const [c, r, a] of [["160,110,255", W * 0.9, 0.22], ["98,182,255", W * 0.6, 0.18], ["255,140,210", W * 0.4, 0.2]] as const) {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, `rgba(${c},${a})`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(-r, -r, 2 * r, 2 * r);
      }
      for (const s of GAL) {
        ctx.fillStyle = s.c > 0.85 ? "rgba(255,200,240,.9)" : "rgba(255,255,255,.8)";
        ctx.fillRect((s.u - 0.5) * W * 2.2, s.v * H * 0.5, s.s, s.s);
      }
      ctx.restore();
    }
  }

  /** A dashed line across the sky at each landmark, with its name and real height. */
  function paintMiles() {
    ctx.save();
    ctx.font = LABEL_FONT;
    ctx.setLineDash([3, 7]);
    ctx.lineWidth = 1;
    const dark = SC.id !== "city" && cam < 1.6;
    for (let i = 1; i < MILES.length; i++) {
      const y = sy(MILES[i].at);
      if (y < 70 || y > H + 8) continue;
      ctx.strokeStyle = dark ? "rgba(40,20,60,.22)" : "rgba(255,255,255,.2)";
      line(0, y, W, y);
      ctx.fillStyle = dark ? "rgba(40,20,60,.6)" : "rgba(255,255,255,.6)";
      ctx.textAlign = wide ? "right" : "left";
      ctx.fillText(`${MILES[i].name} · ${formatDistance(MILES[i].km)}`, wide ? W - 56 : 12, y - 6);
    }
    ctx.restore();
  }

  function cloud(x: number, y: number, s: number, fill: string, lit: string) {
    ctx.fillStyle = fill;
    circ(x, y, 20 * s);
    circ(x + 24 * s, y - 10 * s, 26 * s);
    circ(x + 50 * s, y - 2 * s, 20 * s);
    ctx.fillRect(x, y - 4 * s, 50 * s, 22 * s);
    circ(x - 14 * s, y + 8 * s, 14 * s);
    circ(x + 64 * s, y + 8 * s, 14 * s);
    ctx.fillRect(x - 14 * s, y + 4 * s, 78 * s, 18 * s);
    ctx.fillStyle = lit;
    circ(x + 22 * s, y - 16 * s, 14 * s);
    circ(x + 2 * s, y - 8 * s, 10 * s);
  }

  function paintClouds(t: number) {
    const colors = { city: ["#2b3670", "rgba(120,140,220,.35)"], coast: ["#f2a1a0", "rgba(255,214,170,.9)"], peaks: ["#f6f8ff", "rgba(255,255,255,1)"] }[SC.id];
    for (const c of CLOUDS) {
      const y = sy(c.h) + 22;
      if (y < -60 || y > H + 60) continue;
      const x = wrap(c.x * W + (t || 0) * 0.004 * c.s, W + 180) - 90;
      cloud(x, y, c.s, colors[0], colors[1]);
    }
  }

  function paintFlyers(t: number) {
    const T = t || 0;
    if (SC.id !== "city") {
      // A flock of birds
      const y = sy(0.72);
      if (y > -40 && y < H + 40) {
        ctx.strokeStyle = SC.id === "coast" ? "#3a1f3d" : "#3b3f6e";
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 6; i++) {
          const x = wrap(W * 0.15 + T * 0.03 + i * 16, W + 120) - 60;
          const yy = y + Math.abs(i - 2.5) * 7;
          const f = Math.sin(T * 0.012 + i) * 4;
          ctx.beginPath();
          ctx.moveTo(x - 6, yy - f);
          ctx.quadraticCurveTo(x - 3, yy - 2, x, yy);
          ctx.quadraticCurveTo(x + 3, yy - 2, x + 6, yy - f);
          ctx.stroke();
        }
      }
    }
    if (SC.id === "peaks") {
      // A paraglider
      const y = sy(0.95);
      if (y > -60 && y < H + 60) {
        const x = W * 0.78 + Math.sin(T * 0.0007) * 18;
        ctx.fillStyle = "#ff6b5a";
        ctx.beginPath();
        ctx.ellipse(x, y, 26, 9, 0, Math.PI, 6.283);
        ctx.fill();
        ctx.strokeStyle = "rgba(40,40,70,.7)";
        ctx.lineWidth = 0.8;
        line(x - 24, y, x, y + 26);
        line(x + 24, y, x, y + 26);
        ctx.fillStyle = "#2b2d55";
        circ(x, y + 28, 3);
      }
    }
    // A jet at cruising height
    const yj = sy(3.3);
    if (yj > -30 && yj < H + 30) {
      const x = wrap(T * 0.06, W + 260) - 130;
      const g = ctx.createLinearGradient(x - 200, 0, x, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255,.7)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      line(x - 200, yj, x - 14, yj);
      ctx.fillStyle = SC.id === "peaks" ? "#f2f5ff" : "#c9d2ea";
      ctx.beginPath();
      ctx.moveTo(x + 14, yj);
      ctx.lineTo(x - 14, yj - 3);
      ctx.lineTo(x - 14, yj + 3);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 2, yj);
      ctx.lineTo(x - 6, yj - 10);
      ctx.lineTo(x - 9, yj - 10);
      ctx.lineTo(x - 4, yj);
      ctx.fill();
      if (Math.sin(T * 0.01) > 0.6) {
        ctx.fillStyle = "#ff5b5b";
        circ(x - 6, yj - 10, 2);
      }
    }
  }

  /* ---------- ground scenes ---------- */
  function drawRow(rows: Building[], base: number, color: string, windows: string, t: number) {
    if (base - 200 > H) return;
    ctx.fillStyle = color;
    for (const b of rows) ctx.fillRect(b.x, base - b.h, b.w, H - base + b.h + 2);
    ctx.fillStyle = windows;
    for (const b of rows) {
      for (const [xx, yy, k] of b.win) {
        if (t && k < 0.08 && Math.sin(t * 0.002 + k * 900) > 0.3) continue;
        ctx.fillRect(b.x + xx, base - b.h + yy, 2, 3);
      }
    }
  }

  function palm(x: number, b: number, s: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(x, b);
    ctx.quadraticCurveTo(x + 4 * s, b - 40 * s, x + 14 * s, b - 74 * s);
    ctx.stroke();
    const tx = x + 14 * s;
    const ty = b - 74 * s;
    ctx.lineWidth = 3.2 * s;
    for (const a of [-2.7, -2.1, -1.5, -0.9, -0.35, 0.25]) {
      const l = (30 + Math.abs(a + 1.2) * 6) * s;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a) * l * 0.55, ty - 12 * s, tx + Math.cos(a) * l, ty + Math.sin(a) * l * 0.45 + 14 * s);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  function pine(x: number, b: number, s: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, b - 36 * s);
    ctx.lineTo(x + 10 * s, b - 14 * s);
    ctx.lineTo(x + 5 * s, b - 14 * s);
    ctx.lineTo(x + 13 * s, b);
    ctx.lineTo(x - 13 * s, b);
    ctx.lineTo(x - 5 * s, b - 14 * s);
    ctx.lineTo(x - 10 * s, b - 14 * s);
    ctx.closePath();
    ctx.fill();
  }

  function drawRidge(points: Ridge, base: number, color: string, snow: string | null) {
    if (base - 300 > H) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-10, H);
    for (const [x, hh] of points) ctx.lineTo(x * W, base - hh);
    ctx.lineTo(W + 10, H);
    ctx.closePath();
    ctx.fill();
    if (!snow) return;
    ctx.fillStyle = snow;
    for (let i = 1; i < points.length - 1; i += 2) {
      const p = [points[i][0] * W, base - points[i][1]];
      const l = [points[i - 1][0] * W, base - points[i - 1][1]];
      const r = [points[i + 1][0] * W, base - points[i + 1][1]];
      const k = 0.3;
      const a = [p[0] + (l[0] - p[0]) * k, p[1] + (l[1] - p[1]) * k];
      const c = [p[0] + (r[0] - p[0]) * k, p[1] + (r[1] - p[1]) * k];
      const low = Math.max(a[1], c[1]);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(a[0], a[1]);
      ctx.lineTo(a[0] + (c[0] - a[0]) * 0.3, low + 7);
      ctx.lineTo(a[0] + (c[0] - a[0]) * 0.6, low - 1);
      ctx.lineTo(a[0] + (c[0] - a[0]) * 0.8, low + 5);
      ctx.lineTo(c[0], c[1]);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Detail on the ground in front: reflections in the bay, foam on the sea, snow and rocks in the hills. */
  function fore(b4: number, t: number) {
    if (b4 + 4 > H) return;
    const id = SC.id;
    const hgt = H - b4;
    const g = ctx.createLinearGradient(0, b4, 0, H);
    g.addColorStop(0, { city: "rgba(60,80,170,.28)", coast: "rgba(255,170,140,.16)", peaks: "rgba(160,170,240,.14)" }[id]);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, b4, W, hgt);
    if (id === "city") {
      for (let i = 0; i < 90; i++) {
        const x = (i * 97.3) % W;
        const yy = b4 + 8 + ((i * 29) % Math.max(24, hgt - 14));
        const w = 5 + (i % 5) * 5;
        const s = t ? Math.sin(t * 0.003 + i) * 3 : 0;
        ctx.fillStyle = `rgba(255,210,122,${0.07 + (i % 3) * 0.05})`;
        ctx.fillRect(x + s, yy, w, 1.5);
      }
      ctx.fillStyle = "rgba(120,150,255,.25)";
      ctx.fillRect(0, b4, W, 1);
    }
    if (id === "coast") {
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        const yy = b4 + 10 + k * Math.max(8, hgt / 5);
        ctx.strokeStyle = `rgba(255,225,205,${0.16 - k * 0.03})`;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 12) {
          const yv = yy + Math.sin(x * 0.02 + k * 2 + (t || 0) * 0.0012) * 3;
          if (x) ctx.lineTo(x, yv);
          else ctx.moveTo(x, yv);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = "rgba(255,220,190,.22)";
        circ((i * 173.7) % W, b4 + hgt * 0.55 + ((i * 37) % Math.max(10, hgt * 0.4)), 1.6);
      }
    }
    if (id === "peaks") {
      ctx.fillStyle = "rgba(200,205,255,.10)";
      ctx.beginPath();
      ctx.moveTo(RX - 30, b4 + 12);
      ctx.quadraticCurveTo(RX - W * 0.08, b4 + hgt * 0.5, RX - W * 0.2, H + 2);
      ctx.lineTo(RX - W * 0.1, H + 2);
      ctx.quadraticCurveTo(RX + 4, b4 + hgt * 0.5, RX + 30, b4 + 12);
      ctx.fill();
      for (let i = 0; i < 26; i++) {
        const x = (i * 131.9) % W;
        const yy = b4 + 10 + ((i * 41) % Math.max(20, hgt - 12));
        if (Math.abs(x - RX) < 70 && yy < b4 + 30) continue;
        ctx.fillStyle = i % 3 ? "rgba(10,12,40,.45)" : "rgba(240,244,255,.18)";
        ctx.beginPath();
        ctx.ellipse(x, yy, 4 + (i % 4) * 3, 2 + (i % 3), 0, 0, 6.283);
        ctx.fill();
      }
    }
  }

  function groundCity(t: number) {
    const my = H * 0.2 + cam * P * 0.13;
    if (cam < 3.5 && my < H + 30) {
      ctx.fillStyle = "#f6f0da";
      circ(W * 0.8, my, 17);
      ctx.fillStyle = colorAt(SKY.city, hAtY(my));
      circ(W * 0.8 + 7, my - 5, 15.5);
    }
    drawRow(SC.far, gl(0.22), "#1c2760", "rgba(255,214,150,.3)", t);
    const b2 = gl(0.45);
    if (b2 - 240 < H) {
      drawRow(SC.mid, b2, "#111b48", "rgba(255,214,150,.6)", t);
      ctx.fillStyle = "#111b48";
      // A domed monument with two minarets, and a TV tower with a blinking light
      const dx = W * 0.2;
      ctx.fillRect(dx - 26, b2 - 60, 52, 62);
      circ(dx, b2 - 60, 24);
      ctx.fillRect(dx - 1.5, b2 - 96, 3, 14);
      for (const o of [-34, 34]) {
        ctx.fillRect(dx + o - 4, b2 - 92, 8, 94);
        circ(dx + o, b2 - 92, 5);
      }
      const tx = W * 0.7;
      ctx.fillRect(tx - 9, b2 - 220, 18, 222);
      ctx.fillRect(tx - 1, b2 - 262, 2, 44);
      if (!t || Math.sin(t * 0.005) > 0) {
        ctx.fillStyle = "#ff4b4b";
        circ(tx, b2 - 262, 2.6);
      }
    }
    const b3 = gl(0.7);
    if (b3 - 20 < H) {
      // The bay and its necklace of lights
      ctx.fillStyle = "#0b1438";
      ctx.fillRect(0, b3 - 8, W, H);
      for (let i = 0; i <= 44; i++) {
        const x = (i / 44) * W;
        const y = b3 - 6 - Math.sin((i / 44) * Math.PI) * 10;
        ctx.fillStyle = "rgba(255,210,122,.25)";
        circ(x, y, 4);
        ctx.fillStyle = "#ffd27a";
        circ(x, y, 1.4);
      }
      ctx.fillStyle = "rgba(255,210,122,.12)";
      for (let i = 0; i < 30; i++) ctx.fillRect((i * 37) % W, b3 + 4 + (i % 4) * 5, 1.5, 8);
    }
    const b4 = gl(1);
    if (b4 - 90 < H) {
      ctx.fillStyle = GROUND.city;
      ctx.fillRect(0, b4, W, H);
      fore(b4, t);
      palm(W * 0.06, b4, 1, "#050816");
      palm(W * 0.9, b4, 1.15, "#050816");
    }
  }

  function groundCoast(t: number) {
    const sx = W * 0.62;
    const sY = gl(0.16) - 74;
    if (sY - 120 < H) {
      const g = ctx.createRadialGradient(sx, sY, 10, sx, sY, 170);
      g.addColorStop(0, "rgba(255,230,170,.65)");
      g.addColorStop(1, "rgba(255,170,120,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - 170, sY - 170, 340, 340);
      ctx.fillStyle = "#ffe0a0";
      circ(sx, sY, 44);
    }
    const hz = gl(0.4) - 48;
    if (hz < H) {
      ctx.fillStyle = "#5a3466";
      for (const [a, b, hh] of SC.isl) {
        ctx.beginPath();
        ctx.moveTo(a * W, hz);
        ctx.quadraticCurveTo(((a + b) / 2) * W, hz - hh * 1.6, b * W, hz);
        ctx.fill();
      }
      const g = ctx.createLinearGradient(0, hz, 0, hz + 120);
      g.addColorStop(0, "#8a5288");
      g.addColorStop(1, "#3d2249");
      ctx.fillStyle = g;
      ctx.fillRect(0, hz, W, H);
      for (let i = 0; i < 12; i++) {
        const w = 78 - i * 5 + (t ? Math.sin(t * 0.003 + i) * 6 : 0);
        ctx.fillStyle = `rgba(255,214,150,${0.55 - i * 0.04})`;
        ctx.fillRect(sx - w / 2, hz + 5 + i * 6, w, 2.5);
      }
    }
    const lb = gl(0.85);
    if (lb - 110 < H) {
      // A lighthouse on the rocks, its beam sweeping
      const lx = W * 0.86;
      ctx.fillStyle = "#2a1531";
      ctx.beginPath();
      ctx.ellipse(lx, lb + 4, 40, 14, 0, Math.PI, 6.283);
      ctx.fill();
      ctx.fillRect(lx - 40, lb + 4, 80, H);
      ctx.fillStyle = "#f3e6dc";
      ctx.beginPath();
      ctx.moveTo(lx - 10, lb);
      ctx.lineTo(lx - 6, lb - 72);
      ctx.lineTo(lx + 6, lb - 72);
      ctx.lineTo(lx + 10, lb);
      ctx.fill();
      ctx.fillStyle = "#d9485a";
      ctx.fillRect(lx - 9, lb - 24, 18, 10);
      ctx.fillRect(lx - 7.5, lb - 52, 15, 10);
      ctx.fillStyle = "#3a2030";
      ctx.fillRect(lx - 8, lb - 84, 16, 12);
      ctx.fillStyle = "#fff3c0";
      ctx.fillRect(lx - 5, lb - 82, 10, 8);
      const a = t ? t * 0.0016 : 2.6;
      const len = 260;
      ctx.fillStyle = "rgba(255,240,190,.13)";
      ctx.beginPath();
      ctx.moveTo(lx, lb - 78);
      ctx.lineTo(lx + Math.cos(a) * len, lb - 78 + Math.sin(a) * len * 0.25 - 22);
      ctx.lineTo(lx + Math.cos(a) * len, lb - 78 + Math.sin(a) * len * 0.25 + 22);
      ctx.closePath();
      ctx.fill();
    }
    const b4 = gl(1);
    if (b4 - 110 < H) {
      ctx.fillStyle = GROUND.coast;
      ctx.beginPath();
      ctx.moveTo(0, b4 + 2);
      for (let x = 0; x <= W; x += W / 8) ctx.lineTo(x, b4 - 3 * Math.sin(x * 0.03));
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();
      fore(b4, t);
      palm(W * 0.07, b4, 1.05, "#1c0d22");
      palm(W * 0.19, b4, 0.75, "#1c0d22");
      palm(W * 0.93, b4, 0.95, "#1c0d22");
    }
  }

  function groundPeaks(t: number) {
    drawRidge(SC.r1, gl(0.1), "#bab7dc", "#f7f8ff");
    const mb = gl(0.2) - 30;
    if (mb - 60 < H) {
      const g = ctx.createLinearGradient(0, mb - 50, 0, mb + 20);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,240,245,.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, mb - 50, W, 70);
    }
    drawRidge(SC.r2, gl(0.26), "#8e8ec2", "#eceeff");
    drawRidge(SC.r3, gl(0.48), "#5f639b", null);
    const fb = gl(0.75);
    if (fb - 60 < H) {
      ctx.fillStyle = "#3a3d70";
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 12) ctx.lineTo(x, fb - 14 - 10 * Math.sin(x * 0.02 + 1));
      ctx.lineTo(W, H);
      ctx.fill();
      for (const p of SC.pines) pine(p.x * W, fb - 6 - 8 * Math.sin(p.x * W * 0.02 + 1), p.s * 0.8, "#2b2d5c");
    }
    const b4 = gl(1);
    if (b4 - 100 < H) {
      ctx.fillStyle = GROUND.peaks;
      ctx.fillRect(0, b4, W, H);
      fore(b4, t);
      pine(W * 0.06, b4, 1.3, "#14162f");
      pine(W * 0.15, b4, 0.95, "#14162f");
      pine(W * 0.93, b4, 1.4, "#14162f");
      // Prayer flags strung between two poles
      const x0 = W * 0.03;
      const x1 = W * 0.4;
      const y0 = b4 - 78;
      const y1 = b4 - 38;
      ctx.strokeStyle = "#8a7f9c";
      ctx.lineWidth = 2;
      line(x0, b4, x0, y0);
      line(x1, b4, x1, y1);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(60,50,80,.7)";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 16, x1, y1);
      ctx.stroke();
      const flags = ["#3f7fe0", "#f5f5f5", "#e04848", "#3fae6a", "#f2c94c"];
      for (let i = 1; i < 12; i++) {
        const k = i / 12;
        const x = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * ((x0 + x1) / 2) + k * k * x1;
        const y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * ((y0 + y1) / 2 + 16) + k * k * y1;
        const f = t ? Math.sin(t * 0.008 + i) * 2 : 0;
        ctx.fillStyle = flags[i % 5];
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x + f, y + 11);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawPad() {
    const b = sy(0);
    if (b - 110 > H) return;
    const x = RX;
    const gx = x + 30;
    const g = ctx.createRadialGradient(x, b, 0, x, b, 130);
    g.addColorStop(0, "rgba(255,220,160,.2)");
    g.addColorStop(1, "rgba(255,220,160,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 130, b - 130, 260, 150);
    ctx.fillStyle = "#2e3346";
    ctx.beginPath();
    ctx.moveTo(x - 56, b + 12);
    ctx.lineTo(x - 44, b);
    ctx.lineTo(x + 44, b);
    ctx.lineTo(x + 56, b + 12);
    ctx.fill();
    ctx.fillStyle = "#ffd27a";
    for (const o of [-40, -20, 20, 40]) circ(x + o, b + 6, 1.6);
    ctx.strokeStyle = "#5b627c";
    ctx.lineWidth = 2;
    line(gx, b, gx, b - 94);
    line(gx + 12, b, gx + 12, b - 94);
    ctx.lineWidth = 1;
    for (let y = b; y > b - 92; y -= 14) {
      line(gx, y, gx + 12, y - 14);
      line(gx + 12, y, gx, y - 14);
    }
    ctx.fillStyle = "#ffd27a";
    circ(gx + 6, b - 97, 2.4);
  }

  /** Faint outlines of other climbers parked at their heights, with a name under each. */
  function paintGhosts() {
    if (ghosts.length === 0) return;
    ctx.save();
    ctx.font = GHOST_FONT;
    ctx.textAlign = "center";
    ghosts.forEach((ghost, index) => {
      const y = sy(ghost.progress * STOP);
      if (y < 70 || y > H + 40) return;
      const lanes = wide ? [RX - 120, RX + 120, RX - 200, RX + 200] : [W * 0.2, W * 0.8, W * 0.32, W * 0.68];
      const x = lanes[index % lanes.length];
      if (ghost.paint) {
        // A friend's ghost flies in their own paint job, a little see-through.
        ctx.save();
        ctx.globalAlpha = 0.7;
        drawShip(x, y, 0.55, ghost.paint, -1);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(0.55, 0.55);
        ctx.globalAlpha = 0.85;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = ghost.color;
        ctx.stroke(new Path2D(BODY_PATH));
        ctx.restore();
      }
      ctx.fillStyle = ghost.color;
      ctx.fillText(ghost.label, x, y + 14);
    });
    ctx.restore();
  }

  /* ---------- rocket and effects ---------- */
  function drawRocket(x: number, y: number, power: number, tier: number, t: number, boost = false) {
    ctx.save();
    ctx.translate(x, y);
    const c = tier >= 0 ? tierColor(tier) : "#ffb35c";
    if (boost && power > 0) {
      // Afterburner: a white-hot core and a ring of shock diamonds under the flame.
      const L = (30 + 50 * power) * (0.9 + 0.1 * Math.sin((t || 0) * 0.09));
      const g = ctx.createLinearGradient(0, 0, 0, L);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, "#ffb347");
      g.addColorStop(1, "#ff5a1f00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.quadraticCurveTo(0, L * 1.5, 12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff6d8cc";
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.ellipse(0, k * L * 0.28, 4.5 - k, 2.4, 0, 0, 6.283);
        ctx.fill();
      }
    }
    if (power > 0) {
      const L = (16 + 34 * power) * (0.85 + 0.15 * Math.sin((t || 0) * 0.06));
      const w = 5 + 4 * power;
      const glow = ctx.createRadialGradient(0, 10, 0, 0, 10, 24 + 40 * power);
      glow.addColorStop(0, c + "77");
      glow.addColorStop(1, c + "00");
      ctx.fillStyle = glow;
      ctx.fillRect(-70, -50, 140, 140);
      const g = ctx.createLinearGradient(0, 0, 0, L);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.3, c);
      g.addColorStop(1, c + "00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.quadraticCurveTo(0, L * 1.35, w, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    drawShip(x, y, 1, paint, lastTier);
  }

  /** The rocket itself in a paint job, nose up with its base at (x, y). `band` is a tier whose colour rings the body, or -1. */
  function drawShip(x: number, y: number, scale: number, look: RocketPaint, band: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = look.accent;
    ctx.beginPath();
    ctx.moveTo(-8.5, -24);
    ctx.lineTo(-17, -1);
    ctx.lineTo(-8.5, -7);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8.5, -24);
    ctx.lineTo(17, -1);
    ctx.lineTo(8.5, -7);
    ctx.closePath();
    ctx.fill();
    const body = ctx.createLinearGradient(-11, 0, 11, 0);
    body.addColorStop(0, look.body[0]);
    body.addColorStop(0.45, look.body[1]);
    body.addColorStop(1, look.body[2]);
    ctx.fillStyle = body;
    ctx.fill(BODY);
    ctx.save();
    ctx.clip(BODY);
    ctx.fillStyle = look.accent;
    ctx.fillRect(-14, -60, 28, 13);
    if (look.pattern === "stripes") {
      ctx.globalAlpha = 0.8;
      ctx.fillRect(-14, -27, 28, 3);
      ctx.globalAlpha = 1;
    } else if (look.pattern === "stars") {
      circ(-4, -18, 1.2);
      circ(5, -24, 1);
      circ(2, -44, 0.9);
    } else if (look.pattern === "craters") {
      ctx.fillStyle = "#00000022";
      circ(-4, -19, 2.4);
      circ(5, -13, 1.8);
      circ(4, -44, 1.4);
    }
    // A band in the colour of your last tier
    if (band >= 0) {
      ctx.fillStyle = tierColor(band);
      ctx.fillRect(-14, -21, 28, 5);
    }
    ctx.restore();
    ctx.fillStyle = look.window;
    circ(0, -34, 5);
    ctx.strokeStyle = "#cfd6ea";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -34, 5, 0, 6.283);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.75)";
    circ(-1.6, -35.6, 1.5);
    ctx.fillStyle = "#5b6278";
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.lineTo(6, -6);
    ctx.lineTo(7.5, 0);
    ctx.lineTo(-7.5, 0);
    ctx.fill();
    ctx.restore();
  }

  function rocketPower(): number {
    if (!climb) return 0;
    const p = climb.p;
    if (climb.miss) return p < 0.45 && Math.random() < 0.5 ? 0.25 : 0;
    const ramp = Math.min(1, p / 0.12);
    const fade = p > 0.85 ? Math.max(0, (1 - p) / 0.15) : 1;
    const boost = climb.boost ? 1.3 : 1;
    return boost * POWER[Math.max(0, Math.min(POWER.length - 1, climb.tier))] * Math.max(0.25, ramp) * Math.max(0.15, fade);
  }

  function burst(c: string) {
    ring = { t0: performance.now(), c };
    if (reduce) return;
    const y = sy(h) - 30;
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * 6.283;
      const v = 1.5 + Math.random() * 3.5;
      sparks.push({ x: RX, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c });
    }
  }

  function effects(dt: number, power: number) {
    const rx = RX;
    const ry = sy(h);
    if (!reduce && climb) {
      const n = climb.miss ? (Math.random() < 0.25 ? 1 : 0) : power * 2.2;
      const color = climb.miss ? "#9aa0b4" : tierColor(climb.tier);
      for (let i = 0; i < n; i++) {
        exhaust.push({
          x: rx + (Math.random() - 0.5) * 7,
          y: ry + 6,
          vx: (Math.random() - 0.5) * 0.8 + (h < 0.05 ? (Math.random() - 0.5) * 3 : 0),
          vy: 1.2 + Math.random() * 2.4,
          life: 1,
          s: 3 + Math.random() * 3,
          c: color,
        });
      }
    }
    for (let i = exhaust.length - 1; i >= 0; i--) {
      const e = exhaust[i];
      e.x += e.vx;
      e.y += e.vy;
      e.s += 0.25;
      e.life -= dt * 1.6;
      if (e.life <= 0) {
        exhaust.splice(i, 1);
        continue;
      }
      ctx.fillStyle = e.life > 0.6 ? e.c + alphaHex(e.life * 200) : `rgba(170,176,196,${e.life * 0.35})`;
      circ(e.x, e.y, e.s);
    }
    if (climb && climb.v > 0.35 && !reduce) {
      // Speed streaks
      const v = climb.v;
      const n = Math.min(26, Math.floor(v * 7));
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.32, 0.07 + v * 0.07)})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        line(x, y, x, y + 18 + v * 26);
      }
    }
    if (ring) {
      const k = (performance.now() - ring.t0) / 700;
      if (k >= 1) ring = null;
      else {
        ctx.strokeStyle = ring.c + alphaHex((1 - k) * 230);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(rx, ry - 30, 20 + 150 * k, 0, 6.283);
        ctx.stroke();
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.04;
      s.life -= dt * 0.9;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.fillStyle = s.c;
      ctx.globalAlpha = s.life;
      circ(s.x, s.y, 2.2);
      ctx.globalAlpha = 1;
    }
  }

  /** The path climbed so far, one stretch per answer in its tier's colour. It grows with the rocket. */
  function drawTrail() {
    ctx.save();
    ctx.lineCap = "round";
    for (const segment of trail) {
      const a = segment.from * STOP;
      const b = Math.min(segment.to * STOP, h);
      if (b <= a + 1e-4) continue;
      const y0 = sy(a);
      const y1 = sy(b);
      if (y1 > H || (y0 < 0 && y1 < 0)) continue;
      const c = tierColor(segment.tier);
      ctx.strokeStyle = c + "55";
      ctx.lineWidth = 8;
      line(RX, Math.min(H + 10, y0), RX, y1);
      ctx.strokeStyle = c + "cc";
      ctx.lineWidth = 2.5;
      line(RX, Math.min(H + 10, y0), RX, y1);
    }
    ctx.restore();
  }

  function syncPassed() {
    passedIdx = 0;
    for (let i = 0; i < MILES.length; i++) if (MILES[i].at <= h + 1e-6) passedIdx = i;
  }

  function stepClimb(now: number) {
    if (!climb) return;
    const c = climb;
    const p = c.dur ? clamp01((now - c.t0) / c.dur) : 1;
    const prev = h;
    if (c.miss) h = c.from - 0.03 * Math.sin(Math.min(1, p * 1.6) * Math.PI);
    else {
      const ignition = c.replay ? 0 : 0.12;
      h = p < ignition ? c.from : c.from + ease((p - ignition) / (1 - ignition)) * c.d;
    }
    c.v = (h - prev) * 60;
    c.p = p;
    while (passedIdx < MILES.length - 1 && MILES[passedIdx + 1].at <= h + 1e-6) {
      passedIdx++;
      if (!c.miss && !c.replay) api.onMilestone?.(passedIdx);
    }
    if (p >= 1) {
      climb = null;
      h = c.from + (c.miss ? 0 : c.d);
      if (!c.miss && !c.replay) {
        lastTier = c.tier;
        if (c.boost) burst("#ffb347");
        else if (c.tier >= 3) burst(tierColor(c.tier));
      }
      c.onLand?.();
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    render(now);
  }

  function render(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const moving = climb !== null || sparks.length > 0 || exhaust.length > 0 || ring !== null;
    if (reduce && !dirty && !moving) return;
    dirty = false;
    const t = reduce ? 0 : now;
    stepClimb(now);
    const before = cam;
    anc += (ancTarget - anc) * (reduce ? 1 : Math.min(1, dt * 5));
    if (climb) {
      const limit = h - ((anc - 0.5) * H) / P;
      if (cam < limit) cam += (limit - cam) * (reduce ? 1 : 0.2);
    } else cam += (h - cam) * (reduce ? 1 : Math.min(1, dt * 3));
    if (Math.abs(cam - h) < 1e-4) cam = h;
    const shift = (cam - before) * P;
    for (const e of exhaust) e.y += shift;
    for (const s of sparks) s.y += shift;
    const power = rocketPower();
    ctx.save();
    if (climb && climb.tier === 4 && !climb.miss && !climb.replay && climb.p > 0.12 && climb.p < 0.85 && !reduce) {
      ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    }
    paintSky(t);
    paintSpace(t);
    if (SC.id === "city") groundCity(t);
    else if (SC.id === "coast") groundCoast(t);
    else groundPeaks(t);
    paintClouds(t);
    paintFlyers(t);
    paintMiles();
    paintGhosts();
    drawTrail();
    drawPad();
    effects(dt, power);
    const sway = climb && !climb.miss ? Math.sin(climb.p * Math.PI * 4) * 2 * power : 0;
    const flying = climb ? climb.tier : lastTier;
    drawRocket(RX + sway, sy(h), power, flying, t, climb?.boost === true && !climb.miss);
    ctx.restore();
    api.onFrame?.({ progress: h / STOP, from: lastFrom / STOP, x: RX + sway, y: sy(h), climbing: climb !== null && !climb.replay });
  }

  const api: Sky = {
    onFrame: null,
    onMilestone: null,
    resize(width, height, isWide) {
      W = Math.max(1, width);
      H = Math.max(1, height);
      P = H * 0.95;
      wide = isWide;
      RX = W / 2;
      const dpr = options.pixelRatio ?? Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildScene(SC.id);
      dirty = true;
    },
    setScene(scene) {
      if (scene === SC.id) return;
      buildScene(scene);
      dirty = true;
    },
    setAnchor(share) {
      ancTarget = share;
      if (!anchored || reduce) anc = share;
      anchored = true;
      dirty = true;
    },
    setTrail(next) {
      trail = next;
      if (lastTier < 0) {
        const scored = next.filter((segment) => segment.to > segment.from);
        if (scored.length > 0) lastTier = scored[scored.length - 1].tier;
      }
      dirty = true;
    },
    setGhosts(next) {
      ghosts = next;
      dirty = true;
    },
    setPaint(next) {
      paint = next;
      dirty = true;
    },
    draw() {
      cam = h;
      anc = ancTarget;
      dirty = true;
      render(performance.now());
    },
    jump(progress) {
      climb = null;
      h = progress * STOP;
      cam = h;
      lastFrom = h;
      syncPassed();
      dirty = true;
    },
    climb({ from, to, tier, replay = false, boost = false, onLand }) {
      const start = from * STOP;
      const d = Math.max(0, (to - from) * STOP);
      const miss = !replay && (tier < 0 || d <= 0);
      h = start;
      lastFrom = start;
      if (replay) cam = start;
      syncPassed();
      const dur = reduce ? 0 : replay ? replayMs(to - from) : climbMs(miss ? 0 : to - from);
      climb = { from: start, d, t0: performance.now() + (reduce || replay ? 0 : IGNITION_MS), dur, tier, miss, replay, boost: boost && !miss, v: 0, p: 0, onLand };
      dirty = true;
      if (reduce) stepClimb(performance.now());
    },
    progress() {
      return h / STOP;
    },
    destroy() {
      cancelAnimationFrame(raf);
      api.onFrame = null;
      api.onMilestone = null;
    },
  };

  if (!options.still) raf = requestAnimationFrame(frame);
  return api;
}
