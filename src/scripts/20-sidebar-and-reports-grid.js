function renderReportsGrid() {
  const mount = document.getElementById('reportsGrid');
  if (!mount) return;
  const total = getReports().length;
  // getFilteredReports applies search, PDC status, attention state, and the
  // Insights theme filter. The grid re-sorts alphabetically for scannability;
  // urgency is signaled by the chips on each tile instead of by ordering.
  const filtered = [...getFilteredReports()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Sync toolbar controls without clobbering focus.
  const searchEl = document.getElementById('reportsGridSearch');
  if (searchEl && document.activeElement !== searchEl) {
    searchEl.value = app.ui.searchTerm || '';
  }
  const planEl = document.getElementById('reportsPlanFilter');
  if (planEl && planEl.value !== (app.ui.planFilter || '')) planEl.value = app.ui.planFilter || '';
  const attentionEl = document.getElementById('reportsAttentionFilter');
  if (attentionEl && attentionEl.value !== (app.ui.attentionFilter || '')) attentionEl.value = app.ui.attentionFilter || '';

  // Tiles vs Table lens. The switch lives in the toolbar; the mode is a
  // persisted UI preference (localStorage), never part of the document.
  const viewMode = app.ui.reportsViewMode === 'table' ? 'table' : 'tiles';
  const switchEl = document.getElementById('reportsViewSwitch');
  if (switchEl) {
    switchEl.querySelectorAll('[data-reports-view]').forEach((btn) => {
      const isActive = btn.getAttribute('data-reports-view') === viewMode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }
  mount.classList.toggle('reports-grid', viewMode !== 'table');
  mount.classList.toggle('reports-table', viewMode === 'table');
  if (viewMode === 'table') {
    mount.innerHTML = renderReportsTableHtml(filtered, total);
    return;
  }

  const tiles = filtered.map((report) => renderReportTileHtml(report)).join('');

  const addTile = `<button type="button" class="report-tile-add" data-report-add>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>
    <span>Add direct report</span>
  </button>`;

  if (filtered.length === 0) {
    const filtersActive = !!(app.ui.searchTerm || app.ui.planFilter || app.ui.attentionFilter || currentThemeFilter());
    mount.innerHTML = total > 0 && filtersActive
      ? `<p class="help-text empty-note">No direct reports match the current filters.</p>`
      : `${addTile}`;
    return;
  }
  mount.innerHTML = `${tiles}${addTile}`;
}

function reportInitialsFromName(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

// One direct report tile, shared by the Direct Reports grid and the Overview
// (Overview.html). The tile is a wrapper holding two sibling buttons, so no
// button sits inside another: the main button covers the whole tile and opens
// the workspace (click, Enter or Space), and the small 1:1 room button sits on
// top of it in the head row and opens the room.
// On Direct Reports the hooks are data-report-card and
// .tile-room-btn[data-open-room] (handled in 29). On the Overview they are
// data-glyph-open (handled by the #teamHealthBody delegation in 29) and
// data-overview-room (handled in 33). The Overview stays in the DOM, hidden,
// while Direct Reports is shown, so it must not repeat the Direct Reports hooks.
function renderReportTileHtml(report, options = {}) {
  const onOverview = options.context === 'overview';
  const id = escapeHtml(report.id);
  const metrics = getMetrics(report.id);
  const level = report.level || 'Level not set';
  const mentor = report.mentors ? `Mentor: ${report.mentors}` : '';
  const chips = [];
  if (metrics.oneOnOneOverdue) chips.push(`<span class="report-tile-chip">1:1 overdue</span>`);
  if (metrics.pdcOverdue) chips.push(`<span class="report-tile-chip">PDC overdue</span>`);
  if (metrics.cvReviewOverdue) chips.push(`<span class="report-tile-chip">CV overdue</span>`);
  const openFollowUps = (metrics.openFollowUps || []).length;
  if (openFollowUps) chips.push(`<span class="report-tile-chip" data-tone="neutral">${openFollowUps} follow-up${openFollowUps === 1 ? '' : 's'}</span>`);
  if (report.supportLevel === 'Urgent') chips.push(`<span class="report-tile-chip" data-tone="solid-red">Urgent</span>`);
  else if (report.supportLevel === 'Support needed') chips.push(`<span class="report-tile-chip" data-tone="red">Support needed</span>`);
  else if (report.supportLevel === 'Monitor') chips.push(`<span class="report-tile-chip" data-tone="neutral">Monitor</span>`);
  else if (report.supportLevel === 'Good' && chips.length === 0) chips.push(`<span class="report-tile-chip" data-tone="good">On track</span>`);
  const initials = reportInitialsFromName(report.name);
  // Company initials are the tile title when present: short, uniform, and
  // immune to the truncation that crushed long names next to the 1:1 room
  // button. The full name moves to its own full-width line underneath, where
  // it has the whole tile to itself. People without initials keep the name
  // as the title, exactly as before.
  const hasCode = !!(report.initials && report.name);
  const tileTitle = report.initials || report.name || 'Unnamed';
  const openHook = onOverview ? `data-glyph-open="${id}"` : `data-report-card="${id}"`;
  const roomHook = onOverview ? `data-overview-room="${id}"` : `data-open-room="${id}"`;
  const avatarMorph = onOverview ? '' : ` style="view-transition-name:vt-${id}"`;
  const pulseHtml = renderPulseDots(metrics.pulseSeries, { emptyHtml: '' });
  return `<div class="report-tile">
    <button type="button" class="report-tile-main" ${openHook}>
      <span class="report-tile-head">
        <span class="report-tile-avatar" aria-hidden="true"${avatarMorph}>${escapeHtml(initials)}</span>
        <span class="report-tile-name${report.initials ? ' is-code' : ''}" ${hasCode ? `title="${escapeHtml(report.name)}"` : ''}>${escapeHtml(tileTitle)}</span>
      </span>
      <span class="report-tile-meta">
        ${hasCode ? `<span class="report-tile-meta-line report-tile-fullname">${escapeHtml(report.name)}</span>` : ''}
        <span class="report-tile-meta-line">${escapeHtml(level)}</span>
        ${mentor ? `<span class="report-tile-meta-line">${escapeHtml(mentor)}</span>` : ''}
      </span>
      <span class="report-tile-foot">
        <span class="report-tile-vitals">
          <span class="report-tile-vital">${renderTileSparkline(report)}</span>
          ${pulseHtml ? `<span class="report-tile-vital is-pulse">${pulseHtml}</span>` : ''}
        </span>
        ${metrics.primaryGoal ? `<span class="report-tile-goal" title="${escapeHtml(metrics.primaryGoal.title)}">${renderGoalStatusAndBar(metrics.primaryGoal)}</span>` : ''}
        ${chips.length ? `<span class="report-tile-chips">${chips.join('')}</span>` : ''}
      </span>
    </button>
    <button type="button" class="tile-room-btn" ${roomHook} title="Open the 1:1 meeting room">1:1 room</button>
  </div>`;
}

// The shared goal bar (renderGoalProgressBar in 25) is built from <div>s,
// which a <button> (the tile) or a <span> (the table's title wrapper) may not
// contain. Same markup and classes, with each <div> as a <span>; the output
// is all escaped, so the only tags in it are the helper's own. The fill span
// is made a block in 06 (.report-tile-goal, .reports-table).
function renderGoalProgressBarPhrasing(goal, options = {}) {
  return renderGoalProgressBar(goal, options).replace(/<(\/?)div\b/g, '<$1span');
}

// The goal's status as a tag before the compact bar, as on the PDC board and
// in the 1:1 room, so At risk, Paused and On track never rely on the bar
// color alone. Used by the tile and the table.
function renderGoalStatusAndBar(goal) {
  return `${statusPillHtml('goal', goal.status || GOAL_STATUSES[0])}${renderGoalProgressBarPhrasing(goal, { compact: true })}`;
}

// An overdue last 1:1 is amber, and always carries this triangle and a
// screen reader word, so it never relies on color alone.
const REPORTS_OVERDUE_GLYPH = '<svg class="tt-overdue-glyph" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.2 22.2 20.6H1.8Z"></path><path d="M12 9.6v4.8M12 17.4v.2"></path></svg>';

// Monday-style table lens for Direct Reports: grouped by attention state,
// status selects editable inline, next 1:1 editable in place. Same filtered
// set as the tiles, so search and toolbar filters apply here too.
function renderReportsTableHtml(filtered, total) {
  if (!filtered.length) {
    const filtersActive = !!(app.ui.searchTerm || app.ui.planFilter || app.ui.attentionFilter || currentThemeFilter());
    return total > 0 && filtersActive
      ? '<p class="help-text empty-note">No direct reports match the current filters.</p>'
      : '<p class="help-text empty-note">No direct reports yet. Use + Add direct report in the toolbar.</p>';
  }
  const needsAttention = filtered.filter((report) => (getMetrics(report.id).attentionDetails || []).length > 0);
  const onTrack = filtered.filter((report) => (getMetrics(report.id).attentionDetails || []).length === 0);
  // The select looks like a tag; the wrapping span draws its chevron.
  const pillSelect = (attr, reportId, options, current, kind) => `<span class="pill-select-wrap"><select class="pill-select" ${attr}="${escapeHtml(reportId)}" data-pill-kind="${kind}" data-pill-value="${escapeHtml(current)}" aria-label="${kind === 'pdc' ? 'PDC status' : 'Support level'}">${options.map((option) => `<option value="${escapeHtml(option)}" ${option === current ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></span>`;
  const row = (report) => {
    const metrics = getMetrics(report.id);
    const initials = reportInitialsFromName(report.name);
    const pdcValue = normalizePdcStatus(report.rawPdcStatus !== undefined ? report.rawPdcStatus : report.pdcStatus);
    const supportValue = normalizeSupportLevel(report.supportLevel);
    const openFu = (metrics.openFollowUps || []).length;
    const lastText = metrics.lastOneOnOne ? formatDate(metrics.lastOneOnOne) : 'Never';
    const attentionTitle = (metrics.attentionDetails || []).map((item) => item.label).join(', ');
    return `<tr data-table-row="${escapeHtml(report.id)}">
      <td><button type="button" class="tt-person" data-table-person="${escapeHtml(report.id)}" ${attentionTitle ? `title="${escapeHtml(attentionTitle)}"` : ''}>
        <span class="tt-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
        <span><span class="tt-person-name">${escapeHtml(report.name || 'Unnamed')}</span><span class="tt-sub">${escapeHtml(`${report.initials ? `${report.initials} · ` : ''}${report.level || 'Level not set'}`)}</span></span>
      </button></td>
      <td>${pillSelect('data-table-pdc', report.id, PDC_STATUSES, pdcValue, 'pdc')}</td>
      <td>${pillSelect('data-table-support', report.id, SUPPORT_LEVELS, supportValue, 'support')}</td>
      <td><span class="tt-last${metrics.oneOnOneOverdue ? ' tt-overdue' : ''}">${metrics.oneOnOneOverdue ? REPORTS_OVERDUE_GLYPH : ''}<span>${escapeHtml(lastText)}</span>${metrics.oneOnOneOverdue ? '<span class="sr-only">overdue</span>' : ''}</span></td>
      <td class="tt-date"><input type="date" data-table-next="${escapeHtml(report.id)}" value="${escapeHtml(report.nextOneOnOneDate || '')}" aria-label="Next planned 1:1"></td>
      <td><span class="tt-count${openFu ? '' : ' zero'}">${openFu}</span></td>
      <td>${metrics.primaryGoal ? `<span class="tt-goal" title="${escapeHtml(metrics.primaryGoal.title)}">${renderGoalStatusAndBar(metrics.primaryGoal)}</span>` : '<span class="tt-empty">No goal</span>'}</td>
      <td>${renderPulseDots(metrics.pulseSeries, { emptyHtml: '<span class="tt-empty">No pulse</span>' })}</td>
      <td><span class="tt-actions">
        <button type="button" class="tt-action-btn" data-open-room="${escapeHtml(report.id)}" title="Open the 1:1 meeting room">1:1 room</button>
        <button type="button" class="tt-action-btn" data-table-log="${escapeHtml(report.id)}" title="Log a meeting without the room">Log meeting</button>
      </span></td>
    </tr>`;
  };
  const group = (label, tone, reports) => reports.length
    ? `<tr class="team-table-group" data-tone="${tone}"><td colspan="9"><span class="team-table-group-label">${escapeHtml(label)} <span class="team-table-group-count">· ${reports.length}</span></span></td></tr>${reports.map(row).join('')}`
    : '';
  return `<div class="team-table-wrap"><table class="team-table">
    <thead><tr>
      <th scope="col">Person</th><th scope="col">PDC status</th><th scope="col">Support</th><th scope="col">Last 1:1</th><th scope="col">Next 1:1</th><th scope="col">Follow-ups</th><th scope="col">Goal</th><th scope="col">Pulse</th><th scope="col"></th>
    </tr></thead>
    <tbody>
      ${group('Needs attention', 'danger', needsAttention)}
      ${group('On track', 'success', onTrack)}
    </tbody>
  </table></div>`;
}

function getSortedReports() {
  // Reuse attention-first ordering that the table uses if possible; fall back to alphabetical.
  const reports = getReports();
  return [...reports].sort((a, b) => {
    const ma = getMetrics(a.id);
    const mb = getMetrics(b.id);
    const aAtt = (ma.oneOnOneOverdue ? 1 : 0) + (ma.pdcOverdue ? 1 : 0) + (ma.cvReviewOverdue ? 1 : 0);
    const bAtt = (mb.oneOnOneOverdue ? 1 : 0) + (mb.pdcOverdue ? 1 : 0) + (mb.cvReviewOverdue ? 1 : 0);
    if (aAtt !== bAtt) return bAtt - aAtt;
    return (a.name || '').localeCompare(b.name || '');
  });
}

// Tiny 12-week rhythm bars for a report tile (Overview.html): 3px bars on a
// 7px pitch, 18px high. One meeting is 10px, the busiest week reaches 18px
// (two meetings or more). Weeks with no meeting are 2px stubs. The colors
// come from the classes (06-overview-and-reports.css).
function renderTileSparkline(report) {
  const buckets = buildWeeklyMeetingBuckets(report.meetings || [], 12);
  const max = Math.max(2, ...buckets.map((b) => b.count));
  const BAR = 3;
  const PITCH = 7;
  const H = 18;
  const STUB = 2;
  const width = (buckets.length - 1) * PITCH + BAR;
  const bars = buckets.map((b, i) => {
    const tip = `<title>${escapeHtml(`${b.count} meeting${b.count === 1 ? '' : 's'} · week of ${formatDate(b.key)}`)}</title>`;
    if (b.count === 0) return `<rect class="tile-spark-stub" x="${i * PITCH}" y="${H - STUB}" width="${BAR}" height="${STUB}" rx="1">${tip}</rect>`;
    const h = Math.round(STUB + ((H - STUB) * b.count) / max);
    return `<rect class="tile-spark-bar" x="${i * PITCH}" y="${H - h}" width="${BAR}" height="${h}" rx="1.5">${tip}</rect>`;
  }).join('');
  // The label keeps its wording and adds the 12-week total, since the
  // per-week <title>s are hidden inside role="img".
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const label = `Meetings per week, last 12 weeks: ${total} meeting${total === 1 ? '' : 's'}`;
  return `<svg class="tile-spark" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-label="${escapeHtml(label)}">${bars}</svg>`;
}
