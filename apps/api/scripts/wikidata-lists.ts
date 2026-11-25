/**
 * Drafts "name one" answer lists from Wikidata, with a starting rarity for each answer from how well known it is.
 *
 *   npm run wikidata:lists -w @ballpark/api                 every spec below
 *   npm run wikidata:lists -w @ballpark/api -- ray uranus   only these specs
 *   ... -- --pageviews                                      rarity from English Wikipedia views, not sitelinks
 *   ... -- --fixture path/to/response.json ray              build from a saved SPARQL response, offline
 *
 * It needs query.wikidata.org (and wikimedia.org for --pageviews), so it runs on a machine or cloud environment
 * that allows those hosts. It writes drafts to seed/drafts/, which git ignores. Prompts stay hand-written: a person
 * reads each draft, trims answers nobody would say, adds the spellings people type, and copies the list into a seed
 * file. Nothing here touches a database.
 *
 * Set WIKIMEDIA_CONTACT to a URL or address for the User-Agent, as Wikimedia asks of automated clients.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Spec = {
  id: string;
  /** What the list is for, to help the reviewer. The prompt itself is written by hand. */
  about: string;
  /** Returns ?item, ?itemLabel, ?sitelinks, optionally ?alias (one row per alias) and ?article (English Wikipedia URL). */
  sparql: string;
  /** Answers below this many sitelinks are dropped as too obscure. */
  minSitelinks: number;
};

const LANG = `SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }`;
const EXTRAS = `
  OPTIONAL { ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "en") }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  ?item wikibase:sitelinks ?sitelinks .`;

/** Each spec finds its subject by English label rather than by id, so the queries read plainly. */
const SPECS: Spec[] = [
  {
    id: "ray",
    about: "Films directed by Satyajit Ray",
    sparql: `SELECT ?item ?itemLabel ?alias ?article ?sitelinks WHERE {
      ?director rdfs:label "Satyajit Ray"@en .
      ?item wdt:P57 ?director ; wdt:P31/wdt:P279* wd:Q11424 .
      FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q24862 }${EXTRAS}
      ${LANG}
    }`,
    minSitelinks: 2,
  },
  {
    id: "pixar",
    about: "Feature films produced by Pixar",
    sparql: `SELECT ?item ?itemLabel ?alias ?article ?sitelinks WHERE {
      ?studio rdfs:label "Pixar"@en .
      ?item wdt:P272 ?studio ; wdt:P31/wdt:P279* wd:Q11424 .
      FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q24862 }${EXTRAS}
      ${LANG}
    }`,
    minSitelinks: 10,
  },
  {
    id: "uranus",
    about: "Moons of Uranus",
    sparql: `SELECT ?item ?itemLabel ?alias ?article ?sitelinks WHERE {
      ?planet rdfs:label "Uranus"@en ; wdt:P31 wd:Q634 .
      ?item wdt:P397 ?planet .${EXTRAS}
      ${LANG}
    }`,
    minSitelinks: 3,
  },
];

type Binding = Record<string, { value: string } | undefined>;
type Row = { qid: string; label: string; aliases: Set<string>; article: string | null; sitelinks: number };
export type DraftAnswer = { canonical: string; prior: number; aliases: string[]; qid: string; sitelinks: number; views: number | null };

const USER_AGENT = `BallparkSeedBuilder/0.1 (${process.env.WIKIMEDIA_CONTACT ?? "contact not set"})`;

/** One row per item, with its aliases gathered. Items with no English label come back as their id and are dropped. */
export function collect(bindings: Binding[]): Row[] {
  const rows = new Map<string, Row>();
  for (const binding of bindings) {
    const uri = binding.item?.value ?? "";
    const qid = uri.slice(uri.lastIndexOf("/") + 1);
    const label = binding.itemLabel?.value ?? "";
    if (!qid || !label || label === qid) continue;
    const row = rows.get(qid) ?? { qid, label, aliases: new Set<string>(), article: binding.article?.value ?? null, sitelinks: Number(binding.sitelinks?.value ?? 0) };
    const alias = binding.alias?.value;
    if (alias && alias !== label && alias.length <= 60) row.aliases.add(alias);
    rows.set(qid, row);
  }
  return [...rows.values()];
}

