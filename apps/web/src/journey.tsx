import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { EXPLORER_Y, FAR_RATE, FRONT_RATE, STEP, WORLD_H, WORLD_STOPS, WORLD_W, WorldFar, WorldFront, WorldMain, explorerX, toSuper } from "./worlds";
import "./journey.css";

export type Hop = { id: number; kind: "idle" | "voyage" | "stumble"; travel: number };
export type Ghost = { id: "best" | "average" | "top"; label: string; progress: number };
export type Mission = { target: number };
type Motion = "idle" | "voyage" | "stumble" | "replay";

const SOUND_KEY = "ballpark.sound";
const STOPS = WORLD_STOPS.length;
const PAD = 400;
/** The scene is at most this share of the screen. The world is scaled so it fills that height. */
const SCENE_MAX = 0.8;
const VOYAGE_MS = 2300;
const STUMBLE_MS = 1700;
const REPLAY_MS = 3600;
const ROUTE_POINTS = 1600;

type Pose = { v: number; cam: number; dy: number; rot: number; sx: number; sy: number; jx: number };
type Toast = { id: number; title: string; detail: string; tone: "world" | "pass" | "mission" };

const REST: Omit<Pose, "v" | "cam"> = { dy: 0, rot: 0, sx: 1, sy: 1, jx: 0 };

