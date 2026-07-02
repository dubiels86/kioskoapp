#!/bin/bash
# License-server keeper: restarts the server if it ever exits.
cd /home/z/my-project/mini-services/license-server
while true; do
  echo "[$(date)] Starting license-server..." >> /home/z/my-project/license-server-keeper.log
  bun index.ts >> /home/z/my-project/license-server.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] license-server exited with code $EXIT_CODE, restarting in 3s..." >> /home/z/my-project/license-server-keeper.log
  sleep 3
done
