function meetingExistsForReport(report, meetingType, meetingDate, notes, externalUid = '', excludeMeetingId = '') {
  if (externalUid && report.meetings.some((meeting) => meeting.id !== excludeMeetingId && meeting.externalUid && meeting.externalUid === externalUid)) return true;
  const normalizedNotes = normalizeText(notes);
  return report.meetings.some((meeting) => meeting.id !== excludeMeetingId
    && canonicalMeetingType(meeting.meetingType) === canonicalMeetingType(meetingType)
    && normalizeDate(meeting.meetingDate) === normalizeDate(meetingDate)
    && normalizeText(meeting.notes) === normalizedNotes);
}

// Dialog focus: remember what had focus when a dialog opened and put focus
// back there when it closes. If a re-render replaced that element, its new
// copy gets focus instead (focusReturnTarget in 09). A dialog opened from a
// toast action (such as Log the PDC) returns focus to where it was before the
// toast, because the toast and its button are gone by then.
const dialogReturnFocus = new Map();

function rememberDialogOpener(key, modalEl) {
  const activeEl = document.activeElement;
  if (activeEl && modalEl && modalEl.contains(activeEl)) return;
  const toastEl = activeEl && toastStackEl?.contains(activeEl) ? activeEl.closest('.toast') : null;
  dialogReturnFocus.set(key, toastEl ? toastReturnFocus.get(toastEl) || null : focusReturnRecord(activeEl));
}

function restoreDialogOpener(key) {
  const saved = dialogReturnFocus.get(key);
  dialogReturnFocus.delete(key);
  restoreFocusTo(saved);
}

// Keyboard focus stays inside the open dialog, search or Settings drawer
// (they are aria-modal): Tab from the last control goes back to the first,
// Shift+Tab from the first goes to the last, and Tab from outside moves in.
// The topmost open layer wins, in z-index order (02-moss-base.css).
const FOCUS_TRAP_LAYERS = [
  '#globalSearch.open .gs-panel',
  '#meetingModal.open .modal',
  '.overlay.open .modal',
  '#rulesDrawerOverlay.open .rules-drawer'
];

function topOpenFocusLayer() {
  for (const selector of FOCUS_TRAP_LAYERS) {
    const layerEl = document.querySelector(selector);
    if (layerEl) return layerEl;
  }
  return null;
}

