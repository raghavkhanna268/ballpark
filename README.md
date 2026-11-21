# Ballpark

Ballpark is a daily general-knowledge game. Everyone plays the same puzzle, and the day resets at midnight UTC. Two modes share one fact table: **Classic** (five questions) and **Head-to-head** (a run of pairs until the first miss). Both are scored on the server. There is no account.

Nothing here is deployed. Do not run `wrangler deploy`, `wrangler d1 create`, or any command that talks to a Cloudflare account.

## Run it

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

That one command loads the sample puzzles into local D1, then starts the API on [http://127.0.0.1:8787](http://127.0.0.1:8787) and the web app on [http://127.0.0.1:5173](http://127.0.0.1:5173). The web app proxies `/api` to the Worker, so the browser never needs a second origin.

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). In dev, add `?date=YYYY-MM-DD` to play another sample day (try `2026-01-01` through `2026-01-10` for the ten themes). The override works only against localhost and only while `ALLOW_DATE_OVERRIDE` is `"true"`.

## How a round works

1. The Worker picks the puzzle for the UTC date. Puzzle #1 is 2026-01-01. The sample seed has 10 days, and later dates rotate through those days: slot `(puzzleNumber - 1) mod 10`.
2. `GET /api/puzzle` returns prompts, item labels, and a log-slider range. It does not return values, context, or sources.
3. The browser sends one guess per question, with an anonymous device id kept in `localStorage`.
4. The Worker scores it, stores the submission, and returns the answer, one or two lines of context, a source link, and the crowd stat (median guess, or the share who got it fully right).
5. After the fifth question, the response includes the day's score out of 100 and "you beat X% of players today". One finisher beats 100% of the other finishers, because there aren't any. Ties are not counted as beaten.
6. A second submission for the same device, question, and UTC day is rejected. Refreshing shows the reveal you already earned.

Guess traffic is rate-limited per device and per IP (40 and 80 requests a minute). That is basic protection, not a cheat-proof board.

Streaks and the score histogram stay on the device: played, current streak, best streak, and five buckets from 0–20 through 81+. A missed UTC day breaks the streak. There is no account.

Each correct step zooms the scene out, from an atom toward the observable universe. A Classic day lands on the rung that matches the score. Head-to-head zooms once per correct pick, and a run that outlasts the ladder keeps counting on a "beyond the universe" tier. A miss stops the camera on "You reached". `prefers-reduced-motion` crossfades the scenes instead of scaling them. The scenes are CSS shapes, not image downloads.

Share uses the Web Share API when the browser has it, and copies to the clipboard otherwise. The card names the rung and stays free of answers:

```text
Ballpark #12 · Classic
🟩🟨🟦🟩⬛ 78 pts
⚛️→🧍→🌍 reached Earth
ballpark.local
```

`ballpark.local` is a placeholder host, not a registered domain.

## Head-to-head

Head-to-head is a second daily on the home screen, with its own streak. The Worker builds one sequence per UTC date from facts that share a metric (population with population, height with height). Early pairs are far apart, at least 5×, and later pairs sit inside 1.5×. Some rounds show one value and ask whether the other is higher or lower. One round in the sequence, when the facts allow it, is an odd-one-out among four.

`GET /api/head-to-head` returns only the current pair's labels. A higher-or-lower round also includes the one value that is meant to be visible. Context, sources, and the other values arrive after `POST /api/head-to-head/pick`. The body must carry the current sequence index. Skipping ahead or replaying an index is rejected. The first miss ends the run. A second scored run the same day is rejected. After that, a practice run uses a different sequence and is not written to the board.

A correct pick reveals both values, one line of context, and a source, then advances after about 1.4 seconds. The end screen shows the rung you reached, the run length, rarity points, the percent of players beaten, and the best scored run that day (a number, no names). Ranking is by run length. Equal lengths break on rarity points. The share card is:

```text
Ballpark #325 · Head-to-head
⚛️→🧍→🌍 reached Earth · 7 in a row
ballpark.local
```

## Scoring

Estimate distance is `d = |log10(guess) − log10(answer)|`. Cutoffs are rounded to four decimal places, so a guess of exactly twice the answer counts as within 2× (`log10(2)` is 0.30103, published as 0.3010).

| Band | Cutoff | Emoji | Base points |
| --- | --- | --- | --- |
| Within 10% | d ≤ 0.0414 | 🟩 | 16 |
| Within 2× | d ≤ 0.3010 | 🟨 | 12 |
| Within 10× | d ≤ 1 | 🟦 | 8 |
| Within 100× | d ≤ 2 | 🟤 | 4 |
| Way off | otherwise | ⬛ | 0 |

Confidence changes those points. "Right" means within 2× (green or yellow).

| Confidence | If within 2× | If not |
| --- | --- | --- |
| Wide | +0 | +0 |
| Medium | +2 | −2 |
| Narrow | +4 | −4 |

The base estimate score is clamped to 0–20, so a perfect narrow estimate is 20 and a narrow miss cannot go negative. A close estimate (green or yellow) can then add up to 6 crowd points when most other guesses were farther off.

