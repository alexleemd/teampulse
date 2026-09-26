function toggleFollowUp(reportId, meetingId, lineIndex, done) {
  captureWorkspaceDraftFromDom();
  clearLastDestructiveAction();
  const report = getReportById(reportId);
  const meeting = report?.meetings.find((item) => item.id === meetingId);
  if (!meeting) return false;
  const lines = String(meeting.notes || '').split('\n');
  const original = lines[lineIndex] || '';
  const match = original.match(/^\s*\[(x|X| )?\]\s+(.+)$/);
  if (!match) return false;
  lines[lineIndex] = `${done ? '[x]' : '[]'} ${normalizeText(match[2])}`;
  appendEvent({ id: nextId('event'), type: 'meeting_deleted', personId: reportId, meetingId, createdAt: nowIso() });
  appendEvent({
    id: nextId('event'),
    type: 'meeting_logged',
    personId: reportId,
    meetingId,
    meetingType: meeting.meetingType,
    meetingDate: meeting.meetingDate,
    durationMinutes: meeting.durationMinutes ?? null,
    notes: lines.join('\n'),
    pulse: normalizePulse(meeting.pulse),
    source: meeting.source || 'manual',
    externalUid: meeting.externalUid || '',
    createdAt: nowIso()
  });
  applyProjectedState();
  render();
  scheduleAutosave();
  showToast(done ? 'Follow-up marked complete.' : 'Follow-up reopened.', 'success');
  return true;
}

// ---------------------------------------------------------------------------
// v0.44: talking points, goals, feedback, and the 1:1 meeting room.
// Talking points and goals are person-level arrays saved wholesale through
// updateReport (the same pattern vacations and evidence use), so every change
// lands in the event log as a person_updated and replays cleanly.
// ---------------------------------------------------------------------------

async function addTalkingPoint(reportId, text, options = {}) {
  const report = getReportById(reportId);
  const cleanText = normalizeText(text);
  if (!report || !cleanText) return false;
  captureWorkspaceDraftFromDom();
  const payload = buildFullPayloadFromReport(report);
  payload.talkingPoints = normalizeTalkingPoints([
    ...(report.talkingPoints || []),
    { id: nextId('talkingPoint'), text: cleanText, createdAt: nowIso(), done: false, doneAt: '', meetingId: '' }
  ]);
  const ok = await updateReport(reportId, payload, { silentToast: true });
  if (ok && !options.silent) showToast('Talking point added.', 'success');
  return ok;
}

async function setTalkingPointDone(reportId, pointId, done, meetingId = '') {
  const report = getReportById(reportId);
  if (!report) return false;
  markTickPop(`tp:${pointId}`);
  captureWorkspaceDraftFromDom();
  const payload = buildFullPayloadFromReport(report);
  payload.talkingPoints = normalizeTalkingPoints((report.talkingPoints || []).map((point) => point.id === pointId
    ? { ...point, done: !!done, doneAt: done ? nowIso() : '', meetingId: done ? (meetingId || point.meetingId || '') : '' }
    : point));
  return updateReport(reportId, payload, { silentToast: true });
}

async function deleteTalkingPoint(reportId, pointId) {
  const report = getReportById(reportId);
  if (!report) return false;
  captureWorkspaceDraftFromDom();
  const payload = buildFullPayloadFromReport(report);
  payload.talkingPoints = normalizeTalkingPoints((report.talkingPoints || []).filter((point) => point.id !== pointId));
  const ok = await updateReport(reportId, payload, { silentToast: true });
  if (ok) showToast('Talking point removed.', 'success');
  return ok;
}

function openTalkingPointsFor(report) {
  return normalizeTalkingPoints(report?.talkingPoints || []).filter((point) => !point.done);
}

function talkingPointIsCarriedOver(report, point) {
  const lastLogged = latestMeetingDate(report, '1:1') || '';
  if (!lastLogged) return false;
  const createdStamp = String(point.createdAt || '').slice(0, 10);
  return !!createdStamp && createdStamp <= lastLogged;
}

async function saveGoal(reportId, goalInput) {
  const report = getReportById(reportId);
  if (!report) return false;
  const cleanTitle = normalizeText(goalInput.title);
  if (!cleanTitle) {
    showToast('A goal needs a title.', 'warning');
    return false;
  }
  captureWorkspaceDraftFromDom();
  const payload = buildFullPayloadFromReport(report);
  const goals = normalizeGoals(report.goals || []);
  const existing = goalInput.id ? goals.find((goal) => goal.id === goalInput.id) : null;
  const merged = normalizeGoal({
    ...(existing || { createdAt: nowIso() }),
    id: existing ? existing.id : nextId('goal'),
    title: cleanTitle,
    detail: normalizeText(goalInput.detail),
    status: normalizeGoalStatus(goalInput.status),
    targetDate: normalizeDate(goalInput.targetDate),
    progress: goalInput.progress,
    updates: existing ? existing.updates : []
  }, '');
  const noteText = normalizeText(goalInput.updateNote);
  const progressChanged = existing && Number(existing.progress) !== Number(merged.progress);
  if (noteText || progressChanged) {
    merged.updates = [...merged.updates, normalizeGoalUpdate({
      id: nextId('goalUpdate'),
      date: todayStamp(),
      text: noteText || `Progress set to ${merged.progress}%`,
      progress: merged.progress
    }, '')];
  }
  payload.goals = normalizeGoals(existing ? goals.map((goal) => goal.id === merged.id ? merged : goal) : [...goals, merged]);
  const ok = await updateReport(reportId, payload, { silentToast: true });
  if (ok) showToast(existing ? 'Goal updated.' : 'Goal added.', 'success');
  return ok;
}

