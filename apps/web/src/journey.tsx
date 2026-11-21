import { useEffect, useState, type ReactNode } from "react";
import "./journey.css";

export type Hop = { id: number; kind: "idle" | "voyage" | "stumble"; travel: number };

const SOUND_KEY = "ballpark.sound";

export function Journey({
  worldId,
  hop,
  dots,
  children,
}: {
  worldId: string;
  hop: Hop;
  dots: { total: number; current: number };
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [motion, setMotion] = useState<"idle" | "voyage" | "stumble">("idle");
  const [sound, setSound] = useState(() => localStorage.getItem(SOUND_KEY) === "on");

  useEffect(() => {
    if (hop.kind === "idle") return;
    setMotion(hop.kind);
    if (sound) playHop(hop.kind);
    const timer = window.setTimeout(() => setMotion("idle"), reduced ? 420 : hop.kind === "voyage" ? 1300 : 760);
    return () => window.clearTimeout(timer);
  }, [hop.id, hop.kind, hop.travel, reduced, sound]);

  const klass = ["stage", `world-${worldId}`, motion !== "idle" ? `is-${motion}` : "", reduced ? "quiet" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={klass} style={{ ["--travel" as string]: String(hop.travel) }} data-world={worldId}>
      <div className="sky layer back" aria-hidden="true" />
      <div className="sky layer mid" aria-hidden="true">
        <span className="orb a" />
        <span className="orb b" />
        <span className="ring" />
      </div>
      <div className="sky layer front" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} className={`mote m${index}`} />
        ))}
      </div>
      <Mascot />
      <div className="sheet">
        <div className="trail" aria-label="Progress">
          {Array.from({ length: dots.total }, (_, index) => (
            <i key={index} className={index < dots.current ? "done" : index === dots.current ? "now" : ""} />
          ))}
        </div>
        {children}
      </div>
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

function Mascot() {
  return (
    <div className="mascot" aria-hidden="true">
      <svg viewBox="0 0 80 96" width="92" height="110">
        <ellipse className="jet" cx="40" cy="88" rx="10" ry="6" />
        <g className="body">
          <ellipse cx="40" cy="46" rx="26" ry="28" fill="#f4efe4" />
          <ellipse cx="40" cy="40" rx="16" ry="14" fill="#16324a" />
          <circle className="eye left" cx="34" cy="40" r="2.2" fill="#f7fbff" />
          <circle className="eye right" cx="46" cy="40" r="2.2" fill="#f7fbff" />
          <path d="M18 58c6 10 38 10 44 0" fill="none" stroke="#0e5c52" strokeWidth="3" strokeLinecap="round" />
          <circle cx="16" cy="50" r="6" fill="#f4efe4" />
          <circle cx="64" cy="50" r="6" fill="#f4efe4" />
        </g>
      </svg>
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
  osc.type = "sine";
  osc.frequency.value = kind === "voyage" ? 520 : 180;
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === "voyage" ? 0.35 : 0.2));
  osc.stop(context.currentTime + 0.4);
  window.setTimeout(() => void context.close(), 600);
}
