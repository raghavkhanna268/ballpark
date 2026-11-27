import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSeed, facts, packs, puzzles, questions } from "../seed/content.ts";

assertSeed();

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error("Refusing to write a non-finite number");
  return String(value);
}

const HEADER = [
  "-- SAMPLE DATA. verified = 0 on every row.",
  "-- Generated from seed/content.ts. Do not edit by hand.",
  "-- Pending human verification. Not an official puzzle set.",
  // No BEGIN/COMMIT: remote D1 rejects explicit transactions in an executed file.
];

/** Content rows only: facts, questions, puzzles and packs. `{VERB}` becomes INSERT or INSERT OR REPLACE. */
const rows: string[] = [];

for (const item of facts) {
  rows.push(
    `{VERB} INTO facts (id, label, value, unit, context, source_url, source_name, retrieved_at, license, topic, difficulty, verified, vintage, metric) VALUES (${[
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
      sqlString(item.metric),
    ].join(", ")});`,
  );
}

for (const item of questions) {
  rows.push(
    `{VERB} INTO questions (id, prompt, type, unit, polarity, scale, fact_ids, display_ids, context, source_url, source_name, retrieved_at, license, topic, difficulty, verified, accepted_json, entity_set) VALUES (${[
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
      item.accepted ? sqlString(JSON.stringify(item.accepted)) : "NULL",
      item.entitySet ? sqlString(item.entitySet) : "NULL",
    ].join(", ")});`,
  );
}

for (const item of puzzles) {
  rows.push(
    `{VERB} INTO puzzles (slot, theme, blurb, question_ids) VALUES (${[
      String(item.slot),
      sqlString(item.theme),
      sqlString(item.blurb),
      sqlString(JSON.stringify(item.questionIds)),
    ].join(", ")});`,
  );
}

for (const item of packs) {
  rows.push(
    `{VERB} INTO packs (id, title, emoji, blurb, question_ids, sort) VALUES (${[
      sqlString(item.id),
      sqlString(item.title),
      sqlString(item.emoji),
      sqlString(item.blurb),
      sqlString(JSON.stringify(item.questionIds)),
      String(item.sort),
    ].join(", ")});`,
  );
}

const withVerb = (verb: string) => rows.map((row) => row.replace("{VERB}", verb));

// A fresh database: wipe everything, results included, then load. Never run this on a database people have played on.
const seed = [
  ...HEADER,
  "DELETE FROM h2h_picks;",
  "DELETE FROM h2h_runs;",
  "DELETE FROM daily_results;",
  "DELETE FROM submissions;",
  "DELETE FROM puzzles;",
  "DELETE FROM packs;",
  "DELETE FROM questions;",
  "DELETE FROM facts;",
  ...withVerb("INSERT"),
  "",
].join("\n");

// A live database: replace the content rows in place and drop days or packs that no longer exist.
// Submissions, results, league rows and passes are never touched. No table has a foreign key, so REPLACE is safe.
const list = (values: string[]) => values.map(sqlString).join(", ");
const update = [
  ...HEADER,
  "-- Content update for a database people have played on. Saved results are kept.",
  ...withVerb("INSERT OR REPLACE"),
  `DELETE FROM puzzles WHERE slot NOT IN (${puzzles.map((item) => String(item.slot)).join(", ")});`,
  `DELETE FROM packs WHERE id NOT IN (${list(packs.map((item) => item.id))});`,
  "",
].join("\n");

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../seed/seed.sql");

if (process.argv.includes("--check")) {
  const current = readFileSync(out, "utf8");
  if (current !== seed) {
    console.error("seed.sql is out of date. Run npm run seed:emit -w @ballpark/api");
    process.exit(1);
  }
} else if (process.argv.includes("--update")) {
  const target = join(here, "../seed/update.sql");
  writeFileSync(target, update);
  console.log(`Wrote ${target}`);
} else {
  writeFileSync(out, seed);
  console.log(`Wrote ${out}`);
}
