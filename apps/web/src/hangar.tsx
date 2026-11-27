import { useId } from "react";
import { MILESTONES } from "@ballpark/shared";
import type { RocketPaint } from "./sky";
import type { Logbook } from "./logbook";

/**
 * The Hangar: rocket paint jobs you earn by keeping a streak, and two you earn with a feat. They are never sold.
 * Once earned, a paint job stays yours even if the streak later breaks. Your rocket flies in the one you pick,
 * and friends see it on the Today board and as your ghost in race links.
 */

export type Feat = "supernova" | "moon";
export type Skin = RocketPaint & {
  id: string;
  name: string;
  /** What earns it: a streak of this many days, a feat, or nothing for the starter rocket. */
  unlock: { streak: number } | { feat: Feat } | null;
};

export const SKINS: Skin[] = [
  { id: "classic", name: "Classic", body: ["#98a1bb", "#ffffff", "#b3bbd2"], accent: "#e8505b", window: "#22305e", unlock: null },
  { id: "marigold", name: "Marigold", body: ["#d9822b", "#ffd27a", "#e39b3a"], accent: "#8c2f39", window: "#2b2d5c", unlock: { streak: 3 } },
  { id: "monsoon", name: "Monsoon", body: ["#2f6f8f", "#a8eaf7", "#3b8db0"], accent: "#f2f5ff", window: "#16324a", pattern: "stripes", unlock: { streak: 7 } },
  { id: "midnight", name: "Midnight", body: ["#1b1f3b", "#4a5487", "#20254a"], accent: "#ffcf5a", window: "#ffe7a3", pattern: "stars", unlock: { streak: 14 } },
  { id: "aurora", name: "Aurora", body: ["#2bd1a0", "#c6fbea", "#8a5cf6"], accent: "#6b3fd6", window: "#10204a", unlock: { streak: 30 } },
  { id: "chrome", name: "Chrome", body: ["#6f7a90", "#ffffff", "#4c5568"], accent: "#3d7bff", window: "#0b1430", pattern: "stripes", unlock: { streak: 50 } },
  { id: "gold", name: "Gold", body: ["#a8741a", "#fff1b0", "#c7911f"], accent: "#3a2a0a", window: "#1a1440", pattern: "stars", unlock: { streak: 100 } },
  { id: "nova", name: "Supernova", body: ["#b13fa0", "#ffc4f0", "#ff6fd8"], accent: "#ffffff", window: "#2a0b33", pattern: "stars", unlock: { feat: "supernova" } },
  { id: "lunar", name: "Moonwalker", body: ["#8d93a1", "#eef0f5", "#a3a9b6"], accent: "#62b6ff", window: "#0e1a3a", pattern: "craters", unlock: { feat: "moon" } },
];

const KEY = "ballpark.hangar.v1";
const MOON = MILESTONES.find((milestone) => milestone.id === "moon")!.at;

export type HangarState = { selected: string; seen: string[] };

export function loadHangar(): HangarState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<HangarState> | null;
    return { selected: typeof parsed?.selected === "string" ? parsed.selected : "classic", seen: Array.isArray(parsed?.seen) ? parsed.seen : [] };
  } catch {
    return { selected: "classic", seen: [] };
  }
}

export function saveHangar(next: HangarState): HangarState {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The choice holds for this visit.
  }
  return next;
}

/** What a player has earned: their best Classic streak, and the feats in their logbook. */
export type Earned = { bestStreak: number; feats: Set<Feat> };

export function earnedFrom(bestStreak: number, logbook: Logbook): Earned {
  const feats = new Set<Feat>();
  if (logbook.finds.some((find) => find.tier === "Supernova")) feats.add("supernova");
  if (logbook.farthest >= MOON - 1e-6) feats.add("moon");
  return { bestStreak, feats };
}

export function isUnlocked(skin: Skin, earned: Earned): boolean {
  if (!skin.unlock) return true;
  if ("streak" in skin.unlock) return earned.bestStreak >= skin.unlock.streak;
  return earned.feats.has(skin.unlock.feat);
}

export function skinById(id: string | null | undefined): Skin | null {
  return SKINS.find((skin) => skin.id === id) ?? null;
}

/** The paint job to fly: the one picked, if it is earned, or the Classic rocket. */
export function activeSkin(state: HangarState, earned: Earned): Skin {
  const picked = skinById(state.selected);
  return picked && isUnlocked(picked, earned) ? picked : SKINS[0]!;
}

