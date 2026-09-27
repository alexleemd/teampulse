// Tracks which collection views were visible on the previous render so entry
// animations (staggered tiles and cards) fire only when a view first appears,
// never on in-place re-renders like search keystrokes, filter changes, or
// saves. Each render function reports its visibility every pass.
const viewEntryState = new Map();
function viewJustEntered(viewKey, isVisibleNow) {
  const wasVisible = viewEntryState.get(viewKey) === true;
  viewEntryState.set(viewKey, isVisibleNow);
  return isVisibleNow && !wasVisible;
}

// Runs a navigation-level DOM update. Views switch instantly (no page fade),
// which is how Team Pulse always behaved with Stable mode on.
function navigateRender(update) {
  update();
}

// True when a view's section is hidden. Each view renderer returns early then,
// so render() only rebuilds the view that is on screen. Every way of showing a
// view goes through render(), which un-hides the section before it calls the
// renderers, so a view is always drawn fresh when it appears.
function viewSectionHidden(sectionId) {
  const sectionEl = document.getElementById(sectionId);
  return !sectionEl || sectionEl.hasAttribute('hidden');
}

function render() {
  const ready = !!app.folderHandle && app.connectedFolderReady && !!app.doc;
  if (ready) closeStartupPrompt();
  if (ready) maybeResetPdcRoundOnRollover();
  document.body.classList.toggle('density-compact', app.doc?.settings?.density === 'compact');

  // Inline startup gate is only used as a fallback when the modal flow isn't shown
  // (e.g. on browsers without File System Access API, where the modal's primary
  // action would be useless). When the modal is available, it becomes the sole UX
  // so there's no duplicate "Choose a Team Pulse Folder" UI underneath it.
  const modalWillShow = !ready && supportsDirectoryAccess();
  const showInlineGate = !ready && !modalWillShow;
  startupGateEl.classList.toggle('hidden', !showInlineGate);
  const appShellEl = document.getElementById('appShell');
  const sidebarEl = document.getElementById('sidebar');
  if (sidebarEl) sidebarEl.style.display = ready ? '' : 'none';
  // Without the sidebar the shell drops to one column so the startup gate and
  // the page behind the startup dialog use the full width.
  if (appShellEl) appShellEl.classList.toggle('shell-loading', !ready);
  // The header stays visible before a folder is connected, as it did in
  // v0.52.4: the "Team Health" title, Search (disabled below), the
  // "No folder connected" save status and the Data menu (Choose folder,
  // Import JSON). renderContentHeader() fills in the eyebrow and caption once
  // a folder is ready.
  document.querySelectorAll('.sidebar-item[data-nav-main],.sidebar-item[data-nav-team-health],#globalSearchTrigger').forEach((btn) => { btn.disabled = !ready; });

  updateFileUi();
  renderRuleInputs();
  renderSettingsPanel();
  renderExportReminderBanner();

  if (!ready) {
    // Hide all main-view sections; only startup gate shows.
    teamHealthSectionEl.setAttribute('hidden', '');
    reportsSectionEl.setAttribute('hidden', '');
    const meetingsSectionEl = document.getElementById('meetingsSection');
    if (meetingsSectionEl) meetingsSectionEl.setAttribute('hidden', '');
    const followUpsSectionEl = document.getElementById('followUpsSection');
    if (followUpsSectionEl) followUpsSectionEl.setAttribute('hidden', '');
    const pdcSummarySectionEl = document.getElementById('pdcSummarySection');
    if (pdcSummarySectionEl) pdcSummarySectionEl.setAttribute('hidden', '');
    const meetingRoomSectionEl = document.getElementById('meetingRoomSection');
    if (meetingRoomSectionEl) meetingRoomSectionEl.setAttribute('hidden', '');
    const settingsSectionEl = document.getElementById('settingsSection');
    if (settingsSectionEl) settingsSectionEl.setAttribute('hidden', '');
    renderDetailDrawer();
    return;
  }

  // Ready: route to the active main view. The meeting room needs a valid
  // person behind it; fall back if that person is gone.
  if (app.ui.mainView === 'meetingRoom' && !getReportById(app.ui.meetingRoomReportId)) {
    app.ui.mainView = MAIN_VIEWS.includes(app.ui.meetingRoomReturnView) && app.ui.meetingRoomReturnView !== 'meetingRoom' ? app.ui.meetingRoomReturnView : 'reports';
    app.ui.meetingRoomReportId = '';
  }
  const mainView = MAIN_VIEWS.includes(app.ui.mainView) ? app.ui.mainView : 'teamHealth';
  if (appShellEl) {
    appShellEl.setAttribute('data-main-view', mainView);
  }

  // Update the content header: eyebrow (the sidebar group of the view), the
  // title, and the caption line under it.
  renderContentHeader(mainView);

  // Toggle content-pane sections based on active view.
  const showTeamHealth = mainView === 'teamHealth';
  const showReports = mainView === 'reports';
  const showMeetings = mainView === 'meetings';
  const showFollowUps = mainView === 'followUps';
  const showPdcSummary = mainView === 'pdcSummary';
  const showMeetingRoom = mainView === 'meetingRoom';
  const showSettings = mainView === 'settings';
  teamHealthSectionEl.toggleAttribute('hidden', !showTeamHealth);
  reportsSectionEl.toggleAttribute('hidden', !showReports || !!app.ui.selectedId || app.ui.creatingReport);
  const meetingsSectionEl = document.getElementById('meetingsSection');
  if (meetingsSectionEl) meetingsSectionEl.toggleAttribute('hidden', !showMeetings);
  const followUpsSectionEl = document.getElementById('followUpsSection');
  if (followUpsSectionEl) followUpsSectionEl.toggleAttribute('hidden', !showFollowUps);
  const pdcSummarySectionEl = document.getElementById('pdcSummarySection');
  if (pdcSummarySectionEl) pdcSummarySectionEl.toggleAttribute('hidden', !showPdcSummary);
  const meetingRoomSectionEl = document.getElementById('meetingRoomSection');
  if (meetingRoomSectionEl) meetingRoomSectionEl.toggleAttribute('hidden', !showMeetingRoom);
  const settingsSectionEl = document.getElementById('settingsSection');
  if (settingsSectionEl) settingsSectionEl.toggleAttribute('hidden', !showSettings);

  // Detail drawer only renders content when on Reports view with a selection.
  const drawerVisible = showReports && (!!app.ui.selectedId || app.ui.creatingReport);
  if (!showReports) {
    detailDrawerEl.setAttribute('hidden', '');
    detailDrawerEl.replaceChildren();
  }
  const contentPaneEl = document.getElementById('contentPane');
  if (contentPaneEl) contentPaneEl.classList.toggle('drawer-active', drawerVisible);

  // Render the unified sidebar nav.
  renderSidebar();

  // Each view renderer skips its work while its section is hidden (see
  // viewSectionHidden), so only the view on screen is rebuilt here.
  renderQuickFilterBar();
  renderTeamHealth();
  renderReportsGrid();
  renderMeetingsView();
  renderFollowUpsView();
  renderPdcSummaryView();
  renderMeetingRoomView();
  renderDetailDrawer();
  renderSettingsView();

  // Keep the browser tab in sync with the current view (this only runs once a
  // folder is connected; before that the tab keeps the plain app name). The
  // 1:1 room keeps its "1:1 room · Name" tab title now that the h1 holds the
  // name alone.
  const tabTitleEl = document.getElementById('contentHeaderTitle');
  const tabTitle = mainView === 'meetingRoom' && getReportById(app.ui.meetingRoomReportId)
    ? `1:1 room · ${tabTitleEl?.textContent || ''}`
    : tabTitleEl?.textContent;
  document.title = tabTitle
    ? `${tabTitle} · Team Pulse`
    : 'Team Pulse';
}

