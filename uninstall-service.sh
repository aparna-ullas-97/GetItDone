#!/bin/bash
DEST="$HOME/Library/LaunchAgents/com.glowplan.server.plist"
if [ -f "$DEST" ]; then
  launchctl unload "$DEST" 2>/dev/null || true
  rm "$DEST"
  echo "✦ Glow Plan service removed."
else
  echo "Service not installed."
fi
