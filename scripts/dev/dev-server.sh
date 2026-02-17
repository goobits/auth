#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${ROOT_DIR}/node_modules/.bin:${PATH}"
DEV_DIR="${ROOT_DIR}/.dev"
PORT="${PORT:-3610}"
PID_FILE="${DEV_DIR}/dev-server.${PORT}.pid"
LOG_FILE="${DEV_DIR}/dev-server.${PORT}.log"
STOP_TIMEOUT=5
START_TIMEOUT=35

mkdir -p "${DEV_DIR}"

read_pid_file() {
	if [[ -f "${PID_FILE}" ]]; then
		cat "${PID_FILE}" 2>/dev/null || true
	fi
}

find_pids() {
	local pid
	pid="$(read_pid_file)"
	if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
		echo "${pid}"
		return 0
	fi
	pgrep -f "[v]ite.*dev.*--host 0.0.0.0.*--port ${PORT}" 2>/dev/null || true
}

is_running() {
	[[ -n "$(find_pids)" ]]
}

wait_for_stop() {
	local elapsed=0
	while is_running && (( elapsed < STOP_TIMEOUT )); do
		sleep 1
		elapsed=$(( elapsed + 1 ))
	done

	if is_running; then
		echo "processes did not exit gracefully, sending SIGKILL..."
		kill -9 $(find_pids) 2>/dev/null || true
		sleep 1
	fi
}

start_server() {
	if is_running; then
		echo "dev server already running on port ${PORT}"
		exit 0
	fi

	echo "starting dev server on port ${PORT}..."
	: > "${LOG_FILE}"
	setsid bash -lc "cd '${ROOT_DIR}' && NODE_ENV=development DEV_DB_FILE='${DEV_DB_FILE:-}' CALENDAR_SYNC_MODE='${CALENDAR_SYNC_MODE:-}' dotenvx run -f config/env/.env -- vite dev --host 0.0.0.0 --port '${PORT}' --strictPort" >>"${LOG_FILE}" 2>&1 < /dev/null &
	local daemon_pid=$!
	echo "${daemon_pid}" > "${PID_FILE}"

	local elapsed=0
	while (( elapsed < START_TIMEOUT )); do
		if ! kill -0 "${daemon_pid}" 2>/dev/null; then
			echo "dev server process exited early."
			tail -n 80 "${LOG_FILE}" || true
			rm -f "${PID_FILE}"
			return 1
		fi
		if curl -sSf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
			echo "dev server ready (pid: ${daemon_pid}, host: 0.0.0.0:${PORT})"
			return 0
		fi
		sleep 1
		elapsed=$(( elapsed + 1 ))
	done

	echo "dev server failed to become ready within ${START_TIMEOUT}s."
	tail -n 80 "${LOG_FILE}" || true
	return 1
}

stop_server() {
	if ! is_running; then
		echo "no dev server running"
		rm -f "${PID_FILE}"
		return 0
	fi

	local pids
	pids="$(find_pids)"
	echo "stopping dev server (pids: ${pids})..."
	kill ${pids} 2>/dev/null || true
	wait_for_stop

	if is_running; then
		echo "error: failed to stop all processes"
		return 1
	fi

	rm -f "${PID_FILE}"
	echo "dev server stopped"
}

case "${1:-}" in
	start)
		start_server
		;;
	stop)
		stop_server
		;;
	restart)
		stop_server
		start_server
		;;
	*)
		echo "usage: $0 {start|stop|restart}"
		exit 1
		;;
esac
