# Poop Wars 💩🚽 (test prototype)
## Run it
Needs Node.js 18 or newer. Run `npm install` once first. That installs the Postgres driver.
```
node server.js          # opens on http://localhost:3737  (PORT=xxxx to change)
./test.sh               # automatic two-player test (server must be running)
```
To try two players on one computer, open one normal browser window and one private/incognito window. Each window counts as a different person.
To reset all data, stop the server and delete `data.json`.

On Render, set `DATABASE_URL` to a Postgres connection string. The app then stores everything in Postgres (one table, `pw_state`) instead of `data.json`.
## Files
- `server.js`: the whole backend (accounts, circles, games, leaderboards). It saves everything to `data.json`.
- `public/index.html`: the whole phone app (screens, games, emoji styling).
- `test.sh`: Alice and Bob make a circle, play all 3 games, and the script checks the results.
- `PLAN.md`: the business and product plan, plus a prompt you can paste into Lovable.
## Games
- **Tic-Tac-Toilet**: 🧻 vs 💩, take turns
- **Connect Four-Flush**: drop pieces, get 4 in a row
- **Flush Frenzy**: tap 30 times as fast as you can. Each player plays on their own time. You can't see the other player's score until both of you have played. The faster time wins.

## Games (6)
Tic-Tac-Toilet, Connect Four-Flush, Follow the Flush (4-pad memory pattern race: same server-made pattern for both players, longest correct pattern wins, faster total input time breaks ties; Flush Frenzy was removed and its old data dropped), Stall Wars (dots & boxes 5x5), Sink the Stink (battleship 8x8, ships 4/3/3/2, random placement), Hang-Ten TP (hangman, challenger may set the word; fewest misses wins).

## Plunger Bot 🪠
Every game can be played against Plunger Bot (Easy/Hard). Bot games resolve instantly and count only on a separate vs-Bot record, never in rankings.

## Leaderboards
Per-game + overall, globally and per circle, plus circle leaders per game.

## Tests
`node test.js` (or `./test.sh`); set `BASE=https://...` to test a live URL.
