# Poop Wars 💩🚽 (test prototype)
## Run it
Needs Node.js 18 or newer. No installs, no accounts.
```
node server.js          # opens on http://localhost:3737  (PORT=xxxx to change)
./test.sh               # automatic two-player test (server must be running)
```
To try two players on one computer, open one normal browser window and one private/incognito window. Each window counts as a different person.
To reset all data, stop the server and delete `data.json`.
## Files
- `server.js`: the whole backend (accounts, circles, games, leaderboards). It saves everything to `data.json`.
- `public/index.html`: the whole phone app (screens, games, emoji styling).
- `test.sh`: Alice and Bob make a circle, play all 3 games, and the script checks the results.
- `PLAN.md`: the business and product plan, plus a prompt you can paste into Lovable.
## Games
- **Tic-Tac-Toilet**: 🧻 vs 💩, take turns
- **Connect Four-Flush**: drop pieces, get 4 in a row
- **Flush Frenzy**: tap 30 times as fast as you can. Each player plays on their own time. You can't see the other player's score until both of you have played. The faster time wins.
