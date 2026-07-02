#!/usr/bin/env bash
# Keeper: restarts the Next.js dev server if it dies.
cd /home/z/my-project
while true; do
  if ! pgrep -f "next dev -p 3000" > /dev/null 2>&1; then
    echo "[$(date '+%H:%M:%S')] (re)starting dev server..." >> /home/z/my-project/keeper.log
    bun run dev > /home/z/my-project/dev.log 2>&1 &
    DEV_PID=$!
    echo "[$(date '+%H:%M:%S')] dev server PID=$DEV_PID" >> /home/z/my-project/keeper.log
  fi
  sleep 5
done
