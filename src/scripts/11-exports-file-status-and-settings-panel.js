

function buildMeetingsCsv() {
  const rows = ['date,type,person,duration,pulse,notes,source,created_at'];
  const meetings = [];
  getReports().forEach((report) => {
    (report.meetings || []).forEach((meeting) => {
      meetings.push({ ...meeting, personName: report.name });
    });
  });
  meetings.sort((a, b) => String(b.meetingDate).localeCompare(String(a.meetingDate)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  meetings.forEach((meeting) => {
    rows.push([
      csvCell(meeting.meetingDate || ''),
      csvCell(meeting.meetingType || ''),
      csvCell(meeting.personName || ''),
      csvCell(meeting.durationMinutes ?? ''),
      csvCell(normalizePulse(meeting.pulse)),
      csvCell(meeting.notes || ''),
      csvCell(meeting.source || ''),
      csvCell(meeting.createdAt || '')
    ].join(','));
  });
  return rows.join('\n');
}

function buildPeopleCsv() {
  const headers = ['name','initials','level','mentors','hire_date','last_promotion_date','next_planned_one_on_one','next_planned_pdc','pdc_status','support_level','development_goal_summary','promotion_readiness','next_agenda','goals','talking_points','notes','cadence_overrides','vacations','snoozes','additional_fields'];
  const rows = [headers.join(',')];
  [...getReports()].sort((a, b) => a.name.localeCompare(b.name)).forEach((report) => {
    rows.push([
      csvCell(report.name),
      csvCell(report.initials || ''),
      csvCell(report.level || ''),
      csvCell(report.mentors || ''),
      csvCell(report.hireDate || ''),
      csvCell(report.lastPromotionDate || ''),
      csvCell(report.nextOneOnOneDate || ''),
      csvCell(report.nextPdcDate || ''),
      csvCell(report.pdcStatus || ''),
      csvCell(report.supportLevel || ''),
      csvCell(primaryGoalOf(report)?.title || report.developmentGoalSummary || ''),
      csvCell(report.promotionReadiness || ''),
      csvCell(openTalkingPointsFor(report).map((point) => point.text).join('\n') || report.agenda || ''),
      csvCell(JSON.stringify(normalizeGoals(report.goals || []))),
      csvCell(JSON.stringify(normalizeTalkingPoints(report.talkingPoints || []))),
      csvCell(report.notes || ''),
      csvCell(serializeCadenceOverrides(report.cadenceOverrides)),
      csvCell(serializeVacations(report.vacations)),
      csvCell(serializeSnoozes(report.snoozes)),
      csvCell((report.customFields || []).map((field) => `${field.label}: ${field.value}`).join(' | '))
    ].join(','));
  });
  return rows.join('\n');
}

function buildNotesMarkdown() {
  const lines = ['# Team Pulse notes', ''];
  getReports().forEach((report) => {
    lines.push(`## ${report.name}`);
    lines.push('');
    if (!report.notesHistory.length && !report.notes && !report.meetings.some((meeting) => meeting.notes)) {
      lines.push('_No notes yet._');
      lines.push('');
      return;
    }
    if (report.notesHistory.length || report.notes) {
      lines.push('### Manager notes');
      lines.push('');
      if (report.notesHistory.length) {
        report.notesHistory.forEach((note) => {
          lines.push(`- ${note.noteDate || ''}: ${note.noteText || ''}`);
        });
      } else if (report.notes) {
        lines.push(`- ${report.notes}`);
      }
      lines.push('');
    }
    const meetingNotes = report.meetings.filter((meeting) => meeting.notes);
    if (meetingNotes.length) {
      lines.push('### Meeting notes');
      lines.push('');
      meetingNotes.forEach((meeting) => {
        lines.push(`- ${meeting.meetingDate} (${meeting.meetingType}): ${meeting.notes}`);
      });
      lines.push('');
    }
  });
  return lines.join('\n');
}

function quarterlyExportDue() {
  const last = normalizeText(app.doc?.settings?.lastExportDate);
  if (!last) return true;
  const days = daysSinceIso(last);
  return days === null ? true : days >= 90;
}

async function exportPlainFiles(options = {}) {
  const { silent = false } = options;
  if (!app.folderHandle || !app.doc) {
    if (!silent) showToast('Choose a Team Pulse folder first.', 'error');
    return false;
  }
  try {
    const stamp = todayStamp();
    const meetingsName = `export_${stamp}_meetings.csv`;
    const peopleName = `export_${stamp}_people.csv`;
    const notesName = `export_${stamp}_notes.md`;
    await writeFolderFileText(meetingsName, buildMeetingsCsv());
    await writeFolderFileText(peopleName, buildPeopleCsv());
    await writeFolderFileText(notesName, buildNotesMarkdown());
    clearLastDestructiveAction();
    app.doc.settings.lastExportDate = nowIso();
    app.doc.settings.latestExportFiles = [meetingsName, peopleName, notesName];
    await persistDocToFolder({ reason: 'autosave' });
    renderSettingsPanel();
    renderExportReminderBanner();
    if (!silent) showToast('Quarterly export files written to your Team Pulse folder.', 'success');
    return true;
  } catch (error) {
    console.error('Failed to export plain files', error);
    if (!silent) showToast(error?.message || 'Could not write the export files.', 'error');
    return false;
  }
}

// The save status in the header has five looks (Moss, Controls 1): Autosaved
// (is-saved), Saving… (is-saving), Pending save (is-pending), Save failed
// (is-failed) and No folder connected (is-disconnected). The dot is drawn in CSS.
function updateFileUi() {
  const connected = !!app.folderHandle && app.connectedFolderReady;
  saveDockEl.classList.add('hidden');
  saveDockEl.classList.remove('nudge');

  if (!connected) {
    fileStatePillEl.textContent = 'No folder connected';
    fileStatePillEl.className = 'save-status is-disconnected';
    fileStatePillEl.title = 'Choose a Team Pulse folder to begin.';
  } else if (app.saveInFlight) {
    fileStatePillEl.textContent = 'Saving…';
    fileStatePillEl.className = 'save-status is-saving';
    fileStatePillEl.title = `Writing to ${MAIN_JSON_NAME} in ${app.folderName || 'your Team Pulse folder'}.`;
  } else if (app.lastSaveError) {
    fileStatePillEl.textContent = 'Save failed';
    fileStatePillEl.className = 'save-status is-failed';
    fileStatePillEl.title = app.lastSaveError;
  } else if (app.saveQueued) {
    fileStatePillEl.textContent = 'Pending save';
    fileStatePillEl.className = 'save-status is-pending';
    fileStatePillEl.title = 'A file save is queued.';
  } else {
    const manualSaveLabel = app.lastSaveReason === 'manual' ? formatManualSaveLabel(app.lastSaveAt) : '';
    fileStatePillEl.textContent = manualSaveLabel || 'Autosaved';
    fileStatePillEl.className = 'save-status is-saved';
    fileStatePillEl.title = app.lastSaveAt
      ? `Last save: ${formatSavedStamp(app.lastSaveAt)} in ${app.folderName || 'your Team Pulse folder'}.`
      : `Connected to ${app.folderName || 'your Team Pulse folder'}.`;
  }

  addReportBtn.disabled = !connected;
  importIcsBtn.disabled = !connected || getReports().length === 0;
  exportCsvBtn.disabled = !connected || getReports().length === 0;

  saveFileBtn.disabled = !supportsDirectoryAccess();
  saveFileBtn.textContent = connected ? 'Save now' : 'Choose folder';
  saveFileBtn.title = connected
    ? 'Write the durable Team Pulse files to the connected folder now.'
    : 'Choose the folder where Team Pulse should keep its files.';

  connectDataFileBtn.disabled = !supportsJsonOpen();
  connectDataFileBtn.textContent = 'Import JSON';
  connectDataFileBtn.title = 'Import an older Team Pulse JSON file and migrate it into the durable folder layout.';

  exportCsvBtn.textContent = 'Export files';
  exportCsvBtn.title = 'Write meetings.csv, people.csv, and notes.md to the Team Pulse folder.';
}

function setStatus(el, message, kind = '') {
  if (!el) return;
  el.textContent = message;
  el.className = `status-line ${kind}`.trim();
}

function ensureConnectedOrToast() {
  if (app.folderHandle && app.connectedFolderReady && app.doc) return true;
  showToast('Choose a Team Pulse folder first.', 'warning');
  return false;
}

// v0.52.1: the banner can be snoozed for 7 days. The snooze lives in the UI
// state (localStorage, per browser), never in the document: it is a personal
// "not now", not a property of the data. Exporting clears the underlying
// condition anyway, so the snooze only matters while the export stays due.
function exportReminderSnoozed() {
  const until = app.ui?.exportReminderSnoozedUntil;
  if (!until) return false;
  const parsed = Date.parse(until);
  return Number.isFinite(parsed) && parsed > Date.now();
}

function renderExportReminderBanner() {
  let mount = document.getElementById('exportReminderMount');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'exportReminderMount';
    // Above the page header, where the banner sat in v0.52.4.
    const headerEl = document.getElementById('contentHeader');
    if (headerEl) headerEl.insertAdjacentElement('beforebegin', mount);
    else startupGateEl.insertAdjacentElement('afterend', mount);
  }
  mount.replaceChildren();
  if (!app.folderHandle || !app.connectedFolderReady || !quarterlyExportDue() || exportReminderSnoozed()) return;
  // Moss backup banner (Controls 3): a white card with the title and text,
  // then Remind me later (secondary) and Export now (primary).
  const wrapper = document.createElement('section');
  wrapper.className = 'export-banner';
  wrapper.setAttribute('aria-labelledby', 'exportBannerTitle');
  const copy = document.createElement('div');
  copy.className = 'export-banner-copy';
  const title = document.createElement('strong');
  title.className = 'export-banner-title';
  title.id = 'exportBannerTitle';
  title.textContent = 'Time for a backup export';
  const text = document.createElement('p');
  text.className = 'export-banner-text';
  text.textContent = 'It has been more than 90 days since the last plain-format export.';
  copy.append(title, text);
  const actions = document.createElement('div');
  actions.className = 'export-banner-actions';
  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'secondary';
  dismissBtn.id = 'bannerExportDismissBtn';
  dismissBtn.title = 'Hide this reminder for 7 days';
  dismissBtn.textContent = 'Remind me later';
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.id = 'bannerExportNowBtn';
  exportBtn.textContent = 'Export now';
  actions.append(dismissBtn, exportBtn);
  wrapper.append(copy, actions);
  mount.appendChild(wrapper);
  document.getElementById('bannerExportNowBtn')?.addEventListener('click', () => exportPlainFiles());
  document.getElementById('bannerExportDismissBtn')?.addEventListener('click', () => {
    app.ui.exportReminderSnoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    persistUiState();
    renderExportReminderBanner();
    showToast('Backup reminder snoozed for 7 days.', 'info');
  });
}

function renderSettingsPanel() {
  const healthPanelEl = document.getElementById('dataHealthPanel');
  if (!healthPanelEl) return;

  const eventDates = (app.doc?.events || []).map((event) => event.createdAt).filter(Boolean).sort();
  const firstEvent = eventDates[0] || '';
  const lastEvent = eventDates[eventDates.length - 1] || '';
  const daysSinceExport = app.doc?.settings?.lastExportDate ? daysSinceIso(app.doc.settings.lastExportDate) : null;
  const folderLabel = app.fileStats.folderLabel || app.folderName || 'Not available';

  // The third value marks a row good or needing attention; the row's text
  // always says the same thing, so the mark never carries meaning alone.
  const savedState = (stamp) => (stamp ? 'good' : 'attention');
  const items = [
    ['Schema', `File v${app.loadedSchemaVersion || CURRENT_SCHEMA_VERSION} · App ${APP_VERSION}`],
    ['Last migration', app.lastMigrationApplied || 'None'],
    ['Folder', `${folderLabel}/${MAIN_JSON_NAME}`, app.connectedFolderReady ? 'good' : 'attention'],
    ['Last save', formatDateTime(app.fileStats.mainSavedAt || app.lastSaveAt), app.lastSaveError ? 'attention' : savedState(app.fileStats.mainSavedAt || app.lastSaveAt)],
    ['Latest backup', formatDateTime(app.fileStats.backupSavedAt) || '-', savedState(app.fileStats.backupSavedAt)],
    ['Daily backup', formatDateTime(app.fileStats.dailySavedAt) || '-', savedState(app.fileStats.dailySavedAt)],
    ['Monthly backup', formatDateTime(app.fileStats.monthlySavedAt) || '-', savedState(app.fileStats.monthlySavedAt)],
    ['Schema doc', app.fileStats.schemaWrittenAt ? 'Up to date' : 'Will be written on save', app.fileStats.schemaWrittenAt ? 'good' : ''],
    ['Event count', String(app.doc?.events?.length || 0)],
    ['Event range', firstEvent ? `${formatDateTime(firstEvent)} → ${formatDateTime(lastEvent)}` : 'No events yet'],
    ['Last export', app.doc?.settings?.lastExportDate ? formatDateTime(app.doc.settings.lastExportDate) : 'Never'],
    ['Days since export', daysSinceExport === null ? 'Never' : String(daysSinceExport)]
  ];
  const grid = document.createElement('div');
  grid.className = 'health-grid';
  items.forEach(([label, value, state]) => {
    const item = document.createElement('div');
    item.className = 'health-item';
    if (state) item.dataset.state = state;
    const strong = document.createElement('strong');
    strong.textContent = label;
    const span = document.createElement('span');
    span.textContent = value;
    item.append(strong, span);
    grid.appendChild(item);
  });
  healthPanelEl.replaceChildren(grid);
}

// The drawer is a modal dialog: opening it moves focus to its Close button,
// and closing it puts focus back on the control that opened it (or that
// control's re-rendered copy, via focusReturnRecord in 09). When nothing had
// focus (a digit shortcut, a search result), focus returns to the sidebar
// Settings item, which is where the view now is.
let rulesDrawerReturnFocus = null;

function openRulesDrawer() {
  const wasOpen = rulesDrawerOverlayEl.classList.contains('open');
  renderRuleInputs();
  renderSettingsPanel();
  rulesDrawerOverlayEl.classList.add('open');
  rulesDrawerOverlayEl.setAttribute('aria-hidden', 'false');
  syncBodyOverlayLock();
  if (wasOpen) return;
  const activeEl = document.activeElement;
  rulesDrawerReturnFocus = activeEl && !rulesDrawerOverlayEl.contains(activeEl) ? focusReturnRecord(activeEl) : null;
  closeRulesDrawerBtn.focus({ preventScroll: true });
}

function closeRulesDrawer() {
  const wasOpen = rulesDrawerOverlayEl.classList.contains('open');
  rulesDrawerOverlayEl.classList.remove('open');
  rulesDrawerOverlayEl.setAttribute('aria-hidden', 'true');
  syncBodyOverlayLock();
  if (!wasOpen) return;
  const saved = rulesDrawerReturnFocus;
  rulesDrawerReturnFocus = null;
  const target = focusReturnTarget(saved) || document.querySelector('#sidebarNav [data-nav-main="settings"]');
  if (target && !target.disabled && typeof target.focus === 'function') target.focus({ preventScroll: true });
}