export function Journey({
  progress,
  hop,
  overview,
  page,
  mission,
  ghosts = [],
  children,
}: {
  /** 0 is the atom. Each correct answer adds 1. A miss adds about a third. */
  progress: number;
  hop: Hop;
  overview: boolean;
  /** Changes whenever the card below the scene shows a new screen, so it starts scrolled to the top. */
  page: string;
  /** Today's target world, by stop index. */
  mission?: Mission | null;
  /** Faint probes for your best run, today's average player and today's best player. */
  ghosts?: Ghost[];
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<SVGSVGElement>(null);
  const mainRef = useRef<SVGSVGElement>(null);
  const frontRef = useRef<SVGSVGElement>(null);
  const explorerRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<SVGPolylineElement>(null);
  const markerRef = useRef<HTMLElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const powerRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const route = useRef<Array<[number, number]>>([]);
  const size = useRef({ w: 390, h: 520, k: 1 });
  const pose = useRef<Pose>({ v: progress, cam: progress, ...REST });
  const landedRef = useRef(-1);
  const ghostsRef = useRef(ghosts);
  const missionRef = useRef(mission);
  const [k, setK] = useState(1);
  const [motion, setMotion] = useState<Motion>("idle");
  const [landed, setLanded] = useState(() => clampStop(progress));
  const [arrived, setArrived] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [sound, setSound] = useState(() => readSound());

  ghostsRef.current = ghosts;
  missionRef.current = mission;

  useEffect(() => {
    const stage = stageRef.current;
    const scene = sceneRef.current;
    if (!stage || !scene) return;
    const measure = () => {
      const nextK = Math.max(0.45, (stage.clientHeight * SCENE_MAX) / WORLD_H);
      size.current = { w: scene.clientWidth || 390, h: scene.clientHeight || 520, k: nextK };
      setK(nextK);
      draw();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  /** Puts every layer and the probe where the current pose says. Runs every frame while flying. */
  function draw() {
    const { w, h, k: scale } = size.current;
    const p = pose.current;
    const anchor = Math.min(w * 0.36, 260);
    const camLeft = explorerX(p.cam) - anchor / scale;
    if (farRef.current) farRef.current.style.transform = `translate3d(${(-camLeft * FAR_RATE - PAD) * scale}px, -50%, 0)`;
    if (mainRef.current) mainRef.current.style.transform = `translate3d(${(-camLeft - PAD) * scale}px, -50%, 0)`;
    if (frontRef.current) frontRef.current.style.transform = `translate3d(${(-camLeft * FRONT_RATE - PAD) * scale}px, -50%, 0)`;
    const ex = (explorerX(p.v) + p.jx - camLeft) * scale;
    const ey = h / 2 + (EXPLORER_Y - WORLD_H / 2 + p.dy) * scale;
    if (explorerRef.current) {
      explorerRef.current.style.transform = `translate3d(${ex}px, ${ey}px, 0) translate(-50%, -50%) rotate(${p.rot}deg) scale(${p.sx}, ${p.sy})`;
    }
    const share = Math.max(0, Math.min(1, p.v / (STOPS - 1)));
    if (markerRef.current) markerRef.current.style.left = `${share * 100}%`;
    if (fillRef.current) fillRef.current.style.width = `${share * 100}%`;
    const stop = clampStop(p.v);
    if (stop !== landedRef.current) {
      landedRef.current = stop;
      const info = WORLD_STOPS[stop]!;
      if (labelRef.current) labelRef.current.textContent = info.label;
      if (powerRef.current) powerRef.current.textContent = `10${toSuper(info.power)} m · ${info.size}`;
    }
  }

  function pushRoute() {
    const p = pose.current;
    const point: [number, number] = [explorerX(p.v) + p.jx - 18, EXPLORER_Y + p.dy];
    const last = route.current[route.current.length - 1];
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 3) return;
    route.current.push(point);
    if (route.current.length > ROUTE_POINTS) route.current.shift();
    routeRef.current?.setAttribute("points", route.current.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "));
  }

  function resetRoute(to: number) {
    route.current = [[explorerX(0) - 18, EXPLORER_Y]];
    if (to > 0) route.current.push([explorerX(to) - 18, EXPLORER_Y]);
    routeRef.current?.setAttribute("points", route.current.map(([x, y]) => `${x},${y}`).join(" "));
  }

  /** What changed by flying from `from` to `to`: a new world, a ghost overtaken, or today's mission. */
  function announce(from: number, to: number) {
    const target = missionRef.current?.target;
    if (target !== undefined && from < target - 0.001 && to >= target - 0.001) {
      setToast({ id: Date.now(), title: "Mission complete", detail: `You reached ${WORLD_STOPS[target]!.label}`, tone: "mission" });
      return;
    }
    const passed = ghostsRef.current.filter((ghost) => from < ghost.progress && to >= ghost.progress).sort((a, b) => b.progress - a.progress)[0];
    if (passed) {
      setToast({ id: Date.now(), title: `Passed ${passed.label.toLowerCase()}`, detail: `${formatDistance(passed.progress)} out`, tone: "pass" });
      return;
    }
    const before = clampStop(from);
    const after = clampStop(to);
    if (after > before) {
      const info = WORLD_STOPS[after]!;
      setToast({ id: Date.now(), title: `New world · ${info.label}`, detail: `10${toSuper(info.power)} m · ${info.size}`, tone: "world" });
    }
  }

  function run(kind: Motion, from: number, to: number, duration: number) {
    const start = performance.now();
    const d = to - from;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      pose.current = kind === "stumble" ? stumblePose(t, from, d) : kind === "replay" ? replayPose(t, from, d) : voyagePose(t, from, d);
      keepInFrame();
      draw();
      pushRoute();
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        pose.current = { v: to, cam: to, ...REST };
        draw();
        pushRoute();
        setMotion("idle");
        setLanded(clampStop(to));
        setArrived((value) => value + 1);
        if (kind !== "replay") announce(from, to);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }

  /** The camera lags so the probe visibly crosses the screen, but it never leaves the frame. */
  function keepInFrame() {
    const { w, k: scale } = size.current;
    const p = pose.current;
    const anchor = Math.min(w * 0.36, 260);
    const maxLead = (w * 0.8 - anchor) / scale;
    const lead = (p.v - p.cam) * STEP;
    if (lead > maxLead) p.cam = p.v - maxLead / STEP;
    if (lead < -anchor / scale + 40) p.cam = p.v + (anchor / scale - 40) / STEP;
  }

  useEffect(() => {
    const from = pose.current.v;
    const to = progress;
    if (overview) return;
    if (reduced || Math.abs(to - from) < 0.001 || Math.abs(to - from) > 2.2 || to < from) {
      pose.current = { v: to, cam: to, ...REST };
      resetRoute(to);
      draw();
      setLanded(clampStop(to));
      return;
    }
    const kind = hop.kind === "stumble" ? "stumble" : "voyage";
    setMotion(kind);
    if (sound) playHop(kind);
    return run(kind, from, to, kind === "stumble" ? STUMBLE_MS : VOYAGE_MS);
  }, [progress, hop.id]);

  /** The end screen replays the whole trip from the atom to where the run landed. */
  useEffect(() => {
    if (!overview) return;
    const to = progress;
    if (reduced || to < 0.5) {
      pose.current = { v: to, cam: to, ...REST };
      draw();
      setLanded(clampStop(to));
      return;
    }
    setMotion("replay");
    pose.current = { v: 0, cam: 0, ...REST };
    resetRoute(0);
    draw();
    return run("replay", 0, to, Math.min(REPLAY_MS, 900 + to * 420));
  }, [overview]);

  useLayoutEffect(() => {
    draw();
  });

  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 });
  }, [page]);

  const flying = motion !== "idle";
  const stageClass = ["stage", `is-${motion}`, flying && motion !== "replay" ? "is-focus" : "", reduced ? "quiet" : "", overview ? "is-overview" : ""].join(" ");
  const info = WORLD_STOPS[landed]!;
  const target = mission ? WORLD_STOPS[mission.target] : null;
  const missionDone = mission ? landed >= mission.target && progress >= mission.target - 0.001 : false;

  return (
    <div className={stageClass} ref={stageRef}>
      <div className="scene" ref={sceneRef}>
        <svg ref={farRef} className="layer" style={layerStyle(WORLD_W * FAR_RATE, k)} viewBox={`${-PAD} 0 ${WORLD_W * FAR_RATE + PAD * 2} ${WORLD_H}`} aria-hidden="true">
          <WorldFar />
        </svg>
        <svg ref={mainRef} className="layer" style={layerStyle(WORLD_W, k)} viewBox={`${-PAD} 0 ${WORLD_W + PAD * 2} ${WORLD_H}`} aria-hidden="true">
          <WorldMain />
          {target && mission ? <MissionFlag x={explorerX(mission.target)} label={target.label} /> : null}
          {ghosts.map((ghost, index) => (
            <GhostProbe key={ghost.id} ghost={ghost} lane={index} />
          ))}
          <polyline ref={routeRef} className={`route-trace ${motion}`} points="" />
        </svg>
        <div className={`explorer ${motion}`} ref={explorerRef} aria-hidden="true">
          <Probe />
          {motion === "stumble" ? <Smoke /> : null}
        </div>
        <svg ref={frontRef} className="layer front" style={layerStyle(WORLD_W * FRONT_RATE, k)} viewBox={`${-PAD} 0 ${WORLD_W * FRONT_RATE + PAD * 2} ${WORLD_H}`} aria-hidden="true">
          <WorldFront />
        </svg>
        <div className="speedlines" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <i key={index} style={{ top: `${12 + index * 10}%`, animationDelay: `${(index * 73) % 400}ms` }} />
          ))}
        </div>
        {motion === "stumble" ? <div className="miss-flash" key={hop.id} /> : null}
        {toast ? (
          <div className={`toast ${toast.tone}`} key={toast.id} role="status">
            <strong>{toast.title}</strong>
            <span>{toast.detail}</span>
          </div>
        ) : null}
        <div className="hud">
          <p className="where" key={arrived}>
            <span className="power" ref={powerRef}>
              10{toSuper(info.power)} m · {info.size}
            </span>
            <span className="place" ref={labelRef}>
              {info.label}
            </span>
          </p>
          {target ? (
            <p className={missionDone ? "mission done" : "mission"}>
              <small>{missionDone ? "Mission complete" : "Today’s mission"}</small>
              <span>Reach {target.label}</span>
            </p>
          ) : null}
        </div>
        <div className="route" aria-hidden="true">
          <div className="route-line">
            <b ref={fillRef} />
            {WORLD_STOPS.map((stop, index) => (
              <i key={stop.id} className={index <= landed ? "passed" : ""} style={{ left: `${(index / (STOPS - 1)) * 100}%` }} />
            ))}
            {mission ? <s className="flag" style={{ left: `${(mission.target / (STOPS - 1)) * 100}%` }} /> : null}
            {ghosts.map((ghost) => (
              <u key={ghost.id} className={`ghost-tick ${ghost.id}`} style={{ left: `${(Math.min(STOPS - 1, ghost.progress) / (STOPS - 1)) * 100}%` }} />
            ))}
            <em ref={markerRef} />
          </div>
          <div className="route-ends">
            <span>10⁻¹⁰ m</span>
            <button
              className="sound-toggle"
              type="button"
              aria-pressed={sound}
              onClick={() => {
                const next = !sound;
                setSound(next);
                writeSound(next);
                if (next) playHop("voyage");
              }}
            >
              {sound ? "Sound on" : "Sound off"}
            </button>
            <span>10²⁶ m</span>
          </div>
        </div>
      </div>
      <div className="sheet" ref={sheetRef}>
        {children}
      </div>
    </div>
  );
}