// Sidebar group each main view sits in. The header shows it as the eyebrow.
// Settings has no group, so it shows no eyebrow.
const CONTENT_HEADER_EYEBROWS = Object.freeze({
  teamHealth: 'Team Health',
  reports: 'People',
  meetings: 'People',
  followUps: 'People',
  pdcSummary: 'People',
  meetingRoom: '1:1 room',
  settings: ''
});

function renderContentHeader(mainView) {
  const headerEyebrowEl = document.getElementById('contentHeaderEyebrow');
  const headerTitleEl = document.getElementById('contentHeaderTitle');
  const headerSubEl = document.getElementById('contentHeaderSubtitle');
  const headerNoteEl = document.getElementById('contentHeaderNote');
  const reportCount = getReports().length;
  const reportLabel = reportCount === 1 ? 'direct report' : 'direct reports';
  let title = '';
  let subtitle = '';
  let note = '';
  if (mainView === 'teamHealth') {
    const tab = currentTeamHealthTab();
    title = TEAM_HEALTH_TAB_LABELS[tab] || 'Team Health';
    const subs = {
      overview: `${reportCount} ${reportLabel} · quick scan before opening a workspace`,
      cadence: `How the team is tracking on 1:1, PDC, and CV review rhythms`,
      attention: `What's driving attention across the team, by rule`,
      support: `Distribution of manager-assessed support levels across the team`,
      insights: `Tenure river and recent themes across the team`
    };
    subtitle = subs[tab] || '';
  } else if (mainView === 'reports') {
    const sel = app.ui.selectedId ? getReportById(app.ui.selectedId) : null;
    title = sel ? sel.name : (app.ui.creatingReport ? 'New direct report' : 'Direct Reports');
    subtitle = sel ? (sel.level || 'Workspace') : (app.ui.creatingReport ? 'Fill in the profile' : `${reportCount} ${reportLabel}`);
  } else if (mainView === 'meetings') {
    title = 'Meetings';
    subtitle = 'All meetings across every direct report, newest first.';
  } else if (mainView === 'followUps') {
    title = 'Follow-Ups';
    subtitle = 'Open action items from meeting notes across the team.';
  } else if (mainView === 'pdcSummary') {
    title = 'PDC Summary';
    subtitle = `PDC outcomes across ${reportCount} ${reportLabel}. Edit development focus and readiness right here.`;
  } else if (mainView === 'meetingRoom') {
    // The 1:1 room: the person's name is the title (it appears once on the
    // page), with level and mentor on the line below. The old subtitle
    // sentence is helper copy, shown as a note under the header.
    const roomReport = getReportById(app.ui.meetingRoomReportId);
    title = roomReport ? (roomReport.name || 'Unnamed') : '1:1 meeting room';
    subtitle = roomReport ? `${roomReport.level || 'Level not set'}${roomReport.mentors ? ` · Mentor: ${roomReport.mentors}` : ''}` : '';
    note = 'Prep, run, and wrap up the conversation in one place.';
  } else if (mainView === 'settings') {
    title = 'Settings';
    subtitle = 'Overdue rules, data health, exports, backups.';
  }
  const eyebrow = CONTENT_HEADER_EYEBROWS[mainView] || '';
  // An empty eyebrow (Settings) keeps its line, so the title never jumps
  // between views.
  if (headerEyebrowEl) headerEyebrowEl.textContent = eyebrow;
  if (headerTitleEl) headerTitleEl.textContent = title;
  if (headerSubEl) {
    headerSubEl.textContent = subtitle;
    headerSubEl.hidden = !subtitle;
  }
  if (headerNoteEl) {
    headerNoteEl.textContent = note;
    headerNoteEl.hidden = !note;
  }
}

