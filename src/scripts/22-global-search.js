// ============================================================================
// Global search: a second navigation dimension. One field searches people,
// full meeting note text, follow-ups, development fields, evidence, and every
// view and action, with grouped clickable results. Click-first by design; the
// slash key and Ctrl/Cmd+K are optional accelerators.
// ============================================================================
const globalSearchEl = document.getElementById('globalSearch');
const globalSearchInputEl = document.getElementById('globalSearchInput');
const globalSearchResultsEl = document.getElementById('globalSearchResults');
let gsResults = [];
let gsActiveIndex = 0;
let gsDebounce = 0;

function personInitials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

// Escapes around a case-insensitive hit and wraps the hit in <mark>.
function searchSnippet(text, query, radius = 46) {
  const raw = normalizeText(text).replace(/\s+/g, ' ');
  const idx = raw.toLowerCase().indexOf(query);
  if (idx < 0) {
    const head = raw.slice(0, radius * 2);
    return escapeHtml(head) + (raw.length > head.length ? '…' : '');
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(raw.length, idx + query.length + radius);
  const pre = (start > 0 ? '…' : '') + raw.slice(start, idx);
  const hit = raw.slice(idx, idx + query.length);
  const post = raw.slice(idx + query.length, end) + (end < raw.length ? '…' : '');
  return `${escapeHtml(pre)}<mark>${escapeHtml(hit)}</mark>${escapeHtml(post)}`;
}

// Opens a person's workspace on a specific tab (search deep links).
function openWorkspaceTab(reportId, tab) {
  if (!selectReport(reportId)) return;
  if (DETAIL_DRAWER_TABS.includes(tab)) {
    app.ui.detailDrawerTab = tab;
    persistUiState();
    renderDetailDrawer();
  }
}

function gsGoMain(view, extra = {}) {
  if (!MAIN_VIEWS.includes(view)) return;
  if (extra.boardMode !== undefined) app.ui.pdcViewMode = extra.boardMode ? 'board' : 'list';
  if (extra.teamHealthTab && TEAM_HEALTH_TABS.includes(extra.teamHealthTab)) app.ui.teamHealthTab = extra.teamHealthTab;
  app.ui.mainView = view;
  app.ui.selectedId = null;
  app.ui.creatingReport = false;
  persistUiState();
  if (view === 'settings') {
    render();
    openRulesDrawer();
    return;
  }
  render();
}

function buildGoToEntries() {
  return [
    { label: 'Overview', meta: 'Team Health', run: () => gsGoMain('teamHealth', { teamHealthTab: 'overview' }) },
    { label: 'Insights', meta: 'Team Health', run: () => gsGoMain('teamHealth', { teamHealthTab: 'insights' }) },
    { label: 'Direct Reports', meta: 'View', run: () => gsGoMain('reports') },
    { label: 'Meetings', meta: 'View', run: () => gsGoMain('meetings') },
    { label: 'Follow-Ups', meta: 'View', run: () => gsGoMain('followUps') },
    { label: 'PDC Summary', meta: 'List view', run: () => gsGoMain('pdcSummary', { boardMode: false }) },
    { label: 'PDC Board', meta: 'Kanban view', run: () => gsGoMain('pdcSummary', { boardMode: true }) },
    { label: 'Settings', meta: 'View', run: () => gsGoMain('settings') },
    { label: 'Add direct report', meta: 'Action', run: () => openCreateWorkspace() },
    { label: 'Export data now', meta: 'Action', run: () => exportPlainFiles() }
  ];
}

function gsPersonResult(report, group) {
  const metrics = getMetrics(report.id);
  return {
    group,
    avatarId: report.id,
    avatarName: report.name,
    title: report.name || 'Unnamed',
    meta: `${report.initials ? `${report.initials} · ` : ''}${report.level || 'Level not set'} · PDC ${metrics.pdcStatus}`,
    snippet: '',
    run: () => selectReport(report.id)
  };
}

function runGlobalSearch(rawQuery) {
  const query = normalizeText(rawQuery).toLowerCase();
  const results = [];
  const reports = getReports();

  if (!query) {
    buildGoToEntries().forEach((entry) => results.push({ group: 'Jump to', title: entry.label, meta: entry.meta, snippet: '', run: entry.run }));
    const recent = [...reports]
      .filter((r) => getMetrics(r.id).lastInteraction)
      .sort((a, b) => (getMetrics(b.id).lastInteraction || '').localeCompare(getMetrics(a.id).lastInteraction || ''))
      .slice(0, 3);
    recent.forEach((r) => results.push(gsPersonResult(r, 'Recently active')));
    return results;
  }

  // People
  reports
    .filter((r) => `${r.name || ''} ${r.initials || ''} ${r.level || ''} ${r.mentors || ''}`.toLowerCase().includes(query))
    .slice(0, 5)
    .forEach((r) => results.push(gsPersonResult(r, 'People')));

  // Meetings: full note text, newest first
  const meetingHits = [];
  reports.forEach((r) => {
    (r.meetings || []).forEach((m) => {
      const blob = `${r.name || ''} ${m.meetingType || ''} ${m.notes || ''}`.toLowerCase();
      if (blob.includes(query)) meetingHits.push({ r, m });
    });
  });
  meetingHits
    .sort((a, b) => (b.m.meetingDate || '').localeCompare(a.m.meetingDate || ''))
    .slice(0, 5)
    .forEach(({ r, m }) => results.push({
      group: 'Meetings',
      avatarId: r.id,
      avatarName: r.name,
      title: `${r.name || 'Unnamed'} · ${m.meetingType || '1:1'}`,
      meta: formatDate(m.meetingDate),
      snippet: searchSnippet(m.notes || '', query),
      run: () => openReportMeetingsAt(r.id, m.id)
    }));

  // Follow-ups: open first
  const followUpHits = [];
  reports.forEach((r) => {
    (getMetrics(r.id).followUps || []).forEach((item) => {
      if ((item.text || '').toLowerCase().includes(query)) followUpHits.push({ r, item });
    });
  });
  followUpHits
    .sort((a, b) => Number(a.item.done) - Number(b.item.done) || (b.item.meetingDate || '').localeCompare(a.item.meetingDate || ''))
    .slice(0, 5)
    .forEach(({ r, item }) => results.push({
      group: 'Follow-ups',
      avatarId: r.id,
      avatarName: r.name,
      title: `${item.done ? 'Done' : 'Open'} · ${r.name || 'Unnamed'}`,
      meta: `${item.meetingType} · ${formatDate(item.meetingDate)}`,
      snippet: searchSnippet(item.text || '', query),
      run: () => openReportMeetingsAt(r.id, item.meetingId)
    }));

  // Development fields, manager notes, agenda, evidence
  const fieldHits = [];
  reports.forEach((r) => {
    [
      ['Development goals', normalizeGoals(r.goals || []).map((goal) => `${goal.title} ${goal.detail}`.trim()).join(' · '), 'pdc-summary'],
      ['Promotion readiness', r.promotionReadiness, 'pdc-summary'],
      ['Talking points', openTalkingPointsFor(r).map((point) => point.text).join(' · '), 'meetings'],
      ['Manager notes', r.notes, 'pdc-summary']
    ].forEach(([label, value, tab]) => {
      if (normalizeText(value).toLowerCase().includes(query)) fieldHits.push({ r, label, value, tab });
    });
    (r.evidence || []).forEach((entry) => {
      const blob = `${entry.summary || ''} ${entry.detail || ''}`.toLowerCase();
      if (blob.includes(query)) fieldHits.push({ r, label: `Evidence · ${normalizeText(entry.category) || 'Uncategorized'}`, value: `${entry.summary || ''} ${entry.detail || ''}`, tab: 'pdc-summary' });
    });
  });
  fieldHits.slice(0, 6).forEach(({ r, label, value, tab }) => results.push({
    group: 'Development & notes',
    avatarId: r.id,
    avatarName: r.name,
    title: `${label} · ${r.name || 'Unnamed'}`,
    meta: '',
    snippet: searchSnippet(value, query),
    run: () => openWorkspaceTab(r.id, tab)
  }));

  // Views and actions
  buildGoToEntries()
    .filter((entry) => entry.label.toLowerCase().includes(query))
    .slice(0, 4)
    .forEach((entry) => results.push({ group: 'Go to', title: entry.label, meta: entry.meta, snippet: '', run: entry.run }));

  return results;
}

// The results follow the combobox and listbox pattern: focus stays in the
// field, the arrow keys move the active option (aria-activedescendant), and
// each group of rows is a labelled group. The rows are left out of the Tab
// order (tabindex -1), so there is only ever one active row: the first row,
// or the one the arrow keys last picked. Hovering a row only highlights it
// (CSS); Enter always runs the active row, as before. With no match the list
// is hidden and the message goes to the status region under it, so it is read
// out.
function renderGlobalSearchResults() {
  gsResults = runGlobalSearch(globalSearchInputEl.value);
  gsActiveIndex = 0;
  const statusEl = document.getElementById('globalSearchStatus');
  if (!gsResults.length) {
    globalSearchResultsEl.replaceChildren();
    globalSearchResultsEl.hidden = true;
    globalSearchInputEl.setAttribute('aria-expanded', 'false');
    globalSearchInputEl.removeAttribute('aria-activedescendant');
    const emptyEl = document.createElement('p');
    emptyEl.className = 'gs-empty';
    emptyEl.textContent = `No matches for "${normalizeText(globalSearchInputEl.value)}".`;
    statusEl?.replaceChildren(emptyEl);
    return;
  }
  statusEl?.replaceChildren();
  let html = '';
  let lastGroup = '';
  let groupIndex = -1;
  gsResults.forEach((res, i) => {
    if (res.group !== lastGroup) {
      if (groupIndex >= 0) html += '</div>';
      groupIndex += 1;
      html += `<div class="gs-section" role="group" aria-labelledby="gs-grp-${groupIndex}"><div class="gs-group" id="gs-grp-${groupIndex}" role="presentation">${escapeHtml(res.group)}</div>`;
      lastGroup = res.group;
    }
    const iconHtml = res.avatarId
      ? `<span class="gs-avatar" aria-hidden="true">${escapeHtml(personInitials(res.avatarName || res.title))}</span>`
      : `<span class="gs-icon" aria-hidden="true">→</span>`;
    html += `<button type="button" class="gs-row${i === gsActiveIndex ? ' active' : ''}" role="option" id="gs-opt-${i}" aria-selected="${i === gsActiveIndex ? 'true' : 'false'}" tabindex="-1" data-gs-index="${i}">
      ${iconHtml}
      <span class="gs-main">
        <span class="gs-title">${escapeHtml(res.title)}</span>
        ${res.snippet ? `<span class="gs-snippet">${res.snippet}</span>` : ''}
      </span>
      ${res.meta ? `<span class="gs-meta">${escapeHtml(res.meta)}</span>` : ''}
    </button>`;
  });
  if (groupIndex >= 0) html += '</div>';
  globalSearchResultsEl.innerHTML = html;
  globalSearchResultsEl.hidden = false;
  globalSearchInputEl.setAttribute('aria-expanded', 'true');
  globalSearchInputEl.setAttribute('aria-activedescendant', `gs-opt-${gsActiveIndex}`);
}

function gsUpdateActiveRow() {
  let activeRow = null;
  globalSearchResultsEl.querySelectorAll('.gs-row').forEach((row) => {
    const isActive = Number(row.getAttribute('data-gs-index')) === gsActiveIndex;
    row.classList.toggle('active', isActive);
    row.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) activeRow = row;
  });
  if (!activeRow) {
    globalSearchInputEl.removeAttribute('aria-activedescendant');
    return;
  }
  globalSearchInputEl.setAttribute('aria-activedescendant', activeRow.id);
  activeRow.scrollIntoView({ block: 'nearest' });
}

