#!/usr/bin/env bash
# One-time setup of the notification backend on a fresh Ubuntu 24.04 droplet. Safe to run again.
#
#   DOMAIN=notifications.worxstream.ai bash setup-droplet.sh     # with TLS (DNS must already point here)
#   bash setup-droplet.sh                                        # no TLS yet, serves on the droplet IP
#
# It never writes secrets: the first run creates /opt/worxstream-notifications/notification-backend/.env from a
# template and stops so you can fill in MONGODB_URI and SERVICE_KEYS. Run it again afterwards.
set -euo pipefail

REPO="${REPO:-https://github.com/invoicehubplus/Worxstream-AI-portal.git}"
BRANCH="${BRANCH:-dev_Udit}"
ROOT=/opt/worxstream-notifications
APP="$ROOT/notification-backend"
DOMAIN="${DOMAIN:-}"

echo "== packages (nginx, git, certbot, Node 20, pm2)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx git curl ca-certificates ufw certbot python3-certbot-nginx
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2

echo "== code ($BRANCH)"
if [ -d "$ROOT/.git" ]; then
  git -C "$ROOT" fetch origin "$BRANCH" && git -C "$ROOT" checkout "$BRANCH" && git -C "$ROOT" reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO" "$ROOT"
fi
cd "$APP" && npm ci --omit=dev

echo "== environment file"
if [ ! -f "$APP/.env" ]; then
  cat > "$APP/.env" <<'EOF'
PORT=8100
NODE_ENV=production
MONGODB_URI=
WORXSTREAM_API_URL=https://api.worxstream.ai
CORS_ORIGINS=https://app.worxstream.ai
SERVICE_KEYS=mail:CHANGE_ME,chat:CHANGE_ME,agent:CHANGE_ME
RETENTION_DAYS=90
EOF
  chmod 600 "$APP/.env"
  echo
  echo "Created $APP/.env. Fill in MONGODB_URI and SERVICE_KEYS (nano $APP/.env), then run this script again."
  exit 0
fi
if grep -qE '^MONGODB_URI=$|CHANGE_ME' "$APP/.env"; then
  echo ".env still has empty MONGODB_URI or CHANGE_ME keys: edit $APP/.env and run again."; exit 1
fi
chmod 600 "$APP/.env"

echo "== pm2 (one instance)"
pm2 startOrReload "$APP/deploy/ecosystem.config.cjs" --update-env
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
sleep 4
curl -fsS http://127.0.0.1:8100/health && echo "  <- app is healthy"

echo "== nginx"
SERVER_NAME="${DOMAIN:-_}"
sed "s/notifications.worxstream.ai/${SERVER_NAME}/" "$APP/deploy/nginx-notifications.conf" > /etc/nginx/sites-available/notifications
ln -sf /etc/nginx/sites-available/notifications /etc/nginx/sites-enabled/notifications
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "== firewall (ssh, http, https)"
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

if [ -n "$DOMAIN" ]; then
  echo "== TLS for $DOMAIN"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
fi

echo
echo "Done. Check:  curl -s http://127.0.0.1/health   ${DOMAIN:+and  curl -s https://$DOMAIN/health}"
