#!/bin/bash
# Stable dev server keeper with memory limit
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=1024"
while true; do
  echo "[$(date)] Starting Next.js dev server (stable)..." >> /home/z/my-project/server-restarts.log
  node node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Next.js exited with code $EXIT_CODE, restarting in 3s..." >> /home/z/my-project/server-restarts.log
  sleep 3
done
