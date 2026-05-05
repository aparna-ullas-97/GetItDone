const VIBES = ['😴','😐','🌸','💪','🔥'];
const VIBE_LABELS = ['Exhausted','Meh','Good','Strong','On fire'];
const CONFETTI_COLORS = ['#C0392B','#8FAF8F','#E8D06A','#D4A5A5','#C0622B'];
const CIRC = 314.16;
const ANCHOR_DATE = new Date(2026, 4, 8); // Fri May 8 2026, local midnight
const PERIODS = [
  { key: null,        label: '— None',     icon: '·' },
  { key: 'pms',       label: 'PMS',        icon: '⚡' },
  { key: 'spotting',  label: 'Spotting',   icon: '💧' },
  { key: 'flow',      label: 'Flow',       icon: '🩸' }
];
const RECOVERY_ITEMS = [
  { key: 'stretch', label: 'Stretch / mobility (10 min)', icon: '🧘' },
  { key: 'foam',    label: 'Foam roll',                   icon: '💆' },
  { key: 'sleep',   label: '8+ hours sleep',              icon: '🌙' },
  { key: 'walk',    label: 'Light walk (≤15 min)',        icon: '☀' }
];

let GLOBAL = null;
let WEEKS = [];
let WEEKS_BY_NUM = {};
let CAL_PER_KG = 7700;
let WEEKLY_KG_GOAL = 0.65;

let S = { weeks: {} };
let activeWeekNum = null;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

let saveTimer = null;
let savePending = false;
function scheduleSave() {
  savePending = true;
  setStatus('Saving…', 'saving');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 350);
}
async function flushSave() {
  if (!savePending) return;
  savePending = false;
  try {
    await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(S)
    });
    setStatus('💾 Saved', '');
  } catch (e) {
    setStatus('⚠ retry…', 'error');
    console.error(e);
    setTimeout(scheduleSave, 2000);
  }
}
function setStatus(text, cls) {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.textContent = text;
  el.className = 'save-status' + (cls ? ' ' + cls : '');
}

window.addEventListener('beforeunload', () => {
  if (savePending && navigator.sendBeacon) {
    navigator.sendBeacon('/api/state', new Blob([JSON.stringify(S)], { type: 'application/json' }));
  }
});

function ws(weekNum) {
  const k = String(weekNum);
  if (!S.weeks[k]) S.weeks[k] = {};
  const w = S.weeks[k];
  if (!w.checks)       w.checks = {};
  if (!w.hydration)    w.hydration = {};
  if (!w.vibes)        w.vibes = {};
  if (!w.actuals)      w.actuals = {};
  if (!w.dailyKcal)    w.dailyKcal = {};
  if (typeof w.nsv !== 'string') w.nsv = '';
  if (w.weight === undefined) w.weight = null;
  if (!w.measurements) w.measurements = {};
  if (!w.period)       w.period = {};
  if (!w.recovery)     w.recovery = {};
  if (w.photo === undefined) w.photo = null;
  return w;
}

function dayDate(weekNum, dayIdx) {
  const d = new Date(ANCHOR_DATE);
  d.setDate(d.getDate() + 7 * (weekNum - 1) + dayIdx);
  d.setHours(0,0,0,0);
  return d;
}
function findToday() {
  const t = new Date(); t.setHours(0,0,0,0);
  for (const w of WEEKS) {
    for (let i = 0; i < (w.days||[]).length; i++) {
      if (dayDate(w.weekNumber, i).getTime() === t.getTime()) {
        return { weekNumber: w.weekNumber, dayId: w.days[i].id };
      }
    }
  }
  return null;
}

function ensureHydrationArr(weekNum, dayId) {
  const w = ws(weekNum);
  if (!Array.isArray(w.hydration[dayId])) w.hydration[dayId] = new Array(8).fill(false);
  return w.hydration[dayId];
}

function renderHeader() {
  document.getElementById('headerTitle').innerHTML = `${escapeHtml(GLOBAL.title)}<br><em>${escapeHtml(GLOBAL.titleEm)}</em>`;
  document.getElementById('headerSub').textContent = GLOBAL.subtitle;
  document.getElementById('headerStats').innerHTML = (GLOBAL.headerStats || []).map(s =>
    `<div class="stat-pill"><span class="dot ${escapeHtml(s.dot)}"></span> ${escapeHtml(s.text)}</div>`).join('');
  document.getElementById('mantra').innerHTML = GLOBAL.mantra || '';
  document.getElementById('goalTrack').innerHTML = (GLOBAL.journey || []).map(g =>
    `<div class="goal-row">
      <div class="goal-label">${escapeHtml(g.label)}</div>
      <div class="goal-bar-wrap"><div class="goal-bar" style="width:${g.barPct}%;background:${g.color}"></div></div>
      <div class="goal-val" style="color:${g.color}">${escapeHtml(g.value)}</div>
    </div>`).join('');
}

function renderWeeksList() {
  const list = document.getElementById('weeksList');
  list.innerHTML = WEEKS.map(w => {
    const num = String(w.weekNumber).padStart(2, '0');
    return `
      <div class="week-block" data-week-num="${w.weekNumber}" data-rendered="false">
        <div class="week-block-header">
          <div class="wbh-left">
            <span class="wbh-num">Week ${num}</span>
            <span class="wbh-label">${escapeHtml(w.weekLabel)}</span>
          </div>
          <div class="wbh-right">
            <span class="wbh-summary" id="wbh-summary-${w.weekNumber}"></span>
            <span class="wbh-chev">⌃</span>
          </div>
        </div>
        <div class="week-block-body"></div>
      </div>`;
  }).join('');

  list.querySelectorAll('.week-block-header').forEach(h => {
    h.addEventListener('click', () => {
      const block = h.parentElement;
      const num = parseInt(block.dataset.weekNum);
      toggleWeek(num);
    });
  });

  WEEKS.forEach(w => updateWeekSummary(w.weekNumber));
}

function toggleWeek(num) {
  const block = document.querySelector(`[data-week-num="${num}"]`);
  if (!block) return;
  const wasOpen = block.classList.contains('open');

  document.querySelectorAll('.week-block.open').forEach(b => b.classList.remove('open'));

  if (!wasOpen) {
    ensureWeekRendered(num);
    block.classList.add('open');
    activeWeekNum = num;
  } else {
    activeWeekNum = null;
  }
  updateBurnBar();
}

function ensureWeekRendered(num) {
  const block = document.querySelector(`[data-week-num="${num}"]`);
  if (!block || block.dataset.rendered === 'true') return;
  const week = WEEKS_BY_NUM[num];
  block.querySelector('.week-block-body').innerHTML = renderWeekBody(week);
  block.dataset.rendered = 'true';
  bindWeekEvents(num);
  applyWeekState(num);
}

