# Ballpark

Ballpark is a daily general-knowledge game. Everyone plays the same puzzle, and the day resets at midnight UTC. Two modes share one fact table: **Classic** (five questions) and **Head-to-head** (ten pairs, and you answer every one). Both are scored on the server. There is no account.

One test deploy exists, made by hand from the owner's Mac on 2026-11-22 at their request: https://ballpark.raghavkhanna.workers.dev (sample questions, Ballpark+ checkout off). Do not run `wrangler deploy`, `wrangler d1 create`, or any other command that talks to a Cloudflare account unless the owner asks for it. See [Test deploy](#test-deploy).

## Run it

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

That one command loads the sample puzzles into local D1, then starts the API on [http://127.0.0.1:8787](http://127.0.0.1:8787) and the web app on [http://127.0.0.1:5173](http://127.0.0.1:5173). The web app proxies `/api` to the Worker, so the browser never needs a second origin.

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). In dev, add `?date=YYYY-MM-DD` to play another sample day (try `2026-01-01` through `2026-01-10` for the ten themes). The override works only against localhost and only while `ALLOW_DATE_OVERRIDE` is `"true"`.

## How a round works

1. The Worker picks the puzzle for the UTC date. Puzzle #1 is 2026-01-01. The sample seed has 17 days, and later dates rotate through those days: slot `(puzzleNumber - 1) mod 17` (`SEED_SLOTS`). Slots 0 to 6 are the fun week (Snack Attack, Creature Feature, Game On, Word Nerd, Wonders & Legends, Lab Rats, Desi Masala). Slots 7 to 16 are the older themes, starting with Space.
2. `GET /api/puzzle` returns five open "name one" prompts. A question about countries or elements also gets the whole group as autocomplete (every country, or every element), which is not the answer key. Free-text questions (whales, Shakespeare plays) get no list, because a list of only the right answers would give them away. Accepted answers, context, and sources never leave the server before a guess.
3. The browser sends one guess per question, with an anonymous device id kept in `localStorage`.
4. The Worker scores it, stores the submission, and returns the answer, one or two lines of context, a source link, and the crowd stat (median guess, or the share who got it fully right).
5. After the fifth question, the response includes the day's score out of 500, your rank among today's finishers ("You're #3 of 40 today, 15 pts behind #2"), and a race link for the share card. Players on the same score share a rank.
6. A second submission for the same device, question, and UTC day is rejected. Refreshing shows the reveal you already earned.

Guess traffic is rate-limited per device and per IP (40 and 80 requests a minute). That is basic protection, not a cheat-proof board.

Streaks and the score histogram stay on the device: played, current streak, best streak, and five buckets from 0–100 through 401+. A missed UTC day breaks the streak. There is no account.

The scene fills most of the screen, with a compact question card below it. It is drawn as a blueprint: thin line art on a dark navy grid, with one amber accent for the climber and its trail. The game is a climb straight up, one stop per right answer: the launch pad, the rooftops, the skyscrapers, the clouds, the mountain peaks, the stratosphere, the edge of space (the Kármán line at 100 km), the space station, the Moon, the planets, and the Milky Way. The light changes as you rise, so every height looks different: a bright blueprint blue at the ground deepens to indigo by the stratosphere, dashed lines mark the tropopause and the stratopause, a thin glow sits under the Kármán line, and from there up the sky is black and full of stars. The climber is a jet-pack pilot in a cap and goggles, and above 100 km it is an astronaut in a helmet. The top corner shows your altitude (`ALT ≈ 9 km`) and the stop's name, and an altimeter on the right edge runs from 0 m to the top. Altitudes are rounded on purpose, so the scene never prints a number that a Head-to-head pair asks about. A correct answer flies the climber up along a dashed amber trail. A wrong answer or a timeout makes it sputter, turn red, and lift only a little. The end screen replays the whole climb. `prefers-reduced-motion` jumps to the new height instead of flying. The art is inline SVG, not image downloads.

The blueprint has a game layer on top, borrowed from arcade and synthwave games but kept to the same navy, cyan and amber. Numbers and call-outs use Orbitron (bundled with `@fontsource/orbitron`, no font CDN). The top corners are a heads-up display: altitude on the left, and on the right a score that counts up after each answer (`SCORE 225`, or `PICKS 07` in Head-to-head). Every scoring answer pops a glowing call-out, with rays behind Deep space and Supernova, and its points fly into the score. A miss flashes "MISS". Two or more scoring answers in a row light a `COMBO x3` meter, and a miss says "combo x3 lost". The combo is only for show: it never changes points, the league or the share text. The timer is ten blocks that go dark every three seconds and turn red for the last ten. Each question is a stage ("STAGE 2/5"), buttons are chunky and press down, the card has amber corner brackets, and the end screen says "Mission complete", tallies the score up from zero, lists each stage's points, and shows the best combo. Reduced motion turns the pop-ups, fly-ins and count-ups off.

