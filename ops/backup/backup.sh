#!/bin/sh
# Daily backup: pg_dump + mc mirror MinIO → /backups với timestamped folders.
# Retention: giữ N ngày (BACKUP_RETAIN_DAYS, default 14).
# Run trong scratch alpine container có postgres-client + mc.

set -eu

TS=$(date -u +%Y%m%d-%H%M%S)
OUT="/backups/${TS}"
mkdir -p "$OUT"

echo "[$(date -u +%FT%TZ)] backup start ts=${TS}"

# 1. Postgres dump (custom format, compressed).
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST:-postgres}" \
  -U "${POSTGRES_USER:-onemcp}" \
  -d "${POSTGRES_DB:-onemcp}" \
  -Fc -Z 6 \
  -f "${OUT}/postgres.dump"
echo "  ✓ postgres dump: $(du -h ${OUT}/postgres.dump | cut -f1)"

# 2. MinIO mirror → tarball.
mc alias set src "${MINIO_ENDPOINT:-http://minio:9000}" \
  "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" > /dev/null 2>&1

mkdir -p "${OUT}/minio"
mc mirror --quiet --overwrite "src/${MINIO_BUCKET:-onemcp-artifacts}" "${OUT}/minio/${MINIO_BUCKET:-onemcp-artifacts}"
tar -czf "${OUT}/minio.tar.gz" -C "${OUT}" "minio"
rm -rf "${OUT}/minio"
echo "  ✓ minio tarball: $(du -h ${OUT}/minio.tar.gz | cut -f1)"

# 3. Retention prune.
RETAIN="${BACKUP_RETAIN_DAYS:-14}"
find /backups -mindepth 1 -maxdepth 1 -type d -mtime "+${RETAIN}" -exec rm -rf {} +
echo "  ✓ prune older than ${RETAIN} days"

echo "[$(date -u +%FT%TZ)] backup done → ${OUT}"