function renderWeekBody(week) {
  const stripHtml = (week.weekStrip || []).map(d =>
    `<div class="week-date${d.today ? ' today' : ''}"><span class="wd">${escapeHtml(d.wd)}</span>${escapeHtml(d.date)}</div>`).join('');

  const daysHtml = (week.days || []).map(d => renderDay(week.weekNumber, d)).join('');
  const kgGoal = (week.kgGoal != null ? week.kgGoal : WEEKLY_KG_GOAL);

  return `
    <div class="week-strip">${stripHtml}</div>
    <div class="week-progress-pills">
      <div class="wpp-card">
        <div class="wpp-lbl">Weekly Goal</div>
        <div class="wpp-val">~${kgGoal.toFixed(2)} kg</div>
      </div>
      <div class="wpp-card actual" id="wpp-card-${week.weekNumber}">
        <div class="wpp-lbl">Actual So Far</div>
        <div class="wpp-val" id="wpp-actual-${week.weekNumber}">~0.00 kg</div>
      </div>
      <div class="wpp-bar-wrap"><div class="wpp-bar" id="wpp-bar-${week.weekNumber}" style="width:0%"></div></div>
      <div class="wpp-pct" id="wpp-pct-${week.weekNumber}">0%</div>
    </div>
    <div class="days-grid">${daysHtml}</div>
    ${renderTrackingCard(week)}
    <div class="ring-section">
      <div class="ring-wrap">
        <svg viewBox="0 0 120 120" width="130" height="130">
          <defs>
            <linearGradient id="ringGrad-${week.weekNumber}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#8FAF8F"/>
              <stop offset="100%" stop-color="#E8D06A"/>
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="11"/>
          <circle id="ringArc-${week.weekNumber}" cx="60" cy="60" r="50" fill="none" stroke="url(#ringGrad-${week.weekNumber})" stroke-width="11"
            stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"
            transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .8s cubic-bezier(.34,1.56,.64,1)"/>
          <text x="60" y="55" text-anchor="middle" fill="white" font-family="'Playfair Display',serif" font-size="21" font-weight="700" id="ringPctTxt-${week.weekNumber}">0%</text>
          <text x="60" y="72" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="10" id="ringTaskTxt-${week.weekNumber}">0 / 0</text>
        </svg>
      </div>
      <div class="ring-info">
        <h2>Week ${String(week.weekNumber).padStart(2,'0')} <em>Progress</em></h2>
        <p class="ring-sub">Every task checked fills the ring. Complete the week to close it. 🌿</p>
        <div class="ring-stat-row">
          <div class="ring-stat"><div class="ring-stat-val green" id="ringStat1-${week.weekNumber}">0</div><div class="ring-stat-lbl">Tasks Done</div></div>
          <div class="ring-stat"><div class="ring-stat-val gold" id="ringStat2-${week.weekNumber}">0</div><div class="ring-stat-lbl">Days Active</div></div>
          <div class="ring-stat"><div class="ring-stat-val" id="ringStat3-${week.weekNumber}" style="color:var(--pink)">0</div><div class="ring-stat-lbl">Meals Logged</div></div>
        </div>
      </div>
    </div>
    <div class="vibe-history-section">
      <h2>Mood Diary ✨</h2>
      <p class="vibe-history-sub">How did each day feel? Tap a vibe inside any day card.</p>
      <div class="vibe-week-row" id="vibeHistory-${week.weekNumber}"></div>
    </div>
    <div class="nsv-section">
      <h2>✨ Non-Scale Victories</h2>
      <p class="nsv-sub">What did your body & mind win this week?</p>
      <textarea class="nsv-textarea" id="nsvInput-${week.weekNumber}" placeholder="Jeans felt looser... more energy on my walk... actually craved water..."></textarea>
    </div>
  `;
}

function renderTrackingCard(week) {
  const num = week.weekNumber;
  return `
    <div class="tracking-card">
      <div class="tracking-title">📊 Body & Photo <small>log at end of week</small></div>
      <div class="tracking-grid">
        <div class="tracking-field" data-field-key="weight"><label>⚖ Weight (kg)</label>
          <input type="number" step="0.1" min="0" id="weight-${num}" data-week="${num}" data-tfield="weight" placeholder="—"></div>
        <div class="tracking-field" data-field-key="waist"><label>📏 Waist (cm)</label>
          <input type="number" step="0.5" min="0" id="waist-${num}" data-week="${num}" data-tfield="waist" placeholder="—"></div>
        <div class="tracking-field" data-field-key="hips"><label>📏 Hips (cm)</label>
          <input type="number" step="0.5" min="0" id="hips-${num}" data-week="${num}" data-tfield="hips" placeholder="—"></div>
        <div class="tracking-field" data-field-key="arms"><label>📏 Arms (cm)</label>
          <input type="number" step="0.5" min="0" id="arms-${num}" data-week="${num}" data-tfield="arms" placeholder="—"></div>
        <div class="tracking-field" data-field-key="thigh"><label>📏 Thigh (cm)</label>
          <input type="number" step="0.5" min="0" id="thigh-${num}" data-week="${num}" data-tfield="thigh" placeholder="—"></div>
      </div>
      <label class="photo-zone" id="photo-zone-${num}" data-week="${num}">
        <input type="file" id="photo-input-${num}" accept="image/jpeg,image/png,image/webp" hidden>
        <div class="photo-thumb-wrap" id="photo-thumb-wrap-${num}"></div>
        <div class="photo-placeholder" id="photo-placeholder-${num}">📸 Tap to add a progress photo (max 6 MB)</div>
        <div class="photo-actions" id="photo-actions-${num}" style="display:none">
          <button type="button" data-photo-act="view">View</button>
          <button type="button" data-photo-act="replace">Replace</button>
          <button type="button" data-photo-act="delete">Remove</button>
        </div>
      </label>
    </div>`;
}

