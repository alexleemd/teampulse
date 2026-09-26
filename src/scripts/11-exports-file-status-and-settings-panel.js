

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
          lines.push(`- ${note.noteDate || ''} — ${note.noteText || ''}`);
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
        lines.push(`- ${meeting.meetingDate} — ${meeting.meetingType}: ${meeting.notes}`);
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

function updateFileUi() {
  const connected = !!app.folderHandle && app.connectedFolderReady;
  saveDockEl.classList.add('hidden');
  saveDockEl.classList.remove('nudge');

  if (!connected) {
    fileStatePillEl.textContent = 'No folder connected';
    fileStatePillEl.className = 'pill save-pill neutral';
    fileStatePillEl.title = 'Choose a Team Pulse folder to begin.';
  } else if (app.saveInFlight) {
    fileStatePillEl.textContent = 'Saving…';
    fileStatePillEl.className = 'pill save-pill info';
    fileStatePillEl.title = `Writing to ${MAIN_JSON_NAME} in ${app.folderName || 'your Team Pulse folder'}.`;
  } else if (app.lastSaveError) {
    fileStatePillEl.textContent = 'Save failed';
    fileStatePillEl.className = 'pill save-pill danger';
    fileStatePillEl.title = app.lastSaveError;
  } else if (app.saveQueued) {
    fileStatePillEl.textContent = 'Pending save';
    fileStatePillEl.className = 'pill save-pill warning';
    fileStatePillEl.title = 'A file save is queued.';
  } else {
    const manualSaveLabel = app.lastSaveReason === 'manual' ? formatManualSaveLabel(app.lastSaveAt) : '';
    fileStatePillEl.textContent = manualSaveLabel || 'Autosaved';
    fileStatePillEl.className = 'pill save-pill success';
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
    startupGateEl.insertAdjacentElement('afterend', mount);
  }
  mount.replaceChildren();
  if (!app.folderHandle || !app.connectedFolderReady || !quarterlyExportDue() || exportReminderSnoozed()) return;
  const wrapper = document.createElement('section');
  wrapper.className = 'card callout';
  // innerHTML kept: complex static markup with inline styles; no dynamic inputs.
  wrapper.innerHTML = `
    <div class="content" style="display:flex;justify-content:space-between;align-items:center;gap:16px;">
      <div>
        <strong>Time for a backup export</strong>
        <p>It has been more than 90 days since the last plain-format export.</p>
      </div>
      <div class="actions">
        <button type="button" class="secondary" id="bannerExportDismissBtn" title="Hide this reminder for 7 days">Remind me later</button>
        <button type="button" id="bannerExportNowBtn">Export now</button>
      </div>
    </div>
  `;
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
  const stableModeToggleEl = document.getElementById('stableModeToggle');
  if (!healthPanelEl) return;
  if (stableModeToggleEl) stableModeToggleEl.checked = !!app.doc?.settings?.stableMode;

  const eventDates = (app.doc?.events || []).map((event) => event.createdAt).filter(Boolean).sort();
  const firstEvent = eventDates[0] || '';
  const lastEvent = eventDates[eventDates.length - 1] || '';
  const daysSinceExport = app.doc?.settings?.lastExportDate ? daysSinceIso(app.doc.settings.lastExportDate) : null;
  const folderLabel = app.fileStats.folderLabel || app.folderName || 'Not available';

  const items = [
    ['Schema', `File v${app.loadedSchemaVersion || CURRENT_SCHEMA_VERSION} · App ${APP_VERSION}`],
    ['Last migration', app.lastMigrationApplied || 'None'],
    ['Folder', `${folderLabel}/${MAIN_JSON_NAME}`],
    ['Last save', formatDateTime(app.fileStats.mainSavedAt || app.lastSaveAt)],
    ['Latest backup', formatDateTime(app.fileStats.backupSavedAt) || '-'],
    ['Daily backup', formatDateTime(app.fileStats.dailySavedAt) || '-'],
    ['Monthly backup', formatDateTime(app.fileStats.monthlySavedAt) || '-'],
    ['Schema doc', app.fileStats.schemaWrittenAt ? 'Up to date' : 'Will be written on save'],
    ['Event count', String(app.doc?.events?.length || 0)],
    ['Event range', firstEvent ? `${formatDateTime(firstEvent)} → ${formatDateTime(lastEvent)}` : 'No events yet'],
    ['Last export', app.doc?.settings?.lastExportDate ? formatDateTime(app.doc.settings.lastExportDate) : 'Never'],
    ['Days since export', daysSinceExport === null ? '—' : String(daysSinceExport)]
  ];
  const grid = document.createElement('div');
  grid.className = 'health-grid';
  items.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'health-item';
    const strong = document.createElement('strong');
    strong.textContent = label;
    const span = document.createElement('span');
    span.textContent = value;
    item.append(strong, span);
    grid.appendChild(item);
  });
  healthPanelEl.replaceChildren(grid);
}

function openRulesDrawer() {
  renderRuleInputs();
  renderSettingsPanel();
  rulesDrawerOverlayEl.classList.add('open');
  rulesDrawerOverlayEl.setAttribute('aria-hidden', 'false');
  syncBodyOverlayLock();
}

function closeRulesDrawer() {
  rulesDrawerOverlayEl.classList.remove('open');
  rulesDrawerOverlayEl.setAttribute('aria-hidden', 'true');
  syncBodyOverlayLock();
}
