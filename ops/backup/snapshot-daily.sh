#!/usr/bin/env bash
# Daily snapshot of OneMCP state — encrypted with age, pushed to S3.
# Mirrors OneLog/Authway pattern (plan 260821-1346).
#
# Contents:
#   1. globals.sql — pg_dumpall roles/tablespaces (CREATE ROLE for restore)
#   2. onemcp.sql.gz — pg_dump with --create (includes CREATE DATABASE + pgvector)
#   3. minio-artifacts.tar.gz — MinIO bucket mirror via `mc`
#   4. Named volumes (git-mirrors, certbot-etc, certbot-www) via helper containers
#   5. configs/ — docker-compose.yml, ops/nginx/, ops/postgres/init.sql
#   6. secrets/ — .env
#   7. MANIFEST.json + SHA256SUMS + RESTORE.md
#
# Usage: bash snapshot-daily.sh [BACKUP_DIR]
# Cron:  0 2 * * * /opt/onemcp/ops/backup/snapshot-daily.sh >> /var/log/onemcp-snapshot.log 2>&1
# Retention: BACKUP_S3_KEEP_DAYS from .env (5). Local: KEEP_DAYS (2) for stranded.
# Prereq: age binary + ops/backup/backup-age.pub. aws cli for S3.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"        # /opt/onemcp
BACKUP_DIR="${1:-${BACKUP_DIR:-$REPO_DIR/backup}}"
DATE="$(date +%Y%m%d-%H%M)"
STAGE="$(mktemp -d -t onemcpsnap.XXXXXX)"
KEEP_DAYS="${KEEP_DAYS:-2}"

cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

mkdir -p "$BACKUP_DIR"

if [[ -f "$REPO_DIR/.env" ]]; then
  set -a; . "$REPO_DIR/.env"; set +a
fi

echo "[snapshot] $(date -Is) start → $BACKUP_DIR"

# --- 1. Postgres globals + database dump ---
PG_CONTAINER="${PG_CONTAINER:-onemcp-postgres-1}"
if ! docker inspect -f '{{.State.Running}}' "$PG_CONTAINER" 2>/dev/null | grep -q true; then
  echo "[snapshot] ERROR $PG_CONTAINER not running" >&2
  exit 2
fi

echo "[1/7] pg_dumpall globals"
docker exec "$PG_CONTAINER" sh -c \
  "pg_dumpall -U '${POSTGRES_USER:-onemcp}' --globals-only --clean --if-exists" \
  > "$STAGE/globals.sql"
GLOBALS_SIZE=$(stat -c%s "$STAGE/globals.sql")
echo "  globals.sql size=$GLOBALS_SIZE bytes"

echo "[2/7] pg_dump ${POSTGRES_DB:-onemcp} database"
docker exec "$PG_CONTAINER" sh -c \
  "pg_dump -U '${POSTGRES_USER:-onemcp}' -d '${POSTGRES_DB:-onemcp}' --create --clean --if-exists" \
  | gzip -9 > "$STAGE/onemcp.sql.gz"
DUMP_SIZE=$(stat -c%s "$STAGE/onemcp.sql.gz")
if [[ "$DUMP_SIZE" -lt 10240 ]]; then
  echo "[snapshot] ERROR pg_dump too small ($DUMP_SIZE bytes)" >&2
  exit 3
fi
echo "  onemcp.sql.gz size=$DUMP_SIZE bytes"

# --- 3. MinIO artifacts mirror ---
echo "[3/7] minio artifacts mirror"
MC_TMP="$(mktemp -d -t mcsnap.XXXXXX)"
docker run --rm --network onemcp_default \
  -v "$MC_TMP:/dst" \
  -e MC_HOST_src="http://${MINIO_ROOT_USER:-onemcp}:${MINIO_ROOT_PASSWORD:-change-me-min-8-chars}@onemcp-minio-1:9000" \
  minio/mc:latest \
  mirror --quiet "src/${MINIO_BUCKET:-onemcp-artifacts}" "/dst/${MINIO_BUCKET:-onemcp-artifacts}" >/dev/null 2>&1 || true
