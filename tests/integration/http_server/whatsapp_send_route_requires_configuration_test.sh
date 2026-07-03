#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 38500 "$@"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"

http_server_start WHATSAPP_ACCESS_TOKEN=$' \t\n' WHATSAPP_PHONE_NUMBER_ID=$'\n  '
http_server_wait_until_responding "/health" "${response_file}"

printf '{"to":"14155551234","message":"Your route for today: Stop 1"}' >"${payload_file}"
http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/whatsapp/send-route)")"

if [[ "${http_code}" != "503" ]]; then
  echo "expected HTTP 503 when WhatsApp credentials are blank, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"WhatsApp is not configured."' "${response_file}"; then
  echo "expected WhatsApp configuration error response" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
