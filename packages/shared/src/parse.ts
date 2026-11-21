/**
 * Parse a positive guess. Accepts commas and k / M / B suffixes
 * (thousand / million / billion). `m` means million, not milli.
 * Also accepts scientific notation (`1.5e8`).
 */
export function parseShorthand(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "").replace(/\s+/g, "");
  if (!trimmed) return null;

  const suffixed = trimmed.match(/^(\d*\.?\d+)([kKmMbB])$/);
  if (suffixed) {
    const magnitude = Number(suffixed[1]);
    const suffix = suffixed[2].toLowerCase();
    const multiplier = suffix === "k" ? 1e3 : suffix === "m" ? 1e6 : 1e9;
    const value = magnitude * multiplier;
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (!/^(\d*\.?\d+)(e[+-]?\d+)?$/i.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}
