#!/usr/bin/env bash

set -euo pipefail

ROOT="$( cd "$( dirname "$0" )" && pwd )"
BACKEND_DIR="$ROOT/Backend"
DB="$BACKEND_DIR/tesla.db"
PORT="${PORT:-3011}"
POLL_TIMEOUT="${POLL_TIMEOUT:-300}"

TUNNEL_LOG="$( mktemp )"
BACK_LOG="$( mktemp )"
TUNNEL_PID=""
BACK_PID=""

log() { printf '\033[1;36m[tesla_token]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[tesla_token] %s\033[0m\n' "$*" >&2; }

cleanup() {
	[ -n "$BACK_PID" ]   && kill "$BACK_PID"   2>/dev/null || true
	[ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
	rm -f "$TUNNEL_LOG" "$BACK_LOG"
}

trap cleanup EXIT INT TERM

for bin in curl sqlite3 cargo; do
	command -v "$bin" >/dev/null || { err "missing required tool: $bin"; exit 1; }
done
[ -f "$BACKEND_DIR/.env" ]                 || { err "Backend/.env not found";                 exit 1; }
[ -f "$BACKEND_DIR/Keys/private-key.pem" ] || { err "Backend/Keys/private-key.pem not found"; exit 1; }

if [ -n "${FIXED_CALLBACK_URL:-}" ]; then
	CALLBACK="$FIXED_CALLBACK_URL"
else
	command -v cloudflared >/dev/null || { err "missing required tool: cloudflared"; exit 1; }
	cloudflared tunnel --url "http://localhost:$PORT" >"$TUNNEL_LOG" 2>&1 &
	TUNNEL_PID=$!

	TUN_URL=""
	for _ in $( seq 1 30 ); do
		TUN_URL="$( grep -oE 'https://[a-z0-9.-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true )"
		[ -n "$TUN_URL" ] && break
		kill -0 "$TUNNEL_PID" 2>/dev/null || { err "cloudflared exited early:"; cat "$TUNNEL_LOG" >&2; exit 1; }
		sleep 1
	done
	[ -n "$TUN_URL" ] || { err "tunnel URL never appeared:"; cat "$TUNNEL_LOG" >&2; exit 1; }
	CALLBACK="$TUN_URL/api/auth/callback"
	log "Tunnel: $TUN_URL"
fi


cat <<EOF

  +-------------------------------------------------------+
  |  Register in Tesla developer dashboard:               |
  |                                                       |
  |      $TUN_URL                                         |
  |      $CALLBACK                                        |
  |                                                       |
  +-------------------------------------------------------+
EOF

read -r -p "Press Enter once it's registered (Ctrl-D to abort)... " _


log "Starting server on 127.0.0.1:$PORT ..."

( cd "$BACKEND_DIR" && REDIRECT_URI="$CALLBACK" BIND_ADDR="127.0.0.1:$PORT" cargo run ) >"$BACK_LOG" 2>&1 &

BACK_PID=$!

for _ in $( seq 1 90 ); do
	curl -sf "http://localhost:$PORT/" >/dev/null 2>&1 && break
	kill -0 "$BACK_PID" 2>/dev/null || { err "backend exited before it was ready:"; tail -20 "$BACK_LOG" >&2; exit 1; }
	sleep 1
done


curl -sf "http://localhost:$PORT/" >/dev/null 2>&1 || { err "backend not ready:"; tail -20 "$BACK_LOG" >&2; exit 1; }


baseline="$( sqlite3 "$DB" 'SELECT COALESCE(MAX(expires_at),0) FROM oauth_tokens;' 2>/dev/null || echo 0 )"

AUTH_JSON="$( curl -s "http://localhost:$PORT/api/auth/url" )"
AUTH_URL="$( printf '%s' "$AUTH_JSON" | sed -E 's/.*"url"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' )"
[ -n "$AUTH_URL" ] && [ "$AUTH_URL" != "$AUTH_JSON" ] || { err "could not parse authorize URL from: $AUTH_JSON"; exit 1; }

log "Opening Tesla login..."
command -v xdg-open >/dev/null && xdg-open "$AUTH_URL" >/dev/null 2>&1 || true
cat <<EOF

  If the browser didn't open, paste this URL manually:

      $AUTH_URL

EOF


log "Waiting... (timeout ${POLL_TIMEOUT}s)..."
got=""
for _ in $( seq 1 "$POLL_TIMEOUT" ); do
	cur="$( sqlite3 "$DB" 'SELECT COALESCE(MAX(expires_at),0) FROM oauth_tokens;' 2>/dev/null || echo 0 )"
	if [ "${cur:-0}" -gt "${baseline:-0}" ]; then got=1; break; fi
	kill -0 "$BACK_PID" 2>/dev/null || { err "backend exited during login:"; tail -20 "$BACK_LOG" >&2; exit 1; }
	sleep 1
done

if [ -z "$got" ]; then
	tail -20 "$BACK_LOG" >&2
	exit 1
fi

log "Tokens stored."
sqlite3 -header -column "$DB" "SELECT user_id, datetime(expires_at,'unixepoch','localtime') AS access_token_expires FROM oauth_tokens;"

cat <<EOF

Done. dev.sh should work
EOF

sleep 2
