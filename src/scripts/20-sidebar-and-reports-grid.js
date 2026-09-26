// Unified sidebar renderer — replaces the old 3-pane list-pane system.
// Renders all nav items (Team Health sub-views, Direct Reports, Meetings, Settings)
// in a single dark sidebar with full names.
function renderSidebar() {
  const mount = document.getElementById('sidebarNav');
  if (!mount) return;
  const ready = !!app.folderHandle && app.connectedFolderReady && !!app.doc;
  if (!ready) { mount.innerHTML = ''; return; }
  const mainView = MAIN_VIEWS.includes(app.ui.mainView) ? app.ui.mainView : 'teamHealth';
  const thTab = currentTeamHealthTab();
  const reports = getReports();
  const reportCount = reports.length;
  const attentionCount = reports.filter((r) => {
    const m = getMetrics(r.id);
    return m.oneOnOneOverdue || m.pdcOverdue || m.cvReviewOverdue;
  }).length;
  const openFollowUpsTotal = reports.reduce((sum, r) => sum + ((getMetrics(r.id).openFollowUps || []).length), 0);

  const thIcon = (tab) => {
    switch (tab) {
      case 'overview':  return '<svg viewBox="0 0 24 24"><path d="M3 12h3l2-5 4 10 2-5h7"/></svg>';
      case 'cadence':   return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
      case 'attention': return '<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>';
      case 'support':   return '<svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6"/></svg>';
      case 'insights':  return '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';
      default:          return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg>';
    }
  };

  const teamHealthItems = TEAM_HEALTH_TABS.map((tab, tabIndex) => {
    const isActive = mainView === 'teamHealth' && tab === thTab;
    let badge = '';
    if (tab === 'attention' && attentionCount > 0) {
      badge = `<span class="sidebar-item-badge" data-tone="warning">${attentionCount}</span>`;
    }
    return `<button type="button" class="sidebar-item sub${isActive ? ' active' : ''}" data-nav-team-health="${escapeHtml(tab)}" aria-pressed="${isActive}" title="${escapeHtml(`${TEAM_HEALTH_TAB_LABELS[tab]} · press ${tabIndex + 1}`)}">
      ${thIcon(tab)}
      <span>${escapeHtml(TEAM_HEALTH_TAB_LABELS[tab])}</span>
      ${badge}
    </button>`;
  }).join('');

  const reportsBadge = reportCount > 0 ? `<span class="sidebar-item-badge">${reportCount}</span>` : '';
  const followUpsBadge = openFollowUpsTotal > 0 ? `<span class="sidebar-item-badge" data-tone="warning">${openFollowUpsTotal}</span>` : '';
  const isReports = mainView === 'reports';
  const isMeetings = mainView === 'meetings' || mainView === 'meetingRoom';
  const isFollowUps = mainView === 'followUps';
  const isPdcSummary = mainView === 'pdcSummary';
  const isSettings = mainView === 'settings';

  mount.innerHTML = `
    <div class="sidebar-group">
      <div class="sidebar-group-label">Team Health</div>
      ${teamHealthItems}
    </div>
    <div class="sidebar-group">
      <div class="sidebar-group-label">People</div>
      <button type="button" class="sidebar-item${isReports ? ' active' : ''}" data-nav-main="reports" aria-pressed="${isReports}" title="Direct Reports · press 3">
        <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.8-3.3 3.3-5 6-5s5.2 1.7 6 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.2 14c2.4.1 4.5 1.6 5.8 4.5"/></svg>
        <span>Direct Reports</span>
        ${reportsBadge}
      </button>
      <button type="button" class="sidebar-item${isMeetings ? ' active' : ''}" data-nav-main="meetings" aria-pressed="${isMeetings}" title="Meetings · press 4">
        <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
        <span>Meetings</span>
      </button>
      <button type="button" class="sidebar-item${isFollowUps ? ' active' : ''}" data-nav-main="followUps" aria-pressed="${isFollowUps}" title="Follow-Ups · press 5">
        <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <span>Follow-Ups</span>
        ${followUpsBadge}
      </button>
      <button type="button" class="sidebar-item${isPdcSummary ? ' active' : ''}" data-nav-main="pdcSummary" aria-pressed="${isPdcSummary}" title="PDC Summary · press 6">
        <svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13h6M9 17h6"/></svg>
        <span>PDC Summary</span>
      </button>
    </div>
    <div class="sidebar-spacer"></div>
    <div class="sidebar-group">
      <button type="button" class="sidebar-item${isSettings ? ' active' : ''}" data-nav-main="settings" aria-pressed="${isSettings}" title="Settings · press 7">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.24 16.97l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.33.22.69.22 1.05 0 .86.7 1.55 1.55 1.55H21a2 2 0 1 1 0 4h-.05A1.7 1.7 0 0 0 19.4 15z"/></svg>
        <span>Settings</span>
      </button>
    </div>
  `;
}