tar -C "$MC_TMP" -czf "$STAGE/minio-artifacts.tar.gz" . 2>/dev/null || echo "  (minio mirror empty)"
rm -rf "$MC_TMP"
[[ -f "$STAGE/minio-artifacts.tar.gz" ]] && echo "  minio-artifacts.tar.gz size=$(stat -c%s "$STAGE/minio-artifacts.tar.gz") bytes"

# --- 4. Named volumes ---
echo "[4/7] docker named volumes"
for vol in git-mirrors certbot-etc certbot-www; do
  VNAME="onemcp_${vol}"
  if docker volume inspect "$VNAME" >/dev/null 2>&1; then
    docker run --rm -v "$VNAME:/src:ro" -v "$STAGE:/dst" alpine:3.20 \
      tar -C /src -cf "/dst/${vol}.tar" . 2>/dev/null || true
    echo "  ${vol}.tar OK"
  else
    echo "  ($VNAME missing — skipped)"
  fi
done

# --- 5. Static configs + secrets ---
echo "[5/7] configs + secrets bundle"
mkdir -p "$STAGE/configs" "$STAGE/configs/ops" "$STAGE/secrets"
cp -p "$REPO_DIR/docker-compose.yml" "$STAGE/configs/docker-compose.yml"
[[ -d "$REPO_DIR/ops/nginx" ]] && cp -rp "$REPO_DIR/ops/nginx" "$STAGE/configs/ops/"
[[ -d "$REPO_DIR/ops/postgres" ]] && cp -rp "$REPO_DIR/ops/postgres" "$STAGE/configs/ops/"
[[ -d "$REPO_DIR/ops/vector" ]] && cp -rp "$REPO_DIR/ops/vector" "$STAGE/configs/ops/"
[[ -d "$REPO_DIR/ops/backup" ]] && cp -rp "$REPO_DIR/ops/backup" "$STAGE/configs/ops/"
[[ -f "$REPO_DIR/.env" ]] && cp -p "$REPO_DIR/.env" "$STAGE/secrets/.env"

# --- 6. RESTORE.md embedded ---
cat > "$STAGE/RESTORE.md" <<'RESTORE_EOF'
# OneMCP snapshot — RESTORE procedure

## Prerequisites on fresh VPS
- Docker Engine + Docker Compose plugin
- `age` binary (`apt-get install age`)
- Private age key `~/.secrets/onelog-backup-master.key`
- Postgres image `pgvector/pgvector:pg16` (required for pgvector extension)

## Step 1 — Decrypt + extract
```bash
age -d -i ~/.secrets/onelog-backup-master.key onemcp-YYYYMMDD-HHMM.tar.gz.age \
  | tar -xzf - -C /tmp/restore
cd /tmp/restore
cat MANIFEST.json
sha256sum -c SHA256SUMS
```

## Step 2 — Provision /opt/onemcp
```bash
mkdir -p /opt/onemcp
cp -r configs/. /opt/onemcp/
cp -r secrets/. /opt/onemcp/
ls /opt/onemcp/    # .env, docker-compose.yml, ops/
```

## Step 3 — Boot Postgres + restore DB
```bash
cd /opt/onemcp
docker compose up -d postgres
sleep 15
set -a; . .env; set +a

# Globals first (CREATE ROLE)
cat /tmp/restore/globals.sql | docker compose exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres

# Schema + data (CREATE DATABASE via --create)
gunzip -c /tmp/restore/onemcp.sql.gz | docker compose exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres

# Verify pgvector extension + row counts
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT extname FROM pg_extension WHERE extname='vector';"
```