/**
 * Starting rarity: a share of 100 by how well known each answer is, so the best-known answer starts as the one
 * most players say. Fame is squared, because the famous few take most of the answers in practice. Every answer
 * keeps at least 1.
 */
export function priors(fame: number[]): number[] {
  const weights = fame.map((value) => Math.max(1, value) ** 2);
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => Math.max(1, Math.round((value / total) * 100)));
}

async function sparql(query: string): Promise<Binding[]> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { accept: "application/sparql-results+json", "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Wikidata answered ${response.status}`);
  return ((await response.json()) as { results: { bindings: Binding[] } }).results.bindings;
}

/** English Wikipedia views over the last 90 full days. */
async function pageviews(article: string): Promise<number> {
  const title = decodeURIComponent(article.slice(article.lastIndexOf("/wiki/") + 6));
  const end = new Date(Date.now() - 86_400_000);
  const start = new Date(end.getTime() - 89 * 86_400_000);
  const day = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "");
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title)}/daily/${day(start)}/${day(end)}`;
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) return 0;
  const body = (await response.json()) as { items?: Array<{ views: number }> };
  return (body.items ?? []).reduce((sum, item) => sum + item.views, 0);
}

export async function draft(spec: Spec, bindings: Binding[], usePageviews: boolean): Promise<DraftAnswer[]> {
  const rows = collect(bindings).filter((row) => row.sitelinks >= spec.minSitelinks);
  const views = usePageviews ? await Promise.all(rows.map((row) => (row.article ? pageviews(row.article) : Promise.resolve(0)))) : null;
  // Views spread over a much wider range than sitelinks, so they are taken as a square root before squaring.
  const fame = rows.map((row, index) => (views ? Math.sqrt(views[index]!) : row.sitelinks));
  const shares = priors(fame);
  return rows
    .map((row, index) => ({ canonical: row.label, prior: shares[index]!, aliases: [...row.aliases].sort(), qid: row.qid, sitelinks: row.sitelinks, views: views ? views[index]! : null }))
    .sort((left, right) => right.prior - left.prior || left.canonical.localeCompare(right.canonical));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const usePageviews = args.includes("--pageviews");
  const fixtureAt = args.indexOf("--fixture");
  const fixture = fixtureAt >= 0 ? args[fixtureAt + 1] : undefined;
  const names = args.filter((arg, index) => !arg.startsWith("--") && index !== fixtureAt + 1);
  const chosen = names.length > 0 ? SPECS.filter((spec) => names.includes(spec.id)) : SPECS;
  if (chosen.length === 0) throw new Error(`No spec named ${names.join(", ")}. Specs: ${SPECS.map((spec) => spec.id).join(", ")}`);
  if (fixture && chosen.length !== 1) throw new Error("--fixture builds one spec: name it");

  const out = join(dirname(fileURLToPath(import.meta.url)), "../seed/drafts");
  mkdirSync(out, { recursive: true });
  for (const spec of chosen) {
    const bindings = fixture ? (JSON.parse(readFileSync(fixture, "utf8")) as { results: { bindings: Binding[] } }).results.bindings : await sparql(spec.sparql);
    const answers = await draft(spec, bindings, usePageviews && !fixture);
    const file = join(out, `${spec.id}.json`);
    writeFileSync(
      file,
      `${JSON.stringify({ about: spec.about, source: "Wikidata, CC0", built: new Date().toISOString(), rarityFrom: usePageviews ? "pageviews" : "sitelinks", review: "Draft: trim, add spellings, then copy into a seed file.", answers }, null, 2)}\n`,
    );
    console.log(`${spec.id}: ${answers.length} answers -> ${file}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
