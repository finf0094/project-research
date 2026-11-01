#!/usr/bin/env bash
# Sets up the whole exam platform on a fresh Ubuntu server, in one run: Docker, the app, HTTPS, demo data.
# Meant for the provider's cloud-init field, or by hand: sudo bash install.sh. Safe to run again (it updates).
#
#   SITE_ADDRESS  the site's domain; default <server ip>.sslip.io, a free name that points at this server,
#                 so Caddy can get an HTTPS certificate (browsers allow the camera only over HTTPS).
#                 Given on a later run, it replaces the one in .env (point the domain at the server first).
#   BRANCH        which branch to run (default feat/exam-platform)
set -euo pipefail
# The log holds the demo password: readable by root only.
# One run at a time (a manual run waits for the updater's); update.sh already holds the lock.
if [ -z "${EXAM_LOCKED:-}" ]; then exec 9>/var/lock/exam-install.lock && flock 9; fi
LOG=/var/log/exam-install.log
touch $LOG && chmod 600 $LOG
# Bounded: every run would add a build's output to it. (umask: the copy is root's only, like the log.)
(umask 077 && tail -n 3000 $LOG >$LOG.tmp && cat $LOG.tmp >$LOG && rm -f $LOG.tmp)
exec > >(tee -a $LOG) 2>&1

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
# Docker's own script first; a release it does not know yet gets Ubuntu's own packages instead.
if ! command -v docker >/dev/null; then
  # Its half-added repository for the unknown release would break apt-get update: it goes first.
  curl -fsSL https://get.docker.com | sh || {
    rm -f /etc/apt/sources.list.d/docker.list /etc/apt/sources.list.d/docker.sources
    apt-get update && apt-get install -y docker.io docker-compose-v2 docker-buildx
  }
fi

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin && git -C "$DIR" reset -q --hard '@{u}' # .env and ignored files stay
else
  git clone -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR/infra"

# The result of the last run, at https://<site>/deploy-status.txt: how whoever pushed sees it without a
# login to the server. On a failure, the end of the log (passwords left out).
mkdir -p status
COMMIT=$(git rev-parse --short HEAD)
# The second line names the change, for the status page (https://<site>/deploy).
SUBJECT="commit: $(git log -1 --format=%s | head -c 200)"
printf '%s\n%s\n' "deploying $COMMIT since $(date -u +%FT%TZ)" "$SUBJECT" >status/deploy-status.txt
# The history for the status page: one line per deployment, then one per change it brought (since the last
# working one): its subject and the "- " points of its message, joined by \x1f. The newest 600 lines are kept.
record() {
  local history=status/deploy-history.txt since range
  since=$(awk -F'\t' '$1 == "deploy" && $3 == "ok" { sha = $4 } END { print sha }' "$history" 2>/dev/null || true)
  range="-n 20 HEAD"
  if [ -n "$since" ] && git merge-base --is-ancestor "$since" HEAD 2>/dev/null; then range="$since..HEAD"; fi
  {
    printf 'deploy\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$1" "$COMMIT"
    # shellcheck disable=SC2086 # the range is two words on purpose when there is no last deployment
    git log --format=%h $range | while read -r sha; do
      points=$(git log -1 --format=%b "$sha" | awk '/^- /{if(p)print p; p=substr($0,3); next} /^  +[^ ]/{if(p){sub(/^ +/,"");p=p" "$0}; next} {if(p)print p; p=""} END{if(p)print p}' | tr '\n' '\037')
      printf 'commit\t%s\t%s\t%s\t%s\n' "$sha" "$(git log -1 --format=%cI "$sha")" "$(git log -1 --format=%s "$sha")" "$points"
    done
  } >>"$history"
  tail -n 600 "$history" >"$history.tmp" && mv "$history.tmp" "$history"
}
# (The log is written through tee: a moment lets its last lines land before they are read.)
trap 'code=$?; [ $code -eq 0 ] || { { sleep 1; echo "FAILED $COMMIT at $(date -u +%FT%TZ), exit $code"; echo "$SUBJECT"; tail -n 40 $LOG | grep -iv password || true; } >status/deploy-status.txt; record FAILED || true; }' EXIT

# Updates by themselves: the owner asked for every push to the branch to reach this server (infra/update.sh).
cat >/etc/systemd/system/exam-update.service <<EOF
[Unit]
Description=Apply new commits of the exam platform
[Service]
Type=oneshot
ExecStart=/bin/bash $DIR/infra/update.sh
EOF
cat >/etc/systemd/system/exam-update.timer <<EOF
[Unit]
Description=Check the exam platform's branch for new commits
[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now exam-update.timer

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
DEMO_PASSWORD=$(openssl rand -hex 6)
EOF
  chmod 600 .env
elif [ -n "${SITE_ADDRESS:-}" ]; then
  sed -i "s|^SITE_ADDRESS=.*|SITE_ADDRESS=$SITE_ADDRESS|; s|^LIVEKIT_URL=.*|LIVEKIT_URL=wss://$SITE_ADDRESS|" .env
fi

docker compose --profile oral up -d --build
# -T and </dev/null: when this script is piped into bash, a container must not read the rest of it as input.
docker compose run -T --rm api node src/db/migrate.ts </dev/null
# Demo accounts once, for trying it out, with the random password from .env (not for real exams).
if [ ! -f .seeded ]; then
  docker compose run -T --rm -e DEMO_PASSWORD="$(grep ^DEMO_PASSWORD= .env | cut -d= -f2)" api \
    node scripts/seed.ts </dev/null
  touch .seeded # reached only when the seed succeeded (set -e)
fi

printf '%s\n%s\n' "ok $COMMIT at $(date -u +%FT%TZ)" "$SUBJECT" >status/deploy-status.txt
# The history is for people only: a failure to write it must not mark a working deployment as failed.
record ok || echo "the deployment history was not written"
echo "Ready: https://$(grep ^SITE_ADDRESS= .env | cut -d= -f2)"
DEMO=$(grep ^DEMO_PASSWORD= .env | cut -d= -f2 || true)
echo "Demo sign-in: teacher@example.edu / admin@example.edu, password ${DEMO:-password}"
echo "Keep a copy of $DIR/infra/.env: it holds MASTER_KEY."

