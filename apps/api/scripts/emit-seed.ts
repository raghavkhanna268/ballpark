import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSeed, facts, puzzles, questions } from "../seed/content.ts";

assertSeed();

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error("Refusing to write a non-finite number");
  return String(value);
}

const lines: string[] = [
  "-- SAMPLE DATA. verified = 0 on every row.",
  "-- Generated from seed/content.ts. Do not edit by hand.",
  "-- Pending human verification. Not an official puzzle set.",
  "BEGIN TRANSACTION;",
  "DELETE FROM puzzles;",
  "DELETE FROM questions;",
  "DELETE FROM facts;",
];

for (const item of facts) {
  lines.push(
    `INSERT INTO facts (id, label, value, unit, context, source_url, source_name, retrieved_at, license, topic, difficulty, verified, vintage) VALUES (${[
      sqlString(item.id),
      sqlString(item.label),
      sqlNumber(item.value),
      sqlString(item.unit),
      sqlString(item.context),
      sqlString(item.sourceUrl),
      sqlString(item.sourceName),
      sqlString(item.retrievedAt),
      sqlString(item.license),
      sqlString(item.topic),
      String(item.difficulty),
      "0",
      item.vintage ? sqlString(item.vintage) : "NULL",
    ].join(", ")});`,
  );
}

for (const item of questions) {
  lines.push(
    `INSERT INTO questions (id, prompt, type, unit, polarity, scale, fact_ids, display_ids, context, source_url, source_name, retrieved_at, license, topic, difficulty, verified) VALUES (${[
      sqlString(item.id),
      sqlString(item.prompt),
      sqlString(item.type),
      item.unit ? sqlString(item.unit) : "NULL",
      sqlString(item.polarity),
      item.scale ? sqlString(item.scale) : "NULL",
      sqlString(JSON.stringify(item.factIds)),
      sqlString(JSON.stringify(item.displayIds)),
      sqlString(item.context),
      sqlString(item.sourceUrl),
      sqlString(item.sourceName),
      sqlString(item.retrievedAt),
      sqlString(item.license),
      sqlString(item.topic),
      String(item.difficulty),
      "0",
    ].join(", ")});`,
  );
}

for (const item of puzzles) {
  lines.push(
    `INSERT INTO puzzles (slot, theme, blurb, question_ids) VALUES (${[
      String(item.slot),
      sqlString(item.theme),
      sqlString(item.blurb),
      sqlString(JSON.stringify(item.questionIds)),
    ].join(", ")});`,
  );
}

lines.push("COMMIT;", "");
const sql = lines.join("\n");
const out = join(dirname(fileURLToPath(import.meta.url)), "../seed/seed.sql");

if (process.argv.includes("--check")) {
  const current = readFileSync(out, "utf8");
  if (current !== sql) {
    console.error("seed.sql is out of date. Run npm run seed:emit -w @ballpark/api");
    process.exit(1);
  }
} else {
  writeFileSync(out, sql);
  console.log(`Wrote ${out}`);
}
