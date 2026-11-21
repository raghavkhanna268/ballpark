export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const maximumFractionDigits = abs >= 100 ? 3 : abs >= 1 ? 3 : 4;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

export function formatFactValue(value: number, unit: string): string {
  if (unit === "year") {
    if (value < 0) return `${formatNumber(Math.abs(value))} BCE`;
    return `${formatNumber(value)} CE`;
  }
  const number = formatNumber(value);
  return unit ? `${number} ${unit}` : number;
}

export function roundSig(value: number, digits = 3): number {
  if (value === 0 || !Number.isFinite(value)) return value;
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const scale = 10 ** (exp - digits + 1);
  return Math.round(value / scale) * scale;
}

export function formatFactor(guess: number, answer: number): { text: string; direction: "high" | "low" | "exact" } {
  if (guess === answer) return { text: "Exact", direction: "exact" };
  const ratio = guess > answer ? guess / answer : answer / guess;
  const direction = guess > answer ? "high" : "low";
  const digits = ratio >= 10 ? 1 : 2;
  const shown = ratio.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  return { text: `${shown}× ${direction}`, direction };
}