function renderDay(weekNum, day) {
  const tags = (day.tags||[]).map(t => `<span class="tag ${escapeHtml(t.kind)}">${escapeHtml(t.text)}</span>`).join('');
  const mac = day.macros || { kcal:0, protein:0, carbs:0, fat:0 };
  const kcalLbl = mac.kcalLabel || (mac.kcal||0).toLocaleString();

  const stepsHtml = day.stepsGoal ? `
    <div class="section-title">Steps Goal</div>
    <div class="steps-visual">
      <div class="steps-icon">${escapeHtml(day.stepsGoal.icon)}</div>
      <div class="steps-info"><div class="steps-num">${(day.stepsGoal.value||0).toLocaleString()}</div><div class="steps-sub">${escapeHtml(day.stepsGoal.sub)}</div></div>
      <div class="steps-bar-wrap"><div class="steps-bar" style="width:0%"></div></div>
    </div>` : '';

  const checklistHtml = (day.checklist||[]).map((item, idx) => {
    const id = `${day.id}-${idx}`;
    const dataAttrs = [`data-id="${id}"`, `data-day="${day.id}"`, `data-week="${weekNum}"`, `data-idx="${idx}"`];
    if (item.cal) dataAttrs.push(`data-cal="${item.cal}"`);
    if (item.mealKcal) dataAttrs.push(`data-meal-kcal="${item.mealKcal}"`);
    if (item.mealProtein) dataAttrs.push(`data-meal-protein="${item.mealProtein}"`);
    if (item.mealFiber) dataAttrs.push(`data-meal-fiber="${item.mealFiber}"`);

    const catLabel = item.label || ({ meal:'Meal', workout:'Strength', steps:'Steps', wellness:'Wellness', cheat:'Cheat' }[item.cat] || item.cat);
    const calTag = item.cal ? `<span class="cal-tag">🔥 ${item.cal} kcal</span>` : '';

    let content;
    if (item.mealKcal) {
      const kc = item.mealKcalLabel || `~${item.mealKcal} kcal`;
      const pr = item.mealProteinLabel || `${item.mealProtein}g protein`;
      const fb = item.mealFiberLabel || `${item.mealFiber}g fiber`;
      content = `<div class="check-content">
        <span class="check-text">${escapeHtml(item.text)}</span>
        <span class="meal-nutrition">
          <span class="n-kcal">Suggested: ${escapeHtml(kc)}</span>
          <span class="n-prot">${escapeHtml(pr)}</span>
          <span class="n-fib">${escapeHtml(fb)}</span>
        </span>
        <div class="meal-actual" data-actual-id="${id}">
          <span class="meal-actual-lbl">I ate</span>
          <input type="text" class="ma-input ma-food" data-actual-id="${id}" data-week="${weekNum}" data-field="food" placeholder="what you actually ate (optional)">
          <input type="number" min="0" class="ma-input ma-num" data-actual-id="${id}" data-week="${weekNum}" data-field="kcal" placeholder="kcal">
          <input type="number" min="0" class="ma-input ma-num" data-actual-id="${id}" data-week="${weekNum}" data-field="protein" placeholder="P g">
          <input type="number" min="0" class="ma-input ma-num" data-actual-id="${id}" data-week="${weekNum}" data-field="fiber" placeholder="F g">
        </div>
      </div>`;
    } else {
      content = `<span class="check-text">${escapeHtml(item.text)}</span>`;
    }

    return `<li ${dataAttrs.join(' ')}>
      <div class="checkbox"></div>
      <span class="check-category cat-${escapeHtml(item.cat)}">${escapeHtml(catLabel)}</span>
      ${calTag}
      ${content}
    </li>`;
  }).join('');

  const cheatBanner = day.cheatBanner ?
    `<div class="cheat-banner"><strong>${escapeHtml(day.cheatBanner.title)}</strong>${escapeHtml(day.cheatBanner.body)}</div>` : '';

  const isRest = (day.tags||[]).some(t => t.kind === 'rest') || day.theme === 'butter';
  const recoveryHtml = isRest ? `
    <div class="recovery-card">
      <h4>🌙 Recovery rituals</h4>
      <ul class="recovery-list" data-week="${weekNum}" data-day="${day.id}">
        ${RECOVERY_ITEMS.map(r => `<li data-rkey="${r.key}"><div class="checkbox"></div><span>${escapeHtml(r.icon)} ${escapeHtml(r.label)}</span></li>`).join('')}
      </ul>
    </div>` : '';

  return `
  <div class="day-card${isRest ? ' is-rest' : ''}" data-theme="${escapeHtml(day.theme)}" data-day-id="${escapeHtml(day.id)}" data-week="${weekNum}">
    <div class="day-header">
      <div class="day-left">
        <div class="day-number"><span class="dn-day">${escapeHtml(day.wd)}</span><span class="dn-date">${day.date}</span></div>
        <div class="day-info">
          <h3>${escapeHtml(day.title)}</h3>
          <div class="day-tags">${tags}</div>
        </div>
      </div>
      <div class="day-right"><span class="complete-badge">✓ Done!</span><div class="chevron">⌃</div></div>
    </div>
    <div class="day-body">
      <div class="section-title">Macros Target</div>
      <div class="macros-row">
        <div class="macro-chip kcal"><span class="macro-val">${escapeHtml(kcalLbl)}</span>kcal</div>
        <div class="macro-chip protein"><span class="macro-val">${mac.protein}g</span>protein</div>
        <div class="macro-chip carbs"><span class="macro-val">${mac.carbs}g</span>carbs</div>
        <div class="macro-chip fat"><span class="macro-val">${mac.fat}g</span>fat</div>
      </div>
      ${stepsHtml}
      <div class="section-title">Today's Checklist</div>
      <ul class="checklist">${checklistHtml}</ul>
      ${cheatBanner}
      <div class="section-title">Hydration</div>
      <div class="hydration-row" id="hydr-${weekNum}-${day.id}"></div>
      <div class="section-title">Today's Vibe</div>
      <div class="vibe-row" id="vibe-${weekNum}-${day.id}"></div>
      <div class="section-title">Cycle</div>
      <div class="period-row" id="period-${weekNum}-${day.id}"></div>
      ${recoveryHtml}
      <div class="day-kcal-row" style="margin-top:14px;border-top:1px dashed rgba(0,0,0,.08);padding-top:12px">
        <div class="day-kcal-field" id="dkf-${weekNum}-${day.id}">
          <label for="dk-${weekNum}-${day.id}">🍽️ Override total kcal today</label>
          <input type="number" class="day-kcal-input" id="dk-${weekNum}-${day.id}" data-week="${weekNum}" data-day="${day.id}" placeholder="optional" min="0">
        </div>
      </div>
    </div>
  </div>`;
}

function bindWeekEvents(num) {
  const block = document.querySelector(`[data-week-num="${num}"]`);
  if (!block) return;

  block.querySelectorAll('.day-header').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
  });
  block.querySelectorAll('[data-id]').forEach(li => {
    li.addEventListener('click', e => {
      if (e.target.closest('.meal-actual')) return;
      toggleCheck(li);
    });
  });
  block.querySelectorAll('.ma-input').forEach(inp => {
    inp.addEventListener('click', e => e.stopPropagation());
    inp.addEventListener('input', e => { e.stopPropagation(); onActualInput(inp); });
  });
  block.querySelectorAll('.day-kcal-input').forEach(inp => {
    inp.addEventListener('input', () => setDayKcal(parseInt(inp.dataset.week), inp.dataset.day));
    inp.addEventListener('click', e => e.stopPropagation());
  });
  const nsv = block.querySelector(`#nsvInput-${num}`);
  if (nsv) nsv.addEventListener('input', e => {
    ws(num).nsv = e.target.value;
    scheduleSave();
  });

  block.querySelectorAll('[data-tfield]').forEach(inp => {
    inp.addEventListener('input', () => onTrackingInput(inp));
    inp.addEventListener('click', e => e.stopPropagation());
  });

  bindPhotoZone(num);

  block.querySelectorAll('.recovery-list').forEach(list => {
    list.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', e => {
        e.stopPropagation();
        toggleRecovery(parseInt(list.dataset.week), list.dataset.day, li.dataset.rkey, li);
      });
    });
  });
}

