#!/bin/bash
while true; do
  node node_modules/.bin/next dev -p 3000
  echo "Server died at $(date), restarting in 3s..." >> server-restarts.log
  sleep 3
done