/** Distance out from the atom, as a power of ten, for a fractional progress value. */
export function formatDistance(progress: number): string {
  const low = WORLD_STOPS[Math.max(0, Math.min(STOPS - 1, Math.floor(progress)))]!;
  const high = WORLD_STOPS[Math.max(0, Math.min(STOPS - 1, Math.ceil(progress)))]!;
  const power = Math.round(low.power + (high.power - low.power) * (progress - Math.floor(progress)));
  return `10${toSuper(power)} m`;
}

function MissionFlag({ x, label }: { x: number; label: string }) {
  return (
    <g className="mission-flag" transform={`translate(${x} 0)`}>
      <line x1="0" y1="60" x2="0" y2="520" stroke="#ffb347" strokeOpacity="0.55" strokeDasharray="6 8" />
      <path d="M0 60 L34 70 L0 80 Z" fill="#ffb347" />
      <text x="40" y="76" fill="#ffb347" fontSize="12" className="mono" letterSpacing="1">
        MISSION · {label.toUpperCase()}
      </text>
    </g>
  );
}

function GhostProbe({ ghost, lane }: { ghost: Ghost; lane: number }) {
  const y = EXPLORER_Y + (lane === 0 ? -96 : lane === 1 ? 96 : -150);
  return (
    <g className={`ghost ${ghost.id}`} transform={`translate(${explorerX(ghost.progress)} ${y})`}>
      <path d="M-14 -10 L16 0 L-14 10 L-8 0 Z" fill="none" strokeWidth="1.6" />
      <circle r="20" fill="none" strokeOpacity="0.35" />
      <text x="0" y="36" textAnchor="middle" fontSize="11" className="mono">
        {ghost.label}
      </text>
    </g>
  );
}

