# Poop Wars: Plan (plain English)

## The one-sentence idea
Quick, silly roll-to-roll games you play against friends and family on your phone. The joke is that they're made for bathroom breaks: each one takes 1–3 minutes, with no download.

## Who it's for
- **First:** your friends and family, about 10–30 people in 2–4 group chats. They already know each other, so trash talk comes naturally.
- **Later:** adults 18–40 who play games like Words With Friends, Wordle, or GamePigeon in iMessage and like dumb humor.
- **Honest note:** "toilet humor" brings people in, but it doesn't keep them. They'll keep playing because of **rivalry with people they know**. That's why circles and leaderboards matter more than the number of games.

## Test version (MVP): what's in it (already built in this folder)
1. Sign up with a display name only. No password, no email.
2. Create a circle (private group). It gets a 6-letter invite code you can copy and paste into a group chat.
3. Join a circle using a code.
4. Challenge anyone in your circle to one of 3 games:
   - Tic-Tac-Toilet (turn-based)
   - Connect Four-Flush (turn-based)
   - Flush Frenzy (tap race; each player plays on their own time, faster wins)
5. "Your turn / Waiting" list on the home screen. It refreshes itself every few seconds.
6. A win/loss leaderboard for each circle, plus a global one.
7. A rematch button.

## Screens and flow
Welcome (type a name) → Home (your games + your circles + create/join) → Circle (invite code, leaderboard, challenge buttons next to each person) → Game screen → Result → Rematch or go Home. A bottom bar has Home and Global Leaderboard.

## Cut until later (on purpose)
- Real logins. Right now, if someone clears their browser they lose their account. That's fine for a test but not for a business.
- Notifications ("Bob made his move!"). **This is the single biggest gap.** Turn-based games depend on reminders. For the test, people will have to nudge each other in the group chat.
- Live real-time play, more games, a shop or cosmetics, ads, the no-ads upgrade, chat or emoji taunts, profile avatars, and a way to block or remove members.
- Strong cheat protection. A tech-savvy tester could fake a Flush Frenzy score.

## Tech stack recommendation
- **Test version (now):** this prototype. Or rebuild it in **Lovable + Supabase** using the prompt below. That's the most AI-friendly option and has a free tier.
- **Real business version:** Next.js + Supabase (logins, database, live updates built in), hosted on Vercel. Add web push notifications once the test shows people keep playing. Use Stripe for the cosmetics and no-ads upgrade.
- Why not a native app yet? App store review, fees, and a slower build. A web app is enough to find out whether people care.

## Launch and test plan
1. Put it online (Lovable publish, Replit, or Render). About 1 hour.
2. Make a circle for each group chat and send the invite code.
3. Run it for 2 weeks. Post a reminder in each chat on day 1 and day 4. After that, don't nag.
4. **Success metric:** at least **40% of the people who played on day 1 are still playing a game on day 7 or later**, and the average active player finishes at least 3 games a week. If you hit under 20%, the idea needs to change. Don't just add more games.
5. Ask 5 testers: "Which game did you play most? What made you open it? What would you pay $2 for?"

## Rough costs
- Test version: **$0–$25/month**. Supabase and Vercel free tiers. Lovable is free to try, about $25/month for the paid plan. A domain is about $12/year (optional).
- Real launch: about $50–150/month until you have thousands of players. Apple/Google developer accounts ($99/year + $25) only if you later make store apps.
- Money ideas: the no-ads upgrade at $2.99 one time, cosmetics at $0.99–$2.99. Honest note: small casual games usually earn pennies per user, so you need tens of thousands of active players before this becomes real income.

## Ready-to-paste prompt for Lovable (or a similar AI builder)
> Build a mobile-first web app called "Poop Wars": funny roll-to-roll mini games for friends and family, themed around playing on the toilet. Use a warm brown/cream bathroom theme with lots of emoji (💩🚽🧻🌊👑). Use Supabase for the database and for auth with email magic links. Features:
> 1. Sign in with email magic link. Then choose a display name.
> 2. "Circles": private groups. Creating one gives a random 6-character invite code and a "copy invite" button. Others join by entering the code.
> 3. On the circle page, show the members ranked by wins (W/L/D in this circle). Next to each member, show buttons to challenge them to one of three games.
> 4. Games, all asynchronous (like Words With Friends). Use Supabase realtime so the board updates without refreshing:
>    - Tic-Tac-Toilet: 3x3 tic-tac-toe, the challenger is 🧻 and the opponent is 💩.
>    - Connect Four-Flush: 7 columns x 6 rows, tap a column to drop a piece, 4 in a row wins.
>    - Flush Frenzy: after a 3-2-1 countdown, tap a big 🚽 30 times as fast as possible. Save the time in milliseconds. Each player plays on their own time. Hide the opponent's time until both have played. Lower time wins. Reject times under 1.5 seconds.
>    Check every move on the server (database function or edge function): right player's turn, legal move, win/draw detection.
> 5. Home screen: list my games with "Your turn" / "Waiting" / "Won" / "Lost", then my circles, and create/join circle.
> 6. Global leaderboard page (top 50 by wins) and a rematch button after each game.
> 7. Optional: web push notification when it's your turn.
> Keep every screen usable one-handed on a phone.
