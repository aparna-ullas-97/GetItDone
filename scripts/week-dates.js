// Shared date helpers — Week 1 anchored to Friday May 8, 2026 (UTC).
const ANCHOR_ISO = '2026-05-08T00:00:00Z';
const WD_LABELS  = ['Fri','Sat','Sun','Mon','Tue','Wed','Thu'];
const DAY_IDS    = ['fri','sat','sun','mon','tue','wed','thu'];
const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function weekDates(weekNumber) {
  const start = new Date(ANCHOR_ISO);
  start.setUTCDate(start.getUTCDate() + 7 * (weekNumber - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
}

function fmtMD(d) {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function weekLabel(weekNumber) {
  const dates = weekDates(weekNumber);
  const a = dates[0], b = dates[6];
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const tail = sameYear ? `, ${b.getUTCFullYear()}` : `, ${a.getUTCFullYear()}–${b.getUTCFullYear()}`;
  return `Week of ${fmtMD(a)} – ${fmtMD(b)}${tail}`;
}

module.exports = { weekDates, fmtMD, weekLabel, WD_LABELS, DAY_IDS, ANCHOR_ISO };