How high you get is the score you carry around. There is no target: a run climbs as far as your answers take it. In Classic, the rarer the answer, the bigger the boost: the tier name flashes in the sky ("SUPERNOVA +100 pts") and the jet flame burns longer and hotter. What keeps people coming back is other people:

- **Ghost climbers.** Faint outline climbers rise with you: your own best on this device, today's average, today's best, and a friend whose race link you opened. The top-right corner always names the next one above you ("Next to beat · Today's best · ≈ 400 km"). Passing one shows a toast ("Passed today's best"). The average and the best come from finished runs today (`field` on `/api/puzzle` and `/api/head-to-head`).
- **Rank after every game.** The end screen says "You're #3 of 40 today" and how far behind the next rank you are, in points (Classic) or right answers (Head-to-head).
- **Race a friend.** The share card ends with a link such as `ballpark.local/?race=c326-735` (mode, puzzle number, height climbed). Opening it on the same day shows a challenge card on the home screen, the friend's climb flies beside yours, and the end screen says who climbed higher. The link carries no answers. It is not signed, so it is for fun between friends, not a ranking.
- **Weekly league.** Finishing any game puts you in this week's league (Monday to Sunday, UTC), in a group of up to 30 players of the same rank: Cadet, Pilot, Navigator, Commander, Captain. League points are your Classic points plus 50 per right Head-to-head pick, so a perfect day in both is 1,000. Next Monday, the top 5 of each group move up a league, and in groups of 15 or more the bottom 5 move down. Players show as stable anonymous callsigns ("Lunar Nova 57"), made from a hash of the device id. `GET /api/league` returns the table.
- **Streak shield.** One missed day a week doesn't break a streak. The home screen shows "Streak 6 · shield ready", and the end screen says when the shield covered a missed day. Like streaks, it lives on the device.
- **Logbook.** The home screen keeps your highest altitude, how many of the 11 heights you have reached, and the Moonshot-or-better answers you found, with the question each came from. It lives in `localStorage`.

Every question has a 30-second timer, in both modes. When it runs out, the answer locks as "Out of time": 0 points in Classic, a miss in Head-to-head. The timer is in the browser only. The server does not check it yet, so a reload starts it again.

Share uses the Web Share API when the browser has it, and copies to the clipboard otherwise. The card names the height you reached and stays free of answers:

```text
Ballpark #12 · Classic
🟩🟨🟦🟩⬛ 260 pts
🏁→🏙️→🎈 reached the stratosphere
Race my climb: ballpark.local/?race=c12-520
```

`ballpark.local` is a placeholder host, not a registered domain.

## Head-to-head

Head-to-head is a second daily on the home screen, with its own streak. The Worker builds one sequence of ten pairs per UTC date from facts that share a metric (population with population, height with height). The first pairs are far apart, at least 5×, and the last pairs sit inside 1.5×. Some rounds show one value and ask whether the other is higher or lower. One round in the sequence, when the facts allow it, is an odd-one-out among four.

`GET /api/head-to-head` returns only the current pair's labels. A higher-or-lower round also includes the one value that is meant to be visible. Context, sources, and the other values arrive after `POST /api/head-to-head/pick`. The body must carry the current sequence index. Skipping ahead or replaying an index is rejected. A wrong pick reveals the values and the game continues. The scored game ends after all ten picks. A second scored game the same day is rejected. After that, a practice game uses a different sequence and is not written to the board.

Each correct pick climbs one stop, with a flip and a jet trail. A miss coughs smoke, wobbles, and lifts about a third as far. The end screen shows the whole climb, where the climber stopped, the score out of 10, the percent of players beaten, and the best score that day (a number, no names). Ranking is by correct answers. Equal scores are ties: a faster finish does not rank higher, because timing a knowledge question rewards skimming. The share card names the height you reached:

```text
Ballpark #325 · Head-to-head
🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩 10/10 · reached the Milky Way
Race my climb: ballpark.local/?race=h325-1000
```

## Scoring

Classic is five open "name one" questions a day, scored by how rare your answer is. The Worker matches case, accents, aliases, and small typos against a server-side list, and works out the share of other players who gave the same answer. Your own answer does not count, so the first player of the day can still find a Supernova. Until 20 other answers exist, that share is blended with a fixed prior from the seed, and the reveal says so. The share sets a named tier:

