#!/bin/sh
# Run the worker as the host user so files it writes into the shared data
# volume stay editable on the host. Falls back to the current user when the
# container was started without root.
set -e

UID_TO_USE="${OXW_UID:-1000}"
GID_TO_USE="${OXW_GID:-1000}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p /models /data/media
  chown "$UID_TO_USE:$GID_TO_USE" /models /data /data/media 2>/dev/null || true
  exec gosu "$UID_TO_USE:$GID_TO_USE" python3 /worker/worker.py
fi

exec python3 /worker/worker.py
