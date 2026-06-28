#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 38400 "$@"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"

http_server_start WHATSAPP_ACCESS_TOKEN="" WHATSAPP_PHONE_NUMBER_ID=""
http_server_wait_until_responding "/health" "${response_file}"

printf '{"message":"Your route for today: Stop 1"}' >"${payload_file}"
http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/whatsapp/send-route)")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 when to is missing, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"Request body must include to."' "${response_file}"; then
  echo "expected missing to error response" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

printf '{"to":"14155551234"}' >"${payload_file}"
http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/whatsapp/send-route)")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 when message is missing, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"Request body must include message."' "${response_file}"; then
  echo "expected missing message error response" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