function renderSettingsView() {
  const settingsSectionEl = document.getElementById('settingsSection');
  if (!settingsSectionEl || settingsSectionEl.hasAttribute('hidden')) return;
  const body = document.getElementById('settingsSectionBody');
  if (!body) return;
  // A real button, so the card works from the keyboard too. The click is
  // handled by the [data-settings-open] listener in bindStaticEvents.
  body.innerHTML = `
    <button type="button" class="settings-open-card" data-settings-open="rules">
      <span class="settings-open-card-text">
        <strong>Overdue rules, data health &amp; privacy</strong>
        <span>Thresholds, toggles, exports, backups, and the disconnect &amp; wipe control.</span>
      </span>
      <svg class="settings-open-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6"/></svg>
    </button>
    <p class="help-text">Click the card above to open the full settings panel.</p>
  `;
}

// Unified sidebar renderer — replaces the old 3-pane list-pane system.
// Renders all nav items (Team Health sub-views, Direct Reports, Meetings, Settings)
// in the Moss sidebar with full names. The current item carries
// aria-current="page"; Settings is pinned to the bottom in .sidebar-footer.
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

  // Icons from the Moss mockups: 24 grid, 1.8 stroke, round caps and joins.
  const navIcon = (paths) => `<svg class="sidebar-item-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  const thIcon = (tab) => {
    switch (tab) {
      case 'overview':  return navIcon('<path d="M3 12h3l2-5 4 10 2-5h7"/>');
      case 'cadence':   return navIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
      case 'attention': return navIcon('<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>');
      case 'support':   return navIcon('<path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6"/>');
      case 'insights':  return navIcon('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>');
      default:          return navIcon('<circle cx="12" cy="12" r="3"/>');
    }
  };
  const current = (isActive) => (isActive ? ' aria-current="page"' : '');

  const teamHealthItems = TEAM_HEALTH_TABS.map((tab, tabIndex) => {
    const isActive = mainView === 'teamHealth' && tab === thTab;
    let badge = '';
    if (tab === 'attention' && attentionCount > 0) {
      badge = `<span class="sidebar-item-badge" data-tone="warning">${attentionCount}</span>`;
    }
    return `<button type="button" class="sidebar-item sub${isActive ? ' active' : ''}" data-nav-team-health="${escapeHtml(tab)}"${current(isActive)} title="${escapeHtml(`${TEAM_HEALTH_TAB_LABELS[tab]} · press ${tabIndex + 1}`)}">
      ${thIcon(tab)}
      <span class="sidebar-item-label">${escapeHtml(TEAM_HEALTH_TAB_LABELS[tab])}</span>
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

  // The nav is rebuilt below. When one of its items has focus (a keyboard
  // user just pressed Enter on it), the same item in the new markup gets
  // focus back, so the next Tab carries on from there.
  const focusedEl = document.activeElement;
  const focusedHook = focusedEl && mount.contains(focusedEl)
    ? ['data-nav-main', 'data-nav-team-health'].find((name) => focusedEl.hasAttribute(name))
    : '';
  const refocusSelector = focusedHook ? `[${focusedHook}="${CSS.escape(focusedEl.getAttribute(focusedHook))}"]` : '';

  mount.innerHTML = `
    <div class="sidebar-group">
      <div class="sidebar-group-label">Team Health</div>
      ${teamHealthItems}
    </div>
    <div class="sidebar-group">
      <div class="sidebar-group-label">People</div>
      <button type="button" class="sidebar-item${isReports ? ' active' : ''}" data-nav-main="reports"${current(isReports)} title="Direct Reports · press 3">
        ${navIcon('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.8-3.3 3.3-5 6-5s5.2 1.7 6 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.2 14c2.4.1 4.5 1.6 5.8 4.5"/>')}
        <span class="sidebar-item-label">Direct Reports</span>
        ${reportsBadge}
      </button>
      <button type="button" class="sidebar-item${isMeetings ? ' active' : ''}" data-nav-main="meetings"${current(isMeetings)} title="Meetings · press 4">
        ${navIcon('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>')}
        <span class="sidebar-item-label">Meetings</span>
      </button>
      <button type="button" class="sidebar-item${isFollowUps ? ' active' : ''}" data-nav-main="followUps"${current(isFollowUps)} title="Follow-Ups · press 5">
        ${navIcon('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')}
        <span class="sidebar-item-label">Follow-Ups</span>
        ${followUpsBadge}
      </button>
      <button type="button" class="sidebar-item${isPdcSummary ? ' active' : ''}" data-nav-main="pdcSummary"${current(isPdcSummary)} title="PDC Summary · press 6">
        ${navIcon('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13h6M9 17h6"/>')}
        <span class="sidebar-item-label">PDC Summary</span>
      </button>
    </div>
    <div class="sidebar-group sidebar-footer">
      <button type="button" class="sidebar-item${isSettings ? ' active' : ''}" data-nav-main="settings"${current(isSettings)} title="Settings · press 7">
        ${navIcon('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>')}
        <span class="sidebar-item-label">Settings</span>
      </button>
    </div>
  `;
  if (refocusSelector) mount.querySelector(refocusSelector)?.focus({ preventScroll: true });
  sidebarRevealTarget = `${mainView}:${thTab}`;
  watchSidebarRowSize(mount);
  revealActiveSidebarItem(mount, sidebarRevealTarget);
}

