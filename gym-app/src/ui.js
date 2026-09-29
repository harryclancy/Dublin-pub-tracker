/* ===== UI helpers: escaping, icons, formatting, toasts, charts, muscle map ===== */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const I = (() => {
  const p = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  return {
    home: p('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
    lift: p('<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>'),
    prog: p('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7"/>'),
    book: p('<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 5v16M9 7h6"/>'),
    chart: p('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    gear: p('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
    plus: p('<path d="M12 5v14M5 12h14"/>'),
    dots: p('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
    check: p('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    x: p('<path d="M6 6l12 12M18 6L6 18"/>'),
    timer: p('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>'),
    play: p('<path d="M7 5l12 7-12 7z"/>'),
    pause: p('<path d="M8 5v14M16 5v14"/>'),
    reset: p('<path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8"/><path d="M3 3v5h5"/>'),
    skip: p('<path d="M5 5l10 7-10 7zM19 5v14"/>'),
    back: p('<path d="M15 18l-6-6 6-6"/>'),
    right: p('<path d="M9 18l6-6-6-6"/>'),
    trash: p('<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>'),
    copy: p('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>'),
    swap: p('<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
    up: p('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    down: p('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    note: p('<path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4M8 9h8M8 13h5"/>'),
    search: p('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    trophy: p('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>'),
    bolt: p('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    info: p('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
    edit: p('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
    cal: p('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    moon: p('<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>'),
    spark: p('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'),
    arrowUp: p('<path d="M7 17L17 7M9 7h8v8"/>'),
    arrowDn: p('<path d="M7 7l10 10M17 9v8H9"/>'),
    eq: p('<path d="M5 9h14M5 15h14"/>'),
    rest: p('<path d="M3 18h18M5 18V9M5 13h14a2 2 0 012 2v3M9 11a2 2 0 100-4 2 2 0 000 4z"/>'),
    target: p('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    heart: p('<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>'),
    ban: p('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
    download: p('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
    upload: p('<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>'),
    cloud: p('<path d="M7 18a5 5 0 01-.6-10A6 6 0 0118 9a4.5 4.5 0 01-.5 9z"/>'),
    grip: p('<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>'),
    shuffle: p('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
    video: p('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>'),
  };
})();

/* ---------- Dates ---------- */
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(t, withYear) { const d = new Date(t); return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}${withYear || d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`; }
function fmtShort(t) { const d = new Date(t); return `${d.getDate()} ${MON[d.getMonth()]}`; }
function fmtTime(t) { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function ago(t) {
  const d = daysBetween(t, Date.now());
  if (d <= 0) return 'Today'; if (d === 1) return 'Yesterday'; if (d < 7) return `${d} days ago`;
  if (d < 14) return '1 week ago'; if (d < 60) return `${Math.floor(d / 7)} weeks ago`; return fmtDate(t, true);
}
function fmtDur(ms) { if (!ms || ms < 0) return '—'; const m = Math.round(ms / 60000); if (m < 60) return `${m} min`; return `${Math.floor(m / 60)} h ${m % 60} min`; }
function fmtClock(sec) { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
function toLocalInput(t) { const d = new Date(t); const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; }
function setsText(sets, bw) { return sets.map(s => `${fmtW(s.w, bw)}${s.w ? '' : ''} × ${s.r}`); }

/* ---------- Toasts ---------- */
let toastTimer = null;
function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.className = 'toast show ' + kind;
  el.innerHTML = (kind === 'pr' ? `<span class="t-ic">${I.trophy}</span>` : '') + `<span>${esc(msg)}</span>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast ' + kind; }, kind === 'pr' ? 3600 : 2400);
}

/* ---------- Charts (inline SVG, drawn to scale) ---------- */
function niceTicks(min, max, n = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || step0;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const t = []; for (let v = lo; v <= hi + step / 2; v += step) t.push(Math.round(v * 1000) / 1000);
  return t;
}
function lineChart(pts, opts = {}) {
  if (pts.length < 2) return `<div class="chart-empty">${pts.length ? 'One session logged so far — the chart appears after your second.' : 'No data yet.'}</div>`;
  const W = 340, H = opts.h || 170, L = 38, R = 12, T = 12, B = 24;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const sx = x => L + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - L - R);
  const sy = y => T + (1 - (y - y0) / (y1 - y0 || 1)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const area = `${line}L${sx(x1).toFixed(1)},${H - B}L${sx(x0).toFixed(1)},${H - B}Z`;
  const grid = ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}" class="c-grid"/><text x="${L - 6}" y="${sy(t) + 3.5}" class="c-lbl" text-anchor="end">${opts.fmt ? opts.fmt(t) : t}</text>`).join('');
  const lp = pts[pts.length - 1];
  const dots = pts.length <= 24 ? pts.map(p => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="2.4" class="c-dot"/>`).join('') : '';
  const gid = 'g' + Math.random().toString(36).slice(2, 7);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Chart')}">
    <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#${gid})"/><path d="${line}" class="c-line"/>${dots}
    <circle cx="${sx(lp.x)}" cy="${sy(lp.y)}" r="5" class="c-end"/>
    <text x="${L}" y="${H - 6}" class="c-lbl">${fmtShort(x0)}</text><text x="${W - R}" y="${H - 6}" class="c-lbl" text-anchor="end">${fmtShort(x1)}</text>
  </svg>`;
}
function barChart(vals, labels, opts = {}) {
  const W = 340, H = opts.h || 150, L = 30, R = 8, T = 12, B = 22;
  const max = Math.max(opts.target || 0, ...vals, 1);
  const ticks = niceTicks(0, max, 3); const top = ticks[ticks.length - 1];
  const bw = (W - L - R) / vals.length;
  const sy = v => T + (1 - v / top) * (H - T - B);
  const grid = ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}" class="c-grid"/><text x="${L - 6}" y="${sy(t) + 3.5}" class="c-lbl" text-anchor="end">${opts.fmt ? opts.fmt(t) : t}</text>`).join('');
  const bars = vals.map((v, i) => { const h = Math.max(v ? 2 : 0, (H - T - B) - (sy(v) - T)); return `<rect x="${(L + i * bw + bw * 0.18).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="3" class="${i === vals.length - 1 ? 'c-bar now' : 'c-bar'}"/>`; }).join('');
  const lbls = labels.map((l, i) => l ? `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" class="c-lbl" text-anchor="middle">${l}</text>` : '').join('');
  const tgt = opts.target ? `<line x1="${L}" x2="${W - R}" y1="${sy(opts.target)}" y2="${sy(opts.target)}" class="c-target"/><text x="${W - R}" y="${sy(opts.target) - 4}" class="c-lbl c-tl" text-anchor="end">Target ${opts.target}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Bar chart')}">${grid}${bars}${tgt}${lbls}</svg>`;
}
function spark(vals) {
  if (vals.length < 2) return '';
  const W = 90, H = 30, mn = Math.min(...vals), mx = Math.max(...vals);
  const sx = i => 2 + i / (vals.length - 1) * (W - 4), sy = v => 3 + (1 - (v - mn) / (mx - mn || 1)) * (H - 6);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" class="c-line"/><circle cx="${sx(vals.length - 1)}" cy="${sy(vals[vals.length - 1])}" r="2.8" class="c-end"/></svg>`;
}

/* ---------- Muscle map: simple front/back figure, primary muscle solid, secondary tinted ---------- */
function muscleMap(primary, secondary = []) {
  const f = m => m === primary ? 'mm-p' : secondary.includes(m) ? 'mm-s' : 'mm-o';
  const front = `
    <circle cx="60" cy="22" r="13" class="mm-head"/>
    <path d="M50 36h20l2 8H48z" class="mm-head"/>
    <path d="M36 46q-10 2-12 14l4 10 10-6z" class="${f('shoulders')}"/><path d="M84 46q10 2 12 14l-4 10-10-6z" class="${f('shoulders')}"/>
    <path d="M40 46h19v24q-12 2-20-6z" class="${f('chest')}"/><path d="M61 46h19l1 18q-8 8-20 6z" class="${f('chest')}"/>
    <path d="M27 72l11-6 3 12-5 18-9-2z" class="${f('biceps')}"/><path d="M93 72l-11-6-3 12 5 18 9-2z" class="${f('biceps')}"/>
    <path d="M26 98l9 2-4 26-7-1z" class="${f('other')}"/><path d="M94 98l-9 2 4 26 7-1z" class="${f('other')}"/>
    <path d="M45 73h30l-2 34H47z" class="${f('core')}"/>
    <path d="M44 110h15l-2 44H44q-4-22 0-44z" class="${f('quads')}"/><path d="M61 110h15q4 22 0 44H63z" class="${f('quads')}"/>
    <path d="M45 160h11l-1 36h-8z" class="${f('calves') === 'mm-p' ? 'mm-s' : 'mm-o'}"/><path d="M64 160h11l-2 36h-8z" class="${f('calves') === 'mm-p' ? 'mm-s' : 'mm-o'}"/>`;
  const back = `
    <circle cx="60" cy="22" r="13" class="mm-head"/>
    <path d="M46 36h28l8 10H38z" class="${f('back') === 'mm-o' && primary !== 'back' ? 'mm-o' : f('back')}"/>
    <path d="M36 46q-10 2-12 14l4 10 10-6z" class="${f('shoulders')}"/><path d="M84 46q10 2 12 14l-4 10-10-6z" class="${f('shoulders')}"/>
    <path d="M40 48h40l-4 30-16 8-16-8z" class="${f('back')}"/>
    <path d="M27 72l11-6 3 12-5 18-9-2z" class="${f('triceps')}"/><path d="M93 72l-11-6-3 12 5 18 9-2z" class="${f('triceps')}"/>
    <path d="M26 98l9 2-4 26-7-1z" class="${f('other')}"/><path d="M94 98l-9 2 4 26 7-1z" class="${f('other')}"/>
    <path d="M47 88l13 6 13-6 2 14H45z" class="${f('back') === 'mm-p' ? 'mm-s' : 'mm-o'}"/>
    <path d="M44 104h16v18H43q-2-10 1-18z" class="${f('glutes')}"/><path d="M60 104h16q3 8 1 18H60z" class="${f('glutes')}"/>
    <path d="M44 124h14l-1 32H45q-3-16-1-32z" class="${f('hamstrings')}"/><path d="M62 124h14q2 16-1 32H63z" class="${f('hamstrings')}"/>
    <path d="M45 160h11l-1 36h-8z" class="${f('calves')}"/><path d="M64 160h11l-2 36h-8z" class="${f('calves')}"/>`;
  return `<div class="mmap" aria-hidden="true"><svg viewBox="0 0 120 204"><g>${front}</g></svg><svg viewBox="0 0 120 204"><g>${back}</g></svg></div>
  <div class="mm-legend"><span><i class="mm-p"></i>Main</span>${secondary.length ? '<span><i class="mm-s"></i>Also works</span>' : ''}<span class="mm-cap">Front · Back</span></div>`;
}

function chip(label, on, attrs = '') { return `<button class="chip${on ? ' on' : ''}" ${attrs}>${esc(label)}</button>`; }
function seg(options, value, action) { return `<div class="seg">${options.map(([v, l]) => `<button class="${String(v) === String(value) ? 'on' : ''}" data-a="${action}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`; }
function stepper(val, action, extra = '') { return `<div class="stepper"><button data-a="${action}" data-d="-1" ${extra} aria-label="Decrease">−</button><span>${esc(val)}</span><button data-a="${action}" data-d="1" ${extra} aria-label="Increase">+</button></div>`; }
