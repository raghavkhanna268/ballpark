import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { EXPLORER_Y, FAR_RATE, FRONT_RATE, STEP, WORLD_H, WORLD_STOPS, WORLD_W, WorldFar, WorldFront, WorldMain, explorerX } from "./worlds";
import "./journey.css";

export type Hop = { id: number; kind: "idle" | "voyage" | "stumble"; travel: number };
type Motion = "idle" | "voyage" | "stumble" | "replay";

const SOUND_KEY = "ballpark.sound";
const STOPS = WORLD_STOPS.length;
const PAD = 400;
/** The scene is at most this share of the screen. The world is scaled so it fills that height. */
const SCENE_MAX = 0.8;
const VOYAGE_MS = 2300;
const STUMBLE_MS = 1700;
const REPLAY_MS = 3600;
const TRAIL_POINTS = 42;

type Pose = { v: number; cam: number; dy: number; rot: number; sx: number; sy: number; jx: number };

export function Journey({
  progress,
  hop,
  overview,
  page,
  children,
}: {
  /** Changes whenever the card below the scene shows a new screen, so it starts scrolled to the top. */
  page: string;
  /** 0 is the atom. Each correct answer adds 1. A miss adds about a third. */
  progress: number;
  hop: Hop;
  overview: boolean;
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
  const trailRef = useRef<SVGPolylineElement>(null);
  const trailGlowRef = useRef<SVGPolylineElement>(null);
  const markerRef = useRef<HTMLElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const trail = useRef<Array<[number, number]>>([]);
  const size = useRef({ w: 390, h: 520, k: 1 });
  const pose = useRef<Pose>({ v: progress, cam: progress, dy: 0, rot: 0, sx: 1, sy: 1, jx: 0 });
  const landedRef = useRef(-1);
  const [k, setK] = useState(1);
  const [motion, setMotion] = useState<Motion>("idle");
  const [landed, setLanded] = useState(() => clampStop(progress));
  const [arrived, setArrived] = useState(0);
  const [sound, setSound] = useState(() => localStorage.getItem(SOUND_KEY) === "on");

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

  /** Puts every layer and the explorer where the current pose says. Runs every frame while flying. */
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
      if (labelRef.current) labelRef.current.textContent = WORLD_STOPS[stop]!.label;
    }
  }

  function pushTrail() {
    const p = pose.current;
    trail.current.push([explorerX(p.v) + p.jx - 30, EXPLORER_Y + p.dy + 26]);
    if (trail.current.length > TRAIL_POINTS) trail.current.shift();
    const points = trail.current.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    trailRef.current?.setAttribute("points", points);
    trailGlowRef.current?.setAttribute("points", points);
  }

  function run(kind: Motion, from: number, to: number, duration: number, onDone?: () => void) {
    const start = performance.now();
    const d = to - from;
    trail.current = [];
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      pose.current = kind === "stumble" ? stumblePose(t, from, d) : kind === "replay" ? replayPose(t, from, d) : voyagePose(t, from, d);
      keepInFrame();
      draw();
      pushTrail();
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        pose.current = { v: to, cam: to, dy: 0, rot: 0, sx: 1, sy: 1, jx: 0 };
        draw();
        setMotion("idle");
        setLanded(clampStop(to));
        setArrived((value) => value + 1);
        onDone?.();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }

  /** The camera lags so the explorer visibly crosses the screen, but it never leaves the frame. */
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
    if (reduced || Math.abs(to - from) < 0.001 || Math.abs(to - from) > 2.2) {
      pose.current = { v: to, cam: to, dy: 0, rot: 0, sx: 1, sy: 1, jx: 0 };
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
      pose.current = { v: to, cam: to, dy: 0, rot: 0, sx: 1, sy: 1, jx: 0 };
      draw();
      setLanded(clampStop(to));
      return;
    }
    setMotion("replay");
    pose.current = { v: 0, cam: 0, dy: 0, rot: 0, sx: 1, sy: 1, jx: 0 };
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

  return (
    <div className={stageClass} ref={stageRef}>
      <div className="scene" ref={sceneRef}>
        <svg ref={farRef} className="layer" style={layerStyle(WORLD_W * FAR_RATE, k)} viewBox={`${-PAD} 0 ${WORLD_W * FAR_RATE + PAD * 2} ${WORLD_H}`} aria-hidden="true">
          <WorldFar />
        </svg>
        <svg ref={mainRef} className="layer" style={layerStyle(WORLD_W, k)} viewBox={`${-PAD} 0 ${WORLD_W + PAD * 2} ${WORLD_H}`} aria-hidden="true">
          <WorldMain />
          <polyline ref={trailGlowRef} className={`trail-glow ${motion}`} points="" />
          <polyline ref={trailRef} className={`trail ${motion}`} points="" />
        </svg>
        <div className="speedlines" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => (
            <i key={index} style={{ top: `${8 + index * 9}%`, animationDelay: `${(index * 73) % 400}ms` }} />
          ))}
        </div>
        <div className={`explorer ${motion}`} ref={explorerRef} aria-hidden="true">
          <Explorer mood={motion === "stumble" ? "dizzy" : flying ? "joy" : "calm"} />
          {motion === "stumble" ? <Smoke /> : null}
          {motion === "voyage" ? <Sparks /> : null}
        </div>
        <svg ref={frontRef} className="layer front" style={layerStyle(WORLD_W * FRONT_RATE, k)} viewBox={`${-PAD} 0 ${WORLD_W * FRONT_RATE + PAD * 2} ${WORLD_H}`} aria-hidden="true">
          <WorldFront />
        </svg>
        {motion === "voyage" ? <Confetti burst={hop.id} /> : null}
        {motion === "stumble" ? <div className="miss-flash" key={hop.id} /> : null}
        <div className="hud">
          <p className="where" key={arrived}>
            <small>You are in</small> <span ref={labelRef}>{WORLD_STOPS[landed]!.label}</span>
          </p>
          <button
            className="sound-toggle"
            type="button"
            aria-pressed={sound}
            onClick={() => {
              const next = !sound;
              setSound(next);
              localStorage.setItem(SOUND_KEY, next ? "on" : "off");
              if (next) playHop("voyage");
            }}
          >
            {sound ? "Sound on" : "Sound off"}
          </button>
        </div>
        <div className="route" aria-hidden="true">
          <div className="route-line">
            <b ref={fillRef} />
            {WORLD_STOPS.map((stop, index) => (
              <i key={stop.id} className={index <= landed ? "passed" : ""} style={{ left: `${(index / (STOPS - 1)) * 100}%` }} />
            ))}
            <em ref={markerRef} />
          </div>
          <div className="route-ends">
            <span>Atom</span>
            <span>Galaxy web</span>
          </div>
        </div>
      </div>
      <div className="sheet" ref={sheetRef}>
        {children}
      </div>
    </div>
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