## Step 4 — Restore MinIO artifacts
```bash
docker compose up -d minio
sleep 10
mkdir -p /tmp/minio-restore
tar -xzf /tmp/restore/minio-artifacts.tar.gz -C /tmp/minio-restore
docker run --rm --network onemcp_default \
  -v /tmp/minio-restore:/src \
  -e MC_HOST_dst="http://$MINIO_ROOT_USER:$MINIO_ROOT_PASSWORD@onemcp-minio-1:9000" \
  minio/mc:latest \
  mirror --quiet "/src/$MINIO_BUCKET" "dst/$MINIO_BUCKET"
```

## Step 5 — Restore named volumes
```bash
for vol in git-mirrors certbot-etc certbot-www; do
  docker volume create "onemcp_${vol}"
  docker run --rm -v "onemcp_${vol}:/dst" -v /tmp/restore:/src alpine:3.20 \
    tar -C /dst -xf /src/${vol}.tar || true
done
```

## Step 6 — Boot full stack
```bash
docker compose up -d
sleep 30
docker compose ps
curl -sf http://localhost:3000/health   # or via public URL
```

## Step 7 — DNS + external
Point `AUTH_URL` domain (from `.env`) at new VPS IP. Renew certs via `certbot`.

## Rollback
```bash
cd /opt/onemcp && docker compose down -v
docker volume rm onemcp_pg-data onemcp_minio-data onemcp_redis-data \
  onemcp_git-mirrors onemcp_certbot-etc onemcp_certbot-www onemcp_tei-cache
# Restart from Step 3.
```

Verify all integrity: `sha256sum -c SHA256SUMS` inside extracted archive.
RESTORE_EOF

# --- 7. MANIFEST + SHA256SUMS ---
echo "[6/7] manifest + checksums"
GIT_COMMIT=$(cd "$REPO_DIR" && git rev-parse HEAD 2>/dev/null || echo unknown)
IMAGE_TAGS=$(cd "$REPO_DIR" && docker compose config --images 2>/dev/null | sort -u | paste -sd, - || echo unknown)
cat > "$STAGE/MANIFEST.json" <<EOF
{
  "version": 1,
  "service": "onemcp",
  "created": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "git_commit": "$GIT_COMMIT",
  "image_tags": "$IMAGE_TAGS",
  "has_secrets": true,
  "dump_size_bytes": $DUMP_SIZE
}
EOF
(cd "$STAGE" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)

# --- Pack + age encrypt ---
echo "[7/7] pack + age encrypt"
ARCHIVE="$BACKUP_DIR/onemcp-${DATE}.tar.gz.age"
AGE_PUB="${BACKUP_AGE_PUB:-$REPO_DIR/ops/backup/backup-age.pub}"
if [[ ! -f "$AGE_PUB" ]]; then
  echo "[snapshot] ERROR age public key missing: $AGE_PUB" >&2
  exit 5
fi
if ! command -v age >/dev/null 2>&1; then
  echo "[snapshot] ERROR age binary missing (apt install age)" >&2
  exit 6