function layerStyle(width: number, k: number) {
  return { width: (width + PAD * 2) * k, height: WORLD_H * k };
}

function clampStop(value: number): number {
  return Math.max(0, Math.min(STOPS - 1, Math.round(value)));
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Right answer: crouch, launch, a full loop at the top of a long arc, then land a whole world further on. */
function voyagePose(t: number, from: number, d: number): Pose {
  if (t < 0.12) {
    const c = Math.sin((t / 0.12) * Math.PI);
    return { v: from - 0.02 * c, cam: from, dy: 14 * c, rot: -10 * c, sx: 1 - 0.15 * c, sy: 1 + 0.12 * c, jx: 0 };
  }
  const u = clamp01((t - 0.12) / 0.7);
  const e = ease(u);
  const flip = ease(clamp01((u - 0.18) / 0.5));
  const stretch = Math.sin(Math.min(1, u * 4) * Math.PI) * 0.25;
  const land = t > 0.82 ? Math.sin(((t - 0.82) / 0.18) * Math.PI) : 0;
  return {
    v: from + d * e,
    cam: from + d * ease(clamp01((t - 0.24) / 0.76)),
    dy: -Math.sin(u * Math.PI) * 120 + land * 8,
    rot: -360 * flip - 20 * Math.sin(u * Math.PI),
    sx: 1 + stretch,
    sy: 1 - stretch * 0.4,
    jx: 0,
  };
}

/** Wrong answer: the engine cuts out, the probe drops and spins, then manages a short hop. */
function stumblePose(t: number, from: number, d: number): Pose {
  if (t < 0.38) {
    const s = t / 0.38;
    return { v: from, cam: from, dy: 34 * ease(s), rot: Math.sin(t * 70) * 22 + 30 * s, sx: 1, sy: 1, jx: Math.sin(t * 110) * 5 };
  }
  if (t < 0.82) {
    const u = (t - 0.38) / 0.44;
    const e = 1 - (1 - u) ** 2;
    return {
      v: from + d * e,
      cam: from + d * ease(clamp01((t - 0.3) / 0.7)),
      dy: 34 * (1 - e) - Math.sin(u * Math.PI) * 46,
      rot: 30 * (1 - u) - 14 * Math.sin(u * Math.PI) + 8 * Math.sin(u * 18),
      sx: 1,
      sy: 1,
      jx: 0,
    };
  }
  const l = (t - 0.82) / 0.18;
  return { v: from + d, cam: from + d * ease(clamp01((t - 0.3) / 0.7)), dy: 4 * Math.sin(l * Math.PI), rot: 6 * Math.sin(l * Math.PI * 2), sx: 1, sy: 1, jx: 0 };
}

/** End screen: fly the whole route again with the camera alongside. */
function replayPose(t: number, from: number, d: number): Pose {
  const e = ease(t);
  return { v: from + d * e, cam: from + d * ease(clamp01(t * 1.05 - 0.02)), dy: -Math.sin(t * Math.PI) * 30, rot: -6 * Math.sin(t * Math.PI), sx: 1, sy: 1, jx: 0 };
}

function Probe() {
  return (
    <svg viewBox="-40 -40 80 80" width="76" height="76" className="probe" aria-hidden="true">
      <g className="thrust">
        <line x1="-22" y1="-5" x2="-46" y2="-5" />
        <line x1="-20" y1="0" x2="-58" y2="0" />
        <line x1="-22" y1="5" x2="-46" y2="5" />
      </g>
      <circle className="ring outer" r="30" />
      <circle className="ring" r="21" />
      <path className="hull" d="M-13 -11 L17 0 L-13 11 L-7 0 Z" />
      <circle className="core" cx="-1" cy="0" r="2.6" />
    </svg>
  );
}

function Smoke() {
  return (
    <div className="smoke">
      {Array.from({ length: 6 }, (_, index) => (
        <i key={index} style={{ animationDelay: `${index * 110}ms` }} />
      ))}
    </div>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

function writeSound(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Sound stays on for this visit only.
  }
}

function playHop(kind: "voyage" | "stumble") {
  const context = new AudioContext();
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = kind === "voyage" ? "triangle" : "sawtooth";
  osc.frequency.value = kind === "voyage" ? 440 : 140;
  gain.gain.value = 0.035;
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();
  if (kind === "voyage") osc.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.25);
  else osc.frequency.exponentialRampToValueAtTime(70, context.currentTime + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
  osc.stop(context.currentTime + 0.4);
  window.setTimeout(() => void context.close(), 700);
}
