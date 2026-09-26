function meetingExistsForReport(report, meetingType, meetingDate, notes, externalUid = '', excludeMeetingId = '') {
  if (externalUid && report.meetings.some((meeting) => meeting.id !== excludeMeetingId && meeting.externalUid && meeting.externalUid === externalUid)) return true;
  const normalizedNotes = normalizeText(notes);
  return report.meetings.some((meeting) => meeting.id !== excludeMeetingId
    && canonicalMeetingType(meeting.meetingType) === canonicalMeetingType(meetingType)
    && normalizeDate(meeting.meetingDate) === normalizeDate(meetingDate)
    && normalizeText(meeting.notes) === normalizedNotes);
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
  meetingModalEl.classList.add('open');
  meetingModalEl.setAttribute('aria-hidden', 'false');
  syncBodyOverlayLock();
  document.getElementById('meetingDate')?.focus();
}

function closeMeetingModal() {
  meetingModalEl.classList.remove('open');
  meetingModalEl.setAttribute('aria-hidden', 'true');
  setStatus(meetingStatusEl, '');
  syncBodyOverlayLock();
}

function openGoalModal(reportId, goalId = '') {
  const report = getReportById(reportId);
  const modalEl = document.getElementById('goalModal');
  if (!report || !modalEl) return;
  const goal = goalId ? normalizeGoals(report.goals || []).find((item) => item.id === goalId) || null : null;
  document.getElementById('goalForm')?.reset();
  document.getElementById('goalReportId').value = reportId;
  document.getElementById('goalId').value = goal?.id || '';
  const statusSelect = document.getElementById('goalStatus');
  if (statusSelect) statusSelect.innerHTML = GOAL_STATUSES.map((status) => `<option value="${escapeHtml(status)}" ${status === (goal?.status || GOAL_STATUSES[0]) ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('');
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
  modalEl.classList.add('open');
  modalEl.setAttribute('aria-hidden', 'false');
  syncBodyOverlayLock();
  document.getElementById('goalTitle')?.focus();
}

function closeGoalModal() {
  const modalEl = document.getElementById('goalModal');
  if (!modalEl) return;
  modalEl.classList.remove('open');
  modalEl.setAttribute('aria-hidden', 'true');
  setStatus(document.getElementById('goalStatusLine'), '');
  syncBodyOverlayLock();
}

function openFeedbackModal(reportId, template = {}) {
  const report = getReportById(reportId);
  const modalEl = document.getElementById('feedbackModal');
  if (!report || !modalEl) return;
  document.getElementById('feedbackForm')?.reset();
  document.getElementById('feedbackReportId').value = reportId;
  const kindSelect = document.getElementById('feedbackKind');
  if (kindSelect) kindSelect.innerHTML = FEEDBACK_KINDS.map((kind) => `<option value="${escapeHtml(kind)}" ${kind === normalizeFeedbackKind(template.kind) ? 'selected' : ''}>${escapeHtml(FEEDBACK_KIND_LABELS[kind])}</option>`).join('');
  const categories = resolveEvidenceCategories(app.doc?.settings);
  const categorySelect = document.getElementById('feedbackCategory');
  if (categorySelect) categorySelect.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}" ${category === normalizeText(template.category) ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('');
  document.getElementById('feedbackDate').value = normalizeDate(template.date) || todayStamp();
  const meetingSelect = document.getElementById('feedbackMeeting');
  if (meetingSelect) {
    const linkedId = normalizeText(template.linkedMeetingId);
    meetingSelect.innerHTML = ['<option value="">Not linked</option>', ...(report.meetings || []).slice(0, 20).map((meeting) => `<option value="${escapeHtml(meeting.id)}" ${meeting.id === linkedId ? 'selected' : ''}>${escapeHtml(`${meeting.meetingType} · ${formatDate(meeting.meetingDate)}`)}</option>`)].join('');
  }
  document.getElementById('feedbackSummary').value = '';
  document.getElementById('feedbackDetail').value = '';
  const sharedEl = document.getElementById('feedbackShared');
  if (sharedEl) sharedEl.checked = !!template.shared;
  const subtitleEl = document.getElementById('feedbackModalSubtitle');
  if (subtitleEl) subtitleEl.textContent = `A dated feedback entry for ${report.name}, stored in the evidence locker.`;
  setStatus(document.getElementById('feedbackStatusLine'), '');
  modalEl.classList.add('open');
  modalEl.setAttribute('aria-hidden', 'false');
  syncBodyOverlayLock();
  document.getElementById('feedbackSummary')?.focus();
}

function closeFeedbackModal() {
  const modalEl = document.getElementById('feedbackModal');
  if (!modalEl) return;
  modalEl.classList.remove('open');
  modalEl.setAttribute('aria-hidden', 'true');
  setStatus(document.getElementById('feedbackStatusLine'), '');
  syncBodyOverlayLock();
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