fi
tar -C "$STAGE" -czf - . | age -R "$AGE_PUB" -o "$ARCHIVE"
echo "[snapshot] wrote $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# --- S3 offsite push ---
if [[ "${BACKUP_S3_ENABLE:-false}" == "true" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "[snapshot] ERROR BACKUP_S3_ENABLE=true but aws cli missing" >&2
    exit 4
  fi
  : "${BACKUP_S3_BUCKET:?Set BACKUP_S3_BUCKET when BACKUP_S3_ENABLE=true}"

  S3_ENDPOINT_ARG=()
  [[ -n "${BACKUP_S3_ENDPOINT:-}" ]] && S3_ENDPOINT_ARG+=(--endpoint-url "$BACKUP_S3_ENDPOINT")

  BUCKET_URI="$BACKUP_S3_BUCKET"
  [[ "$BUCKET_URI" != s3://* ]] && BUCKET_URI="s3://$BUCKET_URI"
  S3_KEY="${BUCKET_URI%/}/${BACKUP_S3_PREFIX:-}onemcp-${DATE}.tar.gz.age"
  S3_KEY_PATH="${BACKUP_S3_PREFIX:-}onemcp-${DATE}.tar.gz.age"
  BUCKET_NAME="${BUCKET_URI#s3://}"
  BUCKET_NAME="${BUCKET_NAME%%/*}"

  echo "[snapshot] s3 preflight"
  set +e
  aws "${S3_ENDPOINT_ARG[@]}" s3 ls "${BUCKET_URI%/}/" >/dev/null 2>&1
  PREFLIGHT=$?
  set -e
  if [[ "$PREFLIGHT" -ne 0 ]]; then
    echo "[snapshot] WARN S3 preflight failed — archive kept at $ARCHIVE" >&2
    exit 0
  fi

  echo "[snapshot] s3 upload → $S3_KEY"
  set +e
  aws "${S3_ENDPOINT_ARG[@]}" s3 cp "$ARCHIVE" "$S3_KEY" \
    --only-show-errors --metadata "hostname=$(hostname),created=$(date -Iseconds)"
  UPLOAD_RC=$?
  set -e
  if [[ "$UPLOAD_RC" -ne 0 ]]; then
    echo "[snapshot] WARN s3 cp failed — archive kept at $ARCHIVE" >&2
    exit 0
  fi

  LOCAL_SIZE=$(stat -c%s "$ARCHIVE" 2>/dev/null || stat -f%z "$ARCHIVE")
  REMOTE_SIZE=""
  for attempt in 1 2 3 4 5; do
    REMOTE_SIZE=$(aws "${S3_ENDPOINT_ARG[@]}" s3api head-object \
      --bucket "$BUCKET_NAME" --key "$S3_KEY_PATH" \
      --query 'ContentLength' --output text 2>/dev/null || true)
    if [[ -n "$REMOTE_SIZE" && "$REMOTE_SIZE" == "$LOCAL_SIZE" ]]; then break; fi
    sleep 2
  done

  if [[ "$REMOTE_SIZE" != "$LOCAL_SIZE" ]]; then
    echo "[snapshot] WARN s3 verify failed (local=$LOCAL_SIZE remote=${REMOTE_SIZE:-<missing>}) — archive kept" >&2
    exit 0
  fi

  echo "[snapshot] s3 verified ($REMOTE_SIZE bytes match)"
  rm -f "$ARCHIVE"
  echo "[snapshot] local archive purged"

  KEEP_S3="${BACKUP_S3_KEEP_DAYS:-0}"
  if [[ "$KEEP_S3" -gt 0 ]]; then
    CUTOFF_EPOCH=$(( $(date +%s) - KEEP_S3 * 86400 ))
    aws "${S3_ENDPOINT_ARG[@]}" s3 ls "${BUCKET_URI%/}/${BACKUP_S3_PREFIX:-}" 2>/dev/null \
      | awk '{print $1" "$2" "$NF}' \
      | while read -r d t f; do
          [[ "$f" =~ ^onemcp-.*\.tar\.gz\.age$ ]] || continue
          FILE_EPOCH=$(date -d "$d $t" +%s 2>/dev/null || echo 0)
          if [[ "$FILE_EPOCH" -gt 0 && "$FILE_EPOCH" -lt "$CUTOFF_EPOCH" ]]; then
            echo "  purge remote: $f"
            aws "${S3_ENDPOINT_ARG[@]}" s3 rm "${BUCKET_URI%/}/${BACKUP_S3_PREFIX:-}$f" --only-show-errors || true
          fi
        done
  fi
fi

find "$BACKUP_DIR" -maxdepth 1 -name 'onemcp-*.tar.gz.age' -mtime "+${KEEP_DAYS}" -print -delete || true

echo "[snapshot] $(date -Is) done"
