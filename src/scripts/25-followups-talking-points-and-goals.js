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
  return { 'On track': 'success', 'At risk': 'danger', 'Paused': 'neutral', 'Done': 'info' }[status] || 'neutral';
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