// The element that had focus before search opened, so closing search with
// Escape or a click outside puts focus back where it was.
let gsReturnFocusEl = null;

function openGlobalSearch() {
  if (!app.connectedFolderReady || !app.doc) return;
  const activeEl = document.activeElement;
  gsReturnFocusEl = activeEl && activeEl !== document.body && !globalSearchEl.contains(activeEl) ? activeEl : null;
  globalSearchEl.classList.add('open');
  globalSearchEl.setAttribute('aria-hidden', 'false');
  syncBodyOverlayLock();
  globalSearchInputEl.value = '';
  renderGlobalSearchResults();
  globalSearchInputEl.focus();
}

function closeGlobalSearch(restoreFocus = true) {
  globalSearchEl.classList.remove('open');
  globalSearchEl.setAttribute('aria-hidden', 'true');
  globalSearchInputEl.setAttribute('aria-expanded', 'false');
  globalSearchInputEl.removeAttribute('aria-activedescendant');
  globalSearchInputEl.blur();
  syncBodyOverlayLock();
  const returnEl = gsReturnFocusEl;
  gsReturnFocusEl = null;
  if (restoreFocus && returnEl && returnEl.isConnected && !returnEl.disabled) returnEl.focus({ preventScroll: true });
}

function runGsResult(index) {
  const res = gsResults[index];
  if (!res) return;
  closeGlobalSearch(false);
  res.run();
}