/** Right answer: crouch, launch, a full backflip at the top of a long arc, then land a whole world further on. */
function voyagePose(t: number, from: number, d: number): Pose {
  if (t < 0.12) {
    const c = Math.sin((t / 0.12) * Math.PI);
    return { v: from - 0.02 * c, cam: from, dy: 14 * c, rot: -8 * c, sx: 1 + 0.18 * c, sy: 1 - 0.2 * c, jx: 0 };
  }
  const u = clamp01((t - 0.12) / 0.7);
  const e = ease(u);
  const flip = ease(clamp01((u - 0.18) / 0.5));
  const stretch = Math.sin(Math.min(1, u * 4) * Math.PI) * 0.2;
  const land = t > 0.82 ? Math.sin(((t - 0.82) / 0.18) * Math.PI) : 0;
  return {
    v: from + d * e,
    cam: from + d * ease(clamp01((t - 0.24) / 0.76)),
    dy: -Math.sin(u * Math.PI) * 120 + land * 10,
    rot: -360 * flip + 18 * Math.sin(u * Math.PI),
    sx: 1 - stretch * 0.5 + land * 0.14,
    sy: 1 + stretch - land * 0.16,
    jx: 0,
  };
}

/** Wrong answer: the jet coughs, the explorer drops and wobbles, then manages a short hop. */
function stumblePose(t: number, from: number, d: number): Pose {
  if (t < 0.38) {
    const s = t / 0.38;
    return {
      v: from,
      cam: from,
      dy: 30 * ease(s),
      rot: Math.sin(t * 70) * 16,
      sx: 1,
      sy: 1,
      jx: Math.sin(t * 110) * 5,
    };
  }
  if (t < 0.82) {
    const u = (t - 0.38) / 0.44;
    const e = 1 - (1 - u) ** 2;
    return {
      v: from + d * e,
      cam: from + d * ease(clamp01((t - 0.3) / 0.7)),
      dy: 30 * (1 - e) - Math.sin(u * Math.PI) * 50,
      rot: -22 * Math.sin(u * Math.PI) + 10 * Math.sin(u * 18),
      sx: 1,
      sy: 1,
      jx: 0,
    };
  }
  const l = (t - 0.82) / 0.18;
  const squash = Math.sin(l * Math.PI);
  return { v: from + d, cam: from + d * ease(clamp01((t - 0.3) / 0.7)), dy: 6 * squash, rot: 6 * Math.sin(l * Math.PI * 2), sx: 1 + 0.16 * squash, sy: 1 - 0.18 * squash, jx: 0 };
}

