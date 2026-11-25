# Ballpark

Ballpark is a daily general-knowledge game. Everyone plays the same puzzle, and the day resets at midnight India time (UTC+5:30), for everyone. **Classic** is seven open questions a day, scored on the server. A second mode, **Head-to-head** (ten pairs from a shared fact table), is built and tested but switched off in the web app for now: `HEAD_TO_HEAD_ON` in `apps/web/src/App.tsx` turns it back on. There is no account.

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

1. The Worker picks the puzzle for today's date in India time (`playToday` in `packages/shared/src/dates.ts`). Puzzle #1 is 2026-01-01. The sample seed has 17 days, and later dates rotate through those days: slot `(puzzleNumber - 1) mod 17` (`SEED_SLOTS`). Slots 0 to 6 are the fun week (Snack Attack, Creature Feature, Game On, Word Nerd, Wonders & Legends, Lab Rats, Desi Masala). Slots 7 to 16 are the older themes, starting with Space.
2. `GET /api/puzzle` returns seven open "name one" prompts. A question about countries or elements also gets the whole group as autocomplete (every country, or every element), which is not the answer key. Free-text questions (whales, Shakespeare plays) get no list, because a list of only the right answers would give them away. Accepted answers, context, and sources never leave the server before a guess.
3. The browser sends one guess per question, with an anonymous device id kept in `localStorage`.
4. The Worker scores it, stores the submission, and returns the answer, one or two lines of context, a source link, and the crowd stat (median guess, or the share who got it fully right).
5. After the seventh question, the response includes the day's score out of 700, your rank among today's finishers ("You're #3 of 40 today, 15 pts behind #2"), and a race link for the share card. Players on the same score share a rank. The app only shows the rank once 20 players have finished that day (see below).
6. A second submission for the same device, question, and game day is rejected. Refreshing shows the reveal you already earned.

Guess traffic is rate-limited per device and per IP (40 and 80 requests a minute). That is basic protection, not a cheat-proof board.

Streaks and the score histogram stay on the device: played, current streak, best streak, and five buckets from 0–140 through 561+. A missed day breaks the streak. There is no account.

The climb fills the whole screen, behind everything, and the card floats over its top, like Krillion's dive. The question, the timer and the answer box sit at the top, so the phone keyboard never covers them, and the rocket waits in the open sky under the card. Every screen fits a phone (375 × 667 and up) without scrolling: the end screen shows the stages as one row of tiles, and the home screen keeps the day and the play button up top, then a row for Journeys, the archive and Unlimited, then the league, Ballpark+, Today, Hangar, logbook and stats as tiles. Only a very short window (a landscape phone, or an Android keyboard that shrinks the page) lets the card scroll inside itself. The rocket rests 84% of the way down the screen, or lower under a tall card (`--sheet-bottom`, measured in `journey.tsx`), and glides when the card changes size. On a screen 900 px or wider the card sits on the left and the rocket climbs at 62% of the width. Ads, for free players, sit in a slim strip at the bottom of the screen. The scene is drawn on a canvas (`apps/web/src/sky.ts`), with no image downloads. The rocket climbs past real landmarks at their real heights: Qutub Minar (73 m), the top of the Burj Khalifa, the monsoon clouds, Everest's summit, the height where jets cruise, where weather balloons pop, where meteors burn up, the edge of space (100 km), the space station, the TV satellites, the Moon, Mars, Saturn, the centre of the Milky Way, and Andromeda. A dashed line crosses the sky at each one with its name and height, and the height between two landmarks grows on a log scale (`MILESTONES` and `altitudeKm` in `packages/shared/src/scale.ts`), so every point moves the camera about as far. The sky darkens into space as you rise, with clouds, birds, a jet, an aurora, the curve of the Earth, the station, satellites, the Moon, Mars, Saturn and the Milky Way on the way. The ground changes each day, the same for everyone, by puzzle number: City night (a skyline, a bay of lights, palms), Sunset coast (the sea, palms, a lighthouse) and Himalaya (snow peaks, pines, prayer flags). The top corner shows your altitude as a real height ("9.6 km", "384,000 km"), and an altimeter on the right edge has a tick for every landmark. A landmark's height is rounded when a seeded question has the exact figure as its answer (the Moon shows as 384,000 km), so the client bundle never carries an answer (`scripts/check-client-bundle.mjs`). The end screen replays the whole climb.

