#!/usr/bin/env bash
# Idempotent installer for the Esmaü'l-Hüsna app on a Debian/Ubuntu server.
# Run as root:  sudo bash deploy/install.sh
# Prerequisites: DNS A/AAAA record for the domain points to this server.
set -euo pipefail

DOMAIN="${DOMAIN:-teknodoz-esmaulhusna-ortakofis.org}"
REPO_URL="${REPO_URL:-https://github.com/izmgamestudios/esmaul-husna.git}"
APP_DIR="${APP_DIR:-/opt/esmaul-husna}"
APP_USER="esmaul"
CERT_EMAIL="${CERT_EMAIL:-izmgamestudios@gmail.com}"

log() { printf '\n==> %s\n' "$*"; }

if [[ "${EUID}" -ne 0 ]]; then
  echo "Bu script root olarak çalıştırılmalı: sudo bash deploy/install.sh" >&2
  exit 1
fi

log "Node.js >= 20 kontrolü"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]]; then
  echo "Node.js 20 veya üzeri gerekli. Önce kurun (ör. NodeSource veya nvm), sonra scripti tekrar çalıştırın." >&2
  exit 1
fi

log "Paketler (git, nginx, certbot)"
apt-get update -y
apt-get install -y git nginx certbot python3-certbot-nginx

log "Uygulama kullanıcısı"
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --home "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

log "Kod (${REPO_URL})"
if [[ -d "${APP_DIR}/.git" ]]; then
  git -C "${APP_DIR}" fetch --depth=1 origin main
  git -C "${APP_DIR}" reset --hard origin/main
else
  git clone --depth=1 "${REPO_URL}" "${APP_DIR}"
fi
mkdir -p "${APP_DIR}/data"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}/data"

log "systemd servisi"
install -m 0644 "${APP_DIR}/deploy/esmaul-husna.service" /etc/systemd/system/esmaul-husna.service
systemctl daemon-reload
systemctl enable --now esmaul-husna.service
systemctl restart esmaul-husna.service

log "nginx sitesi (${DOMAIN})"
sed "s/teknodoz-esmaulhusna-ortakofis.org/${DOMAIN}/g" "${APP_DIR}/deploy/nginx.conf" \
  > /etc/nginx/sites-available/esmaul-husna.conf
ln -sfn /etc/nginx/sites-available/esmaul-husna.conf /etc/nginx/sites-enabled/esmaul-husna.conf
nginx -t
systemctl reload nginx

log "Sağlık kontrolü (yerel)"
for _ in 1 2 3 4 5; do
  if curl -fsS http://127.0.0.1:3000/api/state >/dev/null 2>&1; then
    echo "Uygulama yanıt veriyor."
    break
  fi
  sleep 1
done
curl -fsS http://127.0.0.1:3000/api/state >/dev/null

log "TLS sertifikası (Let's Encrypt)"
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${CERT_EMAIL}" --redirect

log "Tamam: https://${DOMAIN}"
