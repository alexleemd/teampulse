
function renderOpenFollowUpsPanel(report, metrics) {
  const openFollowUps = metrics.openFollowUps || [];
  if (!openFollowUps.length) return '';
  return `
    <div class="sharp-panel followup-panel">
      <div class="sharp-panel-header">
        <h3>Open Follow-Ups</h3>
        <div class="sharp-panel-header-meta">${badge(`${openFollowUps.length} open`, 'neutral')}</div>
      </div>
      <div class="sharp-panel-body">
        <div class="followup-list">
          ${openFollowUps.map((item) => `
            <label class="followup-item">
              <input type="checkbox" data-followup-toggle="${escapeHtml(item.meetingId)}::${item.lineIndex}" ${item.done ? 'checked' : ''}>
              <span class="followup-copy">
                <strong>${escapeHtml(item.text)}</strong>
                <span class="followup-meta">
                  <span>${escapeHtml(`${item.meetingType} · ${formatDate(item.meetingDate)}`)}</span>
                  <button type="button" class="followup-jump" data-jump-meeting="${escapeHtml(item.meetingId)}">Jump to meeting</button>
                </span>
              </span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderMeetingHistory(report) {
  const hasMeetings = report.meetings.length > 0;
  const followUpMap = new Map();
  if (hasMeetings) {
    extractFollowUps(report).forEach((item) => {
      if (!followUpMap.has(item.meetingId)) followUpMap.set(item.meetingId, []);
      followUpMap.get(item.meetingId).push(item);
    });
  }
  const bodyMarkup = hasMeetings ? `
    <ul class="meeting-history">
      ${report.meetings.map((meeting) => {
        const followUps = followUpMap.get(meeting.id) || [];
        const openCount = followUps.filter((item) => !item.done).length;
        const followUpBadge = followUps.length
          ? badge(`${openCount ? `${openCount} open` : 'All done'} · ${followUps.length} follow-up${followUps.length === 1 ? '' : 's'}`, openCount ? 'neutral' : 'outline')
          : '';
        const summaryText = firstMeaningfulLine(meeting.notes) || 'No notes captured for this meeting.';
        return `
        <li>
          <details class="meeting-disclosure" data-meeting-item="${escapeHtml(meeting.id)}">
            <summary class="meeting-summary">
              <div class="meeting-summary-main">
                <div class="meeting-item-meta">
                  ${badge(meeting.meetingType, 'neutral')}
                  <span class="meeting-date">${escapeHtml(formatDate(meeting.meetingDate))}${Number.isFinite(Number(meeting.durationMinutes)) && Number(meeting.durationMinutes) > 0 ? escapeHtml(` · ${Number(meeting.durationMinutes)} min`) : ''}</span>
                  ${normalizePulse(meeting.pulse) ? `<span class="meeting-pulse-inline"><span class="pulse-dot" aria-hidden="true" data-pulse="${escapeHtml(normalizePulse(meeting.pulse))}"></span>${escapeHtml(PULSE_LABELS[normalizePulse(meeting.pulse)])}</span>` : ''}
                  ${followUpBadge}
                </div>
                <div class="meeting-summary-copy">${escapeHtml(summaryText)}</div>
              </div>
              <span class="meeting-summary-toggle" aria-hidden="true"></span>
            </summary>
            <div class="meeting-item-body">
              <div class="meeting-item-head">
                <div class="meeting-item-meta">
                  <span class="meeting-item-subtle">${escapeHtml(meeting.source === 'ics' ? 'Imported from .ics' : 'Logged in Team Pulse')}</span>
                </div>
                <div class="meeting-item-actions">
                  <button type="button" class="small" data-edit-meeting="${escapeHtml(meeting.id)}">Edit</button>
                  <button type="button" class="danger small" data-delete-meeting="${escapeHtml(meeting.id)}">Delete</button>
                </div>
              </div>
              ${(() => {
                const covered = normalizeTalkingPoints(report.talkingPoints || []).filter((point) => point.done && point.meetingId === meeting.id);
                return covered.length ? `<div class="meeting-covered-points"><strong>Covered talking points</strong><ul>${covered.map((point) => `<li>${escapeHtml(point.text)}</li>`).join('')}</ul></div>` : '';
              })()}
              ${meeting.notes ? `<div class="meeting-notes note-markdown">${renderNoteMarkdown(meeting.notes)}</div>` : '<p class="section-note empty-note">No meeting notes.</p>'}
            </div>
          </details>
        </li>
      `;
      }).join('')}
    </ul>
  ` : `
    <div class="sharp-panel-body padded">
      <p class="section-note empty-note">No meetings logged yet.</p>
    </div>
  `;
  return `
    <div class="sharp-panel">
      <div class="sharp-panel-header">
        <h3>Meetings</h3>
        <div class="sharp-panel-header-meta">
          <button type="button" class="secondary" id="openMeetingModalBtn">Log Meeting</button>
        </div>
      </div>
      ${bodyMarkup}
    </div>
  `;
}

function makeDraftReport() {
  return {
    id: '',
    name: '',
    level: '',
    mentors: '',
    hireDate: '',
    lastPromotionDate: '',
    nextOneOnOneDate: '',
    nextPdcDate: '',
    pdcStatus: PDC_STATUSES[0],
    supportLevel: SUPPORT_LEVELS[0],
    developmentGoalSummary: '',
    promotionReadiness: '',
    agenda: '',
    notes: '',
    talkingPoints: [],
    goals: [],
    cadenceOverrides: {},
    vacations: [],
    snoozes: [],
    evidence: [],
    capabilities: [],
    meetings: [],
    customFields: []
  };
}

function getCurrentWorkspaceEditorState() {
  const isCreating = !!app.ui.creatingReport;
  const persistedReport = isCreating ? null : (app.ui.selectedId ? getReportById(app.ui.selectedId) : null);
  const draftKey = workspaceDraftKeyFor(isCreating, isCreating ? '' : persistedReport?.id || app.ui.selectedId);
  const draftPayload = getWorkspaceDraft(draftKey);
  const editorReport = isCreating
    ? { ...makeDraftReport(), ...(draftPayload || {}) }
    : (persistedReport ? { ...persistedReport, ...(draftPayload || {}) } : null);
  return { isCreating, persistedReport, editorReport };
}

function mutateWorkspaceDraft(mutator) {
  const formEl = document.getElementById('detailEditorForm');
  if (formEl) captureWorkspaceDraftFromDom(formEl);
  const { isCreating, persistedReport, editorReport } = getCurrentWorkspaceEditorState();
  if (!editorReport) return;
  const next = deepCopy(editorReport);
  mutator(next);
  storeWorkspaceDraft(next, isCreating, persistedReport);
  renderDetailDrawer();
}

function addVacationDraftRow() {
  captureWorkspaceDraftFromDom();
  mutateWorkspaceDraft((draft) => {
    draft.vacations = normalizeVacationEntries([...(draft.vacations || []), { id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, startDate: todayStamp(), endDate: todayStamp(), note: '' }]);
  });
}

function removeVacationDraftRow(vacationId) {
  captureWorkspaceDraftFromDom();
  mutateWorkspaceDraft((draft) => {
    draft.vacations = normalizeVacationEntries((draft.vacations || []).filter((vacation) => vacation.id !== vacationId));
  });
}

function assignVacationIds(vacations = []) {
  return normalizeVacationEntries(vacations).map((vacation) => ({
    ...vacation,
    id: normalizeText(vacation.id).startsWith('tmp_') || !normalizeText(vacation.id) ? nextId('vacation') : normalizeText(vacation.id)
  }));
}

function addEvidenceDraftRow(template = {}) {
  captureWorkspaceDraftFromDom();
  mutateWorkspaceDraft((draft) => {
    const categories = resolveEvidenceCategories(app.doc?.settings);
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const entry = normalizeEvidenceEntry({
      id: tempId,
      date: normalizeDate(template.date) || todayStamp(),
      category: normalizeText(template.category) || categories[0] || '',
      kind: normalizeFeedbackKind(template.kind),
      shared: !!template.shared,
      summary: normalizeText(template.summary),
      detail: normalizeText(template.detail),
      linkedMeetingId: normalizeText(template.linkedMeetingId)
    }, tempId);
    draft.evidence = normalizeEvidenceEntries([entry, ...(draft.evidence || [])]);
  });
}

function removeEvidenceDraftRow(evidenceId) {
  captureWorkspaceDraftFromDom();
  mutateWorkspaceDraft((draft) => {
    draft.evidence = normalizeEvidenceEntries((draft.evidence || []).filter((entry) => entry.id !== evidenceId));
  });
}

function assignEvidenceIds(evidence = []) {
  return normalizeEvidenceEntries(evidence).map((entry) => ({
    ...entry,
    id: normalizeText(entry.id).startsWith('tmp_') || !normalizeText(entry.id) ? nextId('evidence') : normalizeText(entry.id)
  }));
}