function onTrackingInput(inp) {
  const num = parseInt(inp.dataset.week);
  const field = inp.dataset.tfield;
  const w = ws(num);
  const v = parseFloat(inp.value);
  const valid = inp.value !== '' && !isNaN(v) && v > 0;
  if (field === 'weight') {
    w.weight = valid ? v : null;
  } else {
    w.measurements[field] = valid ? v : null;
  }
  const wrap = inp.closest('.tracking-field');
  if (wrap) wrap.classList.toggle('filled', valid);
  scheduleSave();
  updateBurnBar();
}

function buildPeriodRow(num, day) {
  const el = document.querySelector(`[data-week-num="${num}"] #period-${num}-${day}`);
  if (!el) return;
  const w = ws(num);
  const cur = w.period[day] || null;
  el.innerHTML = '';
  PERIODS.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'period-btn' + (cur === p.key ? ' active' : '');
    btn.innerHTML = `<span>${p.icon}</span><span>${p.label.replace('— ','')}</span>`;
    btn.title = p.label;
    btn.onclick = e => { e.stopPropagation(); setPeriod(num, day, p.key); };
    el.appendChild(btn);
  });
}
function setPeriod(num, day, key) {
  const w = ws(num);
  w.period[day] = (w.period[day] === key) ? null : key;
  scheduleSave();
  buildPeriodRow(num, day);
}

function toggleRecovery(num, day, rkey, li) {
  const w = ws(num);
  if (!w.recovery[day]) w.recovery[day] = {};
  w.recovery[day][rkey] = !w.recovery[day][rkey];
  li.classList.toggle('checked', !!w.recovery[day][rkey]);
  scheduleSave();
}
function applyRecovery(num, day) {
  const w = ws(num);
  const list = document.querySelector(`[data-week-num="${num}"] .recovery-list[data-day="${day}"]`);
  if (!list) return;
  const r = w.recovery[day] || {};
  list.querySelectorAll('li').forEach(li => {
    li.classList.toggle('checked', !!r[li.dataset.rkey]);
  });
}

function bindPhotoZone(num) {
  const zone = document.querySelector(`[data-week-num="${num}"] #photo-zone-${num}`);
  if (!zone) return;
  const input = zone.querySelector(`#photo-input-${num}`);
  zone.addEventListener('click', e => {
    const act = e.target.closest('[data-photo-act]');
    if (act) {
      e.preventDefault(); e.stopPropagation();
      const which = act.dataset.photoAct;
      if (which === 'view') openPhotoModal(num);
      else if (which === 'replace') input.click();
      else if (which === 'delete') deletePhoto(num);
      return;
    }
  });
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) uploadPhoto(num, input.files[0]);
  });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) uploadPhoto(num, e.dataTransfer.files[0]);
  });
}

function uploadPhoto(num, file) {
  if (file.size > 6 * 1024 * 1024) { alert('Max 6 MB'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      setStatus('Uploading photo…', 'saving');
      const res = await fetch('/api/photo/' + num, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: reader.result })
      });
      if (!res.ok) throw new Error('upload failed');
      const out = await res.json();
      ws(num).photo = out.filename;
      scheduleSave();
      renderPhotoZone(num);
      setStatus('💾 Photo saved', '');
    } catch (e) {
      setStatus('⚠ Upload failed', 'error');
      console.error(e);
    }
  };
  reader.readAsDataURL(file);
}

async function deletePhoto(num) {
  if (!confirm('Remove this photo?')) return;
  try {
    await fetch('/api/photo/' + num, { method: 'DELETE' });
    ws(num).photo = null;
    scheduleSave();
    renderPhotoZone(num);
  } catch (e) { console.error(e); }
}

function renderPhotoZone(num) {
  const w = ws(num);
  const wrap = document.getElementById(`photo-thumb-wrap-${num}`);
  const ph   = document.getElementById(`photo-placeholder-${num}`);
  const acts = document.getElementById(`photo-actions-${num}`);
  if (!wrap || !ph || !acts) return;
  if (w.photo) {
    wrap.innerHTML = `<img class="photo-thumb" src="/photos/${escapeHtml(w.photo)}?t=${Date.now()}" alt="Week ${num} photo">`;
    ph.textContent = `Week ${String(num).padStart(2,'0')} photo logged`;
    acts.style.display = 'flex';
  } else {
    wrap.innerHTML = '';
    ph.textContent = '📸 Tap to add a progress photo (max 6 MB)';
    acts.style.display = 'none';
  }
}

function openPhotoModal(num) {
  const w = ws(num);
  if (!w.photo) return;
  const m = document.getElementById('photoModal');
  document.getElementById('photoModalImg').src = `/photos/${w.photo}?t=${Date.now()}`;
  document.getElementById('photoModalMeta').textContent = `Week ${String(num).padStart(2,'0')} · ${WEEKS_BY_NUM[num]?.weekLabel || ''}`;
  m.hidden = false;
}

function onActualInput(inp) {
  const id = inp.dataset.actualId;
  const num = parseInt(inp.dataset.week);
  const field = inp.dataset.field;
  const w = ws(num);
  if (!w.actuals[id]) w.actuals[id] = {};
  const raw = inp.value;
  if (field === 'food') {
    w.actuals[id].food = raw;
  } else {
    const n = parseFloat(raw);
    w.actuals[id][field] = (!raw || isNaN(n) || n < 0) ? null : n;
  }
  refreshActualState(num, id);
  scheduleSave();
  updateBurnBar();
  updateRing(num);
}

function refreshActualState(num, id) {
  const a = ws(num).actuals[id] || {};
  const wrap = document.querySelector(`[data-week-num="${num}"] .meal-actual[data-actual-id="${id}"]`);
  if (!wrap) return;
  const hasData = (a.food && a.food.trim()) || a.kcal > 0 || a.protein > 0 || a.fiber > 0;
  wrap.classList.toggle('has-data', !!hasData);
}

