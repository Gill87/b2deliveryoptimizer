#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <server-binary> <python-binary> [curl-binary]" >&2
  exit 2
fi

python_bin="$2"
curl_bin="${3:-curl}"
stub_default_port="$((52300 + ($$ % 10000)))"
stub_port="${DELIVERYOPTIMIZER_WHATSAPP_FAILURE_STUB_PORT:-${stub_default_port}}"

http_server_init 38700 "$1" "${curl_bin}"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"
ready_file="${work_dir}/stub-ready.txt"
stub_log_file="${work_dir}/stub.log"
rm -f "${ready_file}"

http_server_cleanup_with_stub() {
  if [[ -n "${stub_pid:-}" ]]; then
    kill "${stub_pid}" >/dev/null 2>&1 || true
    wait "${stub_pid}" >/dev/null 2>&1 || true
  fi
  http_server_cleanup
}
trap http_server_cleanup_with_stub EXIT

env STUB_PORT="${stub_port}" READY_FILE="${ready_file}" \
  "${python_bin}" - >"${stub_log_file}" 2>&1 <<'PY' &
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

port = int(os.environ["STUB_PORT"])
ready_file = os.environ["READY_FILE"]


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        payload = b'{"error":{"message":"upstream failed"}}'
        self.send_response(500)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):
        return


server = HTTPServer(("127.0.0.1", port), Handler)
with open(ready_file, "w", encoding="utf-8") as ready:
    ready.write("ready")
server.serve_forever()
PY
stub_pid=$!

stub_ready=false
for _ in $(seq 1 50); do
  if [[ -f "${ready_file}" ]]; then
    stub_ready=true
    break
  fi
  if ! kill -0 "${stub_pid}" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

if [[ "${stub_ready}" != "true" ]]; then
  echo "WhatsApp failure stub failed to start on port ${stub_port}" >&2
  cat "${stub_log_file}" >&2 || true
  exit 1
fi

http_server_start WHATSAPP_API_BASE_URL="http://127.0.0.1:${stub_port}" \
  WHATSAPP_ACCESS_TOKEN="test-token" WHATSAPP_PHONE_NUMBER_ID="phone-123"
http_server_wait_until_responding "/health" "${response_file}"

printf '{"to":"14155551234","message":"Your route for today: Stop 1"}' >"${payload_file}"
http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/whatsapp/send-route)")"

if [[ "${http_code}" != "502" ]]; then
  echo "expected HTTP 502 when WhatsApp upstream fails, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  cat "${stub_log_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"WhatsApp upstream request failed."' "${response_file}"; then
  echo "expected WhatsApp upstream failure error response" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"upstream_status"[[:space:]]*:[[:space:]]*500' "${response_file}"; then
  echo "expected upstream status in failure response" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