Compare is 20 or 0 (🟩 or ⬛). Rank is 20 for the exact order (🟩), 12 for a single adjacent swap (🟨), and 0 otherwise (⬛).

Name-one is an open answer ("Name a country with more than 100 million people"). The Worker matches case, accents, aliases, and small typos against a server-side list. The autocomplete list is the whole group (every country, or every element) and is not the answer key. A correct name scores `20 × (0.5 + 1.5 × uniqueness)`, capped at 36. An invalid name scores 0. Rarer accepted answers are worth more.

Until 20 responses exist for an item, that score blends a fixed prior from the seed into the live share. At 20 it is fully live. Points during the UTC day are provisional ("points so far, final at reset"). At 00:00 UTC a Worker cron recomputes yesterday, and any read of a past day does the same. Percentiles use those final points. Head-to-head rarity is the share of players who missed that pair, with the same cold start.

The estimate field accepts `k`, `M`, and `B` for thousand, million, and billion. `m` means million, not milli. The control is a zoomable log number line. Its endpoints are fixed for the unit class (every distance-in-kilometres question shares one span) and are not centered on the answer. After you submit, the marker moves to the true value, the gap is marked, and faint dots show other players' guesses. Those dots are not in the question payload.

## Layout

```text
apps/web          React, TypeScript, Vite
apps/api          Cloudflare Worker + local D1
packages/shared   types, scoring, share text, date math
```

The web package imports the public helpers from `@ballpark/shared`. Scoring lives in `@ballpark/shared/scoring` and is used by the Worker and the unit tests. Puzzle numbers live in D1, not in the client bundle.

Schema, in short:

- `facts` — id, label, value, unit, metric, context, source, retrieved date, license, topic, difficulty, `verified`. Head-to-head pairs facts that share a metric.
- `questions` — prompt, type (`estimate` | `compare` | `rank` | `name_one`), unit, polarity, the fact ids, the display order, and for name-one an accepted-answer list that never leaves the server
- `puzzles` — a theme and five question ids, one of them a name-one
- `submissions` and `daily_results` — one row per device, question, and day, keyed with a `mode` column. `daily_results.points` is the rarity total. `finalized` flips when the UTC day is recomputed
- `h2h_picks` — one row per pick, so a pair's miss rate can be scored without storing names

## Sample content, and what has to change before a public game

`apps/api/seed/content.ts` and `apps/api/seed/more-facts.ts` are the sample set: 10 Classic days, 50 questions, and at least 150 facts for Head-to-head pairs (populations, areas, GDP, peaks, rivers, planets, animals, landmarks, inventions). Every row has `verified: false`. The numbers are widely documented figures with a real source URL, and they have not had an editorial pass. `apps/api/seed/seed.sql` is generated from those files. Give a new fact a `metric` that matches one in `METRIC_COPY`, or `unpaired` if nothing should be compared with it.

This repository is public. Anyone can read the seed. That is acceptable for a local sample and a bad idea for official answers. Before a real launch, stop committing puzzle values. Load them with an admin script from a file that is not in git, or from a private content repository, and keep D1 as the only copy the Worker reads. The client should keep receiving prompts only, the way it does now.

To add or edit a sample puzzle:

1. Edit `apps/api/seed/content.ts` or `apps/api/seed/name-one.ts`. An estimate uses one positive fact. A compare uses two. A rank uses three or four, and its display order must not already be the correct order. A name-one question carries a complete accepted list with priors, and its prompt must not contain an accepted name. Do not reuse a fact twice in the same day.
2. Run `npm run seed:emit -w @ballpark/api` and commit the TypeScript and the generated SQL together.
3. Run `npm run dev` again. The setup step reloads the local database.

`assertSeed()` runs as part of generating the SQL and as part of the API tests, so a day that is missing a question type, or a prompt that contains its own answer, fails fast.

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

`npm test` regenerates nothing; it checks that `seed.sql` matches the TypeScript, runs the scoring tests and the Worker tests, builds the web app, and fails if the client bundle contains seeded answer numbers. GitHub Actions runs lint, typecheck, and test. It does not deploy.

Worker tests use `@cloudflare/vitest-plugin` and a local D1. They check that a fresh puzzle payload has no answer fields, and that a second submission for the same device and question is rejected.

## Building a single Worker

Local development still uses `wrangler dev` for the API and Vite for the web app. A test deploy that cannot upload static assets can instead embed the built site in the Worker:

```bash
npm run build:deploy
```

That builds `apps/web`, writes `apps/api/src/assets.generated.ts` (gitignored), and runs `wrangler deploy --dry-run --outdir dist/worker` with `apps/api/wrangler.deploy.jsonc`. The dry run does not upload anything. The bundle's `src/deploy.ts` serves those files, falls back to `index.html` for client routes, and forwards `/api/*` to the game handler. Both configs schedule `0 0 * * *` so a closed day is finalized at midnight UTC. Do not add deploy secrets, and do not put a deploy step in CI.

## Ethics

Both daily modes are free. There is no account wall, no ad, no paywall, no loot box, and no streak-shame copy. A missed day simply ends that mode's streak. Archive play and any paid plan are out of scope.
