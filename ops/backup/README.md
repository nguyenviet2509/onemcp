# OneMCP backup

Daily snapshot script: [`snapshot-daily.sh`](snapshot-daily.sh) — age-encrypted, S3 offsite.

Uses same age master key as OneLog + Authway (one operator, one custody chain). See `../../../onelog/infra/backup/README.md` for master key custody procedure.

## Runtime install on onemcp-vps

```bash
sudo apt-get install -y age python3-pip pipx
pipx install awscli
ln -sfn /root/.local/bin/aws /usr/local/bin/aws
```

## Cron

```
0 2 * * * /opt/onemcp/ops/backup/snapshot-daily.sh >> /var/log/onemcp-snapshot.log 2>&1
```

## Restore

Xem `RESTORE.md` được embed trong mỗi archive. Trích:

```bash
aws --endpoint-url https://drive-storagehns3st.000nethost.com s3 cp \
  s3://backups-onemcp-server/daily/onemcp-YYYYMMDD-HHMM.tar.gz.age .
age -d -i ~/.secrets/onelog-backup-master.key \
  onemcp-YYYYMMDD-HHMM.tar.gz.age | tar -xzf - -C /tmp/restore
cat /tmp/restore/RESTORE.md
```

## Contents

- `globals.sql` — pg_dumpall roles/tablespaces
- `onemcp.sql.gz` — pg_dump with `--create` (CREATE DATABASE + pgvector)
- `minio-artifacts.tar.gz` — MinIO bucket mirror
- `git-mirrors.tar`, `certbot-etc.tar`, `certbot-www.tar` — named volumes
- `configs/` — docker-compose.yml + ops/{nginx,postgres,vector,backup}/
- `secrets/.env`
- `MANIFEST.json` + `SHA256SUMS` + `RESTORE.md`
