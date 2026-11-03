#!/bin/bash
# End-to-end test with two simulated users. Server must be running.
set -e; B=${BASE:-http://localhost:3737}/api; j(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);console.log(eval('o'+process.argv[1]))})" "$1"; }
p(){ curl -sf -X POST $B/$1 -H 'Content-Type: application/json' -H "x-token: $2" -d "$3"; }
g(){ curl -sf $B/$1 -H "x-token: $2"; }
A=$(p signup "" '{"name":"Alice"}'); AT=$(echo $A|j .token); AI=$(echo $A|j .id)
Bo=$(p signup "" '{"name":"Bob"}'); BT=$(echo $Bo|j .token); BI=$(echo $Bo|j .id)
C=$(p circles $AT '{"name":"Fam"}'); CI=$(echo $C|j .id); CODE=$(echo $C|j .code); echo "circle code $CODE"
p circles/join $BT "{\"code\":\"$CODE\"}" >/dev/null
# TTT: Alice wins top row
G=$(p challenge $AT "{\"circleId\":\"$CI\",\"opponentId\":\"$BI\",\"type\":\"ttt\"}"|j .id)
for m in "$AT 0" "$BT 3" "$AT 1" "$BT 4" "$AT 2"; do set -- $m; p move $1 "{\"gameId\":\"$G\",\"pos\":$2}" >/dev/null; done
echo "TTT winner is Alice: $( [ "$(g "game?id=$G" $BT|j .winner)" = "$AI" ] && echo PASS || echo FAIL)"
# out of turn rejected
G2=$(p challenge $AT "{\"circleId\":\"$CI\",\"opponentId\":\"$BI\",\"type\":\"c4\"}"|j .id)
curl -s -X POST $B/move -H "x-token: $BT" -H 'Content-Type: application/json' -d "{\"gameId\":\"$G2\",\"pos\":0}" | grep -q "Not your turn" && echo "Out-of-turn rejected: PASS"
for m in "$AT 0" "$BT 1" "$AT 0" "$BT 1" "$AT 0" "$BT 1" "$AT 0"; do set -- $m; p move $1 "{\"gameId\":\"$G2\",\"pos\":$2}" >/dev/null; done
echo "C4 vertical winner Alice: $( [ "$(g "game?id=$G2" $AT|j .winner)" = "$AI" ] && echo PASS || echo FAIL)"
# Flush: Bob faster
G3=$(p challenge $BT "{\"circleId\":\"$CI\",\"opponentId\":\"$AI\",\"type\":\"flush\"}"|j .id)
p move $AT "{\"gameId\":\"$G3\",\"ms\":6000}" >/dev/null
echo "Score hidden before both play: $(g "game?id=$G3" $BT|j ".scores['$AI']")"
p move $BT "{\"gameId\":\"$G3\",\"ms\":5000}" >/dev/null
echo "Flush winner Bob: $( [ "$(g "game?id=$G3" $AT|j .winner)" = "$BI" ] && echo PASS || echo FAIL)"
echo "Circle board:"; g "circle?id=$CI" $AT | j ".members.map(m=>m.name+' '+m.w+'W '+m.l+'L').join(', ')"
echo "Global:"; g leaderboard "" | j ".slice(0,3).map(x=>x.name+' '+x.w+'W').join(', ')"
