
/* =====================================================================
   v0.46.0 — appended helpers: keyboard view shortcuts, illustrated empty
   states, the "Last time" recap in the 1:1 room, tick feedback, and the
   Insights health trend recomputed from the event log. New functions only;
   earlier sections stay byte-identical apart from their own call sites.
   ===================================================================== */

// --- Keyboard view shortcuts (digits 1-7, sidebar order) ---------------
// Mirrors the sidebar click delegation exactly: same workspace-close guard,
// same selection reset, same settings drawer behavior. Kept as a separate
// function so the click handler stays untouched.
function keyboardNavigateToSlot(slot) {
  const ready = !!app.folderHandle && app.connectedFolderReady && !!app.doc;
  if (!ready) return;
  if (slot === 1 || slot === 2) {
    const nextTab = slot === 1 ? 'overview' : 'insights';
    if (app.ui.mainView === 'teamHealth' && currentTeamHealthTab() === nextTab) return;
    if (!confirmWorkspaceClose()) return;
    if (app.ui.mainView !== 'teamHealth') {
      app.ui.selectedId = null;
      app.ui.creatingReport = false;
      app.ui.mainView = 'teamHealth';
    }
    app.ui.teamHealthTab = nextTab;
    persistUiState();
    navigateRender(() => render());
    return;
  }
  const viewBySlot = { 3: 'reports', 4: 'meetings', 5: 'followUps', 6: 'pdcSummary', 7: 'settings' };
  const nextView = viewBySlot[slot];
  if (!nextView || !MAIN_VIEWS.includes(nextView)) return;
  if (app.ui.mainView === nextView) return;
  if (!confirmWorkspaceClose()) return;
  if (nextView !== 'reports') {
    app.ui.selectedId = null;
    app.ui.creatingReport = false;
  }
  app.ui.mainView = nextView;
  persistUiState();
  if (nextView === 'settings') {
    render();
    openRulesDrawer();
    return;
  }
  navigateRender(() => render());
}

// --- Tick feedback ------------------------------------------------------
// Full renders rebuild the DOM, so an animation started on the clicked node
// dies immediately. Instead the toggle handler stamps a key here and the
// next render adds a one-shot .tick-pop class to the matching row. The
// 700ms window means unrelated later renders never replay the animation.
let lastTickPop = null;
function markTickPop(key) {
  lastTickPop = { key, at: Date.now() };
}
function tickPopClass(key) {
  return lastTickPop && lastTickPop.key === key && (Date.now() - lastTickPop.at) < 700 ? ' tick-pop' : '';
}

// --- Illustrated empty states -------------------------------------------
// Inline stroke icons in the same style as the sidebar set, so the zero
// network promise holds. Used by the big first-run and all-clear states;
// small filter-result notes keep their plain text.
const EMPTY_HERO_ICONS = Object.freeze({
  people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.8-3.3 3.3-5 6-5s5.2 1.7 6 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.2 14c2.4.1 4.5 1.6 5.8 4.5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5"/></svg>',
  clear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.6L16 9.5"/></svg>',
  inbox: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
});

function emptyHeroHtml(kind, title, body, actionHtml = '') {
  const icon = EMPTY_HERO_ICONS[kind] || EMPTY_HERO_ICONS.inbox;
  return `
    <div class="empty-hero${kind === 'clear' ? ' celebrate' : ''}">
      <div class="empty-hero-icon" aria-hidden="true">${icon}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
      ${actionHtml}
    </div>`;
}

// --- "Last time" recap in the 1:1 room -----------------------------------
// The most recent logged meeting of any type, collapsed above the editor so
// twenty seconds of prep replaces digging through the workspace. Open state
// lives on the meeting room draft so mid-meeting re-renders keep it as is.
function renderPrevMeetingPanelHtml(report, draft) {
  const prev = (report.meetings || [])[0] || null;
  if (!prev) return '';
  const ago = dateDiffInDays(prev.meetingDate);
  const metaText = `${canonicalMeetingType(prev.meetingType)} · ${formatDate(prev.meetingDate)}${ago !== null && ago >= 0 ? ` · ${ago}d ago` : ''}`;
  const noteHtml = normalizeText(prev.notes)
    ? `<div class="note-markdown mr-prev-note">${renderNoteMarkdown(prev.notes)}</div>`
    : '<p class="tp-empty mr-prev-empty">No notes were written for that meeting.</p>';
  return `
    <details class="mr-panel mr-prev" id="mrPrevDetails"${draft.prevNoteOpen ? ' open' : ''}>
      <summary class="mr-prev-summary">
        <span class="mr-prev-title">Last time</span>
        ${prev.pulse ? `<span class="pulse-dot" data-pulse="${escapeHtml(prev.pulse)}" title="${escapeHtml(PULSE_LABELS[prev.pulse] || prev.pulse)}"></span>` : ''}
        <span class="mr-prev-meta">${escapeHtml(metaText)}</span>
        <span class="mr-prev-chevron" aria-hidden="true">▾</span>
      </summary>
      ${noteHtml}
    </details>`;
}

