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

// Deterministic per-person identity gradient derived from the stable person
// id, so the grid tile, PDC card, and workspace header all share one color
// and the app becomes scannable by color memory. Purely cosmetic, no data.
function avatarGradient(personId) {
  let hash = 5381;
  const s = String(personId || '');
  for (let i = 0; i < s.length; i += 1) hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  const hue = ((hash % 360) + 360) % 360;
  const hue2 = (hue + 42) % 360;
  return `background:linear-gradient(135deg,hsl(${hue} 72% 56%),hsl(${hue2} 78% 46%))`;
}

// Wraps a navigation-level DOM update in the View Transitions API so view
// switches crossfade and same-named elements morph between states. Only
// user-gesture navigation goes through here: frequent in-place re-renders
// (search debounce, draft typing) call render functions directly so text
// entry never flickers. Falls back to a plain synchronous update when the
// API is unavailable or the user prefers reduced motion. Callers must not
// rely on the DOM being updated synchronously after this returns.
function navigateRender(update) {
  const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stableMode = !!app.doc?.settings?.stableMode;
  if (typeof document.startViewTransition === 'function' && !reduceMotion && !stableMode) {
    // v0.52.2: park the ambient canvas while the transition plays. The rAF
    // loop was competing with snapshot compositing for frame budget, and
    // the canvas is frozen behind its own vt-ambient snapshot during the
    // transition anyway, so pausing costs nothing visually.
    window.TP_AMBIENT?.pause?.();
    const transition = document.startViewTransition(() => { update(); });
    const resume = () => window.TP_AMBIENT?.resume?.();
    if (transition?.finished?.finally) transition.finished.finally(resume); else resume();
  } else {
    update();
  }
}

function render() {
  // v0.52.0: let the ambient atmosphere read the latest team state on every
  // render pass. Cheap (counts over app.doc.people) and safe pre-connection.
  window.TP_AMBIENT?.syncFromState();
  const ready = !!app.folderHandle && app.connectedFolderReady && !!app.doc;
  if (ready) closeStartupPrompt();
  if (ready) maybeResetPdcRoundOnRollover();
  document.body.classList.toggle('stable-mode', !!app.doc?.settings?.stableMode);
  document.body.classList.toggle('density-compact', app.doc?.settings?.density === 'compact');

  // Inline startup gate is only used as a fallback when the modal flow isn't shown
  // (e.g. on browsers without File System Access API, where the modal's primary
  // action would be useless). When the modal is available, it becomes the sole UX
  // so there's no duplicate "Choose a Team Pulse Folder" UI underneath it.
  const modalWillShow = !ready && supportsDirectoryAccess();
  const showInlineGate = !ready && !modalWillShow;
  startupGateEl.classList.toggle('hidden', !showInlineGate);
  const appShellEl = document.getElementById('appShell');
  const contentHeaderEl = document.getElementById('contentHeader');
  const sidebarEl = document.getElementById('sidebar');
  if (sidebarEl) sidebarEl.style.display = ready ? '' : 'none';
  if (contentHeaderEl) contentHeaderEl.hidden = !ready;
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

  // Update content header title.
  const headerTitleEl = document.getElementById('contentHeaderTitle');
  const headerSubEl = document.getElementById('contentHeaderSubtitle');
  const reportCount = getReports().length;
  const reportLabel = reportCount === 1 ? 'direct report' : 'direct reports';
  if (mainView === 'teamHealth') {
    const tab = currentTeamHealthTab();
    const label = TEAM_HEALTH_TAB_LABELS[tab] || 'Team Health';
    if (headerTitleEl) headerTitleEl.textContent = label;
    const subs = {
      overview: `${reportCount} ${reportLabel} · quick scan before opening a workspace`,
      cadence: `How the team is tracking on 1:1, PDC, and CV review rhythms`,
      attention: `What's driving attention across the team, by rule`,
      support: `Distribution of manager-assessed support levels across the team`,
      insights: `Tenure river and recent themes across the team`
    };
    if (headerSubEl) headerSubEl.textContent = subs[tab] || '';
  } else if (mainView === 'reports') {
    const sel = app.ui.selectedId ? getReportById(app.ui.selectedId) : null;
    if (headerTitleEl) headerTitleEl.textContent = sel ? sel.name : (app.ui.creatingReport ? 'New direct report' : 'Direct Reports');
    if (headerSubEl) headerSubEl.textContent = sel ? (sel.level || 'Workspace') : (app.ui.creatingReport ? 'Fill in the profile' : `${reportCount} ${reportLabel}`);
  } else if (mainView === 'meetings') {
    if (headerTitleEl) headerTitleEl.textContent = 'Meetings';
    if (headerSubEl) headerSubEl.textContent = 'All meetings across every direct report, newest first.';
  } else if (mainView === 'followUps') {
    if (headerTitleEl) headerTitleEl.textContent = 'Follow-Ups';
    if (headerSubEl) headerSubEl.textContent = 'Open action items from meeting notes across the team.';
  } else if (mainView === 'pdcSummary') {
    if (headerTitleEl) headerTitleEl.textContent = 'PDC Summary';
    if (headerSubEl) headerSubEl.textContent = `PDC outcomes across ${reportCount} ${reportLabel} — edit development focus and readiness right here.`;
  } else if (mainView === 'meetingRoom') {
    const roomReport = getReportById(app.ui.meetingRoomReportId);
    if (headerTitleEl) headerTitleEl.textContent = roomReport ? `1:1 room · ${roomReport.name}` : '1:1 meeting room';
    if (headerSubEl) headerSubEl.textContent = 'Prep, run, and wrap up the conversation in one place.';
  } else if (mainView === 'settings') {
    if (headerTitleEl) headerTitleEl.textContent = 'Settings';
    if (headerSubEl) headerSubEl.textContent = 'Overdue rules, data health, exports, backups.';
  }

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

  // Always render sections that compute data; the hidden attribute handles visibility.
  renderQuickFilterBar();
  renderTeamHealth();
  renderReportsGrid();
  renderMeetingsView();
  renderFollowUpsView();
  renderPdcSummaryView();
  renderMeetingRoomView();
  renderDetailDrawer();
  renderSettingsView();

  // Keep the browser tab in sync with the current view. Before a folder is
  // connected the header is hidden, so the tab shows the plain app name.
  const tabTitleEl = document.getElementById('contentHeaderTitle');
  const tabHeaderHidden = document.getElementById('contentHeader')?.hidden;
  document.title = !tabHeaderHidden && tabTitleEl?.textContent
    ? `${tabTitleEl.textContent} · Team Pulse`
    : 'Team Pulse';
}

function renderSettingsView() {
  const settingsSectionEl = document.getElementById('settingsSection');
  if (!settingsSectionEl || settingsSectionEl.hasAttribute('hidden')) return;
  const body = document.getElementById('settingsSectionBody');
  if (!body) return;
  body.innerHTML = `
    <div class="tile-link-row" data-settings-open="rules"><strong>Overdue rules, data health &amp; privacy</strong><span>Thresholds, toggles, exports, backups, Stable mode, and the disconnect &amp; wipe control.</span></div>
    <p class="help-text" style="margin-top:12px">Click the card above to open the full settings panel.</p>
  `;
}

