#!/usr/bin/env bash


#
# 1. backend env -> cookie_secure=false & dev_login=1
# 2. dev login will work via localhost:5173
#


set -euo pipefail
cd "$(dirname "$0")"

pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

( cd Backend  && cargo run ) & pids+=($!)

( cd Frontend && pnpm run dev ) & pids+=($!)

wait
