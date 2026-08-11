# Certbot — Let's Encrypt cert cho `oneconnector.000nethost.com`

Cấp/renew cert qua **HTTP-01 webroot** — nginx serve `/.well-known/acme-challenge/`
từ volume `certbot-www`, certbot ghi vào cùng volume.

## Prerequisites
1. DNS A record `oneconnector.000nethost.com` → `202.92.5.113` (verify: `dig +short oneconnector.000nethost.com`)
2. Port 80 mở public trên VPS (nginx :80 đã listen)
3. Nginx đang chạy với conf mới nhất (`docker compose up -d nginx`)

## Issue cert lần đầu

```bash
# Trên onemcp-vps, cd /opt/onemcp
docker compose --profile cert run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d oneconnector.000nethost.com \
  --email admin@inet.vn \
  --agree-tos --no-eff-email --non-interactive
```

Verify:
```bash
docker compose --profile cert run --rm certbot certificates
# → oneconnector.000nethost.com  Expiry: ~90 days
```

## Switch nginx sang LE cert

Sửa `ops/nginx/onemcp.conf` — comment 2 dòng self-signed, uncomment 2 dòng LE:

```nginx
# ssl_certificate     /etc/nginx/tls/onemcp.crt;
# ssl_certificate_key /etc/nginx/tls/onemcp.key;
ssl_certificate     /etc/letsencrypt/live/oneconnector.000nethost.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/oneconnector.000nethost.com/privkey.pem;
```

Reload:
```bash
docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload
```

Verify browser: https://oneconnector.000nethost.com — cert Issuer = Let's Encrypt (E5/R11).

## Auto-renew (cron trên host VPS)

```bash
# /etc/cron.d/onemcp-certbot-renew (chmod 644)
0 3,15 * * * root cd /opt/onemcp && docker compose --profile cert run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload
```

Renew idempotent — chỉ actually renew khi <30 days remaining.

## Troubleshoot

| Triệu chứng | Xử lý |
|---|---|
| `Connection refused` khi certbot query :80 | Verify DNS resolve đúng IP + firewall :80 open |
| `Challenge failed` NXDOMAIN | Chờ DNS propagate (5-15 phút) |
| Cert issued nhưng nginx vẫn self-signed | Chưa uncomment LE paths hoặc chưa reload nginx |
| `too many certificates already issued` | Rate limit LE (5/week/domain) — dùng `--staging` để test |
