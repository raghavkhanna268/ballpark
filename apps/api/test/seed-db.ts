import type { Confidence, Guess } from "@ballpark/shared";
import { facts, packs, puzzles, questions, type SeedQuestion } from "../seed/content.ts";

export async function resetAndSeed(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM daily_results"),
    db.prepare("DELETE FROM league_members"),
    db.prepare("DELETE FROM submissions"),
    db.prepare("DELETE FROM rate_limits"),
    db.prepare("DELETE FROM puzzles"),
    db.prepare("DELETE FROM packs"),
    db.prepare("DELETE FROM entitlements"),
    db.prepare("DELETE FROM plus_orders"),
    db.prepare("DELETE FROM questions"),
    db.prepare("DELETE FROM h2h_picks"),
    db.prepare("DELETE FROM h2h_runs"),
    db.prepare("DELETE FROM facts"),
  ]);

  const inserts: D1PreparedStatement[] = [];
  for (const item of facts) {
    inserts.push(
      db
        .prepare(
          `INSERT INTO facts (id, label, value, unit, context, source_url, source_name, retrieved_at, license, topic, difficulty, verified, vintage, metric)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .bind(
          item.id,
          item.label,
          item.value,
          item.unit,
          item.context,
          item.sourceUrl,
          item.sourceName,
          item.retrievedAt,
          item.license,
          item.topic,
          item.difficulty,
          item.vintage,
          item.metric,
        ),
    );
  }
  for (const item of questions) {
    inserts.push(
      db
        .prepare(
          `INSERT INTO questions (id, prompt, type, unit, polarity, scale, fact_ids, display_ids, context, source_url, source_name, retrieved_at, license, topic, difficulty, verified, accepted_json, entity_set)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .bind(
          item.id,
          item.prompt,
          item.type,
          item.unit,
          item.polarity,
          item.scale,
          JSON.stringify(item.factIds),
          JSON.stringify(item.displayIds),
          item.context,
          item.sourceUrl,
          item.sourceName,
          item.retrievedAt,
          item.license,
          item.topic,
          item.difficulty,
          item.accepted ? JSON.stringify(item.accepted) : null,
          item.entitySet,
        ),
    );
  }
  for (const item of puzzles) {
    inserts.push(
      db
        .prepare("INSERT INTO puzzles (slot, theme, blurb, question_ids) VALUES (?, ?, ?, ?)")
        .bind(item.slot, item.theme, item.blurb, JSON.stringify(item.questionIds)),
    );
  }
  for (const item of packs) {
    inserts.push(
      db
        .prepare("INSERT INTO packs (id, title, emoji, blurb, question_ids, sort) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(item.id, item.title, item.emoji, item.blurb, JSON.stringify(item.questionIds), item.sort),
    );
  }
  for (let index = 0; index < inserts.length; index += 40) {
    await db.batch(inserts.slice(index, index + 40));
  }
}

const factById = new Map(facts.map((item) => [item.id, item]));

export function correctGuess(question: SeedQuestion, confidence: Confidence = "narrow"): Guess {
  if (question.type === "name_one") {
    const accepted = question.accepted?.[0];
    if (!accepted) throw new Error(`${question.id} has no accepted answer`);
    return { type: "name_one", text: accepted.canonical };
  }
  if (question.type === "estimate") {
    return { type: "estimate", value: factById.get(question.factIds[0])!.value, confidence };
  }
  if (question.type === "compare") {
    const [left, right] = question.factIds.map((id) => factById.get(id)!);
    const higher = left.value >= right.value ? left : right;
    const lower = higher.id === left.id ? right : left;
    return { type: "compare", choiceId: question.polarity === "higher" ? higher.id : lower.id };
  }
  const ordered = [...question.factIds].sort((leftId, rightId) => {
    const diff = factById.get(leftId)!.value - factById.get(rightId)!.value;
    return question.polarity === "higher" ? -diff : diff;
  });
  return { type: "rank", order: ordered };
}

export function spaceDay() {
  const puzzle = puzzles.find((item) => item.theme === "Space")!;
  return puzzle.questionIds.map((id) => questions.find((item) => item.id === id)!);
}
