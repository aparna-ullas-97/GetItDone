#!/usr/bin/env node
// One-shot: generate weeks 2..26 by cloning week-01.json and shifting dates by +7 days each.
// Usage:  node scripts/scaffold-weeks.js [endWeek=26]
const fs = require('fs');
const path = require('path');
const { weekDates, fmtMD, weekLabel, WD_LABELS, DAY_IDS } = require('./week-dates');

const WEEKS_DIR = path.join(__dirname, '..', 'data', 'weeks');
const TEMPLATE = path.join(WEEKS_DIR, 'week-01.json');
const END = parseInt(process.argv[2]) || 26;

if (!fs.existsSync(TEMPLATE)) {
  console.error('Cannot find', TEMPLATE);
  process.exit(1);
}

const base = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
const created = [];

for (let n = 2; n <= END; n++) {
  const file = path.join(WEEKS_DIR, `week-${String(n).padStart(2, '0')}.json`);
  if (fs.existsSync(file)) {
    console.log(`skip   week-${n}: already exists`);
    continue;
  }
  const w = JSON.parse(JSON.stringify(base));
  w.weekNumber = n;
  w.weekLabel  = weekLabel(n);
  const dates  = weekDates(n);
  w.weekStrip  = dates.map((d, i) => ({ wd: WD_LABELS[i], date: fmtMD(d) }));
  if (Array.isArray(w.days)) {
    w.days.forEach((d, i) => {
      const dt = dates[i];
      if (dt) d.date = dt.getUTCDate();
    });
  }
  fs.writeFileSync(file, JSON.stringify(w, null, 2) + '\n');
  created.push(n);
}

console.log(`\n✦ Created ${created.length} week file(s): ${created.join(', ') || '(none)'}`);
