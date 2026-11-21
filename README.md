# Ballpark

Ballpark is a daily general-knowledge game. Everyone plays the same puzzle, and the day resets at midnight UTC. This milestone is **Classic** only: five questions, scored on the server, playable in a browser with no account.

Head-to-head (a run of higher-or-lower until you miss) is not built yet. The fact table is shaped so it can be added without a new data model: a fact is a named number with a unit, a source, and a short context. Classic questions point at those facts. A later mode can pair any two facts and ask which value is larger.

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

Streaks and the score histogram stay on the device: played, current streak, best streak, and five buckets from 0–20 through 81–100. A missed UTC day breaks the streak. There is no account.

Share uses the Web Share API when the browser has it, and copies to the clipboard otherwise. The card is emoji and score only:

```text
Ballpark #12 · Classic
🟩🟨🟦🟩⬛ 78/100
ballpark.local
```

`ballpark.local` is a placeholder host, not a registered domain.

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

Points are clamped to 0–20, so a perfect narrow estimate is 20 and a narrow miss cannot go negative. Five questions make 100.

Compare is 20 or 0 (🟩 or ⬛). Rank is 20 for the exact order (🟩), 12 for a single adjacent swap (🟨), and 0 otherwise (⬛).

The estimate field accepts `k`, `M`, and `B` for thousand, million, and billion. `m` means million, not milli. The slider is a log scale. Its endpoints are fixed for the unit class (every distance-in-kilometres question shares one span) and are not centered on the answer.

## Layout

```text
apps/web          React, TypeScript, Vite
apps/api          Cloudflare Worker + local D1
packages/shared   types, scoring, share text, date math
```

The web package imports the public helpers from `@ballpark/shared`. Scoring lives in `@ballpark/shared/scoring` and is used by the Worker and the unit tests. Puzzle numbers live in D1, not in the client bundle.

Schema, in short:

- `facts` — id, label, value, unit, context, source, retrieved date, license, topic, difficulty, `verified`
- `questions` — prompt, type (`estimate` | `compare` | `rank`), unit, polarity, the fact ids, the display order
- `puzzles` — a theme and five question ids
- `submissions` and `daily_results` — one row per device, question, and day, keyed with a `mode` column so head-to-head can sit beside Classic

## Sample content, and what has to change before a public game

`apps/api/seed/content.ts` is the sample set: 10 days, 50 questions, across space, Earth, the body, inventions, landmarks, nature, maps, science, and culture. Every row has `verified: false`. The numbers are widely documented figures with a real source URL, and they have not had an editorial pass. `apps/api/seed/seed.sql` is generated from that file.

This repository is public. Anyone can read the seed. That is acceptable for a local sample and a bad idea for official answers. Before a real launch, stop committing puzzle values. Load them with an admin script from a file that is not in git, or from a private content repository, and keep D1 as the only copy the Worker reads. The client should keep receiving prompts only, the way it does now.

To add or edit a sample puzzle:

1. Edit `apps/api/seed/content.ts`. An estimate uses one positive fact. A compare uses two. A rank uses three or four, and its display order must not already be the correct order. Do not reuse a fact twice in the same day.
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

## Ethics

Classic is free. There is no account wall, no ad, no paywall, no loot box, and no streak-shame copy. A missed day simply ends the streak. Head-to-head, archive play, and any paid plan are out of scope for this milestone.
