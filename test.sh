#!/bin/bash
# Runs the end-to-end API test.
# With BASE set, tests that server (it must have ADMIN_TOKEN set). Otherwise starts a throwaway
# local server on in-memory pg-mem storage, runs the tests, and stops it.
cd "$(dirname "$0")"
if [ -n "$BASE" ]; then exec node test.js; fi
export PORT=${PORT:-3790} ADMIN_TOKEN=test-admin MATCH_STALE_MS=${MATCH_STALE_MS:-2500} BASE=http://localhost:${PORT:-3790}
env -u DATABASE_URL -u SUPABASE_URL -u SUPABASE_ANON_KEY node server.js > /tmp/poopwars-test.log 2>&1 & PID=$!
trap "kill $PID 2>/dev/null" EXIT
for i in $(seq 50); do curl -s "$BASE/api/config" >/dev/null && break; sleep 0.2; done
node test.js && env -u DATABASE_URL node test-open.js && env -u DATABASE_URL node test-talk.js && env -u DATABASE_URL node test-otp.js && node test-bot.js && node test-match.js && node test-net.js
