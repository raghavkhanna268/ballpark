export function haptic(kind: "tap" | "good" | "ok" | "bad"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const pattern = kind === "tap" ? 12 : kind === "good" ? [12, 36, 16] : kind === "ok" ? 18 : [26, 40, 26];
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers expose vibrate and then reject the call.
  }
}

export async function shareText(text: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