function toggleCheck(li) {
  const num = parseInt(li.dataset.week);
  li.classList.toggle('checked');
  const w = ws(num);
  w.checks[li.dataset.id] = li.classList.contains('checked');
  scheduleSave();
  updateBurnBar();
  updateRing(num);
  updateWeekSummary(num);
  checkDayComplete(num, li.dataset.day);
}

function checkDayComplete(num, day) {
  const card = document.querySelector(`[data-week-num="${num}"] [data-day-id="${day}"]`);
  if (!card) return;
  const items = card.querySelectorAll('[data-id]');
  if (!items.length) return;
  const allDone = [...items].every(li => li.classList.contains('checked'));
  const wasDone = card.classList.contains('day-complete');
  card.classList.toggle('day-complete', allDone);
  if (allDone && !wasDone) launchConfetti(card);
}

function launchConfetti(card) {
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText = `left:${Math.random()*95}%;background:${CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)]};animation-delay:${Math.random()*.5}s;animation-duration:${.9+Math.random()*.7}s;`;
    card.appendChild(p);
    setTimeout(() => p.remove(), 2000);
  }
}

function buildHydration(num, day) {
  const el = document.querySelector(`[data-week-num="${num}"] #hydr-${num}-${day}`);
  if (!el) return;
  const arr = ensureHydrationArr(num, day);
  el.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const btn = document.createElement('button');
    btn.className = 'drop-btn' + (arr[i] ? ' filled' : '');
    btn.textContent = '💧';
    btn.title = `Glass ${i+1}`;
    btn.onclick = e => { e.stopPropagation(); toggleDrop(num, day, i); };
    el.appendChild(btn);
  }
  const count = document.createElement('span');
  count.className = 'hydration-count';
  count.textContent = arr.filter(Boolean).length + ' / 8 glasses';
  el.appendChild(count);
}

function toggleDrop(num, day, idx) {
  const arr = ensureHydrationArr(num, day);
  arr[idx] = !arr[idx];
  scheduleSave();
  buildHydration(num, day);
}

function buildVibeCheck(num, day) {
  const el = document.querySelector(`[data-week-num="${num}"] #vibe-${num}-${day}`);
  if (!el) return;
  const w = ws(num);
  el.innerHTML = '';
  VIBES.forEach((emoji, i) => {
    const btn = document.createElement('button');
    btn.className = 'vibe-btn' + (w.vibes[day] === i ? ' active' : '');
    btn.textContent = emoji;
    btn.title = VIBE_LABELS[i];
    btn.onclick = e => { e.stopPropagation(); setVibe(num, day, i); };
    el.appendChild(btn);
  });
  if (w.vibes[day] !== null && w.vibes[day] !== undefined) {
    const lbl = document.createElement('span');
    lbl.className = 'vibe-label';
    lbl.textContent = VIBE_LABELS[w.vibes[day]];
    el.appendChild(lbl);
  }
}

function setVibe(num, day, idx) {
  const w = ws(num);
  w.vibes[day] = (w.vibes[day] === idx) ? null : idx;
  scheduleSave();
  buildVibeCheck(num, day);
  buildVibeHistory(num);
}

function buildVibeHistory(num) {
  const el = document.querySelector(`[data-week-num="${num}"] #vibeHistory-${num}`);
  if (!el) return;
  const week = WEEKS_BY_NUM[num];
  const w = ws(num);
  el.innerHTML = '';
  (week.days || []).forEach(d => {
    const chip = document.createElement('div');
    const v = w.vibes[d.id];
    const has = v !== null && v !== undefined;
    chip.className = 'vibe-day-chip' + (has ? '' : ' empty');
    chip.innerHTML = `<span class="vdc-day">${escapeHtml(d.wd)}</span><span class="vdc-emoji">${has ? VIBES[v] : '·'}</span>`;
    el.appendChild(chip);
  });
}

function setDayKcal(num, day) {
  const inp = document.querySelector(`[data-week-num="${num}"] #dk-${num}-${day}`);
  if (!inp) return;
  const raw = inp.value;
  const val = parseFloat(raw);
  const w = ws(num);
  w.dailyKcal[day] = (!raw || isNaN(val) || val <= 0) ? null : val;
  const field = document.querySelector(`[data-week-num="${num}"] #dkf-${num}-${day}`);
  if (field) field.classList.toggle('active', w.dailyKcal[day] !== null);
  scheduleSave();
  updateBurnBar();
}

function calcWeekStats(num) {
  const week = WEEKS_BY_NUM[num];
  const w = ws(num);
  if (!week) return null;
  const block = document.querySelector(`[data-week-num="${num}"]`);
  const isRendered = block && block.dataset.rendered === 'true';

  let exBurned = 0, foodEaten = 0, mealCount = 0, activeTarget = 0;
  let totalTasks = 0, doneTasks = 0;
  const daysActive = new Set();

  // Count from data + state (not DOM), so it works even if not rendered.
  (week.days || []).forEach(day => {
    (day.checklist || []).forEach((item, idx) => {
      const id = `${day.id}-${idx}`;
      totalTasks++;
      const checked = !!w.checks[id];
      if (checked) doneTasks++;
      if (checked && item.cal) exBurned += item.cal;
      if (checked && item.mealKcal) mealCount++;
    });

    const override = w.dailyKcal[day.id];
    let dayFood = 0, dayHasData = false;
    if (override !== null && override !== undefined && override > 0) {
      dayFood = override;
      dayHasData = true;
    } else {
      (day.checklist || []).forEach((item, idx) => {
        if (!item.mealKcal) return;
        const id = `${day.id}-${idx}`;
        const a = (w.actuals && w.actuals[id]) || {};
        const checked = !!w.checks[id];
        if (a.kcal > 0) {
          dayFood += a.kcal; dayHasData = true;
        } else if (checked) {
          dayFood += item.mealKcal; dayHasData = true;
        }
      });
    }
    if (dayHasData) {
      foodEaten += dayFood;
      activeTarget += (day.macros && day.macros.kcal) || 0;
      daysActive.add(day.id);
    }
  });

  const dietDiff = activeTarget > 0 ? activeTarget - foodEaten : 0;
  const exTotal = week.exerciseTotal || 0;
  const totalDeficitKg = (exBurned + Math.max(0, dietDiff)) / CAL_PER_KG;

  return { exBurned, foodEaten, mealCount, daysActive: daysActive.size, dietDiff,
           totalDeficitKg, exTotal, totalTasks, doneTasks };
}

