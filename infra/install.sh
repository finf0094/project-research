#!/usr/bin/env bash
# Sets up the whole exam platform on a fresh Ubuntu server, in one run: Docker, the app, HTTPS, demo data.
# Meant for the provider's cloud-init field, or by hand: sudo bash install.sh. Safe to run again (it updates).
#
#   SITE_ADDRESS  the site's domain; default <server ip>.sslip.io, a free name that points at this server,
#                 so Caddy can get an HTTPS certificate (browsers allow the camera only over HTTPS)
#   BRANCH        which branch to run (default feat/exam-platform)
set -euo pipefail
exec > >(tee -a /var/log/exam-install.log) 2>&1

REPO=https://github.com/finf0094/project-research.git
BRANCH=${BRANCH:-feat/exam-platform}
DIR=/opt/exam
export DEBIAN_FRONTEND=noninteractive

# Building the images needs more memory than a small server has: swap keeps the build from being killed.
if ! swapon --show | grep -q .; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

command -v git >/dev/null || { apt-get update && apt-get install -y git; }
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone -b "$BRANCH" "$REPO" "$DIR"; fi
cd "$DIR/infra"

# Settings are made once and kept: a new MASTER_KEY would make every stored attempt key unreadable.
if [ ! -f .env ]; then
  IP=$(curl -fsS https://api.ipify.org)
  SITE=${SITE_ADDRESS:-$IP.sslip.io}
  cat >.env <<EOF
MASTER_KEY=$(openssl rand -base64 32)
SITE_ADDRESS=$SITE
LIVEKIT_URL=wss://$SITE
LIVEKIT_API_KEY=exam
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
LIVEKIT_NODE_IP=$IP
EOF
  chmod 600 .env
fi

docker compose --profile oral up -d --build
docker compose run --rm api node src/db/migrate.ts
# Demo accounts once, for trying it out (change their passwords, or skip this, for real exams).
if [ ! -f .seeded ]; then docker compose run --rm api node scripts/seed.ts && touch .seeded; fi

echo "Ready: https://$(grep ^SITE_ADDRESS= .env | cut -d= -f2)  (keep a copy of $DIR/infra/.env: it holds MASTER_KEY)"
