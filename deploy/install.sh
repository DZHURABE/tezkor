#!/usr/bin/env bash
# Тезкор — one-command install on a fresh Ubuntu/Debian VPS (run as root):
#   bash deploy/install.sh
# Installs Node.js 20 and Caddy (automatic HTTPS), copies the app to /opt/tezkor,
# keeps data in /var/lib/tezkor (hourly backups inside), and starts it as a service.
# Run it again any time to update the app: data and settings are kept.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/tezkor}"
DATA_DIR="${DATA_DIR:-/var/lib/tezkor}"
ENV_FILE="${ENV_FILE:-/etc/tezkor.env}"
PORT="${PORT:-3000}"
SKIP_SYSTEM="${SKIP_SYSTEM:-0}"          # 1 = only copy/build/configure (used for testing)
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mXATO: %s\033[0m\n' "$*" >&2; exit 1; }

if [ "$SKIP_SYSTEM" != "1" ]; then
  [ "$(id -u)" = "0" ] || die "root sifatida ishga tushiring: sudo bash deploy/install.sh"
  command -v apt-get >/dev/null || die "Bu skript Ubuntu yoki Debian uchun."

  say "Kerakli dasturlar o'rnatilmoqda"
  apt-get update -y
  apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https
  if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi
  if ! command -v caddy >/dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y && apt-get install -y caddy
  fi
  id tezkor >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin tezkor
fi

say "Dastur nusxalanmoqda: $APP_DIR"
mkdir -p "$APP_DIR" "$DATA_DIR"
rm -rf "$APP_DIR/apps"
cp -r "$SRC/apps" "$APP_DIR/"
rm -rf "$APP_DIR/apps/web/shots" "$APP_DIR/apps/api/data"
(cd "$APP_DIR/apps/web" && node build.mjs)

if [ ! -f "$ENV_FILE" ]; then
  say "Birinchi sozlash"
  IP="$(curl -fsS -4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
  DEF_DOMAIN="${IP//./-}.sslip.io"
  DOMAIN="${DOMAIN:-}"; ADMIN_PHONE="${ADMIN_PHONE:-}"; ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"; SUPPORT="${SUPPORT_PHONE:-}"
  [ -n "$DOMAIN" ] || read -rp "Domen (masalan tezkor.tj). Bo'sh qoldirsangiz: $DEF_DOMAIN : " DOMAIN
  DOMAIN="${DOMAIN:-$DEF_DOMAIN}"
  [ -n "$ADMIN_PHONE" ] || read -rp "Admin telefon raqami (9 raqam, masalan 931112233): " ADMIN_PHONE
  if [ -z "$ADMIN_PASSWORD" ]; then read -rsp "Admin paroli (kamida 8 belgi): " ADMIN_PASSWORD; echo; fi
  [ ${#ADMIN_PASSWORD} -ge 8 ] || die "Parol kamida 8 belgi bo'lsin."
  case "$ADMIN_PASSWORD" in *"'"*) die "Parolda ' belgisi bo'lmasin.";; esac
  umask 077
  cat > "$ENV_FILE" <<EOF
PORT="$PORT"
DATA_FILE="$DATA_DIR/db.json"
DOMAIN="$DOMAIN"
ADMIN_PHONE="$ADMIN_PHONE"
ADMIN_PASSWORD='$ADMIN_PASSWORD'
ADMIN_NAME="Admin"
MAP_TILES="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
MAP_TILES_ATTR="© OpenStreetMap"
EOF
  umask 022
fi
set -a; . "$ENV_FILE"; set +a

if [ "$SKIP_SYSTEM" = "1" ]; then say "SKIP_SYSTEM=1: xizmat o'rnatilmadi"; exit 0; fi
chown -R tezkor:tezkor "$DATA_DIR"; chmod 600 "$ENV_FILE"

say "Xizmat (systemd) sozlanmoqda"
cat > /etc/systemd/system/tezkor.service <<EOF
[Unit]
Description=Tezkor food delivery
After=network-online.target
Wants=network-online.target

[Service]
User=tezkor
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP_DIR/apps/api
ExecStart=$(command -v node) $APP_DIR/apps/api/src/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA_DIR
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  encode gzip
  reverse_proxy 127.0.0.1:$PORT
}
EOF

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 80/tcp; ufw allow 443/tcp; fi
systemctl daemon-reload
systemctl enable --now tezkor
systemctl restart tezkor
systemctl reload caddy || systemctl restart caddy

sleep 3
curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null || die "Dastur ishga tushmadi. Ko'rish: journalctl -u tezkor -n 50"
# the admin password is only needed for the very first start: remove it from the file
sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=''/" "$ENV_FILE"
say "Tayyor! Brauzerda oching: https://$DOMAIN"
echo "Admin: telefon $ADMIN_PHONE va siz kiritgan parol."
echo "Holatni ko'rish: systemctl status tezkor   |   Loglar: journalctl -u tezkor -f"
echo "Zaxira nusxalar: $DATA_DIR/backups"
