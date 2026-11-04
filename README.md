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
- Signup needs a birthdate. The **server** rejects under-13s (403, nothing stored). Ages 13–17 must give a parent email, saved as `owner_email` (the account owner).
- Free tier: `POST /api/guest` (no account) or a free account can play Plunger Bot. No saved scores, circles, trophies or arena.
- Premium (`users.premium`) or pilot (`users.pilot`, lifetime full premium) is required on: circles (create/join/view/leave), friend challenges, `/api/scores`, `/api/trophies`, `/api/taunt`.
- Flags are set by a **single-use invite code** at signup (or later via `POST /api/redeem`). Make codes:
  `DATABASE_URL=... node scripts/make-invites.js 20 pilot "family"` (kinds: `pilot` or `premium`).

## Trash talk / safety
Preset taunts only (`GET /api/taunts`); `POST /api/taunt {gameId,key}`; `POST /api/report {userId,gameId?,tauntId?,reason}`; `POST /api/block` and `/api/unblock {userId}`. Blocking stops taunts and challenges both ways. No ad or analytics SDKs.

## Not done yet
- **Push notifications / turn reminders**: out of scope for this pass. The `moves` table is where a "Bob made his move" hook would go.
- Payments (RevenueCat) are not wired. `premium` is only set by invite codes.
- Parent consent email/verification for teen accounts: we store the parent email as owner, but nothing emails the parent yet.
- Old prototype data (`pw_state` JSON blob) is **not migrated**. Those accounts had no birthdates, so the pilot starts fresh. The old table is left alone.
- Reports go into the `reports` table. There's no admin review screen yet.

## Games
Tic-Tac-Toilet, Connect Four-Flush, Follow the Flush, Stall Wars, Sink the Stink, Hang-Ten TP. Each one can be played vs Plunger Bot 🪠 (Easy/Hard). Bot games only count on the separate vs-Bot record.