// --- Insights: health trend recomputed from the event log ----------------
// weeklySnapshots were removed in the v7 migration because storing them was
// waste. This takes the other path: since every meeting, vacation, and
// support level change carries a date, the same score the Overview dial
// shows can be recomputed for any past week at render time with zero stored
// data. Deliberate simplifications, stated in the card copy: thresholds and
// cadence overrides are today's values, and snoozes (transient by design)
// only affect the newest point, which is taken straight from the live dial
// so the trend always lands exactly on the number the Overview shows.
const HEALTH_TREND_WEEKS = 26;

function supportLevelAsOf(report, dateStamp) {
  const entries = (report.changeLog || []).filter((entry) => entry.field === 'Support level');
  if (!entries.length) return normalizeSupportLevel(report.supportLevel);
  let level = normalizeSupportLevel(entries[0].from);
  entries.forEach((entry) => {
    if ((entry.date || '') <= dateStamp) level = normalizeSupportLevel(entry.to);
  });
  return level;
}

function latestMeetingDateAsOf(report, type, dateStamp) {
  const wanted = canonicalMeetingType(type);
  let best = '';
  (report.meetings || []).forEach((meeting) => {
    const date = normalizeDate(meeting.meetingDate);
    if (!date || date > dateStamp) return;
    if (canonicalMeetingType(meeting.meetingType) !== wanted) return;
    if (date > best) best = date;
  });
  return best;
}

// Same rule as isMissingTouchpointOverdue, evaluated against an arbitrary
// reference date instead of today.
function touchpointOverdueAsOf(report, lastDate, thresholdDays, dateStamp) {
  const anchor = lastDate || normalizeDate(report.hireDate);
  if (!anchor) return true;
  return daysBetween(anchor, dateStamp) > thresholdDays;
}

function healthScoreAsOf(reports, settings, dateStamp) {
  const cohort = reports.filter((report) => {
    const created = normalizeDate(String(report.createdAt || '').slice(0, 10));
    return created && created <= dateStamp;
  });
  if (!cohort.length) return null;
  let onTime = 0;
  let urgent = 0;
  let needsSupport = 0;
  cohort.forEach((report) => {
    if (getVacationStatus(report, dateStamp).active) {
      // Mirrors cadenceSuppressed in the live metrics: a vacation week never
      // counts a touchpoint as overdue.
      onTime += 3;
    } else {
      [
        ['1:1', effectiveThreshold(report, '1:1', settings)],
        ['PDC', effectiveThreshold(report, 'PDC', settings)],
        ['CV review', effectiveThreshold(report, 'CV review', settings)]
      ].forEach(([type, thresholdDays]) => {
        const last = latestMeetingDateAsOf(report, type, dateStamp);
        if (!touchpointOverdueAsOf(report, last, thresholdDays, dateStamp)) onTime += 1;
      });
    }
    const level = supportLevelAsOf(report, dateStamp);
    if (level === 'Urgent') urgent += 1;
    else if (level === 'Support needed') needsSupport += 1;
  });
  const cadenceScore = (onTime / (cohort.length * 3)) * 100;
  const supportPenalty = Math.min(30, urgent * 8 + needsSupport * 4);
  return {
    score: Math.max(0, Math.min(100, Math.round(cadenceScore - supportPenalty))),
    count: cohort.length
  };
}

