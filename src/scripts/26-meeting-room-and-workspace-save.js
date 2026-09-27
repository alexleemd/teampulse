// The 1:1 meeting room keeps its in-flight state (notes, staged talking
// points, meta) in a module-level draft so nothing is written to the event
// log until Wrap up. Navigating away keeps the draft for the same person.
let meetingRoomDraft = null;

function meetingRoomDraftFor(reportId) {
  if (meetingRoomDraft && meetingRoomDraft.reportId === reportId) return meetingRoomDraft;
  meetingRoomDraft = {
    reportId,
    meetingType: '1:1',
    meetingDate: todayStamp(),
    durationMinutes: '',
    pulse: '',
    notes: '',
    checkedPointIds: [],
    prevNoteOpen: false
  };
  return meetingRoomDraft;
}

// Ends the draft and removes the room's page content, which stays in the
// page while hidden. Without this, reopening the room for the same person
// read the old notes, pulse and duration back out of that content.
function discardMeetingRoomDraft() {
  meetingRoomDraft = null;
  document.getElementById('meetingRoomBody')?.replaceChildren();
}

function openMeetingRoom(reportId, options = {}) {
  const report = getReportById(reportId);
  if (!report) return;
  if (!confirmWorkspaceClose()) return;
  clearWorkspaceDraft();
  app.ui.meetingRoomReturnView = MAIN_VIEWS.includes(app.ui.mainView) && app.ui.mainView !== 'meetingRoom' ? app.ui.mainView : 'reports';
  app.ui.meetingRoomReportId = reportId;
  app.ui.selectedId = null;
  app.ui.creatingReport = false;
  app.ui.mainView = 'meetingRoom';
  meetingRoomDraftFor(reportId);
  if (options.presetType && MEETING_TYPES.includes(options.presetType)) meetingRoomDraft.meetingType = options.presetType;
  persistUiState();
  navigateRender(() => render());
}

function closeMeetingRoom(options = {}) {
  const draft = meetingRoomDraft;
  if (!options.force && draft && (normalizeText(draft.notes) || draft.checkedPointIds.length)) {
    if (!window.confirm('Leave the meeting room? The unlogged notes draft stays until you close the app.')) return;
  }
  if (options.discardDraft) discardMeetingRoomDraft();
  const returnView = MAIN_VIEWS.includes(app.ui.meetingRoomReturnView) && app.ui.meetingRoomReturnView !== 'meetingRoom'
    ? app.ui.meetingRoomReturnView
    : 'reports';
  app.ui.meetingRoomReportId = '';
  app.ui.mainView = returnView;
  persistUiState();
  navigateRender(() => render());
}

function captureMeetingRoomDraftFromDom() {
  if (!meetingRoomDraft) return;
  const root = document.getElementById('meetingRoomBody');
  if (!root || root.closest('[hidden]')) return;
  const shell = root.querySelector('.mr-shell');
  if (!shell || shell.getAttribute('data-mr-report') !== meetingRoomDraft.reportId) return;
  const typeEl = root.querySelector('#mrType');
  const dateEl = root.querySelector('#mrDate');
  const durationEl = root.querySelector('#mrDuration');
  const notesEl = root.querySelector('#mrNotes');
  const pulseEl = root.querySelector('input[name="mrPulse"]:checked');
  if (typeEl) meetingRoomDraft.meetingType = canonicalMeetingType(typeEl.value);
  if (dateEl) meetingRoomDraft.meetingDate = normalizeDate(dateEl.value) || todayStamp();
  if (durationEl) meetingRoomDraft.durationMinutes = durationEl.value;
  if (notesEl) meetingRoomDraft.notes = notesEl.value;
  meetingRoomDraft.pulse = pulseEl ? normalizePulse(pulseEl.value) : '';
  meetingRoomDraft.checkedPointIds = [...root.querySelectorAll('[data-mr-point]:checked')].map((input) => input.getAttribute('data-mr-point'));
}

async function wrapUpMeetingRoom() {
  const draft = meetingRoomDraft;
  const report = draft ? getReportById(draft.reportId) : null;
  if (!draft || !report) return;
  captureMeetingRoomDraftFromDom();
  const checkedIds = new Set(draft.checkedPointIds || []);
  const checkedPoints = normalizeTalkingPoints(report.talkingPoints || []).filter((point) => !point.done && checkedIds.has(point.id));
  if (!normalizeText(draft.notes) && !checkedPoints.length) {
    showToast('Add notes or tick a talking point before wrapping up.', 'warning');
    return;
  }
  const rawDuration = Number(draft.durationMinutes);
  const meetingId = nextId('meeting');
  const statusEl = document.getElementById('meetingRoomStatus');
  const logged = await addMeeting(report.id, {
    meetingType: canonicalMeetingType(draft.meetingType),
    meetingDate: normalizeDate(draft.meetingDate) || todayStamp(),
    durationMinutes: Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration) : null,
    notes: normalizeText(draft.notes),
    pulse: normalizePulse(draft.pulse),
    source: 'manual',
    externalUid: ''
  }, { meetingId, statusEl, successMessage: `Meeting wrapped up for ${report.name}.` });
  if (!logged) return;
  if (checkedPoints.length) {
    const freshReport = getReportById(report.id);
    const payload = buildFullPayloadFromReport(freshReport);
    payload.talkingPoints = normalizeTalkingPoints((freshReport.talkingPoints || []).map((point) => checkedIds.has(point.id)
      ? { ...point, done: true, doneAt: nowIso(), meetingId }
      : point));
    await updateReport(report.id, payload, { silentToast: true });
  }
  discardMeetingRoomDraft();
  closeMeetingRoom({ force: true });
}

async function saveWorkspaceChanges(event, reportId) {
  event.preventDefault();
  const formEl = event.currentTarget;
  const isCreating = !!app.ui.creatingReport;
  const report = isCreating ? null : getReportById(reportId);
  if (!isCreating && !report) return;
  const formData = new FormData(formEl);
  const payload = buildReportPayloadFromForm(formData, report);
  if (!payload.name) {
    showToast('Name is required.', 'error');
    return;
  }
  if (isCreating) {
    const personId = await createReport(payload, { skipRender: true });
    clearWorkspaceDraft();
    selectReport(personId, { skipConfirm: true, fullRender: true });
    return;
  }
  await updateReport(reportId, payload, { silentToast: true });
  // Stay in the workspace after saving. Ejecting to the grid (the old
  // behavior) made multi-tab editing miserable — reset the section edit
  // modes, drop the draft, and re-render in place instead.
  clearWorkspaceDraft();
  app.ui.profileEditMode = false;
  app.ui.vacationEditMode = false;
  app.ui.cadenceEditMode = false;
  renderDetailDrawer();
  showToast('Changes saved.', 'success');
}