function focusableIn(containerEl) {
  return [...containerEl.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter((el) => {
    if (el.disabled || el.tabIndex < 0 || el.type === 'hidden') return false;
    if (!el.getClientRects().length) return false;
    return getComputedStyle(el).visibility !== 'hidden';
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
  const layerEl = topOpenFocusLayer();
  if (!layerEl) return;
  const items = focusableIn(layerEl);
  if (!items.length) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!active || !layerEl.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
});

// Fills a select with options built by DOM methods.
function fillSelectOptions(selectEl, entries, selectedValue) {
  if (!selectEl) return;
  selectEl.replaceChildren(...entries.map(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (value === selectedValue) {
      option.selected = true;
      option.defaultSelected = true;
    }
    return option;
  }));
}

function openMeetingModal(reportId, options = {}) {
  const report = getReportById(reportId);
  if (!report) return;
  const meeting = options.meeting || null;
  meetingFormEl.reset();
  document.getElementById('meetingReportId').value = reportId;
  document.getElementById('editingMeetingId').value = meeting?.id || '';
  document.getElementById('meetingSource').value = meeting?.source || 'manual';
  document.getElementById('meetingExternalUid').value = meeting?.externalUid || '';
  document.getElementById('meetingType').value = canonicalMeetingType(options.presetType || meeting?.meetingType || MEETING_TYPES[0]);
  document.getElementById('meetingDate').value = normalizeDate(meeting?.meetingDate) || todayStamp();
  const durationEl = document.getElementById('meetingDuration');
  if (durationEl) durationEl.value = Number.isFinite(Number(meeting?.durationMinutes)) && Number(meeting.durationMinutes) > 0 ? Number(meeting.durationMinutes) : '';
  document.getElementById('meetingNotes').value = meeting?.notes || '';
  document.getElementById('saveMeetingBtn').textContent = meeting ? 'Save changes' : 'Save meeting';
  meetingModalTitleEl.textContent = meeting ? 'Edit Meeting' : 'Log Meeting';
  meetingModalSubtitleEl.textContent = meeting
    ? `Update the meeting record for ${report.name}.`
    : `Log or import a meeting for ${report.name}.`;
  meetingImportIcsBtn.classList.toggle('hidden', !!meeting);
  const insertAgendaBtn = document.getElementById('insertAgendaBtn');
  if (insertAgendaBtn) insertAgendaBtn.classList.toggle('hidden', !!meeting || openTalkingPointsFor(report).length === 0);
  const insertPdcTemplateBtn = document.getElementById('insertPdcTemplateBtn');
  if (insertPdcTemplateBtn) insertPdcTemplateBtn.classList.toggle('hidden', canonicalMeetingType(document.getElementById('meetingType').value) !== 'PDC');
  const meetingPulse = normalizePulse(meeting?.pulse);
  document.querySelectorAll('input[name="meetingPulse"]').forEach((input) => { input.checked = input.value === meetingPulse; });
  setStatus(meetingStatusEl, '');
  syncMeetingNotesPreview();
  const meetingShell = document.getElementById('meetingNotesShell');
  if (meetingShell) {
    meetingShell.setAttribute('data-md-active', 'write');
    meetingShell.querySelectorAll('[data-md-target]').forEach((btn) => {
      const isWrite = btn.getAttribute('data-md-mode') === 'write';
      btn.classList.toggle('active', isWrite);
      btn.setAttribute('aria-selected', isWrite ? 'true' : 'false');
    });
  }
  rememberDialogOpener('meeting', meetingModalEl);
  meetingModalEl.classList.add('open');
  meetingModalEl.setAttribute('aria-hidden', 'false');
  syncBodyOverlayLock();
  document.getElementById('meetingDate')?.focus();
}

function closeMeetingModal() {
  const wasOpen = meetingModalEl.classList.contains('open');
  meetingModalEl.classList.remove('open');
  meetingModalEl.setAttribute('aria-hidden', 'true');
  setStatus(meetingStatusEl, '');
  syncBodyOverlayLock();
  if (wasOpen) restoreDialogOpener('meeting');
}

function openGoalModal(reportId, goalId = '') {
  const report = getReportById(reportId);
  const modalEl = document.getElementById('goalModal');
  if (!report || !modalEl) return;
  const goal = goalId ? normalizeGoals(report.goals || []).find((item) => item.id === goalId) || null : null;
  document.getElementById('goalForm')?.reset();
  document.getElementById('goalReportId').value = reportId;
  document.getElementById('goalId').value = goal?.id || '';
  fillSelectOptions(document.getElementById('goalStatus'), GOAL_STATUSES.map((status) => [status, status]), goal?.status || GOAL_STATUSES[0]);
  document.getElementById('goalTitle').value = goal?.title || '';
  document.getElementById('goalTargetDate').value = goal?.targetDate || '';
  const progressEl = document.getElementById('goalProgress');
  if (progressEl) progressEl.value = String(goal?.progress ?? 0);
  const progressValueEl = document.getElementById('goalProgressValue');
  if (progressValueEl) progressValueEl.textContent = `${goal?.progress ?? 0}%`;
  document.getElementById('goalDetail').value = goal?.detail || '';
  document.getElementById('goalUpdateNote').value = '';
  document.getElementById('deleteGoalBtn')?.classList.toggle('hidden', !goal);
  const titleEl = document.getElementById('goalModalTitle');
  if (titleEl) titleEl.textContent = goal ? 'Edit Goal' : 'Add Goal';
  const subtitleEl = document.getElementById('goalModalSubtitle');
  if (subtitleEl) subtitleEl.textContent = goal
    ? `Update the goal for ${report.name}. A progress note or changed progress is added to the goal's log.`
    : `A concrete development goal for ${report.name}, with a status and progress.`;
  setStatus(document.getElementById('goalStatusLine'), '');
  rememberDialogOpener('goal', modalEl);
  modalEl.classList.add('open');
  modalEl.setAttribute('aria-hidden', 'false');
  syncBodyOverlayLock();
  document.getElementById('goalTitle')?.focus();
}

function closeGoalModal() {
  const modalEl = document.getElementById('goalModal');
  if (!modalEl) return;
  const wasOpen = modalEl.classList.contains('open');
  modalEl.classList.remove('open');
  modalEl.setAttribute('aria-hidden', 'true');
  setStatus(document.getElementById('goalStatusLine'), '');
  syncBodyOverlayLock();
  if (wasOpen) restoreDialogOpener('goal');
}

function openFeedbackModal(reportId, template = {}) {
  const report = getReportById(reportId);
  const modalEl = document.getElementById('feedbackModal');
  if (!report || !modalEl) return;
  document.getElementById('feedbackForm')?.reset();
  document.getElementById('feedbackReportId').value = reportId;
  fillSelectOptions(document.getElementById('feedbackKind'), FEEDBACK_KINDS.map((kind) => [kind, FEEDBACK_KIND_LABELS[kind]]), normalizeFeedbackKind(template.kind));
  const categories = resolveEvidenceCategories(app.doc?.settings);
  fillSelectOptions(document.getElementById('feedbackCategory'), categories.map((category) => [category, category]), normalizeText(template.category));
  document.getElementById('feedbackDate').value = normalizeDate(template.date) || todayStamp();
  fillSelectOptions(
    document.getElementById('feedbackMeeting'),
    [['', 'Not linked'], ...(report.meetings || []).slice(0, 20).map((meeting) => [meeting.id, `${meeting.meetingType} · ${formatDate(meeting.meetingDate)}`])],
    normalizeText(template.linkedMeetingId)
  );
  document.getElementById('feedbackSummary').value = '';
  document.getElementById('feedbackDetail').value = '';
  const sharedEl = document.getElementById('feedbackShared');
  if (sharedEl) sharedEl.checked = !!template.shared;
  const subtitleEl = document.getElementById('feedbackModalSubtitle');
  if (subtitleEl) subtitleEl.textContent = `A dated feedback entry for ${report.name}, stored in the evidence locker.`;
  setStatus(document.getElementById('feedbackStatusLine'), '');
  rememberDialogOpener('feedback', modalEl);
  modalEl.classList.add('open');
  modalEl.setAttribute('aria-hidden', 'false');
  syncBodyOverlayLock();
  document.getElementById('feedbackSummary')?.focus();
}

function closeFeedbackModal() {
  const modalEl = document.getElementById('feedbackModal');
  if (!modalEl) return;
  const wasOpen = modalEl.classList.contains('open');
  modalEl.classList.remove('open');
  modalEl.setAttribute('aria-hidden', 'true');
  setStatus(document.getElementById('feedbackStatusLine'), '');
  syncBodyOverlayLock();
  if (wasOpen) restoreDialogOpener('feedback');
}

function buildMeetingPayloadFromForm(formData) {
  const rawDuration = Number(formData.get('meetingDuration'));
  return {
    meetingType: canonicalMeetingType(formData.get('meetingType')),
    meetingDate: normalizeDate(formData.get('meetingDate')),
    notes: normalizeText(formData.get('meetingNotes')),
    pulse: normalizePulse(formData.get('meetingPulse')),
    source: normalizeText(formData.get('meetingSource') || 'manual') || 'manual',
    externalUid: normalizeText(formData.get('meetingExternalUid')),
    durationMinutes: Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration) : null
  };
}

