// -----------------------------------------------------------------------
// 1:1 meeting room: a full-screen per-person view for running the actual
// conversation. Left side is prep (talking points, open follow-ups, goals),
// right side is the live meeting (meta, pulse, notes, wrap up). Nothing is
// written to the event log until Wrap up; the in-flight draft lives in the
// module-level meetingRoomDraft.
// -----------------------------------------------------------------------
// The overdue triangle on the Last 1:1 chip (the reports table's shape, drawn
// in the tag's text color). Hidden from screen readers; the chip carries an
// sr-only "overdue" instead.
const MEETING_ROOM_OVERDUE_GLYPH = '<svg class="mr-overdue-glyph" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3.2 22.2 20.6H1.8Z"/><path d="M12 9.6v4.8M12 17.4v.2"/></svg>';

function renderMeetingRoomView() {
  const sectionEl = document.getElementById('meetingRoomSection');
  const mount = document.getElementById('meetingRoomBody');
  if (!sectionEl || !mount) return;
  if (sectionEl.hasAttribute('hidden')) return;
  // Preserve whatever is currently typed before the innerHTML rewrite.
  captureMeetingRoomDraftFromDom();
  const report = getReportById(app.ui.meetingRoomReportId);
  if (!report) { mount.innerHTML = ''; return; }
  const metrics = getMetrics(report.id);
  const draft = meetingRoomDraftFor(report.id);
  const checkedIds = new Set(draft.checkedPointIds || []);
  const openPoints = openTalkingPointsFor(report);
  const donePoints = normalizeTalkingPoints(report.talkingPoints || []).filter((point) => point.done);
  const openFollowUps = metrics.openFollowUps || [];
  const goals = metrics.goals || [];
  const lastOneOnOneText = metrics.lastOneOnOne
    ? `Last 1:1 ${formatDate(metrics.lastOneOnOne)}${dateDiffInDays(metrics.lastOneOnOne) !== null ? ` · ${dateDiffInDays(metrics.lastOneOnOne)}d ago` : ''}`
    : 'No 1:1 logged yet';
  // An overdue last 1:1 is amber, with a leading triangle and a screen reader
  // "overdue" (as in the reports table), so it never relies on color alone.
  const lastOneOnOneChip = metrics.oneOnOneOverdue
    ? `<span class="badge amber mr-overdue">${MEETING_ROOM_OVERDUE_GLYPH}${escapeHtml(lastOneOnOneText)}<span class="sr-only">overdue</span></span>`
    : badge(lastOneOnOneText, 'neutral');
  const chips = [
    lastOneOnOneChip,
    statusPillHtml('pdc', metrics.pdcStatus),
    openFollowUps.length ? badge(`${openFollowUps.length} open follow-up${openFollowUps.length === 1 ? '' : 's'}`, 'neutral') : '',
    report.nextOneOnOneDate ? badge(`Next planned ${formatDate(report.nextOneOnOneDate)}`, 'neutral') : '',
    metrics.vacationStatus?.active ? badge('On vacation', 'neutral') : '',
    renderPulseDots(metrics.pulseSeries, { emptyHtml: '' })
  ].filter(Boolean).join('');

  const pointsHtml = openPoints.length
    ? `<ul class="tp-list">${openPoints.map((point) => `
        <li class="tp-item">
          <label class="mr-tp-check"><input type="checkbox" data-mr-point="${escapeHtml(point.id)}" ${checkedIds.has(point.id) ? 'checked' : ''} aria-labelledby="mrTpText-${escapeHtml(point.id)}" title="Covered in this meeting"></label>
          <span class="tp-item-text" id="mrTpText-${escapeHtml(point.id)}">${escapeHtml(point.text)}${talkingPointIsCarriedOver(report, point) ? '<span class="tp-chip">Carried over</span>' : ''}</span>
          <button type="button" class="tp-delete" data-mr-tp-delete="${escapeHtml(point.id)}" title="Remove talking point" aria-label="Remove talking point">×</button>
        </li>`).join('')}</ul>`
    : '<p class="tp-empty">Nothing queued. Add the first talking point below.</p>';

  const followUpsHtml = openFollowUps.length
    ? `<div class="mr-followups">${openFollowUps.map((item) => `
        <label class="tp-item">
          <input type="checkbox" data-mr-followup="${escapeHtml(item.meetingId)}::${item.lineIndex}">
          <span class="tp-item-text">${escapeHtml(item.text)}<span class="tp-meta">${escapeHtml(`${item.meetingType} · ${formatDate(item.meetingDate)}`)}</span></span>
        </label>`).join('')}</div>`
    : '<p class="tp-empty">No open follow-ups. Clean slate.</p>';

  const goalsHtml = goals.length
    ? goals.map((goal) => `
        <div class="mr-goal-row">
          <span class="mr-goal-title" title="${escapeHtml(goal.title)}">${escapeHtml(goal.title)}</span>
          <div class="mr-goal-meta">
            ${statusPillHtml('goal', goal.status)}
            ${renderGoalProgressBar(goal, { compact: true })}
            <button type="button" class="tt-action-btn" data-mr-goal-edit="${escapeHtml(goal.id)}" title="Edit goal">Edit</button>
          </div>
        </div>`).join('')
    : '<p class="tp-empty">No goals yet. Add one to anchor the development conversation.</p>';

  mount.innerHTML = `
    <div class="mr-shell" data-mr-report="${escapeHtml(report.id)}">
      <div class="mr-header">
        <div class="mr-chips">${chips}</div>
      </div>
      <div class="mr-grid">
        <div class="mr-col">
          <section class="mr-panel">
            <div class="mr-panel-head">
              <h2>Talking Points</h2>
              <p class="section-note">Tick what you cover. Ticked points are marked discussed when you wrap up, and unticked ones carry over automatically.</p>
            </div>
            ${pointsHtml}
            <div class="tp-add">
              <input type="text" id="mrTpInput" placeholder="Add a talking point and press Enter" autocomplete="off" aria-label="New talking point">
              <button type="button" class="secondary" id="mrTpAddBtn">Add</button>
            </div>
            ${donePoints.length ? `<button type="button" class="tp-done-toggle" data-open-report-meetings="${escapeHtml(report.id)}">${donePoints.length} discussed point${donePoints.length === 1 ? '' : 's'} in the workspace →</button>` : ''}
          </section>
          <section class="mr-panel">
            <div class="mr-panel-head">
              <h2>Open Follow-Ups</h2>
              <p class="section-note">Ticking marks them complete immediately in the source meeting note.</p>
            </div>
            ${followUpsHtml}
          </section>
          <section class="mr-panel">
            <div class="mr-panel-head">
              <h2>Goals</h2>
              <p class="section-note">The development thread this conversation should touch.</p>
            </div>
            <div class="mr-goal-list">${goalsHtml}</div>
            <div class="actions mr-goal-actions">
              <button type="button" class="secondary" id="mrAddGoalBtn">Add goal</button>
              <button type="button" class="secondary" id="mrLogFeedbackBtn">Log feedback</button>
            </div>
          </section>
        </div>
        <div class="mr-col">
          ${renderPrevMeetingPanelHtml(report, draft)}
          <section class="mr-panel mr-meeting">
            <div class="mr-panel-head">
              <h2 id="mrMeetingTitle">This Meeting</h2>
            </div>
            <div class="mr-meta-row">
              <label><span>Type</span>
                <select id="mrType">${MEETING_TYPES.map((type) => `<option value="${escapeHtml(type)}" ${type === draft.meetingType ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}</select>
              </label>
              <label><span>Date</span><input id="mrDate" type="date" value="${escapeHtml(draft.meetingDate || todayStamp())}"></label>
              <label><span>Duration (min)</span><input id="mrDuration" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 45" value="${escapeHtml(String(draft.durationMinutes || ''))}"></label>
            </div>
            <div class="pulse-field">
              <span id="mrPulseLabel">How did it feel?</span>
              <div class="pulse-picker" role="radiogroup" aria-labelledby="mrPulseLabel">
                ${PULSE_VALUES.map((value) => `<label class="pulse-option" data-pulse="${value}"><input type="radio" name="mrPulse" value="${value}" ${draft.pulse === value ? 'checked' : ''}><span>${PULSE_LABELS[value]}</span></label>`).join('')}
                <button type="button" class="pulse-clear" id="mrPulseClear" title="Clear pulse">Clear</button>
              </div>
            </div>
            <textarea id="mrNotes" class="mr-notes" aria-labelledby="mrMeetingTitle" placeholder="Meeting notes in Markdown. Use [] lines for follow-ups you want tracked.">${escapeHtml(draft.notes || '')}</textarea>
            <div class="actions mr-insert-actions">
              <button type="button" class="secondary" id="mrInsertPointsBtn" ${openPoints.length ? '' : 'disabled'}>Insert talking points</button>
              <button type="button" class="secondary${draft.meetingType === 'PDC' ? '' : ' hidden'}" id="mrInsertPdcBtn">Insert PDC template</button>
            </div>
            <div class="mr-footer">
              <div id="meetingRoomStatus" class="status-line" role="status"></div>
              <button type="button" class="secondary" id="mrBackBtn">Back</button>
              <button type="button" id="mrWrapUpBtn">Wrap up meeting</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  // Per-render wiring (same pattern the drawer uses).
  const syncDraft = () => captureMeetingRoomDraftFromDom();
  // v0.46: remember whether the "Last time" recap is expanded so re-renders
  // (follow-up toggles, goal edits) do not collapse it mid-meeting.
  document.getElementById('mrPrevDetails')?.addEventListener('toggle', (event) => {
    if (meetingRoomDraft && meetingRoomDraft.reportId === report.id) meetingRoomDraft.prevNoteOpen = !!event.target.open;
  });
  ['mrType', 'mrDate', 'mrDuration'].forEach((id) => document.getElementById(id)?.addEventListener('change', () => {
    syncDraft();
    if (id === 'mrType') {
      document.getElementById('mrInsertPdcBtn')?.classList.toggle('hidden', meetingRoomDraft?.meetingType !== 'PDC');
    }
  }));
  document.getElementById('mrNotes')?.addEventListener('input', syncDraft);
  mount.querySelectorAll('input[name="mrPulse"]').forEach((input) => input.addEventListener('change', syncDraft));
  document.getElementById('mrPulseClear')?.addEventListener('click', () => {
    mount.querySelectorAll('input[name="mrPulse"]').forEach((input) => { input.checked = false; });
    syncDraft();
  });
  mount.querySelectorAll('[data-mr-point]').forEach((input) => input.addEventListener('change', syncDraft));
  mount.querySelectorAll('[data-mr-followup]').forEach((input) => input.addEventListener('change', () => {
    const [meetingId, lineIndex] = String(input.getAttribute('data-mr-followup') || '').split('::');
    toggleFollowUp(report.id, meetingId, Number(lineIndex), !!input.checked);
  }));
  mount.querySelectorAll('[data-mr-tp-delete]').forEach((button) => button.addEventListener('click', () => deleteTalkingPoint(report.id, button.getAttribute('data-mr-tp-delete'))));
  const mrTpInput = document.getElementById('mrTpInput');
  const submitTp = async () => {
    const value = normalizeText(mrTpInput?.value);
    if (!value) return;
    await addTalkingPoint(report.id, value, { silent: true });
    const restored = document.getElementById('mrTpInput');
    if (restored) restored.focus();
  };
  mrTpInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submitTp();
  });
  document.getElementById('mrTpAddBtn')?.addEventListener('click', submitTp);
  document.getElementById('mrAddGoalBtn')?.addEventListener('click', () => openGoalModal(report.id));
  mount.querySelectorAll('[data-mr-goal-edit]').forEach((button) => button.addEventListener('click', () => openGoalModal(report.id, button.getAttribute('data-mr-goal-edit'))));
  document.getElementById('mrLogFeedbackBtn')?.addEventListener('click', () => openFeedbackModal(report.id));
  mount.querySelector('[data-open-report-meetings]')?.addEventListener('click', () => {
    const id = mount.querySelector('[data-open-report-meetings]').getAttribute('data-open-report-meetings');
    closeMeetingRoom({ force: true });
    app.ui.detailDrawerTab = 'meetings';
    window.setTimeout(() => selectReport(id, { keepTab: true }), 0);
  });
  document.getElementById('mrInsertPointsBtn')?.addEventListener('click', () => {
    const notesEl = document.getElementById('mrNotes');
    const points = openTalkingPointsFor(getReportById(report.id));
    if (!notesEl || !points.length) return;
    const block = points.map((point) => `- ${point.text}`).join('\n');
    const existing = notesEl.value;
    notesEl.value = existing ? `${existing.replace(/\s+$/, '')}\n\n${block}` : block;
    syncDraft();
    notesEl.focus();
  });
  document.getElementById('mrInsertPdcBtn')?.addEventListener('click', () => {
    const notesEl = document.getElementById('mrNotes');
    if (!notesEl) return;
    const existing = notesEl.value;
    notesEl.value = existing ? `${existing.replace(/\s+$/, '')}\n\n${PDC_TEMPLATE_MARKDOWN}` : PDC_TEMPLATE_MARKDOWN;
    syncDraft();
    notesEl.focus();
  });
  document.getElementById('mrBackBtn')?.addEventListener('click', () => closeMeetingRoom());
  document.getElementById('mrWrapUpBtn')?.addEventListener('click', () => wrapUpMeetingRoom());
}

