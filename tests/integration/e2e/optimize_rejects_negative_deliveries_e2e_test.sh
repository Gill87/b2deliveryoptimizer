#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/e2e_helpers.sh"

e2e_init "$@"
health_file="${work_dir}/health.json"
payload_file="${work_dir}/optimize-payload.json"
response_file="${work_dir}/optimize-negative.json"

e2e_stack_up
e2e_wait_for_api_health "${health_file}"

cat >"${payload_file}" <<'JSON'
{
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308], "demand": -1 }
  ]
}
JSON

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "http://127.0.0.1:${api_port}/api/v1/deliveries/optimize")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 for negative job demand, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"field"[[:space:]]*:[[:space:]]*"jobs\[0\]\.demand"' "${response_file}"; then
  echo "expected validation issue for jobs[0].demand" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
