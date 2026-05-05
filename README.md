# Glow Plan 🌿

Personal weekly tracker — meals, workouts, hydration, mood, weight, measurements, photos — for a 6-month transformation. Runs locally on your Mac, accessible from your phone on the same Wi-Fi, with all logs persisted to JSON files you own.

---

## Quick start

```bash
node server.js
```

Then open **http://localhost:3000** in Safari.

---

## Run it automatically (no terminal needed)

To have the server start on login, restart if it crashes, and survive terminal closes:

```bash
./install-service.sh
```

This installs a macOS LaunchAgent (`~/Library/LaunchAgents/com.glowplan.server.plist`). From then on, you just open the URL — the server is always running in the background.

**Verify it's running:**
```bash
launchctl list | grep glowplan
curl -s http://localhost:3000/api/state | head -c 80
```

**Stop / remove:**
```bash
./uninstall-service.sh
```

**Logs:** `data/server.log`

> ⚠ **Sleep caveat:** when your Mac sleeps, the network sleeps too, so phone access pauses until you wake it. The service itself keeps running. To prevent display sleep while plugged in: System Settings → Battery → "Prevent automatic sleeping when display is off".

---

## Open on your phone

The server binds to all interfaces. On the same Wi-Fi as your Mac, open:

```
http://<your-mac-ip>:3000
```

The startup banner prints the right URL. In Safari → **Share → Add to Home Screen** for an app-like icon (manifest + favicon already wired up).

For "anywhere" access (cellular, away from home), install **Tailscale** on Mac + phone — gives each device a stable private IP, end-to-end encrypted, free for personal use. No code changes needed.

---

## Desktop icon

macOS 15+ Safari: open the URL → **File → Add to Dock…** → gives you a real web app with its own window, no toolbars. Drag from the Dock to the Desktop for a desktop shortcut.

---

## File layout

```
data/
  global.json            # title, journey roadmap, mantra, kg goal, calPerKg
  state.json             # all your logs, namespaced { weeks: { "1": {...} } }
  server.log             # launchd output (created on first run)
  photos/                # progress photos (wk-01.jpg, wk-02.png, …)
  weeks/
    week-01.json         # one file per week — fully editable
    week-02.json
    …
    week-26.json
    _template.json       # files starting with _ are ignored

public/
  index.html             # shell
  styles.css
  app.js                 # all client logic

scripts/
  scaffold-weeks.js      # one-shot: generate weeks 2..N
  week-dates.js          # shared date helpers (anchor: Fri May 8, 2026)

server.js                # zero-dep Node http server
package.json
com.glowplan.server.plist  # launchd config
install-service.sh / uninstall-service.sh
```

---

## Adding weeks

Either:

**A. Click "+ Add next week"** in the UI — server clones the most recent week (so your evolving plan carries forward), bumps the dates by 7 days, writes the new file.

**B. Manually:**
```bash
cp data/weeks/_template.json data/weeks/week-NN.json
# then edit weekNumber, weekLabel, weekStrip, days
```

**C. Bulk scaffold:**
```bash
node scripts/scaffold-weeks.js 52   # extends to a year
```

---

## Editing your plan

Each `data/weeks/week-NN.json` is a normal JSON file — open in any editor.

- **Meals** → `days[].checklist[]` items with `cat: "meal"`. The text is a *suggestion*; you log what you actually ate in the UI under each meal.
- **Workouts / steps / wellness** → other `cat` values, all just checkboxes.
- **Macros target** → `days[].macros`. The kcal target drives the deficit math.
- **Weekly exercise target** → `exerciseTotal` at the top of the file.
- **Per-week kg goal** → add `"kgGoal": 0.5` to override the global `weeklyKgGoal`.

Refresh the browser to pick up changes. State (your logs) is unaffected.

---

## Features at a glance

**Sidebar (sticky on wide screens)**
- Title, subtitle, weekly pattern stats
- 🔥 Streak counters: workout days, full-hydration days, logged days (across all 26 weeks)
- 📍 Jump to today button — finds today in the plan, expands the right week + day, scrolls
- 6-month journey roadmap (78 → 61 kg)
- Mantra
- Tool links: 📊 View charts · ↓ Export CSV

**Each week (collapsible accordion)**
- Header summary: tasks done, % complete
- Week strip · weekly goal vs actual kg pill row
- Day cards with collapsible bodies
- Body & Photo card: weight, waist, hips, arms, thigh, drag-drop photo
- Week ring (task completion)
- Mood diary
- Non-Scale Victories text area

**Each day (collapsible)**
- Macros target · steps goal
- Checklist (meals, workouts, steps, wellness, cheat)
  - Each meal has an inline "I ate" row: optional food text + actual kcal/protein/fiber
- Hydration: 8 water-drop buttons
- Vibe: 5 emoji moods
- Cycle: PMS · spotting · flow · none
- Override total kcal today (optional)
- Rest days get a 🌙 badge + recovery rituals card (stretch / foam roll / sleep / walk)

**Charts modal** (📊 View charts)
- Weight curve: actual cherry line vs dashed expected line (78→61 linear)
- Estimated kg lost per week: bars, sage when ≥ goal, butter when below, cherry dashed goal line
- Mood heatmap: every day × every week
- Calories eaten per week: line chart

**Sticky burn bar** (bottom)
- Active week's exercise burned + progress
- Deficit vs plan target
- Food logged this week
- This week's est. kg loss
- All-time total kg (cumulative across all 26 weeks)
- Save indicator · Reset week (resets only the active week)

---

## API (for tinkering)

```
GET  /api/plan          → { global, weeks: [...] }
GET  /api/state         → { weeks: { "1": {...}, ... } }
PUT  /api/state         → save full state object
POST /api/weeks/new     → create next week file, return new week
POST /api/photo/:week   → body: { dataUrl }, saves data/photos/wk-NN.{jpg|png|webp}
DELETE /api/photo/:week → remove the photo
GET  /photos/:filename  → static photo
```

State is saved atomically (write to `.tmp`, rename) on every change, debounced 350ms. `sendBeacon` on tab close so nothing is lost.

---

## Backups

Everything is plain JSON in `data/`. To back up:

```bash
cp -r data ~/Documents/glow-plan-backup-$(date +%Y%m%d)
```

Or commit `data/` to a private git repo. Photos in `data/photos/` are regular image files.

---

## Troubleshooting

**Page won't load** — server isn't running. `lsof -ti:3000` to check, `node server.js` to start manually, or run `./install-service.sh`.

**Phone can't connect** — make sure Mac and phone are on the same Wi-Fi, and macOS Firewall isn't blocking port 3000 (System Settings → Network → Firewall).

**Service not auto-starting after install** — `launchctl list | grep glowplan` should show a PID. If not: `launchctl unload ~/Library/LaunchAgents/com.glowplan.server.plist && launchctl load ~/Library/LaunchAgents/com.glowplan.server.plist`.

**Want to start fresh** — `echo '{"weeks":{}}' > data/state.json` and refresh.
