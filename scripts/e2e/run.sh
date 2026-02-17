#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

SUITE="${1:-full}"
if [[ "${SUITE}" == "--" ]]; then
	SUITE="${2:-full}"
fi

E2E_PORT="${E2E_PORT:-3611}"
E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:${E2E_PORT}}"
E2E_DB_FILE="${E2E_DB_FILE:-.dev/db.e2e.sqlite}"

mkdir -p ".dev"

cleanup() {
	# Always stop the dedicated E2E server (if it started).
	PORT="${E2E_PORT}" bash scripts/dev/dev-server.sh stop >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Ensure tests never reuse a dev DB that might have live Google tokens/connections.
rm -f "${E2E_DB_FILE}" || true

PORT="${E2E_PORT}" \
DEV_DB_FILE="${E2E_DB_FILE}" \
CALENDAR_SYNC_MODE="mock" \
bash scripts/dev/dev-server.sh start

case "${SUITE}" in
	full)
		E2E_BASE_URL="${E2E_BASE_URL}" pnpm run e2e:suite
		;;
	critical)
		E2E_BASE_URL="${E2E_BASE_URL}" pnpm run e2e:critical:suite
		;;
	*)
		echo "usage: $0 [full|critical]"
		exit 2
		;;
esac