async function addMeeting(reportId, meetingInput = null, options = {}) {
  const report = getReportById(reportId);
  if (!report) return false;
  const payload = meetingInput || buildMeetingPayloadFromForm(new FormData(meetingFormEl));
  const statusEl = options.statusEl || meetingStatusEl;
  if (!payload.meetingDate) {
    setStatus(statusEl, 'Meeting date is required.', 'error');
    return false;
  }
  if (meetingExistsForReport(report, payload.meetingType, payload.meetingDate, payload.notes, payload.externalUid, options.excludeMeetingId || '')) {
    setStatus(statusEl, 'That meeting is already logged.', 'warning');
    return false;
  }
  clearLastDestructiveAction();
  appendEvent({
    id: nextId('event'),
    type: 'meeting_logged',
    personId: reportId,
    meetingId: options.meetingId || nextId('meeting'),
    meetingType: payload.meetingType,
    meetingDate: payload.meetingDate,
    durationMinutes: payload.durationMinutes ?? null,
    notes: payload.notes || '',
    pulse: normalizePulse(payload.pulse),
    source: payload.source || 'manual',
    externalUid: payload.externalUid || '',
    createdAt: nowIso()
  });
  applyProjectedState();
  render();
  scheduleAutosave();
  setStatus(statusEl, options.successMessage || 'Meeting logged.', 'success');
  showToast(options.successMessage || 'Meeting logged.', 'success');
  return true;
}