function updateRing(num) {
  const block = document.querySelector(`[data-week-num="${num}"]`);
  if (!block || block.dataset.rendered !== 'true') return;
  const st = calcWeekStats(num);
  if (!st) return;
  const pct = st.totalTasks ? st.doneTasks / st.totalTasks * 100 : 0;
  const arc = document.getElementById(`ringArc-${num}`);
  if (arc) arc.style.strokeDashoffset = CIRC * (1 - pct / 100);
  const el = id => document.getElementById(id);
  if (el(`ringPctTxt-${num}`)) el(`ringPctTxt-${num}`).textContent = Math.round(pct) + '%';
  if (el(`ringTaskTxt-${num}`)) el(`ringTaskTxt-${num}`).textContent = st.doneTasks + ' / ' + st.totalTasks;
  if (el(`ringStat1-${num}`)) el(`ringStat1-${num}`).textContent = st.doneTasks;
  if (el(`ringStat2-${num}`)) el(`ringStat2-${num}`).textContent = st.daysActive;
  if (el(`ringStat3-${num}`)) el(`ringStat3-${num}`).textContent = st.mealCount;
  updateWeekProgressPills(num, st);
}

function updateWeekProgressPills(num, st) {
  const week = WEEKS_BY_NUM[num];
  if (!week) return;
  const goal = week.kgGoal != null ? week.kgGoal : WEEKLY_KG_GOAL;
  const actual = st.totalDeficitKg;
  const pct = goal > 0 ? (actual / goal) * 100 : 0;
  const barPct = Math.min(pct, 100);
  const over = pct > 100;
  const el = id => document.getElementById(id);
  if (el(`wpp-actual-${num}`)) el(`wpp-actual-${num}`).textContent = '~' + actual.toFixed(2) + ' kg';
  if (el(`wpp-bar-${num}`))    el(`wpp-bar-${num}`).style.width = barPct + '%';
  if (el(`wpp-pct-${num}`)) {
    el(`wpp-pct-${num}`).textContent = Math.round(pct) + '%';
    el(`wpp-pct-${num}`).classList.toggle('over', over);
  }
  const card = el(`wpp-card-${num}`);
  if (card) card.classList.toggle('over', over && pct < 100);
}

function calcStreaks() {
  let workouts = 0, hydration = 0, logged = 0;
  WEEKS.forEach(w => {
    const ws_ = ws(w.weekNumber);
    (w.days || []).forEach(d => {
      const isWorkoutDay = (d.checklist || []).some((it, idx) => {
        const id = `${d.id}-${idx}`;
        const ck = !!ws_.checks[id];
        return ck && (it.cat === 'workout' || it.cat === 'steps');
      });
      if (isWorkoutDay) workouts++;
      const hArr = ws_.hydration?.[d.id];
      if (Array.isArray(hArr) && hArr.every(Boolean)) hydration++;
      const overrideOK = ws_.dailyKcal?.[d.id] > 0;
      const anyActual = (d.checklist || []).some((it, idx) => {
        if (!it.mealKcal) return false;
        const a = ws_.actuals?.[`${d.id}-${idx}`];
        return a && a.kcal > 0;
      });
      if (overrideOK || anyActual) logged++;
    });
  });
  return { workouts, hydration, logged };
}

function updateStreaks() {
  const s = calcStreaks();
  document.getElementById('streakWorkouts').textContent = s.workouts;
  document.getElementById('streakHydration').textContent = s.hydration;
  document.getElementById('streakLogged').textContent = s.logged;
}

function calcLifetimeKg() {
  let total = 0;
  WEEKS.forEach(w => {
    const st = calcWeekStats(w.weekNumber);
    if (st) total += st.totalDeficitKg;
  });
  return total;
}

function updateWeekSummary(num) {
  const st = calcWeekStats(num);
  const el = document.getElementById(`wbh-summary-${num}`);
  if (!el || !st) return;
  if (st.totalTasks > 0) {
    const pct = Math.round(st.doneTasks / st.totalTasks * 100);
    el.textContent = `${st.doneTasks}/${st.totalTasks} · ${pct}%`;
    el.classList.toggle('full', st.doneTasks === st.totalTasks && st.totalTasks > 0);
  } else {
    el.textContent = '';
  }
}

function updateBurnBar() {
  document.getElementById('lifetimeKgVal').textContent = '~' + calcLifetimeKg().toFixed(2) + ' kg';
  updateStreaks();
  const num = activeWeekNum;
  if (num == null) {
    document.getElementById('burnContext').textContent = 'No week open';
    document.getElementById('exBurnVal').innerHTML = '0 <small>/ 0 kcal</small>';
    document.getElementById('burnFill').style.width = '0%';
    document.getElementById('burnPctLbl').textContent = '— open a week to see stats';
    document.getElementById('foodVal').innerHTML = '0 <small>kcal eaten</small>';
    document.getElementById('deficitVal').textContent = '— kcal';
    document.getElementById('totalKgVal').textContent = '~0.00 kg';
    return;
  }

  const st = calcWeekStats(num);
  if (!st) return;
  const exPct = st.exTotal > 0 ? Math.min(st.exBurned / st.exTotal * 100, 100) : 0;
  document.getElementById('burnContext').textContent = `Week ${String(num).padStart(2,'0')} · Exercise Burned`;
  document.getElementById('exBurnVal').innerHTML = st.exBurned.toLocaleString() + ` <small>/ ${st.exTotal.toLocaleString()} kcal</small>`;
  document.getElementById('burnFill').style.width = exPct + '%';
  document.getElementById('burnPctLbl').textContent = exPct.toFixed(1) + '% of weekly exercise target';

  document.getElementById('foodVal').innerHTML = st.foodEaten.toLocaleString() + ' <small>kcal eaten</small>';
  const defEl = document.getElementById('deficitVal');
  if (st.daysActive > 0) {
    const sign = st.dietDiff >= 0 ? '−' : '+';
    defEl.textContent = sign + Math.abs(st.dietDiff).toLocaleString() + ' kcal';
    defEl.className = 'def-val ' + (st.dietDiff >= 0 ? 'positive' : 'negative');
    defEl.title = st.dietDiff >= 0 ? 'Under target — great!' : 'Over target';
  } else {
    defEl.textContent = '— kcal';
    defEl.className = 'def-val positive';
  }
  document.getElementById('totalKgVal').textContent = '~' + st.totalDeficitKg.toFixed(2) + ' kg';

  if (st.exBurned > 0) {
    const fl = document.getElementById('burnFlame');
    fl.classList.remove('pop'); void fl.offsetWidth; fl.classList.add('pop');
  }
}

async function resetActiveWeek() {
  if (activeWeekNum == null) {
    alert('Open a week first to reset it.');
    return;
  }
  const num = activeWeekNum;
  if (!confirm(`Reset all logs for Week ${String(num).padStart(2,'0')}?`)) return;
  S.weeks[String(num)] = { checks:{}, hydration:{}, vibes:{}, actuals:{}, dailyKcal:{}, nsv:'' };
  await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(S)
  });
  setStatus('💾 Reset & saved', '');

  const block = document.querySelector(`[data-week-num="${num}"]`);
  if (block && block.dataset.rendered === 'true') {
    block.dataset.rendered = 'false';
    block.querySelector('.week-block-body').innerHTML = '';
    ensureWeekRendered(num);
  }
  updateBurnBar();
  updateRing(num);
  updateWeekSummary(num);
}

