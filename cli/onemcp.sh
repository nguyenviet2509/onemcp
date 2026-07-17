#!/usr/bin/env bash
# onemcp.sh — Bash wrapper for OneMCP CLI using curl + jq.
# Fallback for ops jump-hosts where Node.js is not available.
# V3: ships alongside Node package; survey determines which is primary.
#
# Commands: search, show, submit
# Requirements: curl, jq (show/search); file (submit binary check)
#
# Config priority: ENV vars > ~/.onemcp/config.json
# ONEMCP_BASE_URL, ONEMCP_USER, ONEMCP_TOKEN, ONEMCP_INSECURE=1

set -euo pipefail

# ── Config resolution ─────────────────────────────────────────────────────────

CONFIG_FILE="${HOME}/.onemcp/config.json"
MAX_FILE_BYTES=$((256 * 1024))  # 256 KB

resolve_config() {
  BASE_URL="${ONEMCP_BASE_URL:-}"
  USER_ID="${ONEMCP_USER:-}"
  TOKEN="${ONEMCP_TOKEN:-}"
  INSECURE="${ONEMCP_INSECURE:-0}"

  if [[ -f "${CONFIG_FILE}" ]]; then
    # Check permissions on Linux/macOS — refuse if world/group readable
    if [[ "$(uname -s)" != "Darwin" ]] && [[ "$(uname -s)" != "Linux" ]]; then
      : # Skip perm check on other OS
    else
      PERMS=$(stat -c "%a" "${CONFIG_FILE}" 2>/dev/null || stat -f "%A" "${CONFIG_FILE}" 2>/dev/null || echo "000")
      # Last two digits should be 00 (no group/other access)
      if [[ "${PERMS: -2}" != "00" ]]; then
        echo "[ERROR] Config file ${CONFIG_FILE} has permissions ${PERMS} (too open)." >&2
        echo "        Run: chmod 600 ${CONFIG_FILE}" >&2
        exit 1
      fi
    fi

    if command -v jq &>/dev/null; then
      [[ -z "${BASE_URL}" ]] && BASE_URL=$(jq -r '.baseUrl // ""' "${CONFIG_FILE}")
      [[ -z "${USER_ID}" ]] && USER_ID=$(jq -r '.user // ""' "${CONFIG_FILE}")
      [[ -z "${TOKEN}" ]]   && TOKEN=$(jq -r '.token // ""' "${CONFIG_FILE}")
      # tlsVerify: false in config → insecure (unless env already set)
      if [[ "${INSECURE}" == "0" ]]; then
        TLS_VERIFY=$(jq -r '.tlsVerify // true' "${CONFIG_FILE}")
        [[ "${TLS_VERIFY}" == "false" ]] && INSECURE="1"
      fi
    fi
  fi

  if [[ -z "${BASE_URL}" ]]; then
    echo "[ERROR] Missing baseUrl. Set ONEMCP_BASE_URL or configure ~/.onemcp/config.json" >&2
    exit 1
  fi
  if [[ -z "${USER_ID}" ]]; then
    echo "[ERROR] Missing user. Set ONEMCP_USER or configure ~/.onemcp/config.json" >&2
    exit 1
  fi

  # Strip trailing slash
  BASE_URL="${BASE_URL%/}"
}

