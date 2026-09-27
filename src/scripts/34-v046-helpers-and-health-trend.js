
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
// stamp is used up by the first render that draws that row, so a later
// render (the autosave status, for example) never replays the fade, and the
// 700ms window drops a stamp that no render picked up.
let lastTickPop = null;
function markTickPop(key) {
  lastTickPop = { key, at: Date.now() };
}
function tickPopClass(key) {
  if (!lastTickPop || lastTickPop.key !== key) return '';
  const fresh = (Date.now() - lastTickPop.at) < 700;
  lastTickPop = null;
  return fresh ? ' tick-pop' : '';
}

// --- Keyboard focus kept across re-renders ---------------------------------
// The Development path stage pills, the Heatmap / Web switch, the Tenure /
// Months since promotion switch and the capability ticks all re-render
// their area, which drops focus to the page. When the control had focus, the
// control with the same hook and value in the new markup gets it back, so a
// keyboard user carries on where they were. A MutationObserver waits for the
// re-render, whether it runs straight away or after a save, and gives up
// after 2 seconds or as soon as something else takes focus.
const FOCUS_KEEP_HOOKS = Object.freeze({
  click: ['data-cdp-stage', 'data-cdp-team-mode', 'data-tenure-mode'],
  change: ['data-cdp-toggle', 'data-cdp-date']
});
let focusKeepWatch = null;

function stopFocusKeepWatch() {
  if (!focusKeepWatch) return;
  focusKeepWatch.observer.disconnect();
  clearTimeout(focusKeepWatch.timer);
  focusKeepWatch = null;
}

function keepFocusAcrossRender(control, hook) {
  stopFocusKeepWatch();
  const selector = `[${hook}="${CSS.escape(control.getAttribute(hook) || '')}"]`;
  const tryRestore = () => {
    if (control.isConnected) return;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) {
      stopFocusKeepWatch();
      return;
    }
    const next = document.querySelector(selector);
    if (!next) return;
    stopFocusKeepWatch();
    next.focus({ preventScroll: true });
  };
  const observer = new MutationObserver(tryRestore);
  observer.observe(document.body, { childList: true, subtree: true });
  focusKeepWatch = { observer, timer: setTimeout(stopFocusKeepWatch, 2000) };
}

Object.entries(FOCUS_KEEP_HOOKS).forEach(([type, hooks]) => {
  const selector = hooks.map((hook) => `[${hook}]`).join(', ');
  document.addEventListener(type, (event) => {
    const control = event.target instanceof Element ? event.target.closest(selector) : null;
    if (!control || document.activeElement !== control) return;
    const hook = hooks.find((name) => control.hasAttribute(name));
    if (hook) keepFocusAcrossRender(control, hook);
  }, true);
});

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
    const created = localDateOf(report.createdAt);
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
      <div class="trend-head-text">
        <h3>Health Trend</h3>
        <p class="trend-sub">The Overview score recomputed for each past week from logged meetings, vacations, and support level changes. Uses today's cadence thresholds. Snoozes only affect the newest point.</p>
      </div>
      <span class="trend-note">Weekly · last ${HEALTH_TREND_WEEKS} weeks</span>
    </div>`;
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
  // No viewBox: x positions are percentages of the chart width and y
  // positions are pixels, so the chart stretches to the card while the
  // 12px axis labels stay 12px on screen (a scaled viewBox would grow or
  // shrink them). The y labels sit in the wrapper's left padding.
  const H = 184;
  const padT = 8;
  const plotH = 150;
  const baseY = padT + plotH;
  const n = series.length;
  const xPct = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const px = (i) => `${xPct(i).toFixed(2)}%`;
  const y = (score) => padT + ((100 - score) / 100) * plotH;
  const gridLines = [25, 50, 75, 100]
    .map((v) => `<line class="trend-grid-line" x1="0" y1="${y(v).toFixed(1)}" x2="100%" y2="${y(v).toFixed(1)}"></line>`)
    .join('');
  const axisLine = `<line class="trend-axis-line" x1="0" y1="${baseY}" x2="100%" y2="${baseY}"></line>`;
  const axisLabels = [0, 50, 100]
    .map((v) => `<text class="trend-axis-label" x="-10" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`)
    .join('');
  const monthTicks = [];
  let prevMonth = '';
  series.forEach((point, i) => {
    const monthName = new Date(`${point.weekStart}T00:00:00`).toLocaleString(undefined, { month: 'short' });
    if (monthName !== prevMonth) {
      monthTicks.push({ i, monthName });
      prevMonth = monthName;
    }
  });
  // A month with fewer than three weeks on the chart sits close to the next
  // label. It is marked "tight" and hidden on narrow cards so the two never
  // run together.
  const monthLabels = monthTicks.map((tick, index) => {
    const next = monthTicks[index + 1];
    const tight = next && (next.i - tick.i) < 3;
    return `<text class="trend-month-label${tight ? ' tight' : ''}" x="${px(tick.i)}" y="${baseY + 20}" text-anchor="middle">${escapeHtml(tick.monthName)}</text>`;
  }).join('');
  // The line is drawn as one segment per week, since a path cannot mix
  // percentage and pixel coordinates.
  const segments = [];
  let prevIndex = -1;
  series.forEach((point, i) => {
    if (point.score === null) return;
    if (prevIndex > -1) {
      segments.push(`<line class="trend-line" x1="${px(prevIndex)}" y1="${y(series[prevIndex].score).toFixed(1)}" x2="${px(i)}" y2="${y(point.score).toFixed(1)}"></line>`);
    }
    prevIndex = i;
  });
  // Each week keeps its tooltip on a larger invisible hit area. The dot only
  // shows on hover, except the current week, which is always marked.
  const points = series
    .map((point, i) => {
      if (point.score === null) return '';
      const tip = `Week of ${formatDate(point.weekStart)} · ${point.score} of 100 · ${point.count} ${point.count === 1 ? 'person' : 'people'} tracked`;
      const cy = y(point.score).toFixed(1);
      return `<g class="trend-point${point.current ? ' current' : ''}"><title>${escapeHtml(tip)}</title><circle class="trend-hit" cx="${px(i)}" cy="${cy}" r="10"></circle><circle class="trend-dot${point.current ? ' current' : ''}" cx="${px(i)}" cy="${cy}" r="${point.current ? 4 : 3}"></circle></g>`;
    })
    .join('');
  const latest = drawable[drawable.length - 1];
  return `
    <div class="trend-card">
      ${head}
      <div class="trend-plot">
        <svg class="trend-chart" width="100%" height="${H}" role="img" aria-label="Team health score by week for the last ${HEALTH_TREND_WEEKS} weeks, currently ${latest.score} of 100">
          ${gridLines}
          ${axisLine}
          ${axisLabels}
          ${monthLabels}
          ${segments.join('')}
          ${points}
        </svg>
      </div>
    </div>`;
}