function applyWeekState(num) {
  const week = WEEKS_BY_NUM[num];
  const w = ws(num);
  const block = document.querySelector(`[data-week-num="${num}"]`);
  if (!block || !week) return;

  block.querySelectorAll('[data-id]').forEach(li => {
    if (w.checks[li.dataset.id]) li.classList.add('checked');
  });
  Object.entries(w.actuals || {}).forEach(([id, a]) => {
    block.querySelectorAll(`.ma-input[data-actual-id="${id}"]`).forEach(inp => {
      const v = a[inp.dataset.field];
      if (v !== undefined && v !== null && v !== '') inp.value = v;
    });
    refreshActualState(num, id);
  });
  (week.days || []).forEach(d => {
    buildHydration(num, d.id);
    buildVibeCheck(num, d.id);
    buildPeriodRow(num, d.id);
    applyRecovery(num, d.id);
    checkDayComplete(num, d.id);
    const v = w.dailyKcal[d.id];
    if (v !== null && v !== undefined && v > 0) {
      const inp = block.querySelector(`#dk-${num}-${d.id}`);
      if (inp) inp.value = v;
      const fld = block.querySelector(`#dkf-${num}-${d.id}`);
      if (fld) fld.classList.add('active');
    }
  });
  buildVibeHistory(num);
  const nsv = block.querySelector(`#nsvInput-${num}`);
  if (nsv && w.nsv) nsv.value = w.nsv;

  // Tracking fields
  const setField = (id, val, key) => {
    const inp = block.querySelector(`#${id}`);
    if (!inp) return;
    if (val != null) inp.value = val;
    const wrap = inp.closest('.tracking-field');
    if (wrap) wrap.classList.toggle('filled', val != null);
  };
  setField(`weight-${num}`, w.weight, 'weight');
  ['waist','hips','arms','thigh'].forEach(k => setField(`${k}-${num}`, w.measurements?.[k], k));
  renderPhotoZone(num);

  updateRing(num);
}