| Tier | Share of other players | Points | Emoji |
| --- | --- | --- | --- |
| Supernova | 1% or less | 100 | 🟩 |
| Deep space | 3% or less | 75 | 🟩 |
| Moonshot | 8% or less | 50 | 🟨 |
| Orbit | 20% or less | 25 | 🟦 |
| Liftoff | more than 20% | 10 | 🟤 |
| Not on the list, or out of time | | 0 | ⬛ |

The ladder shows under every prompt, so the goal is to think past the obvious answer. How high an answer climbs follows its points: 0.6 of a stop for any right answer plus up to 1.4 more, so five Supernova answers reach the Milky Way. A wrong answer lifts 0.28.

The estimate, compare and rank scorers below are still in the code and tested, but no sample day uses them now.

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

The estimate score is clamped to 0–20, so a perfect narrow estimate is 20 and a narrow miss cannot go negative. Closeness and confidence are the whole estimate score. Compare is 20 or 0. Rank is 20 for the exact order, 12 for a single adjacent swap, and 0 otherwise. Head-to-head picks are right or wrong, with no rarity bonus.

The reveal's "percent of players" for a name-one answer is the live share including you, the same number as that answer's row in the list.

At 00:00 UTC a Worker cron recomputes yesterday, and any read of a past day does the same. Percentiles use those final points.

The estimate field accepts `k`, `M`, and `B` for thousand, million, and billion. `m` means million, not milli. The control is a zoomable log number line. Its endpoints are fixed for the unit class (every distance-in-kilometres question shares one span) and are not centered on the answer. After you submit, the marker moves to the true value, the gap is marked, and faint dots show other players' guesses. Those dots are not in the question payload.

## Ballpark+

The daily Classic, Head-to-head, the league, ranks, race links and streaks are free for everyone. Ballpark+ adds:

- **Themed packs.** A pack is five name-one questions on one theme, played any day, once per device: Cricket Crazy 🏏, Screen Time 🎬 and Space Nerd 🚀 in the sample. Rarity is counted among everyone who has played that pack, and the end screen ranks you among them ("You're #2 of 40 who played this pack"). Pack answers are `submissions` rows with `mode = 'pack'` and `puzzle_date = 'pack:<id>'`. They never reach `daily_results`, so a pass never adds league points.
- **No ads.** Free players see a labelled ad space on the home screen and the end screen. There is no ad network yet: it is a placeholder (`AdSlot` in `apps/web/src/plus.tsx`) that also links to Ballpark+. Members never see it.

Without a pass, `GET /api/packs` lists the packs as locked and the questions stay on the server. `GET /api/packs/:id` and `POST /api/packs/:id/guess` answer `402 plus_required`.

A pass is a one-time purchase for this device, 30 or 365 days, and it does not renew by itself. Prices in `packages/shared/src/plus.ts` are **placeholders** (₹99 a month, ₹799 a year). Buying early adds the new days to the days left. A pass is tied to the anonymous device id, like the rest of the game, so clearing site data loses it. "Restore purchase" by phone or email is a follow-up.

### Razorpay

Payment uses Razorpay's standard web checkout:

1. `POST /api/plus/order` `{ plan }` creates an order through `https://api.razorpay.com/v1/orders` with the key id and secret, and stores it in `plus_orders` against the device.
2. The browser loads `https://checkout.razorpay.com/v1/checkout.js` and opens Checkout with the public key id and that order id (UPI, cards, netbanking).
3. `POST /api/plus/verify` `{ orderId, paymentId, signature }` recomputes `HMAC-SHA256(order_id + "|" + payment_id)` with the secret and compares it with Razorpay's signature. Only a match, on an order this device created, starts the pass. Confirming the same payment twice grants nothing new, and a paid order cannot be reused.

`GET /api/plus` tells the app whether the device has a pass, the prices, and Razorpay's public key id when checkout is configured. The secret never leaves the Worker.

Keys are never committed. For local play, put test-mode keys in `apps/api/.dev.vars` (gitignored):

```text
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
```

A deployed Worker would take them as Worker secrets (`wrangler secret put RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`). That command talks to a Cloudflare account, so it is not run from this repository. With no keys, checkout is off: the page says payments are not switched on, and `POST /api/plus/order` answers `503 payments_not_configured`.

For trying packs locally, `PLUS_TEST_UNLOCK` is `"true"` in `wrangler.jsonc`, and the Ballpark+ page shows "Unlock for testing (no payment)". `POST /api/plus/test-unlock` works only with that flag and only on a local address. `wrangler.deploy.jsonc` sets it to `"false"`.