async function updateMeeting(reportId, meetingId, meetingInput = null) {
  const report = getReportById(reportId);
  const existingMeeting = report?.meetings.find((meeting) => meeting.id === meetingId);
  if (!report || !existingMeeting) return false;
  const payload = meetingInput || buildMeetingPayloadFromForm(new FormData(meetingFormEl));
  payload.source = payload.source || existingMeeting.source || 'manual';
  payload.externalUid = payload.externalUid || existingMeeting.externalUid || '';

  if (!payload.meetingDate) {
    setStatus(meetingStatusEl, 'Meeting date is required.', 'error');
    return false;
  }
  if (meetingExistsForReport(report, payload.meetingType, payload.meetingDate, payload.notes, payload.externalUid, meetingId)) {
    setStatus(meetingStatusEl, 'That meeting is already logged.', 'warning');
    return false;
  }

  clearLastDestructiveAction();
  appendEvent({ id: nextId('event'), type: 'meeting_deleted', personId: reportId, meetingId, createdAt: nowIso() });
  appendEvent({
    id: nextId('event'),
    type: 'meeting_logged',
    personId: reportId,
    meetingId,
    meetingType: payload.meetingType,
    meetingDate: payload.meetingDate,
    durationMinutes: payload.durationMinutes ?? null,
    notes: payload.notes || '',
    pulse: normalizePulse(payload.pulse),
    source: payload.source || 'manual',
    externalUid: payload.externalUid || '',
    createdAt: nowIso()
  });
  applyProjectedState();
  render();
  scheduleAutosave();
  setStatus(meetingStatusEl, 'Meeting updated.', 'success');
  showToast('Meeting updated.', 'success');
  return true;
}

async function handleMeetingSubmit(event) {
  event.preventDefault();
  const formData = new FormData(meetingFormEl);
  const reportId = normalizeText(formData.get('meetingReportId'));
  const editingMeetingId = normalizeText(formData.get('editingMeetingId'));
  if (!reportId) {
    showToast('Open a direct report before logging a meeting.', 'warning');
    return;
  }
  const success = editingMeetingId
    ? await updateMeeting(reportId, editingMeetingId, buildMeetingPayloadFromForm(formData))
    : await addMeeting(reportId, buildMeetingPayloadFromForm(formData));
  if (success) closeMeetingModal();
}

async function deleteMeeting(reportId, meetingId) {
  const report = getReportById(reportId);
  const meeting = report?.meetings.find((item) => item.id === meetingId);
  if (!report || !meeting) return;
  const label = `${meeting.meetingType} on ${formatDate(meeting.meetingDate)}`;
  if (!window.confirm(`Are you sure you want to delete ${label}?`)) return;
  clearLastDestructiveAction();
  const eventId = nextId('event');
  appendEvent({ id: eventId, type: 'meeting_deleted', personId: reportId, meetingId, createdAt: nowIso() });
  app.lastDestructiveAction = { kind: 'deleteMeeting', eventId, undoMessage: 'Meeting restored.' };
  applyProjectedState();
  render();
  scheduleAutosave();
  showToast('Meeting deleted.', 'success', { actionLabel: 'Undo', duration: 8000, onAction: undoLastDestructiveAction });
}