/** Paint jobs earned since the player last opened the Hangar, newest first, for the "new paint job" banner. */
export function newlyEarned(state: HangarState, earned: Earned): Skin[] {
  return SKINS.filter((skin) => skin.unlock && isUnlocked(skin, earned) && !state.seen.includes(skin.id)).reverse();
}

export function unlockLine(skin: Skin): string {
  if (!skin.unlock) return "Your first rocket";
  if ("streak" in skin.unlock) return `${skin.unlock.streak}-day streak`;
  return skin.unlock.feat === "supernova" ? "Find a Supernova answer" : "Climb past the Moon";
}

/** The next streak paint job still to earn, and how many days away it is. */
export function nextStreakSkin(earned: Earned, streak: number): { skin: Skin; days: number } | null {
  const next = SKINS.find((skin) => skin.unlock && "streak" in skin.unlock && earned.bestStreak < skin.unlock.streak);
  if (!next || !next.unlock || !("streak" in next.unlock)) return null;
  return { skin: next, days: next.unlock.streak - streak };
}

export function HangarCard({
  state,
  earned,
  streak,
  onPick,
}: {
  state: HangarState;
  earned: Earned;
  streak: number;
  onPick: (id: string) => void;
}) {
  const flying = activeSkin(state, earned);
  const next = nextStreakSkin(earned, streak);
  return (
    <section className="card hangar" aria-label="Hangar">
      <div className="mode-top">
        <h2>Hangar</h2>
        <p className="streak">Streak {streak}</p>
      </div>
      <p className="hint">
        {next
          ? `Next: ${next.skin.name} at a ${next.skin.unlock && "streak" in next.skin.unlock ? next.skin.unlock.streak : 0}-day streak, ${next.days} ${next.days === 1 ? "day" : "days"} to go.`
          : "Every streak paint job is yours. Respect."}
      </p>
      <ul className="skins">
        {SKINS.map((skin) => {
          const open = isUnlocked(skin, earned);
          const on = skin.id === flying.id;
          return (
            <li key={skin.id}>
              <button
                type="button"
                className={`skin${on ? " on" : ""}${open ? "" : " locked"}`}
                disabled={!open}
                aria-pressed={on}
                onClick={() => onPick(skin.id)}
              >
                <RocketIcon paint={skin} size={46} dim={!open} />
                <strong>{skin.name}</strong>
                <small>{on ? "Flying" : open ? "Fly this" : unlockLine(skin)}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A small picture of a rocket in a paint job, for the Hangar, the board and the end screen. */
export function RocketIcon({ paint, size = 28, dim = false }: { paint: RocketPaint; size?: number; dim?: boolean }) {
  const id = useId().replaceAll(":", "");
  return (
    <svg className="rocket-icon" width={size * 0.62} height={size} viewBox="-19 -62 38 64" aria-hidden="true" style={dim ? { opacity: 0.35, filter: "grayscale(1)" } : undefined}>
      <defs>
        <linearGradient id={`b${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={paint.body[0]} />
          <stop offset="0.45" stopColor={paint.body[1]} />
          <stop offset="1" stopColor={paint.body[2]} />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <path d="M-8.5 -24 L-17 -1 L-8.5 -7Z M8.5 -24 L17 -1 L8.5 -7Z" fill={paint.accent} />
      <path d={BODY} fill={`url(#b${id})`} />
      <g clipPath={`url(#c${id})`}>
        <rect x="-14" y="-60" width="28" height="13" fill={paint.accent} />
        {paint.pattern === "stripes" ? <rect x="-14" y="-21" width="28" height="4" fill={paint.accent} opacity="0.8" /> : null}
        {paint.pattern === "stars" ? (
          <g fill={paint.accent}>
            <circle cx="-4" cy="-18" r="1.2" />
            <circle cx="5" cy="-24" r="1" />
            <circle cx="2" cy="-12" r="0.9" />
          </g>
        ) : null}
        {paint.pattern === "craters" ? (
          <g fill="#00000022">
            <circle cx="-4" cy="-19" r="2.4" />
            <circle cx="5" cy="-13" r="1.8" />
            <circle cx="4" cy="-44" r="1.4" />
          </g>
        ) : null}
      </g>
      <circle cx="0" cy="-34" r="5" fill={paint.window} stroke="#cfd6ea" strokeWidth="1.5" />
      <path d="M-6 -6 L6 -6 L7.5 0 L-7.5 0Z" fill="#5b6278" />
    </svg>
  );
}

const BODY = "M0 -58 C12 -46 12 -24 9 -6 L-9 -6 C-12 -24 -12 -46 0 -58Z";
