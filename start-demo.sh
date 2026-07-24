#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Node.js 18 atau lebih baru diperlukan. Instal Node.js, lalu jalankan kembali script ini."
  exit 1
fi

open_url() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$1" >/dev/null 2>&1 || true
  else
    printf '%s\n' "Buka $1 menggunakan browser."
  fi
}

URL="http://127.0.0.1:${PORT:-8080}"
printf '%s\n' "Menjalankan Dapur Rini v4.0 di $URL"
node server/server.js &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' INT TERM EXIT
sleep 1
open_url "$URL"
printf '%s\n' "Server aktif. Tekan Ctrl+C untuk menghentikan."
wait "$SERVER_PID"
