/**
 * Small one-off effects drawn over the page: sparks, a shock ring, a flash of colour, a burst of static, and the
 * question card burning away. Each one lives on a fixed layer above everything, removes itself when it is done, and
 * does nothing at all when the player asks for less motion.
 */

const EMBERS = ["#fff3d6", "#ffd08a", "#ffb347", "#ff8a3d"];

let layer: HTMLDivElement | null = null;
let measure: CanvasRenderingContext2D | null = null;

/** True when the player asked for less motion. Every effect here checks it. */
export function calm(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function fxLayer(): HTMLDivElement {
  if (layer?.isConnected) return layer;
  layer = document.createElement("div");
  layer.className = "fx-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  return layer;
}

/** Runs keyframes on a new element in the layer, then removes it. */
function play(node: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
  fxLayer().appendChild(node);
  const animation = node.animate(frames, { fill: "forwards", ...options });
  animation.onfinish = () => node.remove();
  animation.oncancel = () => node.remove();
}

type SparkOptions = {
  count?: number;
  colors?: readonly string[];
  /** How far they fly, in pixels. */
  spread?: number;
  size?: number;
  /** Extra lift, so embers drift up. */
  rise?: number;
  ms?: number;
  /** Spread the starting points over a box this wide and tall, centred on (x, y). */
  box?: { w: number; h: number };
};

/** A spray of glowing bits from a point. */
export function sparks(x: number, y: number, { count = 6, colors = EMBERS, spread = 40, size = 3, rise = 0, ms = 600, box }: SparkOptions = {}) {
  if (calm()) return;
  for (let i = 0; i < count; i++) {
    const bit = document.createElement("i");
    bit.className = "fx-spark";
    const color = colors[i % colors.length];
    const s = size * (0.6 + Math.random() * 0.7);
    const sx = x + (box ? (Math.random() - 0.5) * box.w : 0);
    const sy = y + (box ? (Math.random() - 0.5) * box.h : 0);
    bit.style.cssText = `left:${sx}px;top:${sy}px;width:${s}px;height:${s}px;margin:${-s / 2}px;background:${color};box-shadow:0 0 ${s * 2}px ${color}`;
    const angle = Math.random() * Math.PI * 2;
    const far = spread * (0.35 + Math.random() * 0.65);
    const dx = Math.cos(angle) * far;
    const dy = Math.sin(angle) * far - rise * (0.5 + Math.random());
    play(bit, [{ transform: "translate(0, 0) scale(1)", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 }], {
      duration: ms * (0.7 + Math.random() * 0.5),
      easing: "cubic-bezier(0.2, 0.8, 0.3, 1)",
    });
  }
}

/** A ring that rushes out from a point and fades. */
export function ring(x: number, y: number, color = "#ffb347", { size = 40, grow = 5, ms = 700, delay = 0 } = {}) {
  if (calm()) return;
  const node = document.createElement("i");
  node.className = "fx-ring";
  node.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;border-color:${color};box-shadow:0 0 12px ${color}, inset 0 0 8px ${color}`;
  play(node, [{ transform: "scale(0.3)", opacity: 0.95 }, { transform: `scale(${grow})`, opacity: 0 }], { duration: ms, delay, easing: "cubic-bezier(0.1, 0.7, 0.3, 1)" });
}

/** The whole screen flashes a colour, then fades. */
export function flash(color = "#ffb347", strength = 0.3, ms = 450) {
  if (calm()) return;
  const node = document.createElement("i");
  node.className = "fx-flash";
  node.style.background = color;
  play(node, [{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: "ease-out" });
}

/** A burst of static over the screen, like a bad signal. */
export function zap(ms = 320) {
  if (calm()) return;
  const node = document.createElement("i");
  node.className = "fx-static";
  play(
    node,
    [
      { opacity: 0.9, transform: "translateY(0)" },
      { opacity: 0.25, transform: "translateY(2px)", offset: 0.33 },
      { opacity: 0.7, transform: "translateY(-1px)", offset: 0.66 },
      { opacity: 0, transform: "translateY(1px)" },
    ],
    { duration: ms, easing: "steps(3, end)" },
  );
}

/**
 * The question card burns away after Lock in: a copy of it rises, shrinks and blurs out while embers fly off its
 * edges and the screen flashes amber. The copy sits in a second, empty sheet so the card's own styles still apply
 * while the real one is replaced by the result.
 */
export function burnAway(card: HTMLElement) {
  if (calm()) return;
  const stage = card.closest(".stage");
  const box = card.getBoundingClientRect();
  if (!stage || box.width === 0 || box.height === 0) return;
  const shell = document.createElement("div");
  shell.className = "sheet fx-ghost";
  shell.setAttribute("aria-hidden", "true");
  shell.inert = true;
  shell.style.cssText = "inset:0;top:0;max-height:none;overflow:hidden;padding:0;opacity:1;visibility:visible;transition:none;pointer-events:none";
  const ghost = card.cloneNode(true) as HTMLElement;
  ghost.style.cssText = `position:absolute;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;margin:0;animation:none`;
  shell.appendChild(ghost);
  stage.appendChild(shell);
  const animation = ghost.animate(
    [
      { opacity: 1, transform: "none", filter: "none" },
      { opacity: 1, transform: "translateY(-6px) scale(1.02)", filter: "brightness(1.6) drop-shadow(0 0 18px rgba(255,150,60,.9))", offset: 0.25 },
      { opacity: 0, transform: "translateY(-34px) scale(0.86)", filter: "brightness(2) blur(4px) drop-shadow(0 0 24px rgba(255,120,40,.9))" },
    ],
    { duration: 650, easing: "ease-in", fill: "forwards" },
  );
  animation.onfinish = () => shell.remove();
  animation.oncancel = () => shell.remove();
  const cx = box.left + box.width / 2;
  sparks(cx, box.bottom - 4, { count: 22, spread: 70, size: 4, rise: 50, ms: 900, box: { w: box.width, h: 10 } });
  sparks(cx, box.top + box.height / 2, { count: 14, spread: 90, size: 3, rise: 30, ms: 800, box: { w: box.width * 0.9, h: box.height * 0.8 } });
  flash("#ffb347", 0.22, 500);
}

/** The answer bar drops off the bottom of the screen as the card burns. */
export function dropAway(bar: HTMLElement) {
  if (calm()) return;
  const stage = bar.closest(".stage");
  const slot = bar.parentElement;
  if (!stage || !slot) return;
  const shell = document.createElement("div");
  shell.className = "dock-slot fx-ghost";
  shell.setAttribute("aria-hidden", "true");
  shell.inert = true;
  const ghost = bar.cloneNode(true) as HTMLElement;
  ghost.style.animation = "none";
  shell.appendChild(ghost);
  stage.appendChild(shell);
  const animation = ghost.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(110%)", opacity: 0.4 }], {
    duration: 380,
    easing: "cubic-bezier(0.5, 0, 0.75, 0)",
    fill: "forwards",
  });
  animation.onfinish = () => shell.remove();
  animation.oncancel = () => shell.remove();
}

/** A few sparks fly from the text cursor as a letter goes in. */
export function caretSparks(input: HTMLInputElement) {
  if (calm()) return;
  const box = input.getBoundingClientRect();
  if (box.width === 0) return;
  const style = window.getComputedStyle(input);
  measure ??= document.createElement("canvas").getContext("2d");
  if (!measure) return;
  measure.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const upto = input.value.slice(0, input.selectionStart ?? input.value.length);
  const width = measure.measureText(upto).width;
  const x = Math.min(box.right - 6, box.left + parseFloat(style.paddingLeft || "0") + width - input.scrollLeft + 2);
  sparks(x, box.top + box.height / 2, { count: 7, spread: 34, size: 4.2, rise: 22, ms: 620, colors: ["#ffffff", "#ffd08a", "#ffb347", "#8fd3ff"] });
  // The box glows for a moment with each letter.
  input.closest(".number-field")?.animate([{ boxShadow: "0 0 0 1px #ffd08a, 0 0 20px rgba(255, 179, 71, 0.55)" }, {}], { duration: 280, easing: "ease-out" });
}

/** Shake an element side to side. */
export function jolt(element: Element, strength = 8) {
  if (calm()) return;
  element.animate(
    [
      { transform: "translateX(0)" },
      { transform: `translateX(${-strength}px)`, offset: 0.2 },
      { transform: `translateX(${strength * 0.85}px)`, offset: 0.45 },
      { transform: `translateX(${-strength * 0.5}px)`, offset: 0.7 },
      { transform: `translateX(${strength * 0.25}px)`, offset: 0.88 },
      { transform: "translateX(0)" },
    ],
    { duration: 400, easing: "linear" },
  );
}

/** The arcade "slam": the number punches up big, tilts, glows gold, and drops back. */
export function slam(element: Element, { delay = 0, scale = 1.4 } = {}) {
  if (calm()) return;
  element.animate(
    [
      { transform: "none" },
      { transform: `scale(${scale}) rotate(-2deg)`, color: "#ffd166", textShadow: "0 0 26px rgba(255, 209, 102, 0.9), 0 0 8px rgba(255, 209, 102, 0.9)", offset: 0.35 },
      { transform: "none" },
    ],
    { duration: 520, delay, easing: "cubic-bezier(0.2, 1.6, 0.4, 1)" },
  );
}