function buildHealthTrendSeries(reports, settings) {
  const points = [];
  const thisMonday = mondayOf(todayStamp());
  for (let back = HEALTH_TREND_WEEKS - 1; back >= 1; back -= 1) {
    const weekStart = addDays(thisMonday, -7 * back);
    const result = healthScoreAsOf(reports, settings, weekStart);
    points.push({
      weekStart,
      score: result ? result.score : null,
      count: result ? result.count : 0,
      current: false
    });
  }
  const reportStates = reports.map((report) => {
    const metrics = getMetrics(report.id);
    return { report, metrics, attentionCount: metrics.attention.length };
  });
  const live = computeTeamHealthScore(reportStates);
  points.push({ weekStart: thisMonday, score: reports.length ? live.score : null, count: reports.length, current: true });
  const firstIdx = points.findIndex((point) => point.score !== null);
  return firstIdx <= 0 ? points : points.slice(firstIdx);
}

function renderHealthTrendCard(reports) {
  const settings = app.doc?.settings || normalizeSettings({});
  const series = reports.length ? buildHealthTrendSeries(reports, settings) : [];
  const drawable = series.filter((point) => point.score !== null);
  const head = `
    <div class="trend-head">
      <h3>Health Trend</h3>
      <span class="trend-note">Weekly · last ${HEALTH_TREND_WEEKS} weeks</span>
    </div>
    <p class="trend-sub">The Overview score recomputed for each past week from logged meetings, vacations, and support level changes. Uses today's cadence thresholds. Snoozes only affect the newest point.</p>`;
  if (!reports.length || drawable.length < 2) {
    const emptyCopy = reports.length
      ? 'Not enough history yet. The trend appears once the team has been tracked for at least two weeks.'
      : 'Add a direct report to start building trend history.';
    return `
    <div class="trend-card">
      ${head}
      <div class="trend-empty">${emptyCopy}</div>
    </div>`;
  }
  const W = 660;
  const H = 170;
  const padL = 34;
  const padR = 14;
  const padT = 12;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = series.length;
  const x = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (score) => padT + ((100 - score) / 100) * plotH;
  const gridLines = [0, 25, 50, 75, 100]
    .map((v) => `<line class="trend-grid-line" x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}"></line>`)
    .join('');
  const axisLabels = [0, 50, 100]
    .map((v) => `<text class="trend-axis-label" x="${padL - 8}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${v}</text>`)
    .join('');
  let monthLabels = '';
  let prevMonth = '';
  series.forEach((point, i) => {
    const monthName = new Date(`${point.weekStart}T00:00:00`).toLocaleString(undefined, { month: 'short' });
    if (monthName !== prevMonth) {
      monthLabels += `<text class="trend-month-label" x="${x(i).toFixed(1)}" y="${H - 8}">${escapeHtml(monthName)}</text>`;
      prevMonth = monthName;
    }
  });
  const coords = series
    .map((point, i) => (point.score === null ? null : `${x(i).toFixed(1)},${y(point.score).toFixed(1)}`))
    .filter(Boolean);
  const linePath = `M ${coords.join(' L ')}`;
  const firstDrawn = Math.max(0, series.findIndex((point) => point.score !== null));
  const areaPath = `${linePath} L ${x(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L ${x(firstDrawn).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
  const dots = series
    .map((point, i) => {
      if (point.score === null) return '';
      const tip = `Week of ${formatDate(point.weekStart)} · ${point.score} of 100 · ${point.count} ${point.count === 1 ? 'person' : 'people'} tracked`;
      return `<circle class="trend-dot${point.current ? ' current' : ''}" cx="${x(i).toFixed(1)}" cy="${y(point.score).toFixed(1)}" r="${point.current ? 4 : 3}"><title>${escapeHtml(tip)}</title></circle>`;
    })
    .join('');
  const latest = drawable[drawable.length - 1];
  return `
    <div class="trend-card">
      ${head}
      <svg class="trend-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Team health score by week for the last ${HEALTH_TREND_WEEKS} weeks, currently ${latest.score} of 100">
        <defs>
          <linearGradient id="trendFillGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(41,87,214,0.16)"></stop>
            <stop offset="100%" stop-color="rgba(41,87,214,0)"></stop>
          </linearGradient>
        </defs>
        ${gridLines}
        ${axisLabels}
        ${monthLabels}
        <path d="${areaPath}" fill="url(#trendFillGradient)"></path>
        <path class="trend-line" d="${linePath}"></path>
        ${dots}
      </svg>
    </div>`;
}
