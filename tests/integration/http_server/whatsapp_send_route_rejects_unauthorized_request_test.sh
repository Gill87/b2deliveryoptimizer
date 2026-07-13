#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 38800 "$@"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"

stop_http_server_for_restart() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" >/dev/null 2>&1 || true
    wait "${server_pid}" >/dev/null 2>&1 || true
    server_pid=""
  fi
}

printf '{"to":"14155551234","message":"Your route for today: Stop 1"}' >"${payload_file}"

http_server_start WHATSAPP_ACCESS_TOKEN="test-token" WHATSAPP_PHONE_NUMBER_ID="phone-123" \
  WHATSAPP_SEND_ROUTE_SECRET=$' \t\n'
http_server_wait_until_responding "/health" "${response_file}"

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-WhatsApp-Send-Secret: anything" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/whatsapp/send-route)")"

if [[ "${http_code}" != "503" ]]; then
  echo "expected HTTP 503 when send route secret is blank, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"WhatsApp is not configured."' "${response_file}"; then
  echo "expected WhatsApp configuration error response for blank secret" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

stop_http_server_for_restart

send_route_secret="correct-secret"
http_server_start WHATSAPP_ACCESS_TOKEN="test-token" WHATSAPP_PHONE_NUMBER_ID="phone-123" \
  WHATSAPP_SEND_ROUTE_SECRET="${send_route_secret}"
http_server_wait_until_responding "/health" "${response_file}"

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/whatsapp/send-route)")"

if [[ "${http_code}" != "401" ]]; then
  echo "expected HTTP 401 when secret header is missing, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"Unauthorized."' "${response_file}"; then
  echo "expected unauthorized error response for missing secret header" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-WhatsApp-Send-Secret: wrong-secret" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/whatsapp/send-route)")"

if [[ "${http_code}" != "401" ]]; then
  echo "expected HTTP 401 when secret header does not match, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"Unauthorized."' "${response_file}"; then
  echo "expected unauthorized error response for mismatched secret header" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

empty_payload_file="${work_dir}/empty-payload.json"
printf '{"message":"Your route for today: Stop 1"}' >"${empty_payload_file}"
http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-WhatsApp-Send-Secret: ${send_route_secret}" \
  --data-binary "@${empty_payload_file}" \
  "$(http_server_url /api/whatsapp/send-route)")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 past the secret check when to is missing, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"Request body must include to."' "${response_file}"; then
  echo "expected request to pass the secret check and reach field validation" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
