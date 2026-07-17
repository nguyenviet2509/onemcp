# Backup & Restore

## Backup service (auto)

Container `backup` chạy alpine với `postgres-client` + `mc` + crond. Cron mặc định `0 3 * * *` (03:00 UTC daily). Output vào bind-mount `./backups/<UTC-timestamp>/`.

Format per snapshot:
```
./backups/20260717-030000/
├── postgres.dump         # pg_dump -Fc -Z 6 (custom format, compressed ~zstd-like)
└── minio.tar.gz          # tar -czf của mc mirror bucket onemcp-artifacts
```

Retention: giữ `BACKUP_RETAIN_DAYS` (default 14 ngày) — cron xóa folder cũ hơn.

## Manual trigger

```bash
docker compose exec backup /usr/local/bin/backup.sh
tail -f backups.log
```

## Verify

```bash
ls -lh backups/
# Kỳ vọng: folder mới nhất với 2 file, size hợp lý (dump vài MB, minio.tar.gz tùy attachment)

docker compose exec -T postgres pg_restore --list /backups/<TS>/postgres.dump | head
```

## Restore Postgres

```bash
# 1. Stop backend để tránh writes.
docker compose stop backend

# 2. Drop + recreate DB.
docker compose exec -T postgres psql -U onemcp postgres -c 'DROP DATABASE onemcp;'
docker compose exec -T postgres psql -U onemcp postgres -c 'CREATE DATABASE onemcp;'

# 3. Restore từ dump.
docker compose exec -T postgres pg_restore -U onemcp -d onemcp \
  --no-owner --no-privileges \
  /backups/<TS>/postgres.dump

# 4. Migration re-run (backend boot sẽ tự chạy).
docker compose up -d backend
docker compose logs backend --tail=10 | grep Migration
```

## Restore MinIO

```bash
# 1. Extract tarball.
tar -xzf backups/<TS>/minio.tar.gz -C /tmp/

# 2. Mirror ngược lên MinIO.
docker compose exec -T minio sh -c '
  mc alias set local http://localhost:9000 onemcp $MINIO_ROOT_PASSWORD &&
  mc mirror --overwrite /restore-src/onemcp-artifacts/ local/onemcp-artifacts/
'
```

## Off-site backup (recommended prod)

Bind mount `./backups` → NAS/S3 external mirror qua rclone hoặc systemd timer:

```bash
# /etc/cron.d/onemcp-offsite
0 4 * * * root rclone sync /opt/onemcp/backups s3-external:onemcp-backups
```

Best practice: 3-2-1 rule — 3 copies, 2 media, 1 off-site.

## Restore test schedule

Chạy restore test mỗi tháng lên staging riêng. Verify: artifacts + attachments count matches.

## Monitoring

Backup age exposed qua `/metrics`:
```
onemcp_backup_last_success_seconds  # timestamp last successful backup
```

(Chưa implement — TODO P6.2. Hiện tại monitor bằng `ls -lt backups/ | head`.)

Alert: nếu > 25h không có snapshot mới → page ops.
