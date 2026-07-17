# Staging Deployment Guide — VPS 4vCPU/8GB/200GB Ubuntu 24.04

**Scope:** Deploy OneMCP P1 scaffold lên VPS staging. Chưa có full features — chỉ verify infrastructure + health endpoints hoạt động.

---

## 0. Prerequisites

### VPS spec
- Ubuntu 24.04 LTS.
- 4 vCPU / 8 GB RAM / 200 GB disk.
- Static internal IP + SSH access.
- Trong VPN nội bộ (không expose Internet).
- Có sudo user (tránh dùng root trực tiếp).

### Local (máy bạn dùng để SSH)
- SSH client + SSH key added to VPS.
- Git client (để clone hoặc scp code lên).

### Info cần chuẩn bị trước
- IP CIDR list production (đã chốt: `USER=10.0.14.0/24`, `ADMIN=192.168.122.0/24`).
- Domain hoặc IP internal cho portal (VD: `onemcp-staging.internal` hoặc IP trực tiếp).

---

## 1. SSH vào VPS + initial system config

### 1.1 SSH lần đầu (dùng root nếu chưa có sudo user)
```bash
ssh root@<vps-ip>
```

### 1.2 Đổi hostname
```bash
sudo hostnamectl set-hostname onemcp-staging
# Verify
hostnamectl
```

Cập nhật `/etc/hosts` để tránh sudo warning:
```bash
sudo sed -i "s/127.0.1.1.*/127.0.1.1 onemcp-staging/" /etc/hosts
grep 127.0.1.1 /etc/hosts
```

### 1.3 Đổi timezone → Asia/Ho_Chi_Minh
```bash
sudo timedatectl set-timezone Asia/Ho_Chi_Minh
# Verify
timedatectl
# Expect: Time zone: Asia/Ho_Chi_Minh (+07)
```

### 1.4 Enable NTP sync
```bash
sudo timedatectl set-ntp true
timedatectl status | grep -i ntp
# Expect: System clock synchronized: yes
#         NTP service: active
```

### 1.5 Locale (UTF-8)
```bash
sudo apt update && sudo apt install -y locales
sudo locale-gen en_US.UTF-8 vi_VN.UTF-8
sudo update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
# Reload session
exit
ssh youruser@<vps-ip>
locale
```

### 1.6 Tạo sudo user (nếu đang là root)
```bash
# Skip nếu bạn đã có non-root user
adduser deploy
usermod -aG sudo deploy

# Copy SSH key
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Test login từ máy dev
exit
ssh deploy@<vps-ip>
```

### 1.7 SSH hardening
```bash
sudo nano /etc/ssh/sshd_config
```

Đổi các dòng sau:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Restart SSH (chú ý: **giữ 1 SSH session cũ mở phòng bị lock out**):
```bash
sudo systemctl restart ssh
# Test từ terminal thứ 2:
# ssh deploy@<vps-ip>
```

### 1.8 System update + core packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ca-certificates gnupg openssl ufw fail2ban \
  htop unzip vim jq net-tools

# Cleanup
sudo apt autoremove -y
```

### 1.9 Enable automatic security updates (khuyến nghị)
```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
# Trả lời "Yes" khi hỏi
```

### 1.10 Swap (nếu VPS chưa có)
Check trước:
```bash
free -h
swapon --show
```

Nếu không có swap, tạo 4GB:
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Tuning cho server (dùng swap khi cần thật)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 1.11 Kernel tuning cho Docker + Postgres (khuyến nghị)
```bash
sudo tee /etc/sysctl.d/99-onemcp.conf > /dev/null <<'EOF'
# File descriptors
fs.file-max = 2097152

# Network
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 10000 65535

# Postgres shared memory
kernel.shmmax = 4294967296
kernel.shmall = 1048576

# Overcommit for Redis
vm.overcommit_memory = 1
EOF

sudo sysctl -p /etc/sysctl.d/99-onemcp.conf
```

### 1.12 Verify final state
```bash
hostnamectl
timedatectl
locale
free -h
df -h
uname -a
```

---

## 2. Cài Docker Engine + Compose v2

```bash
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Cho user vào group docker (khỏi sudo mỗi lần)
sudo usermod -aG docker $USER

# Logout + login lại để group có hiệu lực
exit
ssh youruser@<vps-ip>

# Verify
docker --version
docker compose version
```

---

## 3. Firewall (UFW)

Chỉ mở port cần thiết. Vì trong VPN nên rất chặt.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 443/tcp   # HTTPS portal + MCP
sudo ufw allow 80/tcp    # HTTP → redirect HTTPS
sudo ufw enable

sudo ufw status verbose
```

Fail2ban (tùy chọn, bảo vệ SSH):
```bash
sudo systemctl enable --now fail2ban
```

---

## 4. Clone code

```bash
sudo mkdir -p /opt/onemcp
sudo chown $USER:$USER /opt/onemcp
cd /opt/onemcp

git clone <your-git-url> .
# Nếu chưa push lên git → dùng scp từ máy dev:
# scp -r d:\Vietnt\Project\onemcp\* youruser@<vps-ip>:/opt/onemcp/
```

---

## 5. Generate TLS cert (self-signed)

```bash
cd /opt/onemcp
chmod +x ops/nginx/generate-self-signed-tls.sh
bash ops/nginx/generate-self-signed-tls.sh onemcp-staging.internal

# Verify
ls -la ops/nginx/tls/
# onemcp.crt, onemcp.key
```

---

## 6. Configure .env

```bash
cp .env.example .env
nano .env    # hoặc vim
```

