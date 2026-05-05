#!/bin/bash
# Install Glow Plan as a macOS LaunchAgent — starts on login, restarts on crash.
set -e

PLIST_NAME="com.glowplan.server.plist"
SRC="$(cd "$(dirname "$0")" && pwd)/$PLIST_NAME"
DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

mkdir -p "$HOME/Library/LaunchAgents"

# Stop any previous version
if launchctl list | grep -q com.glowplan.server; then
  launchctl unload "$DEST" 2>/dev/null || true
fi

# Free the port if something else is on it
lsof -ti:3000 | xargs kill 2>/dev/null || true
sleep 1

cp "$SRC" "$DEST"
launchctl load "$DEST"

echo ""
echo "✦ Glow Plan installed as a background service"
echo "  • Starts automatically on login"
echo "  • Restarts if it crashes"
echo "  • Logs:    data/server.log"
echo "  • Local:   http://localhost:3000"
LAN=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "?")
echo "  • Phone:   http://$LAN:3000   (same Wi-Fi)"
echo ""
echo "Manage it:"
echo "  Stop:      launchctl unload ~/Library/LaunchAgents/$PLIST_NAME"
echo "  Start:     launchctl load   ~/Library/LaunchAgents/$PLIST_NAME"
echo "  Uninstall: ./uninstall-service.sh"