function setupTodayButton() {
  const btn = document.getElementById('todayBtn');
  const target = findToday();
  if (!target) {
    btn.disabled = true;
    btn.textContent = '📅 Today not in the plan yet';
    return;
  }
  btn.disabled = false;
  btn.textContent = '📍 Jump to today';
  btn.onclick = () => {
    toggleWeek(target.weekNumber);
    setTimeout(() => {
      const card = document.querySelector(`[data-week-num="${target.weekNumber}"] [data-day-id="${target.dayId}"]`);
      if (card) {
        card.classList.add('open');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  };
}

function setupModal() {
  const m = document.getElementById('chartsModal');
  const pm = document.getElementById('photoModal');
  document.getElementById('chartsBtn').onclick = () => { renderCharts(); m.hidden = false; };
  document.getElementById('exportBtn').onclick = exportCsv;
  [m, pm].forEach(node => {
    node.addEventListener('click', e => {
      if (e.target.matches('[data-close]')) node.hidden = true;
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { m.hidden = true; pm.hidden = true; }
  });
}

function exportCsv() {
  const rows = [['week','date','day','task','category','checked','meal_kcal_suggested','actual_food','actual_kcal','actual_protein','actual_fiber','daily_kcal_override','vibe','period','weight_kg','waist_cm','hips_cm','arms_cm','thigh_cm','nsv']];
  WEEKS.forEach(w => {
    const wst = ws(w.weekNumber);
    (w.days || []).forEach((d, di) => {
      const dt = dayDate(w.weekNumber, di).toISOString().slice(0,10);
      (d.checklist || []).forEach((it, idx) => {
        const id = `${d.id}-${idx}`;
        const a = wst.actuals?.[id] || {};
        rows.push([
          w.weekNumber, dt, d.id,
          (it.text || '').replace(/[\r\n]+/g,' '),
          it.cat, !!wst.checks[id],
          it.mealKcal || '', a.food || '', a.kcal ?? '', a.protein ?? '', a.fiber ?? '',
          wst.dailyKcal?.[d.id] ?? '',
          (wst.vibes?.[d.id] != null ? VIBE_LABELS[wst.vibes[d.id]] : ''),
          wst.period?.[d.id] || '',
          (idx === 0 ? (wst.weight ?? '') : ''),
          (idx === 0 ? (wst.measurements?.waist ?? '') : ''),
          (idx === 0 ? (wst.measurements?.hips ?? '') : ''),
          (idx === 0 ? (wst.measurements?.arms ?? '') : ''),
          (idx === 0 ? (wst.measurements?.thigh ?? '') : ''),
          (idx === 0 && di === 0 ? (wst.nsv || '').replace(/[\r\n]+/g,' ') : '')
        ]);
      });
    });
  });
  const csv = rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[,"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `glow-plan-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function expectedWeightAt(weekIdx) {
  // Linear from 78 → 61 across journey length (default 26 weeks)
  const j = (GLOBAL.journey && GLOBAL.journey.length) ? GLOBAL.journey : null;
  const start = 78, end = 61;
  const totalWeeks = WEEKS.length || 26;
  return start + (end - start) * (weekIdx / Math.max(totalWeeks - 1, 1));
}

function renderCharts() {
  // Weight chart
  const W = 600, H = 240, PAD = 40;
  const innerW = W - PAD * 2, innerH = H - PAD * 2;
  const totalWeeks = WEEKS.length;
  const startKg = 78, endKg = 61;
  const minY = endKg - 1, maxY = startKg + 1;
  const xFor = i => PAD + (i / Math.max(totalWeeks - 1, 1)) * innerW;
  const yFor = kg => PAD + ((maxY - kg) / (maxY - minY)) * innerH;

  const expectedPath = WEEKS.map((w, i) => {
    const exp = startKg + (endKg - startKg) * (i / Math.max(totalWeeks - 1, 1));
    return `${i===0?'M':'L'}${xFor(i)},${yFor(exp)}`;
  }).join(' ');

  const actuals = WEEKS.map((w, i) => ({ i, kg: ws(w.weekNumber).weight, num: w.weekNumber }))
                       .filter(p => p.kg != null);
  const actualPath = actuals.map((p, j) => `${j===0?'M':'L'}${xFor(p.i)},${yFor(p.kg)}`).join(' ');
  const dots = actuals.map(p => `<circle cx="${xFor(p.i)}" cy="${yFor(p.kg)}" r="4" fill="#C0392B"/>`).join('');
  const yLabels = [maxY, (maxY+minY)/2, minY].map(v =>
    `<text x="6" y="${yFor(v)+4}" font-size="10" fill="#999">${v.toFixed(0)}</text>`).join('');

  const wsvg = document.getElementById('weightChart');
  wsvg.innerHTML = `
    <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${H-PAD}" stroke="rgba(0,0,0,.1)"/>
    <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="rgba(0,0,0,.1)"/>
    ${yLabels}
    <path d="${expectedPath}" fill="none" stroke="#C8B87A" stroke-width="2" stroke-dasharray="4 4"/>
    <path d="${actualPath}" fill="none" stroke="#C0392B" stroke-width="2.5" stroke-linecap="round"/>
    ${dots}
    <text x="${W-PAD}" y="${PAD-8}" font-size="10" fill="#C0392B" text-anchor="end">— actual</text>
    <text x="${W-PAD-70}" y="${PAD-8}" font-size="10" fill="#C8B87A" text-anchor="end">--- expected</text>`;
  document.getElementById('weightEmpty').hidden = actuals.length > 0;

  // Deficit chart (bars)
  const dsvg = document.getElementById('deficitChart');
  const Hd = 200, padD = 32, innerHd = Hd - padD * 2, innerWd = W - padD * 2;
  const maxKg = Math.max(0.1, ...WEEKS.map(w => calcWeekStats(w.weekNumber)?.totalDeficitKg || 0));
  const goalKg = WEEKLY_KG_GOAL;
  const yScale = v => padD + innerHd - (v / Math.max(maxKg, goalKg) * 0.95) * innerHd;
  const barW = Math.max(6, innerWd / WEEKS.length - 4);
  const bars = WEEKS.map((w, i) => {
    const v = calcWeekStats(w.weekNumber)?.totalDeficitKg || 0;
    const x = padD + i * (innerWd / WEEKS.length) + 2;
    const y = yScale(v);
    const h = (Hd - padD) - y;
    const colour = v >= goalKg ? '#5C8C5C' : '#E8D06A';
    return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${colour}" rx="2"/>`;
  }).join('');
  const goalY = yScale(goalKg);
  dsvg.setAttribute('viewBox', `0 0 ${W} ${Hd}`);
  dsvg.innerHTML = `
    ${bars}
    <line x1="${padD}" y1="${goalY}" x2="${W-padD}" y2="${goalY}" stroke="#C0392B" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="${W-padD}" y="${goalY-4}" font-size="10" fill="#C0392B" text-anchor="end">goal ${goalKg.toFixed(2)} kg</text>
    <line x1="${padD}" y1="${Hd-padD}" x2="${W-padD}" y2="${Hd-padD}" stroke="rgba(0,0,0,.1)"/>`;

  // Mood heatmap
  const mood = document.getElementById('moodChart');
  mood.innerHTML = '';
  mood.style.gridTemplateColumns = `repeat(${Math.min(WEEKS.length, 13)}, 1fr)`;
  const moodColours = ['#3D3020','#6B5B3E','#D4A5A5','#8FAF8F','#C0392B'];
  WEEKS.forEach(w => {
    const wst = ws(w.weekNumber);
    (w.days || []).forEach(d => {
      const v = wst.vibes?.[d.id];
      const cell = document.createElement('div');
      cell.className = 'mc';
      if (v != null) {
        cell.style.background = moodColours[v];
        cell.title = `Wk${w.weekNumber} ${d.wd}: ${VIBE_LABELS[v]}`;
        cell.textContent = VIBES[v];
      } else {
        cell.title = `Wk${w.weekNumber} ${d.wd}`;
      }
      mood.appendChild(cell);
    });
  });

  // kcal chart
  const ksvg = document.getElementById('kcalChart');
  const maxK = Math.max(2200, ...WEEKS.map(w => calcWeekStats(w.weekNumber)?.foodEaten || 0));
  const yK = v => padD + innerHd - (v / maxK) * innerHd;
  const points = WEEKS.map((w, i) => {
    const v = calcWeekStats(w.weekNumber)?.foodEaten || 0;
    return { x: padD + (i / Math.max(WEEKS.length - 1, 1)) * innerWd, y: yK(v), v };
  });
  const path = points.map((p, i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ');
  const kdots = points.filter(p => p.v > 0).map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#C0622B"/>`).join('');
  ksvg.setAttribute('viewBox', `0 0 ${W} ${Hd}`);
  ksvg.innerHTML = `
    <line x1="${padD}" y1="${Hd-padD}" x2="${W-padD}" y2="${Hd-padD}" stroke="rgba(0,0,0,.1)"/>
    <path d="${path}" fill="none" stroke="#C0622B" stroke-width="2"/>
    ${kdots}`;
}

async function addNextWeek() {
  const btn = document.getElementById('addWeekBtn');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  try {
    const newWeek = await fetchJson('/api/weeks/new', { method: 'POST' });
    WEEKS.push(newWeek);
    WEEKS_BY_NUM[newWeek.weekNumber] = newWeek;
    renderWeeksList();
    toggleWeek(newWeek.weekNumber);
    const block = document.querySelector(`[data-week-num="${newWeek.weekNumber}"]`);
    if (block) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    alert('Could not create new week: ' + e.message);
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Add next week';
  }
}

function pickInitialWeek() {
  if (!WEEKS.length) return null;
  const today = new Date();
  for (const w of WEEKS) {
    const probe = (w.weekStrip || []).find(d => d.today);
    if (probe) return w.weekNumber;
  }
  return WEEKS[0].weekNumber;
}

(async function init() {
  try {
    const plan = await fetchJson('/api/plan');
    GLOBAL = plan.global || {};
    WEEKS = plan.weeks || [];
    WEEKS_BY_NUM = Object.fromEntries(WEEKS.map(w => [w.weekNumber, w]));
    CAL_PER_KG = GLOBAL.calPerKg || 7700;
    WEEKLY_KG_GOAL = GLOBAL.weeklyKgGoal || 0.65;

    const remoteState = await fetchJson('/api/state');
    S = (remoteState && remoteState.weeks) ? remoteState : { weeks: {} };
    if (!S.weeks) S.weeks = {};

    renderHeader();
    renderWeeksList();
    document.getElementById('resetBtn').addEventListener('click', resetActiveWeek);
    document.getElementById('addWeekBtn').addEventListener('click', addNextWeek);
    setupTodayButton();
    setupModal();
    updateStreaks();

    const initial = pickInitialWeek();
    if (initial != null) toggleWeek(initial);
    setStatus('💾 saved', '');
  } catch (e) {
    console.error(e);
    document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif">Failed to load plan: ${escapeHtml(e.message)}<br>Is the server running? <code>node server.js</code></div>`;
  }
})();