function renderReportsGrid() {
  const mount = document.getElementById('reportsGrid');
  if (!mount) return;
  const gridVisible = app.ui.mainView === 'reports' && !app.ui.selectedId && !app.ui.creatingReport;
  mount.classList.toggle('anim-entry', viewJustEntered('reportsGrid', gridVisible));
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
  if (viewMode === 'table') {
    mount.innerHTML = renderReportsTableHtml(filtered, total);
    return;
  }

  const tiles = filtered.map((report, tileIndex) => {
    const metrics = getMetrics(report.id);
    const fill = supportLevelFill(report.supportLevel);
    const level = report.level || 'Level not set';
    const mentor = report.mentors ? `Mentor: ${report.mentors}` : '';
    const chips = [];
    if (metrics.oneOnOneOverdue) chips.push(`<span class="report-tile-chip">1:1 overdue</span>`);
    if (metrics.pdcOverdue) chips.push(`<span class="report-tile-chip">PDC overdue</span>`);
    if (metrics.cvReviewOverdue) chips.push(`<span class="report-tile-chip">CV overdue</span>`);
    const openFollowUps = (metrics.openFollowUps || []).length;
    if (openFollowUps) chips.push(`<span class="report-tile-chip" data-tone="info">${openFollowUps} follow-up${openFollowUps === 1 ? '' : 's'}</span>`);
    if (report.supportLevel === 'Urgent') chips.push(`<span class="report-tile-chip" data-tone="danger">Urgent</span>`);
    else if (report.supportLevel === 'Support needed') chips.push(`<span class="report-tile-chip" data-tone="danger">Support needed</span>`);
    else if (report.supportLevel === 'Monitor') chips.push(`<span class="report-tile-chip" data-tone="info">Monitor</span>`);
    else if (report.supportLevel === 'Good' && chips.length === 0) chips.push(`<span class="report-tile-chip" data-tone="good">On track</span>`);
    const initials = (report.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
    // Company initials are the tile title when present: short, uniform, and
    // immune to the truncation that crushed long names next to the 1:1 room
    // pill. The full name moves to its own full-width line underneath, where
    // it has the whole tile to itself. People without initials keep the name
    // as the title, exactly as before.
    const tileTitle = report.initials || report.name || 'Unnamed';
    return `<button type="button" class="report-tile" data-report-card="${escapeHtml(report.id)}" style="--i:${Math.min(tileIndex, 14)}">
      <div class="report-tile-head">
        <div class="report-tile-avatar" style="view-transition-name:vt-${escapeHtml(report.id)};${avatarGradient(report.id)}">${escapeHtml(initials)}</div>
        <span class="report-tile-name" ${report.initials && report.name ? `title="${escapeHtml(report.name)}"` : ''}>${escapeHtml(tileTitle)}</span>
        <span class="tile-room-btn" data-open-room="${escapeHtml(report.id)}" role="button" tabindex="0" title="Open the 1:1 meeting room">1:1 room</span>
        <span class="report-tile-support-dot" data-fill="${escapeHtml(fill)}" aria-hidden="true"></span>
      </div>
      <div class="report-tile-meta">
        ${report.initials && report.name ? `<span class="report-tile-meta-line report-tile-fullname">${escapeHtml(report.name)}</span>` : ''}
        <span class="report-tile-meta-line">${escapeHtml(level)}</span>
        ${mentor ? `<span class="report-tile-meta-line">${escapeHtml(mentor)}</span>` : ''}
      </div>
      ${renderTileSparkline(report)}
      ${(metrics.pulseSeries || []).length || metrics.primaryGoal ? `<div class="report-tile-vitals">
        ${renderPulseDots(metrics.pulseSeries, { emptyHtml: '' })}
        ${metrics.primaryGoal ? `<span class="report-tile-goal" title="${escapeHtml(metrics.primaryGoal.title)}">${renderGoalProgressBar(metrics.primaryGoal, { compact: true })}</span>` : ''}
      </div>` : ''}
      ${chips.length ? `<div class="report-tile-chips">${chips.join('')}</div>` : ''}
    </button>`;
  }).join('');

  const addTile = `<button type="button" class="report-tile-add" data-report-add style="--i:${Math.min(filtered.length, 14)}">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
    <span>Add direct report</span>
  </button>`;

  if (filtered.length === 0) {
    const filtersActive = !!(app.ui.searchTerm || app.ui.planFilter || app.ui.attentionFilter || currentThemeFilter());
    mount.innerHTML = total > 0 && filtersActive
      ? `<p class="help-text" style="grid-column:1/-1;padding:12px">No direct reports match the current filters.</p>`
      : `${addTile}`;
    return;
  }
  mount.innerHTML = `${tiles}${addTile}`;
}

// Monday-style table lens for Direct Reports: grouped by attention state,
// solid status pills editable inline, next 1:1 editable in place. Same
// filtered set as the tiles, so search and toolbar filters apply here too.
function renderReportsTableHtml(filtered, total) {
  if (!filtered.length) {
    const filtersActive = !!(app.ui.searchTerm || app.ui.planFilter || app.ui.attentionFilter || currentThemeFilter());
    return total > 0 && filtersActive
      ? '<p class="help-text" style="padding:12px">No direct reports match the current filters.</p>'
      : '<p class="help-text" style="padding:12px">No direct reports yet. Use + Add direct report in the toolbar.</p>';
  }
  const needsAttention = filtered.filter((report) => (getMetrics(report.id).attentionDetails || []).length > 0);
  const onTrack = filtered.filter((report) => (getMetrics(report.id).attentionDetails || []).length === 0);
  const pillSelect = (attr, reportId, options, current, kind) => `<select class="pill-select" ${attr}="${escapeHtml(reportId)}" data-pill-kind="${kind}" data-pill-value="${escapeHtml(current)}" aria-label="${kind === 'pdc' ? 'PDC status' : 'Support level'}">${options.map((option) => `<option value="${escapeHtml(option)}" ${option === current ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>`;
  const row = (report) => {
    const metrics = getMetrics(report.id);
    const initials = (report.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
    const pdcValue = normalizePdcStatus(report.rawPdcStatus !== undefined ? report.rawPdcStatus : report.pdcStatus);
    const supportValue = normalizeSupportLevel(report.supportLevel);
    const openFu = (metrics.openFollowUps || []).length;
    const lastText = metrics.lastOneOnOne ? formatDate(metrics.lastOneOnOne) : 'Never';
    const attentionTitle = (metrics.attentionDetails || []).map((item) => item.label).join(', ');
    return `<tr data-table-row="${escapeHtml(report.id)}">
      <td><button type="button" class="tt-person" data-table-person="${escapeHtml(report.id)}" ${attentionTitle ? `title="${escapeHtml(attentionTitle)}"` : ''}>
        <span class="tt-avatar" style="${avatarGradient(report.id)}">${escapeHtml(initials)}</span>
        <span><span class="tt-person-name">${escapeHtml(report.name || 'Unnamed')}</span><span class="tt-sub">${escapeHtml(`${report.initials ? `${report.initials} · ` : ''}${report.level || 'Level not set'}`)}</span></span>
      </button></td>
      <td>${pillSelect('data-table-pdc', report.id, PDC_STATUSES, pdcValue, 'pdc')}</td>
      <td>${pillSelect('data-table-support', report.id, SUPPORT_LEVELS, supportValue, 'support')}</td>
      <td><span class="${metrics.oneOnOneOverdue ? 'tt-overdue' : ''}">${escapeHtml(lastText)}</span></td>
      <td class="tt-date"><input type="date" data-table-next="${escapeHtml(report.id)}" value="${escapeHtml(report.nextOneOnOneDate || '')}" aria-label="Next planned 1:1"></td>
      <td><span class="tt-count${openFu ? '' : ' zero'}">${openFu}</span></td>
      <td>${metrics.primaryGoal ? `<span title="${escapeHtml(metrics.primaryGoal.title)}">${renderGoalProgressBar(metrics.primaryGoal, { compact: true })}</span>` : '<span class="tt-empty">No goal</span>'}</td>
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
      <th>Person</th><th>PDC status</th><th>Support</th><th>Last 1:1</th><th>Next 1:1</th><th>Follow-ups</th><th>Goal</th><th>Pulse</th><th></th>
    </tr></thead>
    <tbody>
      ${group('Needs attention', 'danger', needsAttention)}
      ${group('On track', 'success', onTrack)}
    </tbody>
  </table></div>`;
}

function supportLevelFill(level) {
  if (level === 'Urgent') return 'red';
  if (level === 'Support needed') return 'amber';
  if (level === 'Monitor') return 'blue';
  if (level === 'Good') return 'green';
  return 'grey';
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

