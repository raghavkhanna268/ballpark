import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync("apps/api/seed/seed.sql", "utf8");
const numbers = new Set();
for (const match of sql.matchAll(/\b\d{5,}\b/g)) numbers.add(match[0]);
const phrases = ["Dunstable", "Challenger Deep", "Azevedo", "Stockton and Darlington", "384,400", "12,756", "4,806", "puggles", "Hans Island", "Oliver Smoot", "Cow corner"];

function files(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...files(path));
    else if (/\.(js|css|html)$/.test(entry)) found.push(path);
  }
  return found;
}

const hits = [];
for (const path of files("apps/web/dist")) {
  const text = readFileSync(path, "utf8");
  for (const number of numbers) {
    const pattern = new RegExp(`(?<![0-9A-Fa-f])${number}(?![0-9A-Fa-f])`);
    if (pattern.test(text)) hits.push(`${path} contains answer-like number ${number}`);
  }
  for (const phrase of phrases) {
    if (text.includes(phrase)) hits.push(`${path} contains seed phrase ${phrase}`);
  }
}

if (hits.length > 0) {
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log(`Client bundle does not contain ${numbers.size} seeded answer numbers.`);