**Chỉnh các giá trị bắt buộc:**
```env
# Postgres — password mạnh
POSTGRES_PASSWORD=<strong-random-32-chars>

# MinIO — password ≥8 chars
MINIO_ROOT_PASSWORD=<strong-random-16-chars>

# Access CIDR (staging test có thể mở rộng hơn prod)
USER_ALLOW_CIDR=10.0.14.0/24
ADMIN_ALLOW_CIDR=192.168.122.0/24

# Trusted proxy = Docker default bridge network
TRUSTED_PROXY_CIDR=172.16.0.0/12

# Admin bootstrap
ADMIN_USERNAMES=admin,youruser

# GitLab webhook (nếu chưa cần, để tạm)
GITLAB_WEBHOOK_SECRET=<random-secret>
```

Sinh strong passwords — **PHẢI dùng hex** (không ký tự đặc biệt) vì password đi vào `POSTGRES_URL` connection string, ký tự như `/`, `+`, `@`, `:` sẽ phá URL parser:
```bash
openssl rand -hex 24      # cho POSTGRES_PASSWORD (avoid base64 — có / và +)
openssl rand -hex 16      # cho MINIO_ROOT_PASSWORD
openssl rand -hex 32      # cho GITLAB_WEBHOOK_SECRET
```

**Chmod .env để chỉ owner đọc:**
```bash
chmod 600 .env
```

---

## 7. Build + start stack

```bash
cd /opt/onemcp

# Pull base images trước cho fast build
docker compose pull postgres redis minio nginx

# Build backend + portal
docker compose build

# Start stack
docker compose up -d

# Wait for healthy
docker compose ps
# Expect all services "healthy" hoặc "running"
```

**Xem logs nếu có lỗi:**
```bash
docker compose logs -f backend
docker compose logs -f portal
docker compose logs postgres
```

---

## 8. Verify

```bash
# Từ VPS chính nó (localhost)
curl -k https://localhost/api/health
# Expect: { "status": "ok", "service": "onemcp-backend", "mode": "v1-trust-header", ... }

curl -k https://localhost/health
# Expect: { "status": "ok", "service": "onemcp-portal", ... }

curl -k https://localhost/
# Expect: HTML home page
```

**Từ máy dev (trong VPN):**
```bash
# Browser: https://<vps-ip>/
# Nhận certificate warning (self-signed) → accept.
```

**Test IP CIDR guard:**
```bash
# Từ IP không trong CIDR → phải bị 403 (khi access module đã implement ở session 2)
# Hiện tại P1 scaffold chưa có access module → mọi request đều pass.
```

---

## 9. Health monitoring cơ bản

```bash
# System resources
docker stats
htop            # cần sudo apt install htop

# Disk usage
df -h
du -sh /opt/onemcp /var/lib/docker

# Docker network
docker network ls
docker compose exec backend wget -qO- http://postgres:5432 2>&1 || true
```

---

## 10. Update flow (khi có commit mới)

```bash
cd /opt/onemcp

# Pull code mới
git pull

# Rebuild changed services
docker compose build backend portal
docker compose up -d backend portal

# Nếu migration mới (từ session 2 trở đi):
docker compose exec backend pnpm migration:run

# Verify
docker compose ps
curl -k https://localhost/api/health
```

---

## 11. Backup manual (v1 P6 sẽ tự động hóa)

```bash
# Postgres dump
docker compose exec postgres pg_dump -U onemcp onemcp | gzip > /opt/onemcp/backups/pg-$(date +%Y%m%d-%H%M%S).sql.gz

# MinIO snapshot (khi có data)
docker compose exec minio mc mirror /data /backup

# Volumes:
docker run --rm -v onemcp_pg-data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/pg-data-$(date +%Y%m%d).tar.gz -C /data .
```

---

## 12. Rollback nếu deploy fail

```bash
# Stop everything
docker compose down

# Nếu data corrupt → restore từ backup
docker compose down -v   # ⚠️ xóa cả volumes
# ... restore volume ...

# Rollback code
git log --oneline -5
git checkout <previous-commit>
docker compose build
docker compose up -d
```

---

## 13. Troubleshooting

| Vấn đề | Check |
|---|---|
| `docker compose up` fail | `docker compose logs <service>` |
| Backend không start | Check `.env` value valid (Zod fail-fast log) |
| Postgres init.sql không chạy | Xóa volume `onemcp_pg-data` (data mất!) → `up` lại |
| Portal 502 từ nginx | Portal chưa healthy — check `docker compose logs portal` |
| TLS cert invalid | Regenerate: `bash ops/nginx/generate-self-signed-tls.sh` + restart nginx |
| Ports bị chiếm | `sudo lsof -i :443` — kill process khác |
| Docker permission denied | User chưa vào group docker — logout/login lại |

---

## 14. Sau khi verify OK

- [ ] Screenshot browser hiển thị home page.
- [ ] Log các container không có ERROR/FATAL trong 5 phút đầu.
- [ ] All services `docker compose ps` = healthy.
- [ ] Disk usage baseline: `du -sh /opt/onemcp /var/lib/docker`.
- [ ] Backup manual test OK.

→ Ready cho **cook session 2** (DB + Access + Audit).

---

## Unresolved
- Firewall rule refinement khi mở rộng test (thêm dev machine IP whitelist ngoài VPN?).
- SSH hardening (disable password auth, chỉ key) — nên làm nếu VPS staging exposed internal.
- Log rotation cho Docker (`/etc/docker/daemon.json` `log-opts max-size 100m`).