// At phone and tablet widths the sidebar is a row that scrolls sideways. When
// the view changes, bring the current item into that row so "you are here"
// is always visible. Only the row itself scrolls (no smooth scrolling), and
// nothing happens while the whole row fits. The view counts as revealed only
// once the reveal ran on a row that overflows, so a view opened while the
// row fits (for example at desktop width, where the nav is a column) is
// still brought into view when the window later narrows: a ResizeObserver on
// the row runs the reveal again whenever the row changes size, and crossing
// the 900px breakpoint starts the reveal over (the column resets the scroll).
let sidebarRevealedKey = '';
let sidebarRevealTarget = '';
let sidebarRowWatched = false;
const sidebarRowQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 900px)') : null;
function watchSidebarRowSize(mount) {
  if (sidebarRowWatched) return;
  sidebarRowWatched = true;
  const rerun = () => { if (sidebarRevealTarget) revealActiveSidebarItem(mount, sidebarRevealTarget); };
  if (typeof ResizeObserver === 'function') new ResizeObserver(rerun).observe(mount);
  if (sidebarRowQuery && typeof sidebarRowQuery.addEventListener === 'function') {
    sidebarRowQuery.addEventListener('change', () => { sidebarRevealedKey = ''; rerun(); });
  }
}
function revealActiveSidebarItem(mount, key) {
  if (key === sidebarRevealedKey) return;
  // Above 900px the nav is a column that never scrolls sideways: skip the
  // layout read. Crossing the breakpoint resizes the row, which runs this again.
  if (sidebarRowQuery && !sidebarRowQuery.matches) return;
  const activeEl = mount.querySelector('.sidebar-item.active');
  if (!activeEl || mount.scrollWidth <= mount.clientWidth + 1) return;
  sidebarRevealedKey = key;
  const navRect = mount.getBoundingClientRect();
  const itemRect = activeEl.getBoundingClientRect();
  const inset = 16;
  if (itemRect.left < navRect.left + inset || itemRect.right > navRect.right - inset) {
    mount.scrollLeft += itemRect.left - navRect.left - inset;
  }
}