/** End screen: fly the whole route again with the camera alongside. */
function replayPose(t: number, from: number, d: number): Pose {
  const e = ease(t);
  return { v: from + d * e, cam: from + d * ease(clamp01(t * 1.05 - 0.02)), dy: -Math.sin(t * Math.PI) * 40, rot: 10 * Math.sin(t * Math.PI), sx: 1, sy: 1, jx: 0 };
}

function Explorer({ mood }: { mood: "calm" | "joy" | "dizzy" }) {
  return (
    <svg viewBox="-60 -70 120 150" width="96" height="120" className="explorer-art">
      {/* jet flame, drawn behind the pack */}
      <g className="flame" transform="translate(-34 22)">
        <path d="M0 0 C-14 10 -14 34 0 70 C14 34 14 10 0 0 Z" fill="#ff7a2c" />
        <path d="M0 6 C-8 14 -8 30 0 52 C8 30 8 14 0 6 Z" fill="#ffd34a" />
        <path d="M0 12 C-3 18 -3 28 0 38 C3 28 3 18 0 12 Z" fill="#fff6d0" />
      </g>
      <g className="bob">
        {/* jetpack */}
        <rect x="-46" y="-14" width="22" height="40" rx="8" fill="#b8431f" stroke="#5a2410" strokeWidth="3" />
        <rect x="-42" y="22" width="14" height="8" rx="2" fill="#3a3a44" />
        {/* body */}
        <rect x="-28" y="-6" width="52" height="50" rx="20" fill="#f4efe4" stroke="#1c1915" strokeWidth="3.5" />
        <rect x="-10" y="10" width="18" height="12" rx="3" fill="#0e5c52" />
        <circle cx="-1" cy="16" r="3" fill="#7fe0c8" />
        {/* arms */}
        <path className="arm-back" d="M-22 6 q-14 10 -16 24" stroke="#1c1915" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path className="arm-front" d="M18 6 q18 -4 26 -18" stroke="#1c1915" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path className="arm-back" d="M-22 6 q-14 10 -16 24" stroke="#f4efe4" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path className="arm-front" d="M18 6 q18 -4 26 -18" stroke="#f4efe4" strokeWidth="5" strokeLinecap="round" fill="none" />
        {/* legs */}
        <path d="M-14 42 v14 M10 42 v14" stroke="#1c1915" strokeWidth="10" strokeLinecap="round" />
        <path d="M-14 42 v14 M10 42 v14" stroke="#f4efe4" strokeWidth="6" strokeLinecap="round" />
        {/* helmet */}
        <circle cx="0" cy="-30" r="34" fill="#f4efe4" stroke="#1c1915" strokeWidth="3.5" />
        <rect x="-22" y="-48" width="48" height="34" rx="16" fill="#16324a" />
        <path d="M-14 -44 q8 -4 16 -2" stroke="#7fd3ff" strokeWidth="4" strokeLinecap="round" fill="none" />
        {mood === "dizzy" ? (
          <g stroke="#ffd34a" strokeWidth="3" strokeLinecap="round">
            <path d="M-12 -36 l8 8 M-4 -36 l-8 8 M8 -36 l8 8 M16 -36 l-8 8" />
            <path d="M-6 -20 q4 -4 8 0 q4 4 8 0" fill="none" />
          </g>
        ) : mood === "joy" ? (
          <g fill="none" stroke="#9ff0ff" strokeWidth="3.5" strokeLinecap="round">
            <path d="M-12 -30 q4 -7 8 0 M8 -30 q4 -7 8 0" />
            <path d="M-6 -22 q8 8 16 0" />
          </g>
        ) : (
          <g>
            <circle className="eye" cx="-7" cy="-32" r="3.5" fill="#9ff0ff" />
            <circle className="eye" cx="11" cy="-32" r="3.5" fill="#9ff0ff" />
            <path d="M-4 -22 q6 4 12 0" stroke="#9ff0ff" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>
        )}
        {/* antenna */}
        <path d="M14 -62 l8 -12" stroke="#1c1915" strokeWidth="3" />
        <circle cx="23" cy="-75" r="5" fill="#b8431f" className="antenna" />
      </g>
    </svg>
  );
}

function Sparks() {
  return (
    <div className="sparks">
      {Array.from({ length: 10 }, (_, index) => (
        <i key={index} style={{ ["--i" as string]: String(index) }} />
      ))}
    </div>
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

function Confetti({ burst }: { burst: number }) {
  return (
    <div className="confetti" key={burst} aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => (
        <i key={index} style={{ ["--i" as string]: String(index), left: `${6 + ((index * 17) % 88)}%`, animationDelay: `${(index % 6) * 60}ms` }} />
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
