import { formatAltitude, milestoneAt } from "@ballpark/shared";
import { MISS_COLOR, createSky, tierColor, type RocketPaint, type Scenery, type SkyTrail } from "./sky";

/**
 * The postcard: a picture of your climb to share. It is today's scenery with your rocket in its paint job at the
 * height you reached, the trail in tier colours, and the day's tiles, height and score. It carries no answers.
 */
export type PostcardInput = {
  puzzleNumber: number;
  scenery: Scenery;
  trail: SkyTrail[];
  progress: number;
  paint: RocketPaint;
  score: number;
  /** One tier per stage in order: 0 Liftoff to 4 Supernova, -1 a miss. */
  tiers: number[];
  /** The stage that used the Afterburner, or null. */
  boosted: number | null;
  host: string;
};

const WIDTH = 1080;
const HEIGHT = 1350;
/** 1080 / 2.5 = 432 px wide, about a phone. */
const SCALE = 2.5;
const FONT = 'Outfit, "Avenir Next", system-ui, sans-serif';

export async function drawPostcard(input: PostcardInput): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  // The sky is drawn at phone size and scaled up, so the rocket, the landmarks and their labels keep the
  // proportions they have in the game.
  const sky = createSky(canvas, true, { still: true, pixelRatio: SCALE });
  sky.resize(WIDTH / SCALE, HEIGHT / SCALE, false);
  sky.setScene(input.scenery);
  sky.setAnchor(0.66);
  sky.setTrail(input.trail);
  sky.setPaint(input.paint);
  sky.jump(input.progress);
  sky.draw();
  sky.destroy();

  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // A dark band at the top and the bottom so the words read over any scenery.
  const top = ctx.createLinearGradient(0, 0, 0, 380);
  top.addColorStop(0, "rgba(6,9,24,.92)");
  top.addColorStop(1, "rgba(6,9,24,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, WIDTH, 380);
  const bottom = ctx.createLinearGradient(0, HEIGHT - 330, 0, HEIGHT);
  bottom.addColorStop(0, "rgba(6,9,24,0)");
  bottom.addColorStop(0.45, "rgba(6,9,24,.88)");
  bottom.addColorStop(1, "rgba(6,9,24,.96)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, HEIGHT - 330, WIDTH, 330);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffd04a";
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText(`BALLPARK #${input.puzzleNumber}`, 72, 104);
  ctx.fillStyle = "#ffffff";
  const height = formatAltitude(input.progress);
  ctx.font = `800 ${height.length > 12 ? 92 : 120}px ${FONT}`;
  ctx.fillText(height, 68, 226);
  const passed = milestoneAt(input.progress);
  ctx.font = `600 44px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,.86)";
  ctx.fillText(passed.at > 0 ? `past ${passed.name}` : "off the launch pad", 72, 292);

  // The day's stages as tiles in tier colours, with a flame on the Afterburner stage.
  const size = 86;
  const gap = 18;
  const rowY = HEIGHT - 238;
  input.tiers.forEach((tier, index) => {
    const x = 72 + index * (size + gap);
    ctx.fillStyle = tier >= 0 ? tierColor(tier) : MISS_COLOR;
    roundRect(ctx, x, rowY, size, size, 18);
    ctx.fill();
    if (index === input.boosted) {
      ctx.font = `700 44px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#1b1f3b";
      ctx.fillText("×2", x + size / 2, rowY + size / 2 + 15);
      ctx.textAlign = "start";
    }
  });
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(`${input.score} pts`, 72, HEIGHT - 66);
  ctx.textAlign = "right";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.fillText(input.host, WIDTH - 72, HEIGHT - 72);
  ctx.textAlign = "start";
  return canvas;
}

export async function postcardFile(input: PostcardInput): Promise<File> {
  const canvas = await drawPostcard(input);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The postcard could not be drawn");
  return new File([blob], `ballpark-${input.puzzleNumber}.png`, { type: "image/png" });
}

/**
 * Shares the postcard with the text through the phone's share sheet. Where pictures cannot be shared (most
 * computers), the text is copied and the picture is saved instead.
 */
export async function sharePostcard(input: PostcardInput, text: string): Promise<"shared" | "saved" | "cancelled" | "failed"> {
  let file: File;
  try {
    file = await postcardFile(input);
  } catch {
    return "failed";
  }
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Saving the picture still works without the clipboard.
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "saved";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
