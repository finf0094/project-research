#!/usr/bin/env bash
# Run by the exam-update timer every 2 minutes: when the branch has new commits, the server takes them and
# runs install.sh again (rebuild, migrations, restart). Changes reach the server by a push alone.
set -euo pipefail
# Busy with a run already: the next tick checks again (the commit is compared, not consumed, until a run).
exec 9>/var/lock/exam-install.lock
flock -n 9 || exit 0
cd /opt/exam
git fetch -q origin
# Compared with the last successful run, so a failed one (a network blip) is tried again on the next tick.
deployed=$(sed -n 's/^ok \([0-9a-f]*\).*/\1/p' infra/status/deploy-status.txt 2>/dev/null || true)
[ -n "$deployed" ] && [ "$(git rev-parse --short '@{u}')" = "$deployed" ] && exit 0
EXAM_LOCKED=1 exec bash infra/install.sh