# Build curl TLS flags
curl_tls_flags() {
  if [[ "${INSECURE}" == "1" ]]; then
    echo -n " --insecure"
    echo "[WARNING] TLS verification DISABLED. Do NOT use in production." >&2
  fi
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_search() {
  local query="" limit="10" service=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --limit|-l) limit="$2"; shift 2 ;;
      --service|-s) service="$2"; shift 2 ;;
      --) shift; query="$*"; break ;;
      -*) echo "[ERROR] Unknown option: $1" >&2; exit 1 ;;
      *)  query="${query:+${query} }$1"; shift ;;
    esac
  done

  if [[ -z "${query}" ]]; then
    echo "Usage: onemcp search <query> [--limit N] [--service NAME]" >&2
    exit 1
  fi

  local url_params
  url_params="q=$(printf '%s' "${query}" | jq -sRr @uri)&limit=${limit}"
  [[ -n "${service}" ]] && url_params+="&service=$(printf '%s' "${service}" | jq -sRr @uri)"

  local tls_flag
  tls_flag=$(curl_tls_flags)

  # shellcheck disable=SC2086
  local response
  response=$(curl -sf ${tls_flag} \
    -H "X-Onemcp-User: ${USER_ID}" \
    -H "Accept: application/json" \
    --max-time 10 \
    "${BASE_URL}/api/search?${url_params}" 2>&1) || {
    echo "[ERROR] Request failed. Check BASE_URL and network." >&2
    exit 4
  }

  if ! command -v jq &>/dev/null; then
    echo "${response}"
    exit 0
  fi

  # Render table: try .hits[], .results[], or top-level array
  echo "${response}" | jq -r '
    (if type == "array" then . elif .hits then .hits elif .results then .results else [] end) |
    if length == 0 then "(no results)" | halt_error(0)
    else
      (["TYPE", "ID", "TITLE", "SLUG", "SERVICE"] | @tsv),
      (.[] | [
        ("[" + (.type // "?") + "]"),
        ("#" + ((.id // 0) | tostring)),
        (.title // "(untitled)"),
        (.slug // "-"),
        (.service // "-")
      ] | @tsv)
    end
  ' | column -t -s $'\t' 2>/dev/null || echo "${response}"
}

cmd_show() {
  local id_or_slug=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --) shift; id_or_slug="$*"; break ;;
      -*) echo "[ERROR] Unknown option: $1" >&2; exit 1 ;;
      *)  id_or_slug="$1"; shift ;;
    esac
  done

  if [[ -z "${id_or_slug}" ]]; then
    echo "Usage: onemcp show <id-or-slug>" >&2
    exit 1
  fi

  local tls_flag
  tls_flag=$(curl_tls_flags)

  # shellcheck disable=SC2086
  local response status_code
  response=$(curl -sf ${tls_flag} \
    -H "X-Onemcp-User: ${USER_ID}" \
    -H "Accept: application/json" \
    --max-time 10 \
    -w "\n__STATUS__%{http_code}" \
    "${BASE_URL}/api/artifacts/$(printf '%s' "${id_or_slug}" | jq -sRr @uri)" 2>&1) || true

  status_code=$(echo "${response}" | grep '__STATUS__' | sed 's/__STATUS__//')
  response=$(echo "${response}" | grep -v '__STATUS__')

  if [[ "${status_code}" == "404" ]]; then
    # Try skills endpoint
    # shellcheck disable=SC2086
    response=$(curl -sf ${tls_flag} \
      -H "X-Onemcp-User: ${USER_ID}" \
      -H "Accept: application/json" \
      --max-time 10 \
      "${BASE_URL}/api/skills/$(printf '%s' "${id_or_slug}" | jq -sRr @uri)" 2>&1) || {
      echo "[NOT FOUND] \"${id_or_slug}\". Try: onemcp search ${id_or_slug}" >&2
      exit 1
    }
  fi

  if command -v jq &>/dev/null; then
    # Print metadata to stderr, body to stdout
    echo "${response}" | jq -r '
      "ID     : " + ((.id // "?") | tostring),
      "Type   : " + (.type // .kind // "?"),
      "Title  : " + (.title // .name // "?"),
      "Status : " + (.status // "-"),
      "Service: " + (.service // "-")
    ' >&2
    echo "" >&2
    echo "${response}" | jq -r '.body // .content // "(no body)"'
  else
    echo "${response}"
  fi
}

cmd_submit() {
  local type="" file_path="" tags="" yes=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --type|-t)    type="$2";      shift 2 ;;
      --file|-f)    file_path="$2"; shift 2 ;;
      --tags)       tags="$2";      shift 2 ;;
      --yes|-y)     yes=1;          shift ;;
      --) shift; break ;;
      -*) echo "[ERROR] Unknown option: $1" >&2; exit 1 ;;
      *)  shift ;;
    esac
  done

  if [[ -z "${type}" ]] || [[ -z "${file_path}" ]]; then
    echo "Usage: onemcp submit --type <type> --file <path> [--tags a,b] [--yes]" >&2
    echo "Types: report, research, kb, postmortem, runbook" >&2
    exit 1
  fi

  # Token required for submit (write operation)
  if [[ -z "${TOKEN}" ]]; then
    echo "[ERROR] Token required for submit. Set ONEMCP_TOKEN or add \"token\" to ~/.onemcp/config.json" >&2
    exit 2
  fi

  if [[ ! -f "${file_path}" ]]; then
    echo "[ERROR] File not found: ${file_path}" >&2
    exit 1
  fi

  # ── Security checks ────────────────────────────────────────────────────────

  # Size check
  local file_size
  file_size=$(wc -c < "${file_path}" | tr -d ' ')
  if [[ "${file_size}" -gt "${MAX_FILE_BYTES}" ]]; then
    echo "[REJECT] File too large: ${file_size} bytes (limit: ${MAX_FILE_BYTES} bytes / 256 KB)" >&2
    exit 1
  fi

  # Binary check — detect null bytes in first 8KB
  if head -c 8192 "${file_path}" | grep -qP '\x00' 2>/dev/null; then
    echo "[REJECT] Binary file detected (null bytes). Only UTF-8 text files are accepted." >&2
    exit 1
  fi

  # Secret scan — basic patterns
  local secret_found=0
  local secret_pattern=""

  if grep -qE 'AKIA[0-9A-Z]{16}' "${file_path}" 2>/dev/null; then
    secret_found=1; secret_pattern="AWS Access Key (AKIA...)"
  fi
  if grep -qE '-----BEGIN\s*(RSA\s*)?PRIVATE KEY-----' "${file_path}" 2>/dev/null; then
    secret_found=1; secret_pattern="Private Key (BEGIN PRIVATE KEY)"
  fi
  if grep -qE 'Bearer\s+[A-Za-z0-9+/=_-]{20,}' "${file_path}" 2>/dev/null; then
    secret_found=1; secret_pattern="Bearer token (20+ chars)"
  fi
  if grep -qE 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' "${file_path}" 2>/dev/null; then
    secret_found=1; secret_pattern="JWT token (eyJ...)"
  fi
  if grep -qiE 'password\s*=\s*["\x27]?[^"\x27\s]{4,}' "${file_path}" 2>/dev/null; then
    secret_found=1; secret_pattern="Password assignment (password=...)"
  fi

  # Print preview: first 20 lines + size
  local size_kb
  size_kb=$(echo "scale=1; ${file_size} / 1024" | bc 2>/dev/null || echo "${file_size}B")
  echo "" >&2
  echo "--- File Preview ---" >&2
  echo "File : ${file_path}" >&2
  echo "Size : ${size_kb} KB (${file_size} bytes)" >&2
  echo "" >&2
  echo "First 20 lines:" >&2
  head -n 20 "${file_path}" | nl -ba >&2

  if [[ "${secret_found}" -eq 1 ]]; then
    echo "" >&2
    echo "[WARNING] Potential secret detected: ${secret_pattern}" >&2
    echo "[REJECT] Cannot submit file with detected secrets. Remove secrets first." >&2
    exit 1
  fi

  echo "" >&2

  # Prompt confirmation unless --yes
  if [[ "${yes}" -eq 0 ]]; then
    if [[ ! -t 0 ]]; then
      echo "[Non-TTY] Defaulting to N. Use --yes to skip prompt in scripts." >&2
      exit 1
    fi
    read -r -p "Submit this file? [y/N]: " answer >&2
    if [[ "${answer,,}" != "y" ]]; then
      echo "Submit cancelled." >&2
      exit 1
    fi
  fi

  # ── Build JSON payload and POST ────────────────────────────────────────────

  local basename slug title
  basename=$(basename "${file_path}" | sed 's/\.[^.]*$//')
  title="${basename}"
  slug=$(echo "${title}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/^-*//;s/-*$//' | cut -c1-160)

  # Ensure slug is at least 3 chars
  if [[ ${#slug} -lt 3 ]]; then
    slug="artifact-${slug}"
  fi

  # Build tags JSON array
  local tags_json="[]"
  if [[ -n "${tags}" ]]; then
    tags_json=$(echo "${tags}" | tr ',' '\n' | jq -Rsc 'split("\n") | map(select(length > 0) | ascii_downcase)')
  fi

  local tls_flag
  tls_flag=$(curl_tls_flags)

  # Read file content and build payload with jq
  local payload
  payload=$(jq -n \
    --arg type "${type}" \
    --arg title "${title}" \
    --arg slug "${slug}" \
    --arg body "$(cat "${file_path}")" \
    --argjson tags "${tags_json}" \
    '{type: $type, title: $title, slug: $slug, body: $body, tags: $tags}')

  echo "Submitting \"${title}\" (type=${type}, slug=${slug})..." >&2

  # shellcheck disable=SC2086
  local response
  response=$(curl -sf ${tls_flag} \
    -X POST \
    -H "X-Onemcp-User: ${USER_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --max-time 10 \
    -d "${payload}" \
    "${BASE_URL}/api/artifacts") || {
    echo "[ERROR] Submit failed. Check token, URL, and network." >&2
    exit 1
  }

  if command -v jq &>/dev/null; then
    local id artifact_slug status
    id=$(echo "${response}" | jq -r '.id // "?"')
    artifact_slug=$(echo "${response}" | jq -r '.slug // "?"')
    status=$(echo "${response}" | jq -r '.status // "?"')
    echo ""
    echo "Artifact created: #${id} · ${artifact_slug} [${status}]"
  else
    echo "${response}"
  fi
}

# ── Main dispatcher ───────────────────────────────────────────────────────────

usage() {
  cat >&2 <<'EOF'
onemcp — OneMCP CLI (bash wrapper)

Commands:
  search <query> [--limit N] [--service NAME]
  show <id-or-slug>
  submit --type <type> --file <path> [--tags a,b] [--yes]

Types: report, research, kb, postmortem, runbook

Config: ~/.onemcp/config.json (chmod 600)
  {"baseUrl":"https://onemcp.local","user":"alice","token":"...","tlsVerify":true}

Env: ONEMCP_BASE_URL, ONEMCP_USER, ONEMCP_TOKEN, ONEMCP_INSECURE=1
EOF
  exit 1
}

main() {
  if [[ $# -eq 0 ]]; then usage; fi

  local cmd="$1"; shift

  # Resolve config before any command
  resolve_config

  case "${cmd}" in
    search)  cmd_search "$@" ;;
    show)    cmd_show "$@" ;;
    submit)  cmd_submit "$@" ;;
    --help|-h|help) usage ;;
    *)
      echo "[ERROR] Unknown command: ${cmd}" >&2
      echo "Available: search, show, submit" >&2
      exit 1
      ;;
  esac
}

main "$@"