async function deleteGoal(reportId, goalId) {
  const report = getReportById(reportId);
  const goal = normalizeGoals(report?.goals || []).find((item) => item.id === goalId);
  if (!report || !goal) return false;
  if (!window.confirm(`Remove the goal "${goal.title}"? Its progress notes go with it.`)) return false;
  captureWorkspaceDraftFromDom();
  const payload = buildFullPayloadFromReport(report);
  payload.goals = normalizeGoals((report.goals || []).filter((item) => item.id !== goalId));
  const ok = await updateReport(reportId, payload, { silentToast: true });
  if (ok) showToast('Goal removed.', 'success');
  return ok;
}

async function saveFeedbackEntry(reportId, entryInput) {
  const report = getReportById(reportId);
  if (!report) return false;
  const summary = normalizeText(entryInput.summary);
  if (!summary) {
    showToast('Feedback needs a short summary.', 'warning');
    return false;
  }
  captureWorkspaceDraftFromDom();
  const payload = buildFullPayloadFromReport(report);
  payload.evidence = normalizeEvidenceEntries([
    normalizeEvidenceEntry({
      id: nextId('evidence'),
      date: normalizeDate(entryInput.date) || todayStamp(),
      category: normalizeText(entryInput.category),
      kind: normalizeFeedbackKind(entryInput.kind),
      shared: !!entryInput.shared,
      summary,
      detail: normalizeText(entryInput.detail),
      linkedMeetingId: normalizeText(entryInput.linkedMeetingId)
    }, ''),
    ...(report.evidence || [])
  ]);
  const ok = await updateReport(reportId, payload, { silentToast: true });
  if (ok) showToast('Feedback logged.', 'success');
  return ok;
}

function goalStatusVariant(status) {
  return { 'On track': 'good', 'At risk': 'red', 'Paused': 'outline', 'Done': 'solid-good' }[status] || 'neutral';
}

function renderGoalProgressBar(goal, options = {}) {
  const progress = Math.max(0, Math.min(100, Number(goal?.progress) || 0));
  const compact = options.compact ? ' compact' : '';
  return `<div class="goal-progress${compact}" role="img" aria-label="Goal progress ${progress}%">
    <div class="goal-progress-track"><div class="goal-progress-fill" data-goal-status="${escapeHtml(goal?.status || 'On track')}" style="width:${progress}%"></div></div>
    <span class="goal-progress-pct">${progress}%</span>
  </div>`;
}

function renderPulseDots(pulseSeries = [], options = {}) {
  const limit = options.limit || 5;
  const items = [...(pulseSeries || [])].slice(0, limit).reverse();
  if (!items.length) return options.emptyHtml !== undefined ? options.emptyHtml : '<span class="pulse-dots-empty">No pulse yet</span>';
  return `<span class="pulse-dots" role="img" aria-label="Recent 1:1 pulse, oldest to newest">${items.map((item) => `<span class="pulse-dot" data-pulse="${escapeHtml(item.pulse)}" title="${escapeHtml(`${item.meetingType} · ${formatDate(item.meetingDate)} · ${PULSE_LABELS[item.pulse] || item.pulse}`)}"></span>`).join('')}</span>`;
}

function statusPillHtml(kind, value) {
  return `<span class="status-pill" data-pill-kind="${escapeHtml(kind)}" data-pill-value="${escapeHtml(value)}">${escapeHtml(value)}</span>`;
}

// Moss avatars are flat: initials on --sunken in --ink, styled by the avatar
// classes in src/styles/04-moss-components.css. The function stays so every
// call site keeps working; it adds no per-person color.
function avatarGradient(personId) {
  return '';
}

// --- Illustrated empty states -------------------------------------------
// Inline stroke icons in the same style as the sidebar set, so the zero
// network promise holds. Used by the big first-run and all-clear states;
// small filter-result notes keep their plain text.
const EMPTY_HERO_ICONS = Object.freeze({
  people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.8-3.3 3.3-5 6-5s5.2 1.7 6 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.2 14c2.4.1 4.5 1.6 5.8 4.5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5"/></svg>',
  clear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.6L16 9.5"/></svg>',
  inbox: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
});

function emptyHeroHtml(kind, title, body, actionHtml = '') {
  const icon = EMPTY_HERO_ICONS[kind] || EMPTY_HERO_ICONS.inbox;
  return `
    <div class="empty-hero${kind === 'clear' ? ' celebrate' : ''}">
      <div class="empty-hero-icon" aria-hidden="true">${icon}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
      ${actionHtml}
    </div>`;
}
