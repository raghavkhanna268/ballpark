import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { WORLD_STOPS, Backdrop, WorldArt } from "./worlds";
import "./journey.css";

export type Hop = { id: number; kind: "idle" | "voyage" | "stumble"; travel: number };

const SOUND_KEY = "ballpark.sound";
const STOPS = WORLD_STOPS.length;

export function Journey({
  progress,
  hop,
  overview,
  children,
}: {
  /** 0 is the atom. Each correct answer adds 1. A miss adds about a third. */
  progress: number;
  hop: Hop;
  overview: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const viewport = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const pipRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const railRef = useRef<Array<HTMLElement | null>>([]);
  const heightRef = useRef(480);
  const shownRef = useRef(progress);
  const overviewRef = useRef(overview);
  const [height, setHeight] = useState(480);
  const [shown, setShown] = useState(progress);
  const [motion, setMotion] = useState<"idle" | "voyage" | "stumble">("idle");
  const [focus, setFocus] = useState(false);
  const [sound, setSound] = useState(() => localStorage.getItem(SOUND_KEY) === "on");
  const [burst, setBurst] = useState(0);

  overviewRef.current = overview;

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => {
      const next = node.clientHeight || 480;
      heightRef.current = next;
      setHeight(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const from = shownRef.current;
    const to = progress;
    if (reduced || Math.abs(to - from) < 0.001 || Math.abs(to - from) > 2.2) {
      shownRef.current = to;
      setShown(to);
      applyCamera(to);
      return;
    }
    const kind = hop.kind === "stumble" ? "stumble" : "voyage";
    setMotion(kind);
    setFocus(false);
    if (kind === "voyage") setBurst((value) => value + 1);
    if (sound) playHop(kind);
    const duration = kind === "stumble" ? 1200 : 1600;
    const focusAt = window.setTimeout(() => setFocus(true), kind === "stumble" ? 420 : 520);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const value = from + (to - from) * eased;
      shownRef.current = value;
      applyCamera(value);
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        setShown(value);
        setMotion("idle");
        setFocus(false);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(focusAt);
    };
  }, [progress, hop.id, hop.kind, reduced, sound]);

  useLayoutEffect(() => {
    applyCamera(shownRef.current);
  });

  function applyCamera(value: number) {
    if (overviewRef.current) return;
    const y = -value * heightRef.current;
    if (midRef.current) midRef.current.style.transform = `translate3d(0, ${y}px, 0)`;
    if (backRef.current) backRef.current.style.transform = `translate3d(0, ${y * 0.55}px, 0)`;
    if (frontRef.current) frontRef.current.style.transform = `translate3d(0, ${y * 1.28}px, 0)`;
    if (pipRef.current) pipRef.current.style.top = `${(value / (STOPS - 1)) * 100}%`;
    const stop = WORLD_STOPS[Math.max(0, Math.min(STOPS - 1, Math.round(value)))];
    if (labelRef.current && stop) labelRef.current.textContent = `You are here: ${stop.label}`;
    railRef.current.forEach((node, index) => node?.classList.toggle("passed", index <= value + 0.05));
  }

  const landed = Math.max(0, Math.min(STOPS - 1, Math.round(shown)));

  return (
    <div className={`stage ${motion === "idle" ? "" : `is-${motion}`} ${focus ? "is-focus" : ""} ${reduced ? "quiet" : ""} ${overview ? "is-overview" : ""}`}>
      <div className="viewport" ref={viewport}>
        {overview ? (
          <ol className="overview">
            {WORLD_STOPS.map((stop, index) => (
              <li key={stop.id} className={index === landed ? "here" : index < landed ? "passed" : ""}>
                <svg viewBox={stop.frame} className="thumb" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                  <WorldArt id={stop.id} />
                </svg>
                <span>{stop.label}</span>
                {index === landed ? (
                  <div className="mini-mascot">
                    <Face flip={false} />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <>
            <div className="strip back-strip" ref={backRef}>
              {WORLD_STOPS.map((stop) => (
                <div key={stop.id} className="stop" style={{ height }}>
                  <svg viewBox="0 0 390 700" className="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                    <Backdrop id={stop.id} />
                  </svg>
                </div>
              ))}
            </div>
            <div className="strip" ref={midRef}>
              {WORLD_STOPS.map((stop) => (
                <div key={stop.id} className="stop" style={{ height }} data-stop={stop.id}>
                  <svg viewBox="0 0 390 700" className="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                    <WorldArt id={stop.id} />
                  </svg>
                </div>
              ))}
            </div>
            <div className="strip front-strip" ref={frontRef} aria-hidden="true">
              {WORLD_STOPS.map((stop, index) => (
                <div key={stop.id} className="stop front-bits" style={{ height }}>
                  <span style={{ left: `${12 + (index % 4) * 18}%`, top: `${22 + (index % 3) * 16}%` }} />
                  <span style={{ left: `${68 - (index % 3) * 10}%`, top: `${48 + (index % 2) * 12}%`, width: 18, height: 10, borderRadius: 10 }} />
                  <span style={{ left: `${40 + (index % 5) * 8}%`, top: `${70 - (index % 3) * 8}%` }} />
                </div>
              ))}
            </div>
            <div className={`mascot ${motion}`} key={burst}>
              <Jet />
              {motion === "voyage" ? <Sparks /> : null}
              {motion === "stumble" ? <Smoke /> : null}
              <Face flip={motion === "voyage"} />
            </div>
            {motion === "voyage" ? <Confetti burst={burst} /> : null}
            <div className="flight-rail" aria-hidden="true">
              {WORLD_STOPS.map((stop, index) => (
                <i
                  key={stop.id}
                  ref={(node) => {
                    railRef.current[index] = node;
                  }}
                  className={index <= shown ? "passed" : ""}
                />
              ))}
              <b ref={pipRef} style={{ top: `${(shown / (STOPS - 1)) * 100}%` }} />
            </div>
            <p className="where" ref={labelRef}>
              You are here: {WORLD_STOPS[landed]?.label}
            </p>
            {motion === "stumble" ? <div className="red-pulse" /> : null}
          </>
        )}
        {overview ? <p className="where">The whole journey</p> : null}
      </div>
      <div className={`sheet ${motion !== "idle" ? "compact" : ""}`}>{children}</div>
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
  );
}

function Face({ flip }: { flip: boolean }) {
  return (
    <svg viewBox="0 0 80 96" width="108" height="128" className={flip ? "flip" : ""}>
      <g className="body">
        <ellipse cx="40" cy="46" rx="26" ry="28" fill="#f4efe4" />
        <ellipse cx="40" cy="40" rx="16" ry="14" fill="#16324a" />
        <circle className="eye" cx="34" cy="40" r="2.2" fill="#f7fbff" />
        <circle className="eye" cx="46" cy="40" r="2.2" fill="#f7fbff" />
        <path d="M22 58c8 8 28 8 36 0" fill="none" stroke="#0e5c52" strokeWidth="3" strokeLinecap="round" />
        <circle cx="14" cy="50" r="6" fill="#f4efe4" />
        <circle cx="66" cy="50" r="6" fill="#f4efe4" />
      </g>
    </svg>
  );
}

function Jet() {
  return (
    <svg className="jet-flame" viewBox="0 0 40 50" width="36" height="48" aria-hidden="true">
      <path d="M20 0 C28 16 26 28 20 48 C14 28 12 16 20 0" fill="#ffb15a" />
      <path d="M20 10 C24 20 23 30 20 40 C17 30 16 20 20 10" fill="#fff1c9" />
    </svg>
  );
}

function Sparks() {
  return (
    <div className="sparks" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <i key={index} style={{ ["--i" as string]: String(index) }} />
      ))}
    </div>
  );
}

function Smoke() {
  return (
    <div className="smoke" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  );
}

function Confetti({ burst }: { burst: number }) {
  return (
    <div className="confetti" key={burst} aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <i key={index} style={{ ["--i" as string]: String(index), left: `${8 + ((index * 17) % 84)}%` }} />
      ))}
    </div>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
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
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
  osc.stop(context.currentTime + 0.4);
  window.setTimeout(() => void context.close(), 700);
}
