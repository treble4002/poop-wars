# Poop Wars 💩🚽 (pilot rebuild)
Head-to-head toilet-themed mini games for phone browsers. Node server + plain HTML/JS/CSS (no build step).

## Run it
Needs Node.js 18+. `npm install` once.
```
node server.js     # http://localhost:3737 (PORT to change)
./test.sh          # starts a throwaway in-memory server and runs the end-to-end API tests
BASE=https://... ADMIN_TOKEN=... node test.js   # test a running server instead (it needs ADMIN_TOKEN set)
```
Without `DATABASE_URL` the server uses **pg-mem** (in-memory Postgres emulator). Data resets on restart; it's for dev/tests only.

## Environment variables
| Var | Needed | What it does |
|---|---|---|
| `DATABASE_URL` | prod | Postgres connection string. Tables are created on boot (`src/schema.sql`). |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | prod | Project URL (any path such as /rest/v1/ is stripped) and the anon or `sb_publishable_` key. Turns on email-code (OTP) login. If either is missing, the dev name-only signup is used. |
| `ADMIN_TOKEN` | optional | Enables `POST /api/admin/invites` (header `x-admin-token`). Unset = route hidden. |
| `OPEN_PREMIUM` | optional | `true` = every new signup gets premium, tagged `premium_source='open_pilot'`. That premium only counts while the flag is on. Invite-code premium/pilot users keep theirs either way. |
| `PORT` | optional | Default 3737. Render sets it. |

Supabase setup: Auth → Providers → Email on; edit the "Magic Link" email template to show the code with `{{ .Token }}` so users get a 6-digit code.

## Layout
- `server.js` boots: db init → bot user → HTTP.
- `src/db.js` Postgres or pg-mem pool, `tx()` helper. `src/schema.sql` tables: users, circles, circle_members, games, moves, invite_codes, pending_signups, taunts, blocks, reports.
- `src/store.js` all queries. Moves use **compare-and-swap on `games.version`** inside a transaction (plus a `moves` row with a unique `(game_id, seq)`); a lost race reloads and retries, so two simultaneous moves can't overwrite each other. Stats and leaderboards are computed from finished games (no shared counters to race on).
- `src/games/<type>.js` one file per game (rules, bot, per-player view); `src/games/index.js` registry and engine.
- `src/routes.js` API; `src/http.js` static files, auth and premium checks; `src/auth.js` Supabase OTP and the age check.
- `public/landing.html` is the welcome page at `/`. The game app is `public/play.html`, served at `/play` (and any `/play/...` path). `/index.html` redirects to `/play`. Deep links: `/play?invite=CODE` prefills the invite code; `/play?join=CODE` prefills a circle code.
- `public/play.html`, `public/css/app.css`, `public/js/app.js` (API, router, screens, trash talk), `public/js/games/<type>.js` (one renderer per game), `public/js/main.js`.

## Accounts, age gate, premium
- Signup needs the checkbox "I certify I am 13 or older and agree to the Poop Wars rules." The **server** rejects signup unless `acceptRules === true` and stores `users.accepted_rules_at`. We don't collect a birthdate or parent email; the old `birthdate`/`owner_email` columns are no longer written. `/rules` (also `/privacy`) is the rules and privacy page. Set `CONTACT_EMAIL` to show an account-deletion email address there.
- Free tier: `POST /api/guest` (no account) or a free account can play Plunger Pete. No saved scores, circles, trophies or arena.
- Premium (`users.premium`) or pilot (`users.pilot`, lifetime full premium) is required on: circles (create/join/view/leave), friend challenges, `/api/scores`, `/api/trophies`, and `/api/taunt` in circle games.
- Flags are set by a **single-use invite code** at signup (or later via `POST /api/redeem`). Make codes:
  `DATABASE_URL=... node scripts/make-invites.js 20 pilot "family"` (kinds: `pilot` or `premium`).

## Trash talk / safety
Premium-only. Preset taunts (`GET /api/taunts`) or free text: `POST /api/taunt {gameId,key}` or `{gameId,text}`. Free text is capped at 60 characters on the server and passes `src/filter.js`, which rejects slurs, hate, sexual and self-harm terms and masks common swears. Rate limit: 1 message per 3 s per user (`TALK_GAP_MS`), max 20 per game. Taunts are per-game: they are deleted when the game finishes, and a sweep every 15 min deletes any older than 24 h. A report copies the reported message into `reports.message`, so it survives the wipe for review. `POST /api/report {userId,gameId?,tauntId?,reason}`; `POST /api/block` and `/api/unblock {userId}`. Blocking stops taunts and challenges both ways. No ad or analytics SDKs.

## Not done yet
- **Push notifications / turn reminders**: out of scope for this pass. The `moves` table is where a "Bob made his move" hook would go.
- Payments (RevenueCat) are not wired. `premium` is only set by invite codes.
- Old prototype data (`pw_state` JSON blob) is **not migrated**. Those accounts had no birthdates, so the pilot starts fresh. The old table is left alone.
- Reports go into the `reports` table. There's no admin review screen yet.

## Games
Tic-Tac-Toilet, Connect Four-Flush, Follow the Flush, Stall Wars, Sink the Stink, Hang-Ten TP. Each one can be played vs Plunger Pete 🪠 (Easy/Hard). Games vs Plunger Pete only count on the separate vs-Bot record.

## Quick match (random opponents)
- Any signed-in account (`kind='user'`, not guests) can use it; **not premium-gated** (it is the free on-ramp, and during OPEN_PREMIUM everyone is premium anyway).
- `POST /api/match/join {type}`, `GET /api/match/poll` (~every 1.5s), `POST /api/match/cancel`. Queue table `match_queue`; entries with no poll for 2 min expire (`MATCH_STALE_MS`).
- Pairing is one conditional `UPDATE ... WHERE user_id IN (me, them) AND game_id IS NULL` that must claim both rows, in the same transaction as the game insert, so concurrent joins make exactly one pair. Never yourself, never someone either of you blocked, same game type only. Longest waiter moves first.
- Players only see display names (never emails). Chat in random games: preset taunts + preset emoji only (free text rejected server-side). Free text (60 chars, filtered) only in circle games while both players still share the circle. Chat is wiped when the game ends; report/block work in both.
- Leaderboards: quick-match results count on the global overall + per-game boards and your personal record (same as other human-vs-human games). They don't count on circle boards (no circle). Bot games stay separate.