// --- "Last time" recap in the 1:1 room -----------------------------------
// The most recent logged meeting of any type, collapsed above the editor so
// twenty seconds of prep replaces digging through the workspace. Open state
// lives on the meeting room draft so mid-meeting re-renders keep it as is.
function renderPrevMeetingPanelHtml(report, draft) {
  const prev = (report.meetings || [])[0] || null;
  if (!prev) return '';
  const ago = dateDiffInDays(prev.meetingDate);
  const metaText = `${canonicalMeetingType(prev.meetingType)} · ${formatDate(prev.meetingDate)}${ago !== null && ago >= 0 ? ` · ${ago}d ago` : ''}`;
  const noteHtml = normalizeText(prev.notes)
    ? `<div class="note-markdown mr-prev-note">${renderNoteMarkdown(prev.notes)}</div>`
    : '<p class="tp-empty mr-prev-empty">No notes were written for that meeting.</p>';
  return `
    <details class="mr-prev" id="mrPrevDetails"${draft.prevNoteOpen ? ' open' : ''}>
      <summary class="mr-prev-summary">
        <span class="mr-prev-title">Last time</span>
        ${prev.pulse ? `<span class="pulse-dot" data-pulse="${escapeHtml(prev.pulse)}" role="img" aria-label="${escapeHtml(PULSE_LABELS[prev.pulse] || prev.pulse)}" title="${escapeHtml(PULSE_LABELS[prev.pulse] || prev.pulse)}"></span>` : ''}
        <span class="mr-prev-meta">${escapeHtml(metaText)}</span>
        <span class="mr-prev-chevron" aria-hidden="true">▾</span>
      </summary>
      ${noteHtml}
    </details>`;
}
