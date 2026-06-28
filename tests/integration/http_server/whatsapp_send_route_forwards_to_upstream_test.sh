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
stub_default_port="$((52200 + ($$ % 10000)))"
stub_port="${DELIVERYOPTIMIZER_WHATSAPP_STUB_PORT:-${stub_default_port}}"

http_server_init 38600 "$1" "${curl_bin}"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"
request_path_file="${work_dir}/request-path.txt"
request_auth_file="${work_dir}/request-auth.txt"
request_content_type_file="${work_dir}/request-content-type.txt"
request_body_file="${work_dir}/request-body.json"
ready_file="${work_dir}/stub-ready.txt"
stub_log_file="${work_dir}/stub.log"
rm -f "${request_path_file}" "${request_auth_file}" "${request_content_type_file}" \
  "${request_body_file}" "${ready_file}"

http_server_cleanup_with_stub() {
  if [[ -n "${stub_pid:-}" ]]; then
    kill "${stub_pid}" >/dev/null 2>&1 || true
    wait "${stub_pid}" >/dev/null 2>&1 || true
  fi
  http_server_cleanup
}
trap http_server_cleanup_with_stub EXIT

env STUB_PORT="${stub_port}" REQUEST_PATH_FILE="${request_path_file}" \
  REQUEST_AUTH_FILE="${request_auth_file}" \
  REQUEST_CONTENT_TYPE_FILE="${request_content_type_file}" \
  REQUEST_BODY_FILE="${request_body_file}" READY_FILE="${ready_file}" \
  "${python_bin}" - >"${stub_log_file}" 2>&1 <<'PY' &
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

port = int(os.environ["STUB_PORT"])
request_path_file = os.environ["REQUEST_PATH_FILE"]
request_auth_file = os.environ["REQUEST_AUTH_FILE"]
request_content_type_file = os.environ["REQUEST_CONTENT_TYPE_FILE"]
request_body_file = os.environ["REQUEST_BODY_FILE"]
ready_file = os.environ["READY_FILE"]


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length)

        with open(request_path_file, "w", encoding="utf-8") as path_file:
            path_file.write(self.path)
        with open(request_auth_file, "w", encoding="utf-8") as auth_file:
            auth_file.write(self.headers.get("Authorization", ""))
        with open(request_content_type_file, "w", encoding="utf-8") as content_type_file:
            content_type_file.write(self.headers.get("Content-Type", ""))
        with open(request_body_file, "wb") as body_file:
            body_file.write(body)

        payload = b'{"messages":[{"id":"wamid.test-message"}]}'
        self.send_response(200)
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
  echo "WhatsApp stub failed to start on port ${stub_port}" >&2
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

if [[ "${http_code}" != "200" ]]; then
  echo "expected HTTP 200 from WhatsApp send route, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  cat "${stub_log_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"id"[[:space:]]*:[[:space:]]*"wamid.test-message"' "${response_file}"; then
  echo "expected WhatsApp message id in response" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

recorded_path="$(cat "${request_path_file}")"
if [[ "${recorded_path}" != "/v18.0/phone-123/messages" ]]; then
  echo "expected upstream path /v18.0/phone-123/messages, got ${recorded_path}" >&2
  exit 1
fi

recorded_auth="$(cat "${request_auth_file}")"
if [[ "${recorded_auth}" != "Bearer test-token" ]]; then
  echo "expected bearer auth header to be forwarded" >&2
  exit 1
fi

recorded_content_type="$(cat "${request_content_type_file}")"
if [[ "${recorded_content_type}" != application/json* ]]; then
  echo "expected JSON content type, got ${recorded_content_type}" >&2
  exit 1
fi

if ! grep -Eq '"messaging_product"[[:space:]]*:[[:space:]]*"whatsapp"' "${request_body_file}" ||
   ! grep -Eq '"to"[[:space:]]*:[[:space:]]*"14155551234"' "${request_body_file}" ||
   ! grep -Eq '"type"[[:space:]]*:[[:space:]]*"text"' "${request_body_file}" ||
   ! grep -Eq '"body"[[:space:]]*:[[:space:]]*"Your route for today: Stop 1"' "${request_body_file}"; then
  echo "expected forwarded WhatsApp JSON payload" >&2
  cat "${request_body_file}" >&2 || true
  exit 1
fi
