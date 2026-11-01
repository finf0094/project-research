#!/usr/bin/env bash
# Run by the exam-update timer every 2 minutes: when the branch has a commit not yet deployed, the server
# takes it and runs install.sh again (rebuild, migrations, restart). Changes reach the server by a push.
set -euo pipefail
# Busy with a run already: the next tick checks again.
exec 9>/var/lock/exam-install.lock
flock -n 9 || exit 0
cd /opt/exam
git fetch -q origin
target=$(git rev-parse --short '@{u}')
status=infra/status/deploy-status.txt
first=$(head -n 1 "$status" 2>/dev/null || true)
# Deployed already: nothing to do.
[ "$first" = "${first#ok $target }" ] || exit 0
# The same commit failed lately: tried again every 30 minutes (a network blip), not every tick.
if [ "$first" != "${first#FAILED $target }" ] && [ -n "$(find "$status" -mmin -30)" ]; then exit 0; fi
# The new commit's own install.sh runs, not the one on disk before the fetch.
git reset -q --hard '@{u}'
EXAM_LOCKED=1 exec bash infra/install.sh