Before taking real money: set the real prices, turn on automatic capture in the Razorpay dashboard (or capture in the Worker), and add a Razorpay webhook (`payment.captured`) so a pass still starts if the browser closes before `verify` runs.

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
- `puzzles` — a theme and five question ids, all name-one
- `submissions` and `daily_results` — one row per device, question, and day, keyed with a `mode` column. Head-to-head `score` is correct picks out of 10. `finalized` flips when the UTC day is recomputed
- `h2h_picks` — one row per pick, so a pair's miss rate can be scored without storing names
- `league_members` — one row per device per league week: its rank (`tier`), its group, and whether last week moved it up or down
- `packs` — a Ballpark+ pack: title, emoji, blurb, and five question ids
- `entitlements` — one row per device with a pass: plan, source (`razorpay` or `test`), payment id, and when it ends
- `plus_orders` — Razorpay orders this Worker created, with the device and plan, so a payment only counts for its own order

## Sample content, and what has to change before a public game

`apps/api/seed/content.ts`, `apps/api/seed/fun.ts` and `apps/api/seed/more-facts.ts` are the sample set: 17 Classic days, 3 Ballpark+ packs, 100 questions, and at least 150 facts for Head-to-head pairs (populations, areas, GDP, peaks, rivers, planets, animals, landmarks, inventions). Every row has `verified: false`. The numbers are widely documented figures with a real source URL, and they have not had an editorial pass. `apps/api/seed/seed.sql` is generated from those files. Give a new fact a `metric` that matches one in `METRIC_COPY`, or `unpaired` if nothing should be compared with it.

This repository is public. Anyone can read the seed. That is acceptable for a local sample and a bad idea for official answers. Before a real launch, stop committing puzzle values. Load them with an admin script from a file that is not in git, or from a private content repository, and keep D1 as the only copy the Worker reads. The client should keep receiving prompts only, the way it does now.

The fun week and the packs in `apps/api/seed/fun.ts` set the voice for new questions: a cheeky prompt that still asks for real knowledge ("Name a fruit that botanists call a berry. Warning: the strawberry is a fraud."), a long list of right answers so nobody is stuck, and a reveal with one fact worth repeating. Facts that could change soon, such as a current champion or this year's winner, are left out.

To add or edit a sample puzzle:

1. Edit `apps/api/seed/fun.ts`, `apps/api/seed/content.ts`, `apps/api/seed/name-one.ts`, or `apps/api/seed/name-one-more.ts`. Every Classic question is a name-one question. The older days override a base question id. The fun week and the packs are new ids in `fun.ts`, and a pack is an entry in its `packs` list. Every question belongs to exactly one day or one pack. Set `entitySet` to `countries` or `elements` when the answers are all in that list (every accepted name must then be in it), or `null` for free text with no autocomplete. Give each accepted answer a prior (how often you expect players to say it) and the aliases people type, and never give one spelling to two answers. An estimate uses one positive fact. A compare uses two. A rank uses three or four, and its display order must not already be the correct order. A name-one question carries a complete accepted list with priors, and its prompt must not contain an accepted name. Do not reuse a fact twice in the same day.
2. Run `npm run seed:emit -w @ballpark/api` and commit the TypeScript and the generated SQL together.
3. Run `npm run dev` again. The setup step reloads the local database.

`assertSeed()` runs as part of generating the SQL and as part of the API tests, so a day that is not five name-one questions, a spelling shared by two answers, or a prompt that contains its own answer, fails fast.

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

## Test deploy

Only when the owner asks, and from a machine signed in to their Cloudflare account (`npx wrangler login`). From `apps/api`:

1. `npx wrangler d1 create ballpark` once, then put its id in `wrangler.deploy.jsonc` in place of the placeholder. Keep that edit local.
2. `npx tsx scripts/emit-seed.ts`, then `npx wrangler d1 migrations apply ballpark --remote --config wrangler.deploy.jsonc`, then `npx wrangler d1 execute ballpark --remote --config wrangler.deploy.jsonc --file=./seed/seed.sql`. The seed deletes every saved result first, so load it only into a fresh database. `seed.sql` has no `BEGIN`/`COMMIT`, because remote D1 rejects explicit transactions.
3. From the repo root, `npm run build:deploy`. Then, from `apps/api`, `npx wrangler deploy --config wrangler.deploy.jsonc`.
4. Set `SHARE_HOST` to the printed workers.dev host, then build and deploy again, so share links point at the deploy.

`PLUS_TEST_UNLOCK` stays `"false"` in that config, so packs stay locked there until Razorpay keys are added as Worker secrets.

## Ethics

Both daily modes, the league and streaks are free, with no account wall. Ballpark+ sells extra packs and the removal of ads, not an edge: a pass never adds league points, and every free player gets the same daily questions. There is no loot box and no streak-shame copy. The ad space is a placeholder with no ad network or tracking behind it. Archive play is out of scope.