**One thing on screen at a time, like a Krillion dive.** In Krillion the prompt card disappears the moment you answer and the dive takes the screen. Ballpark does the same upward. While a question is open, the card holds only the question: the theme, the timer, the prompt, "Rarer answers climb higher", the answer box and Lock in. The prompt shows for 3 seconds before the clock starts ("Clock starts in 3"), so reading it is free. The stage strip (one square per question, filled in its band's colour once answered, and "STAGE 3/7") sits in the heads-up display, between the altitude and the score. Once you lock in, the card clears away and the rocket climbs with your answer riding above it. Height follows points with no base amount, so a Supernova climbs ten times as far as a Liftoff, and a rarer answer burns longer: about 1.6 seconds for a Liftoff and 4 for a Supernova. The burner and the exhaust take the tier's colour (Liftoff copper, Orbit blue, Moonshot gold, Deep space green, Supernova pink), the gain counts up beside the rocket ("+9.6 km"), each landmark passed pops a line at the bottom ("Passed the summit of Everest · 8.8 km"), and a Supernova shakes the screen. Deep space and Supernova end in a burst of sparks. The trail under the rocket keeps each answer's stretch in its tier's colour, and the rocket wears a band in the colour of your last tier. A timeout sputters and holds its height. Then the result appears over the scene: a picture for the tier (🎈 Liftoff, 🛰️ Orbit, 🌙 Moonshot, 🪐 Deep space, 🌟 Supernova, ⏱️ out of time), the tier in its colour, your answer, a line on what it did ("Rare air. Few players went here."), the points, one line on the crowd and the rare answers, the fact, and the source. Deep space and Supernova results glow. "Next stage ▲" brings the card back, and the next landmark shows under the card ("Next: Everest summit · 1.5 km to go"). Packs play the same way. Reduced motion skips the climb and shows the result at once. A screen turns this on with `useFocusMode()` from `journey.tsx`.

The card keeps the blueprint look, with a game layer on top. Numbers and call-outs use Orbitron (bundled with `@fontsource/orbitron`, no font CDN). The heads-up display has the altitude on the left, and on the right a score that counts up after each climb lands (`SCORE 225`, or `PICKS 07` in Head-to-head). Two or more scoring answers in a row light a `COMBO x3` meter just under the card. The combo is only for show: it never changes points, the league or the share text. The timer is ten blocks that go dark every three seconds and turn red for the last ten. Each question is a stage ("STAGE 2/7"), buttons are chunky and press down, the card has amber corner brackets, and the end screen says "Mission complete", tallies the score up from zero, shows each stage's points as a row of tiles, and shows the best combo. Reduced motion turns the count-ups off.

Sound is on unless you turn it off (the switch in the corner). It is made with WebAudio, so there are no files: a burner that roars louder, deeper and longer for rarer answers, a chime that steps up the scale for each landmark passed, a bright arpeggio for Deep space and Supernova, a sputter for a timeout, and a bonk for a name that is not on the list (`apps/web/src/sound.ts`). Browsers only allow sound after a tap, so the first tap on the page wakes it.

How high you get is the score you carry around. There is no target: a run climbs as far as your answers take it, and seven Supernova answers reach the centre of the Milky Way. The Afterburner (below) is the only way past it, to Andromeda. What keeps people coming back is other people:

- **Ghost rockets.** Faint dashed rockets sit at other climbs' heights: your own best on this device, today's average, today's best, and a friend whose race link you opened. A tag just under the card always names the next one above you ("Next to beat · Today's best · 400 km"). Passing one on the way up shows a line at the bottom ("Passed today's best"). The average and the best come from finished runs today (`field` on `/api/puzzle` and `/api/head-to-head`).
- **Rank after every game.** The end screen says "You're #3 of 40 today" and how far behind the next rank you are, in points (Classic) or right answers (Head-to-head).
- **Race a friend.** The share card ends with a link such as `ballpark.local/?race=c326-735` (mode, puzzle number, height climbed). Opening it on the same day shows a challenge card on the home screen, the friend's climb flies beside yours, and the end screen says who climbed higher. The link carries no answers. It is not signed, so it is for fun between friends, not a ranking.
- **Weekly league.** Finishing any game puts you in this week's league (Monday to Sunday, by game day), in a group of up to 30 players of the same rank: Cadet, Pilot, Navigator, Commander, Captain. League points are your Classic points, so a perfect day is 700 (a right Head-to-head pick adds 50 when that mode is on). The table only opens once a group has 20 players. From then on, next Monday the top 5 of each group move up a league, and the bottom 5 move down. A group under 20 moves nobody. Players show as stable anonymous callsigns ("Lunar Nova 57"), made from a hash of the device id. `GET /api/league` returns the table.
- **Streak shield.** One missed day a week doesn't break a streak. The home screen shows "Streak 6 · shield ready", and the end screen says when the shield covered a missed day. Like streaks, it lives on the device.
- **Logbook.** A home-screen tile keeps your highest altitude, how many of the 15 landmarks you have passed, and the Moonshot-or-better answers you found, with the question each came from. It lives in `localStorage`.

**The daily habit (Phase 2).** These sit on top of the climb and keep people coming back each day:

- **Afterburner ×2.** Once a day, before locking in an answer, you can arm the Afterburner. That stage's points double, and so does its climb, with a white-hot flame and an orange burst on landing. It counts in the league and the rank. Its tile on the share card carries a 🔥 and its tile on the postcard says ×2. A second boost the same day answers `409 afterburner_used`. The tier and colour still come from the answer's own points, so a boosted Liftoff is still a Liftoff.
- **Hangar.** Rocket paint jobs you earn, never sell: Marigold at a 3-day streak, Monsoon at 7, Midnight at 14, Aurora at 30, Chrome at 50 and Gold at 100, plus Supernova (find a Supernova answer) and Moonwalker (climb past the Moon). Unlocks follow your best streak, so a paint job stays yours if the streak later breaks. The rocket flies in the one you pick, and friends see it on the Today board and as your ghost in race links (`c326-735.gold`). The end screen shows a banner the day you earn one. It lives in `localStorage` (`apps/web/src/hangar.tsx`).
- **Flight log.** The end screen has four tabs. Result is the score and tiles. Flight log draws your climb stage by stage past the landmarks, and the curve of today's climbs with yours marked ("Higher than 72% of today's climbs"). The catch lists each answer and how many players gave it ("4 of 61 said it", "Only you said it"). Today is the board. Crowd numbers wait for 20 players.
- **Postcard.** "Share postcard" draws a 1080 × 1350 picture of today's scenery with your rocket in its paint job at the height you reached, the trail in tier colours, the tiles, the height and the score, and no answers (`apps/web/src/postcard.ts`). Phones share it with the text through the share sheet. Where pictures cannot be shared, the text is copied and the picture is saved.
- **Today board.** The ten highest Classic climbs today by callsign, each with its rocket, plus your own row if you are lower. It opens at 20 finishers (`today.board` on `/api/puzzle`).
- **Players today.** The home card says "N climbing today" once 20 players have answered at least one question.
- **Streak reminder.** An opt-in switch on the end screen. At 8 PM India time a Worker cron (`30 14 * * *`) sends one browser notification to devices that played one of the last two days and not yet today, at most once a day. The push has no body, so only the endpoint is stored, and only the major browsers' push hosts are accepted. Without VAPID keys the switch hides itself (see Test deploy).
- **Should this count?** After a name is rejected, the card offers "Should “Abu Dhabi” count? Tell us". It goes to `answer_reports` (`POST /api/report`, 20 a minute per device). If we add that name to the seed, the midnight recount swaps it in for that player when it scores more.
- **Stuck nudge.** After 15 seconds on a Classic question, a "Stuck? Get a nudge" button shows a one-line hint from the seed (`apps/api/seed/nudges.ts`). Opening it caps that answer at Moonshot (50 points). The seed check fails if a nudge names an accepted answer or alias.

**More to play (Phase 3).** Under today's Classic, three buttons open the rest. None of them touches the streak, the rank or the league, except that Cruise keeps the streak:

- **Cruise.** A switch under the play button plays today's Classic with no clock and no wait before typing. It keeps the streak and the reminder, and the share card says "Cruise" instead of "Classic". A cruise is left out of the rank, the Today board, the curve, the climbers count, the ghosts and the league (`cruise = 1` on its `submissions` and `daily_results` rows). Its answers still count toward rarity for everyone. The first answer of a day decides it: switching midway answers `409 mode_locked`.
- **Archive.** Any past day's Classic, newest first, 28 days a page (`GET /api/archive?before=`). The last 7 days are free; older days are in Ballpark+ (`402 plus_required`). Rarity is the day as it was played live, and the end screen says where you would have ranked that day ("You'd have been #4 of 61 that day"). A day you played live stays as you played it (`409 played_that_day`). Answers are `submissions` rows with `mode = 'archive'` and the day's date. The share card says "Ballpark #N · Archive".
- **Unlimited (Ballpark+).** Rounds of seven questions, as many as you like (`POST /api/unlimited` deals one, or hands back the round still open). Questions come from `unlimited_pool`, which the seed fills with every daily question. A day joins the pool only once it has run, and today's never does, so Unlimited cannot give away a daily. Questions you have not answered anywhere come first. Rarity counts every answer the question has ever had, live, in the archive or here. A round is `unlimited_rounds` plus `submissions` rows with `mode = 'unlimited'` and `puzzle_date = 'unlimited:<round id>'`. There is no rank, since every round is different.
- **Pack journeys (Ballpark+).** Each pack is a route of three chapters of five questions (`pack_chapters`, with the route's name on `packs.route`), shown as a map. A chapter opens once the one before it is finished (`403 chapter_locked`). Chapter 1 is the pack's original five questions and keeps their old key (`pack:<id>`), so earlier answers still count; later chapters are `pack:<id>:<n>`. Rarity and the rank count everyone who has played that chapter.

**Comparing waits for 20 players.** A comparison with three other people means little, so nothing compares you with the crowd until there are 20 of them (`COMPARE_MIN_PLAYERS` in `packages/shared/src/compete.ts`). Below that, a finished Classic, chapter or archive day shows "Early player #N to finish today" (or "this chapter", "that day") instead of a rank, the "Today's average" and "Today's best" ghost climbers stay hidden, the reveal says rarity is still our estimate instead of showing crowd shares, and the league card says how many players the group has so far. Rarity points still work from the first answer, because they fall back on the seed's priors until 20 answers exist.

Every question has a 30-second timer, in both modes, and it starts after the 3-second read. When it runs out, the answer locks as "Out of time": 0 points in Classic, a miss in Head-to-head. The timer is in the browser only. The server does not check it yet, so a reload starts it again.

**Second chance.** A name that is not on the list does not end the question. The server answers `422 not_listed`, stores nothing, and the card says "Not on our list. Try another. −2 s": the box shakes and clears, and the clock loses 2 seconds. You can keep trying until a name is on the list or the clock runs out. Tries are rate limited per question (10 a minute, `RETRY_LIMIT`). A timeout still stores 0 points.

Share uses the Web Share API when the browser has it, and copies to the clipboard otherwise. The card names the height you climbed and the last landmark you passed, and stays free of answers:

```text
Ballpark #12 · Classic
🟩🟨🟦🟩⬛ 260 pts
🚀 9.6 km · past Everest summit
Race my climb: ballpark.local/?race=c12-520
```

`ballpark.local` is a placeholder host, not a registered domain.

## Head-to-head

Head-to-head is a second daily on the home screen, with its own streak. The Worker builds one sequence of ten pairs per game date from facts that share a metric (population with population, height with height). The first pairs are far apart, at least 5×, and the last pairs sit inside 1.5×. Some rounds show one value and ask whether the other is higher or lower. One round in the sequence, when the facts allow it, is an odd-one-out among four.

`GET /api/head-to-head` returns only the current pair's labels. A higher-or-lower round also includes the one value that is meant to be visible. Context, sources, and the other values arrive after `POST /api/head-to-head/pick`. The body must carry the current sequence index. Skipping ahead or replaying an index is rejected. A wrong pick reveals the values and the game continues. The scored game ends after all ten picks. A second scored game the same day is rejected. After that, a practice game uses a different sequence and is not written to the board.

Each correct pick climbs a tenth of the way to the Milky Way. A miss sputters and lifts about a third as far. The end screen shows the whole climb, where the climber stopped, the score out of 10, the percent of players beaten, and the best score that day (a number, no names). Ranking is by correct answers. Equal scores are ties: a faster finish does not rank higher, because timing a knowledge question rewards skimming. The share card names the height you reached:

```text
Ballpark #325 · Head-to-head
🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩 10/10 · reached the Milky Way
Race my climb: ballpark.local/?race=h325-1000
```

## Scoring

Classic is seven open "name one" questions a day, scored by how rare your answer is. The Worker matches case, accents, aliases, and small typos against a server-side list, and works out the share of other players who gave the same answer. Your own answer does not count, so the first player of the day can still find a Supernova. Until 20 other answers exist, that share is blended with a fixed prior from the seed, and the reveal says so. The share sets a named tier:

| Tier | Share of other players | Points | Emoji |
| --- | --- | --- | --- |
| Supernova | 1% or less | 100 | 🟩 |
| Deep space | 3% or less | 75 | 🟩 |
| Moonshot | 8% or less | 50 | 🟨 |
| Orbit | 20% or less | 25 | 🟦 |
| Liftoff | more than 20% | 10 | 🟤 |
| Out of time | | 0 | ⬛ |

A name that is not on the list gets a second chance instead of 0 points (see above). How high an answer climbs follows its points with no base amount (`classicStep` in `packages/shared/src/scale.ts`): each answer climbs `10 × points / 100 / questions` of the way, so a perfect run reaches the top (10) whether it has seven questions or five, a Supernova climbs ten times as far as a Liftoff, and a timeout does not climb at all. The Afterburner doubles one stage's points and its climb (`AFTERBURNER` in `scale.ts`), so a day can reach past 10, up to Andromeda. An answer given after opening the stuck nudge scores at most Moonshot (`NUDGE_CAP` in `apps/api/src/classic-score.ts`).

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

At midnight India time (18:30 UTC) a Worker cron recomputes yesterday, and any read of a past day does the same. Percentiles use those final points. The recount also checks "Should this count?" reports: if a reported name is now accepted and scores more than what the player locked in, it takes its place.

The estimate field accepts `k`, `M`, and `B` for thousand, million, and billion. `m` means million, not milli. The control is a zoomable log number line. Its endpoints are fixed for the unit class (every distance-in-kilometres question shares one span) and are not centered on the answer. After you submit, the marker moves to the true value, the gap is marked, and faint dots show other players' guesses. Those dots are not in the question payload.

## Ballpark+

The daily Classic, the league, ranks, race links and streaks are free for everyone. Ballpark+ adds:

- **Pack journeys.** Cricket Crazy 🏏 (from the gully to Lord's), Screen Time 🎬 (from the multiplex to the Oscars) and Space Nerd 🚀 (from the launch pad to the edge of the Solar System), each three chapters of five, played in order, any day, once per device (see Phase 3 above). The end screen ranks you among everyone who played that chapter ("You're #2 of 40 who played this chapter"). Pack answers never reach `daily_results`, so a pass never adds league points.
- **Unlimited**, and **the whole archive** rather than the last 7 days (see Phase 3 above).
- **No ads.** Free players see a labelled ad space on the home screen and the end screen. There is no ad network yet: it is a placeholder (`AdSlot` in `apps/web/src/plus.tsx`) that also links to Ballpark+. Members never see it.

Without a pass, `GET /api/packs` lists the packs as locked and the questions stay on the server. `GET /api/packs/:id` (the route), `GET /api/packs/:id/chapters/:n` and `POST /api/packs/:id/chapters/:n/guess` answer `402 plus_required`, and so do Unlimited and archive days older than a week.

A pass is a one-time purchase for this device, 30 or 365 days, and it does not renew by itself. Prices in `packages/shared/src/plus.ts` are **placeholders** (₹99 a month, ₹799 a year). Buying early adds the new days to the days left. A pass is tied to the anonymous device id, like the rest of the game.

**Restore on a new device.** A member taps "Show my restore code" on the Ballpark+ page and gets a code like `BP-7A8C-QQU3-4R44` (12 characters from an alphabet with no 0, O, 1, I or L; `GET /api/plus/restore-code`). Typing it on another device (`POST /api/plus/restore`, 5 tries a minute per IP address) moves the pass there and the code with it, and the old device goes back to free, so one pass is one device at a time. If the new device has a pass of its own, it keeps whichever ends later. Progress in packs and Unlimited stays with the old device, because answers are kept by device. A code whose pass has ended answers `410 pass_expired`. No email or phone number is collected.

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
- `puzzles` — a theme and seven question ids, all name-one
- `submissions` and `daily_results` — one row per device, question, and day, keyed with a `mode` column. Head-to-head `score` is correct picks out of 10. `finalized` flips when the game day is recomputed
- `h2h_picks` — one row per pick, so a pair's miss rate can be scored without storing names
- `league_members` — one row per device per league week: its rank (`tier`), its group, and whether last week moved it up or down
- `packs` — a Ballpark+ pack: title, emoji, blurb, the route's name, and chapter 1's five question ids
- `pack_chapters` — each chapter of a pack: its number, title, blurb and five question ids
- `unlimited_pool` and `unlimited_rounds` — the questions Unlimited may deal, and each round dealt to a device
- `restore_codes` — one code per pass, with the device it belongs to and when it was last used
- `entitlements` — one row per device with a pass: plan, source (`razorpay` or `test`), payment id, and when it ends
- `plus_orders` — Razorpay orders this Worker created, with the device and plan, so a payment only counts for its own order

## Sample content, and what has to change before a public game

`apps/api/seed/content.ts`, `apps/api/seed/fun.ts` and `apps/api/seed/more-facts.ts` are the sample set: 17 Classic days, 3 Ballpark+ packs of three chapters each, 164 questions, and at least 150 facts for Head-to-head pairs (populations, areas, GDP, peaks, rivers, planets, animals, landmarks, inventions). Every row has `verified: false`. The numbers are widely documented figures with a real source URL, and they have not had an editorial pass. `apps/api/seed/seed.sql` is generated from those files. Give a new fact a `metric` that matches one in `METRIC_COPY`, or `unpaired` if nothing should be compared with it.

This repository is public. Anyone can read the seed. That is acceptable for a local sample and a bad idea for official answers. Before a real launch, stop committing puzzle values. Load them with an admin script from a file that is not in git, or from a private content repository, and keep D1 as the only copy the Worker reads. The client should keep receiving prompts only, the way it does now.

The fun week and the packs in `apps/api/seed/fun.ts` set the voice for new questions: a cheeky prompt that still asks for real knowledge ("Name a fruit that botanists call a berry. Warning: the strawberry is a fraud."), a long list of right answers so nobody is stuck, and a reveal with one fact worth repeating. Facts that could change soon, such as a current champion or this year's winner, are left out.

To add or edit a sample puzzle:

1. Edit `apps/api/seed/fun.ts`, `apps/api/seed/seven.ts`, `apps/api/seed/content.ts`, `apps/api/seed/name-one.ts`, or `apps/api/seed/name-one-more.ts`. Every Classic question is a name-one question. The older days override a base question id. The fun week and each pack's first chapter are new ids in `fun.ts`, and a pack is an entry in its `packs` list. A pack's route and its chapters 2 and 3 live in `apps/api/seed/journeys.ts`. The sixth and seventh question of every day live in `apps/api/seed/seven.ts`, keyed by the day's theme. Every question belongs to exactly one day or one pack chapter. Set `entitySet` to `countries` or `elements` when the answers are all in that list (every accepted name must then be in it), or `null` for free text with no autocomplete. Give each accepted answer a prior (how often you expect players to say it) and the aliases people type, and never give one spelling to two answers. An estimate uses one positive fact. A compare uses two. A rank uses three or four, and its display order must not already be the correct order. A name-one question carries a complete accepted list with priors, and its prompt must not contain an accepted name. Do not reuse a fact twice in the same day.
2. Run `npm run seed:emit -w @ballpark/api` and commit the TypeScript and the generated SQL together.
3. Run `npm run dev` again. The setup step reloads the local database.

`assertSeed()` runs as part of generating the SQL and as part of the API tests, so a day that is not seven name-one questions, a pack that is not three chapters of five, a spelling shared by two answers, or a prompt that contains its own answer, fails fast.

**Drafting answer lists from Wikidata.** `npm run wikidata:lists -w @ballpark/api` drafts name-one lists from Wikidata (CC0), with a starting prior for each answer from how many Wikipedias cover it, or with `--pageviews` from its English Wikipedia views over the last 90 days. Each spec in `apps/api/scripts/wikidata-lists.ts` is a SPARQL query (Satyajit Ray's films, Pixar's features and the moons of Uranus to start). Drafts go to `apps/api/seed/drafts/`, which git ignores, for a person to trim, add the spellings people type, and copy into a seed file; prompts stay hand-written. It needs `query.wikidata.org` (and `wikimedia.org` for views), so run it where those hosts are allowed, with `WIKIMEDIA_CONTACT` set for the User-Agent. `--fixture <file> <spec>` builds from a saved SPARQL response, offline.

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

That builds `apps/web`, writes `apps/api/src/assets.generated.ts` (gitignored), and runs `wrangler deploy --dry-run --outdir dist/worker` with `apps/api/wrangler.deploy.jsonc`. The dry run does not upload anything. The bundle's `src/deploy.ts` serves those files, falls back to `index.html` for client routes, and forwards `/api/*` to the game handler. Both configs schedule `30 18 * * *`, so a closed day is finalized at midnight India time, and `30 14 * * *`, which sends streak reminders at 8 PM India time. Do not add deploy secrets, and do not put a deploy step in CI.

## Test deploy

Only when the owner asks, and from a machine signed in to their Cloudflare account (`npx wrangler login`). From `apps/api`:

1. `npx wrangler d1 create ballpark` once, then put its id in `wrangler.deploy.jsonc` in place of the placeholder. Keep that edit local.
2. `npx tsx scripts/emit-seed.ts`, then `npx wrangler d1 migrations apply ballpark --remote --config wrangler.deploy.jsonc`, then `npx wrangler d1 execute ballpark --remote --config wrangler.deploy.jsonc --file=./seed/seed.sql`. The seed deletes every saved result first, so load it only into a fresh database. `seed.sql` has no `BEGIN`/`COMMIT`, because remote D1 rejects explicit transactions.
3. From the repo root, `npm run build:deploy`. Then, from `apps/api`, `npx wrangler deploy --config wrangler.deploy.jsonc`.
4. Set `SHARE_HOST` to the printed workers.dev host, then build and deploy again, so share links point at the deploy.

To redeploy to a database people have already played on, skip the seed. Pull the branch, run `npm run seed:update -w @ballpark/api` to write `seed/update.sql` (gitignored), apply any new migrations, then `npx wrangler d1 execute ballpark --remote --config wrangler.deploy.jsonc --file=./seed/update.sql`, and build and deploy as in step 3. The update replaces facts, questions, days and packs in place and keeps every submission, result, league row and pass.

**Phase 2 on a live database.** Apply `migrations/0006_habit.sql` with the `migrations apply` command in step 2 before deploying the new Worker, then run the `seed:update` path above so the nudges load. Nothing in it touches saved results.

**Phase 3 on a live database.** The same again with `migrations/0007_play_more.sql`, then the `seed:update` path, which loads the new chapters and the Unlimited pool. It adds columns and tables and changes no saved row.

**Streak reminders** need a VAPID key pair. `npm run vapid:keys -w @ballpark/api` makes one and prints it to the terminal only. For local play, paste both lines into `apps/api/.dev.vars` (gitignored). For a deploy, `npx wrangler secret put VAPID_PUBLIC_KEY --config wrangler.deploy.jsonc` and the same for `VAPID_PRIVATE_KEY`. Never commit the private key. Without the keys the switch stays hidden and `POST /api/reminder` answers `503 reminders_off`.

**Reviewing "Should this count?"** From `apps/api`, the owner can list the most reported names:

```bash
npx wrangler d1 execute ballpark --remote --config wrangler.deploy.jsonc --command "SELECT question_id, normalized, COUNT(*) AS players FROM answer_reports GROUP BY question_id, normalized ORDER BY players DESC LIMIT 50"
```

To accept one, add it to that question's `accepted` list (or as an alias) in `apps/api/seed/`, run `npm run seed:check -w @ballpark/api`, and load it with `seed:update` as above. The next recount of that day scores it for everyone who reported it.

`PLUS_TEST_UNLOCK` stays `"false"` in that config, so packs stay locked there until Razorpay keys are added as Worker secrets.

## Ethics

The daily game, the league and streaks are free, with no account wall. Ballpark+ sells extra packs and the removal of ads, not an edge: a pass never adds league points, and every free player gets the same daily questions. There is no loot box and no streak-shame copy. The ad space is a placeholder with no ad network or tracking behind it. The archive, Unlimited and packs are for fun: none of them adds to the streak, the rank or the league, and Cruise keeps a streak alive without a place on the board.
