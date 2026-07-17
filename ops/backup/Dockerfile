FROM alpine:3.20

# Postgres 16 client + mc (minio client) + coreutils.
RUN apk add --no-cache \
      postgresql16-client \
      coreutils \
      tar \
      gzip \
      ca-certificates \
      curl \
 && curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc \
 && chmod +x /usr/local/bin/mc

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Cron: chạy 03:00 UTC hàng ngày. Override qua BACKUP_CRON env.
ENV BACKUP_CRON="0 3 * * *"

# Wrapper: install crontab từ env rồi run crond.
CMD echo "${BACKUP_CRON} /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root \
 && touch /var/log/backup.log \
 && crond -f -L /var/log/cron.log &  \
    tail -f /var/log/backup.log
