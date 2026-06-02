#!/bin/bash
cd /home/z/my-project
while true; do
  rm -rf .next
  node node_modules/.bin/next dev -p 3000 2>&1
  echo "[$(date)] Server died, restarting in 2s..." >> /home/z/my-project/watchdog.log
  sleep 2
done
