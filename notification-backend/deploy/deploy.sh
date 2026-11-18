#!/usr/bin/env bash
# Run on the droplet: pulls the branch, installs, reloads pm2, checks health.
set -euo pipefail
BRANCH="${1:-dev_Udit}"
ROOT=/opt/worxstream-notifications
cd "$ROOT" && git fetch origin "$BRANCH" && git checkout "$BRANCH" && git reset --hard "origin/$BRANCH"
cd "$ROOT/notification-backend" && npm ci --omit=dev
pm2 startOrReload deploy/ecosystem.config.cjs --update-env && pm2 save
sleep 3
curl -fsS http://127.0.0.1:8100/health && echo " <- healthy"
