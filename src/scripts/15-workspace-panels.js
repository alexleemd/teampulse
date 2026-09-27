
// v0.44: talking points panel (Meetings tab). Non-form UI; every action
// commits immediately through updateReport so the queue is never lost to an
// unsaved form. Ticking marks a point discussed; the 1:1 room stages instead.
function renderTalkingPointsPanel(report) {
  const openPoints = openTalkingPointsFor(report);
  const donePoints = normalizeTalkingPoints(report.talkingPoints || [])
    .filter((point) => point.done)
    .sort((a, b) => String(b.doneAt || b.createdAt).localeCompare(String(a.doneAt || a.createdAt)));
  const meetings = report.meetings || [];
  const openList = openPoints.length
    ? `<ul class="tp-list">${openPoints.map((point) => `
        <li class="tp-item${tickPopClass(`tp:${point.id}`)}">
          <label>
            <input type="checkbox" data-tp-toggle="${escapeHtml(point.id)}" title="Mark discussed">
            <span class="tp-item-text">${escapeHtml(point.text)}${talkingPointIsCarriedOver(report, point) ? ' <span class="tp-chip">Carried over</span>' : ''}</span>
          </label>
          <button type="button" class="tp-delete" data-tp-delete="${escapeHtml(point.id)}" title="Remove talking point" aria-label="Remove talking point">×</button>
        </li>`).join('')}</ul>`
    : '<p class="tp-empty">Nothing queued for the next conversation yet.</p>';
  const doneList = donePoints.length
    ? `<details class="tp-done-details">
        <summary class="tp-done-toggle">Discussed (${donePoints.length})</summary>
        <ul class="tp-list">${donePoints.map((point) => {
          const linkedMeeting = point.meetingId ? meetings.find((meeting) => meeting.id === point.meetingId) : null;
          const doneStamp = String(point.doneAt || '').slice(0, 10);
          return `<li class="tp-item done${tickPopClass(`tp:${point.id}`)}">
            <div class="tp-item-main">
              <label>
                <input type="checkbox" checked data-tp-toggle="${escapeHtml(point.id)}" title="Reopen talking point">
                <span class="tp-item-text">${escapeHtml(point.text)}</span>
              </label>
              <span class="tp-meta">${doneStamp ? `Discussed ${formatDate(doneStamp)}` : 'Discussed'}${linkedMeeting ? ` · <button type="button" class="tl-jump" data-jump-meeting="${escapeHtml(linkedMeeting.id)}">View meeting</button>` : ''}</span>
            </div>
            <button type="button" class="tp-delete" data-tp-delete="${escapeHtml(point.id)}" title="Remove talking point" aria-label="Remove talking point">×</button>
          </li>`;
        }).join('')}</ul>
      </details>`
    : '';
  return `
    <div class="drawer-section" id="talkingPointsSection">
      <div class="drawer-section-head">
        <div>
          <h3>Talking Points</h3>
          <p class="section-note">The running queue for the next conversation. Saved instantly, no Save changes needed. Tick a point when it is covered, or run the whole meeting from the 1:1 room.</p>
        </div>
        <button type="button" class="secondary" data-open-room="${escapeHtml(report.id)}">Open 1:1 room</button>
      </div>
      ${openList}
      <div class="tp-add">
        <input type="text" id="drawerTpInput" placeholder="Add a talking point and press Enter" autocomplete="off">
        <button type="button" class="secondary" id="drawerTpAddBtn">Add</button>
      </div>
      ${doneList}
    </div>`;
}

// v0.44: development goals panel (Development tab). Goals are edited through
// the goal modal and saved immediately, replacing the old free-text summary.
function renderGoalsPanelMarkup(editorReport, options = {}) {
  const isCreating = !!options.isCreating;
  const goals = normalizeGoals(editorReport.goals || []);
  const body = isCreating
    ? '<p class="tp-empty">Goals become available after the direct report has been created.</p>'
    : (goals.length
      ? `<div class="goal-list">${goals.map((goal) => {
          const recentUpdates = [...(goal.updates || [])].slice(-3).reverse();
          return `<div class="goal-card">
            <div class="goal-card-head">
              <span class="goal-card-title">${escapeHtml(goal.title)}</span>
              ${statusPillHtml('goal', goal.status)}
              <button type="button" class="secondary" data-goal-edit="${escapeHtml(goal.id)}">Edit</button>
            </div>
            ${renderGoalProgressBar(goal)}
            <div class="goal-card-meta">
              ${goal.targetDate ? `<span>Target ${escapeHtml(formatDate(goal.targetDate))}</span>` : ''}
              <span>${(goal.updates || []).length} update${(goal.updates || []).length === 1 ? '' : 's'}</span>
            </div>
            ${goal.detail ? `<p class="goal-card-detail">${escapeHtml(goal.detail)}</p>` : ''}
            ${recentUpdates.length ? `<ul class="goal-updates">${recentUpdates.map((update) => `<li><strong>${escapeHtml(formatDate(update.date))}</strong><span>${escapeHtml(update.text)} (${update.progress}%)</span></li>`).join('')}</ul>` : ''}
          </div>`;
        }).join('')}</div>`
      : '<p class="tp-empty">No goals yet. Add the first development goal to anchor PDCs and 1:1s.</p>');
  return `
    <div class="drawer-section" id="goalsSection">
      <div class="drawer-section-head">
        <div>
          <h3>Development Goals</h3>
          <p class="section-note">Concrete goals with status and progress. Saved instantly through the goal editor. The first active goal shows on tiles, the table, the PDC board, and the briefing.</p>
        </div>
        ${isCreating ? '' : '<button type="button" class="secondary" id="addGoalBtn">Add goal</button>'}
      </div>
      ${body}
    </div>`;
}

// v0.44: per-person timeline (Timeline tab). One reverse-chronological stream
// of meetings, feedback, goal updates, manager note snapshots, and tracked
// field changes. Everything is derived, nothing here writes to the log.
function buildTimelineItems(report) {
  const items = [];
  (report.meetings || []).forEach((meeting) => {
    items.push({
      kind: 'meeting',
      date: normalizeDate(meeting.meetingDate),
      sortKey: `${normalizeDate(meeting.meetingDate)}~2`,
      title: `${canonicalMeetingType(meeting.meetingType)} meeting`,
      pulse: normalizePulse(meeting.pulse),
      body: firstMeaningfulLine(meeting.notes) || '',
      meetingId: meeting.id
    });
  });
  normalizeEvidenceEntries(report.evidence || []).forEach((entry) => {
    items.push({
      kind: 'feedback',
      date: normalizeDate(entry.date),
      sortKey: `${normalizeDate(entry.date)}~3`,
      title: entry.summary || 'Feedback',
      kindTag: entry.kind,
      body: [entry.category, entry.shared ? 'Shared with them' : '', entry.detail].filter(Boolean).join(' · ')
    });
  });
  normalizeCapabilityTicks(report.capabilities || []).forEach((tick) => {
    const found = cdpCapabilityById(tick.id);
    if (!found) return;
    const date = normalizeDate(String(tick.achievedAt || '').slice(0, 10));
    if (!date) return;
    items.push({
      kind: 'capability',
      date,
      sortKey: `${date}~6`,
      title: 'Capability achieved',
      body: `${found.stage.level} · ${found.item.text}`
    });
  });
  normalizeGoals(report.goals || []).forEach((goal) => {
    (goal.updates || []).forEach((update) => {
      items.push({
        kind: 'goal',
        date: normalizeDate(update.date),
        sortKey: `${normalizeDate(update.date)}~4`,
        title: goal.title,
        body: `${update.text} (${update.progress}%)`
      });
    });
  });
  (report.notesHistory || []).forEach((entry) => {
    items.push({
      kind: 'note',
      date: normalizeDate(entry.noteDate),
      sortKey: `${normalizeDate(entry.noteDate)}~1${String(entry.createdAt || '')}`,
      title: 'Manager note updated',
      body: firstMeaningfulLine(entry.noteText) || ''
    });
  });
  (report.changeLog || []).forEach((entry) => {
    items.push({
      kind: 'change',
      date: normalizeDate(entry.date),
      sortKey: `${normalizeDate(entry.date)}~0${String(entry.createdAt || '')}`,
      title: `${entry.field} changed`,
      body: `${entry.from || 'Not set'} → ${entry.to || 'Not set'}`
    });
  });
  return items
    .filter((item) => item.date)
    .sort((a, b) => String(b.sortKey).localeCompare(String(a.sortKey)));
}

function renderTimelinePanel(report, options = {}) {
  if (options.isCreating) {
    return '<div class="drawer-section"><p class="tp-empty">The timeline becomes available after the direct report has been created.</p></div>';
  }
  const FILTERS = [
    ['all', 'All'],
    ['meeting', 'Meetings'],
    ['feedback', 'Feedback'],
    ['goal', 'Goals'],
    ['capability', 'Capabilities'],
    ['note', 'Notes'],
    ['change', 'Changes']
  ];
  const activeFilter = FILTERS.some(([key]) => key === app.ui.timelineFilter) ? app.ui.timelineFilter : 'all';
  const allItems = buildTimelineItems(report);
  const items = activeFilter === 'all' ? allItems : allItems.filter((item) => item.kind === activeFilter);
  const stream = items.length
    ? `<div class="tl-stream">${items.map((item) => `
        <div class="tl-item" data-tl-kind="${escapeHtml(item.kind)}">
          <div class="tl-item-head">
            <span class="tl-item-date">${escapeHtml(formatDate(item.date))}</span>
            ${item.pulse ? `<span class="pulse-dot" data-pulse="${escapeHtml(item.pulse)}" role="img" aria-label="${escapeHtml(PULSE_LABELS[item.pulse] || item.pulse)}" title="${escapeHtml(PULSE_LABELS[item.pulse] || item.pulse)}"></span>` : ''}
            <span class="tl-item-title">${escapeHtml(item.title)}</span>
            ${item.kindTag ? `<span class="tl-kind-badge" data-kind="${escapeHtml(item.kindTag)}">${escapeHtml(FEEDBACK_KIND_LABELS[item.kindTag] || item.kindTag)}</span>` : ''}
            ${item.meetingId ? `<button type="button" class="tl-jump" data-tl-jump-meeting="${escapeHtml(item.meetingId)}">View meeting</button>` : ''}
          </div>
          ${item.body ? `<p class="tl-item-body">${escapeHtml(item.body)}</p>` : ''}
        </div>`).join('')}</div>`
    : '<p class="tl-empty">Nothing here yet for this filter.</p>';
  return `
    <div class="drawer-section" id="timelineSection">
      <div class="drawer-section-head">
        <div>
          <h3 id="timelineHeading">Timeline</h3>
          <p class="section-note">Everything about this person in one stream: meetings with their pulse, feedback, goal progress, note updates, and status changes.</p>
        </div>
      </div>
      <div class="tl-filter-scroll"><div class="tl-filter" role="group" aria-labelledby="timelineHeading">${FILTERS.map(([key, label]) => `<button type="button" class="${key === activeFilter ? 'active' : ''}" data-tl-filter="${key}" aria-pressed="${key === activeFilter ? 'true' : 'false'}">${label}</button>`).join('')}</div></div>
      ${stream}
    </div>`;
}

function renderEvidenceLockerMarkup(editorReport) {
  const categories = resolveEvidenceCategories(app.doc?.settings);
  const evidence = normalizeEvidenceEntries(editorReport.evidence || []);
  const meetings = [...(editorReport.meetings || [])];
  const counts = new Map();
  evidence.forEach((entry) => {
    const key = entry.category || 'Uncategorized';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const orderedCategories = [...categories, ...[...counts.keys()].filter((category) => !categories.includes(category) && category !== 'Uncategorized')];
  const grouped = orderedCategories
    .map((category) => ({ category, items: evidence.filter((entry) => (entry.category || 'Uncategorized') === category) }))
    .filter((group) => group.items.length > 0);
  if (evidence.some((entry) => !entry.category)) {
    grouped.push({ category: 'Uncategorized', items: evidence.filter((entry) => !entry.category) });
  }
  const summaryBadges = counts.size
    ? [...counts.entries()].map(([category, count]) => badge(`${category} · ${count}`, 'neutral')).join('')
    : badge('No evidence logged yet', 'neutral');
  return `
    <div class="drawer-section" id="evidenceLockerSection">
      <div class="drawer-section-head">
        <div>
          <h3>Evidence Locker</h3>
          <p class="section-note">Capture concrete promotion, performance, and growth evidence while it is fresh.</p>
        </div>
        <div class="actions">
          <button type="button" id="logFeedbackBtn" class="secondary">Log feedback</button>
          <button type="button" id="addEvidenceBtn" class="secondary">Add Evidence</button>
        </div>
      </div>
      <div class="evidence-summary">${summaryBadges}</div>
      <div id="evidenceGroups" class="evidence-groups">
        ${grouped.length ? grouped.map((group) => `
          <div class="evidence-group">
            <div class="evidence-group-head">
              <strong>${escapeHtml(group.category)}</strong>
              ${badge(`${group.items.length} item${group.items.length === 1 ? '' : 's'}`, 'neutral')}
            </div>
            <div class="evidence-list">
              ${group.items.map((entry) => {
                const linkedMeeting = meetings.find((meeting) => meeting.id === entry.linkedMeetingId) || null;
                const meetingOptions = [`<option value="">Not linked</option>`, ...meetings.map((meeting) => `<option value="${escapeHtml(meeting.id)}" ${meeting.id === entry.linkedMeetingId ? 'selected' : ''}>${escapeHtml(`${meeting.meetingType} · ${formatDate(meeting.meetingDate)}`)}</option>`)].join('');
                const categoryOptions = [...categories];
                if (entry.category && !categoryOptions.includes(entry.category)) categoryOptions.push(entry.category);
                return `
                  <div class="evidence-row" data-evidence-row="${escapeHtml(entry.id)}">
                    <div class="evidence-row-top">
                      <label><span>Date</span><input type="date" data-evidence-date value="${escapeHtml(entry.date || '')}"></label>
                      <label><span>Category</span><select data-evidence-category>${categoryOptions.map((category) => `<option value="${escapeHtml(category)}" ${category === entry.category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select></label>
                      <label><span>Kind</span><select data-evidence-kind>${FEEDBACK_KINDS.map((kind) => `<option value="${escapeHtml(kind)}" ${kind === (entry.kind || 'observation') ? 'selected' : ''}>${escapeHtml(FEEDBACK_KIND_LABELS[kind])}</option>`).join('')}</select></label>
                      <label><span>Linked meeting</span><select data-evidence-meeting>${meetingOptions}${entry.linkedMeetingId && !linkedMeeting ? `<option value="${escapeHtml(entry.linkedMeetingId)}" selected>Linked meeting no longer exists</option>` : ''}</select>${entry.linkedMeetingId && !linkedMeeting ? '<small class="field-hint">Linked meeting no longer exists.</small>' : ''}</label>
                      <button type="button" class="danger small" data-remove-evidence="${escapeHtml(entry.id)}">Remove</button>
                    </div>
                    <div class="evidence-row-bottom">
                      <label><span>Summary</span><input type="text" data-evidence-summary value="${escapeHtml(entry.summary || '')}" placeholder="Short headline"></label>
                      <label><span>Detail</span><textarea data-evidence-detail placeholder="What happened, why it mattered, who saw it">${escapeHtml(entry.detail || '')}</textarea></label>
                      <label class="evidence-kind-shared"><input type="checkbox" data-evidence-shared ${entry.shared ? 'checked' : ''}><span>Shared with them</span></label>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('') : '<div class="evidence-empty">No evidence logged yet. Add entries directly here or use Add Evidence from a meeting.</div>'}
      </div>
    </div>
  `;
}

function renderVacationTrackerMarkup(editorReport, metrics, options = {}) {
  const isCreating = !!options.isCreating;
  const inEditMode = isCreating || !!app.ui.vacationEditMode;
  const vacations = normalizeVacationEntries(editorReport.vacations);
  const active = getVacationStatus(editorReport).current;
  const upcoming = getVacationStatus(editorReport).next;
  return `
    <div class="drawer-section">
      <div class="drawer-section-head">
        <div>
          <h3>Vacation Tracker</h3>
          <p class="section-note">Track leave windows so cadence and planning stay realistic.</p>
        </div>
        ${isCreating ? '' : (inEditMode
          ? `<div class="actions">
              <button type="button" id="addVacationBtn" class="small">Add Vacation</button>
              <button type="button" class="small" id="cancelVacationEditBtn">Cancel</button>
            </div>`
          : '<button type="button" class="small" id="openVacationEditBtn">Edit</button>')}
      </div>
      <div class="vacation-summary">
        ${active ? badge(`On vacation · Back ${formatDate(vacationBackDate(active))}`, 'neutral') : ''}
        ${!active && upcoming ? badge(`Upcoming · ${formatVacationRange(upcoming)}`, 'neutral') : ''}
        ${!active && !upcoming ? badge('No vacation scheduled', 'neutral') : ''}
      </div>
      ${inEditMode ? `
      <div id="vacationList" class="vacation-list">
        ${vacations.length ? vacations.map((vacation) => `
          <div class="vacation-row" data-vacation-row="${escapeHtml(vacation.id)}">
            <label><span>Start date</span><input type="date" data-vacation-start value="${escapeHtml(vacation.startDate || '')}"></label>
            <label><span>End date</span><input type="date" data-vacation-end value="${escapeHtml(vacation.endDate || '')}"></label>
            <label><span>Note</span><input type="text" data-vacation-note value="${escapeHtml(vacation.note || '')}" placeholder="Optional"></label>
            <button type="button" class="danger small" data-remove-vacation="${escapeHtml(vacation.id)}">Remove</button>
          </div>
        `).join('') : '<div class="vacation-empty">No vacation windows recorded yet.</div>'}
      </div>
      ` : (vacations.length ? `
      <div class="vacation-list vacation-list-readonly">
        ${vacations.map((vacation) => `
          <div class="vacation-row-readonly">
            <div class="vacation-row-readonly-range">${escapeHtml(formatVacationRange(vacation))}</div>
            ${vacation.note ? `<div class="vacation-row-readonly-note">${escapeHtml(vacation.note)}</div>` : ''}
          </div>
        `).join('')}
      </div>
      ` : '<div class="vacation-empty">No vacation windows recorded yet.</div>')}
    </div>
  `;
}

function renderCadenceTargetsMarkup(editorReport, options = {}) {
  const isCreating = !!options.isCreating;
  const inEditMode = isCreating || !!app.ui.cadenceEditMode;
  const overrides = normalizeCadenceOverrides(editorReport.cadenceOverrides);
  const defaults = {
    oneOnOneDays: app.doc?.settings?.thresholds?.oneOnOneDays || DEFAULT_THRESHOLDS.oneOnOneDays,
    pdcDays: app.doc?.settings?.thresholds?.pdcDays || DEFAULT_THRESHOLDS.pdcDays,
    cvReviewDays: app.doc?.settings?.thresholds?.cvReviewDays || DEFAULT_THRESHOLDS.cvReviewDays
  };
  const readonlyCell = (label, overrideDays, defaultDays) => {
    const using = overrideDays ? `${overrideDays} days` : `${defaultDays} days`;
    const hint = overrideDays ? '' : 'Team default';
    return `
      <div class="cadence-target-readonly">
        <span class="label">${escapeHtml(label)}</span>
        <span class="value">${escapeHtml(using)}</span>
        ${hint ? `<span class="field-hint">${escapeHtml(hint)}</span>` : ''}
      </div>
    `;
  };
  return `
    <div class="drawer-section">
      <div class="drawer-section-head">
        <div>
          <h3>Cadence Targets</h3>
          <p class="section-note">Leave a field blank to keep using the team default.</p>
        </div>
        ${isCreating ? '' : (inEditMode
          ? '<button type="button" class="small" id="cancelCadenceEditBtn">Cancel</button>'
          : '<button type="button" class="small" id="openCadenceEditBtn">Edit</button>')}
      </div>
      ${inEditMode ? `
      <div class="cadence-target-grid">
        <label>
          <span>1:1 target</span>
          <input type="number" min="1" inputmode="numeric" name="cadenceOneOnOneDays" value="${escapeHtml(String(overrides.oneOnOneDays || ''))}" placeholder="${escapeHtml(String(defaults.oneOnOneDays))}">
          <small class="field-hint">Team default: ${escapeHtml(String(defaults.oneOnOneDays))} days</small>
        </label>
        <label>
          <span>PDC target</span>
          <input type="number" min="1" inputmode="numeric" name="cadencePdcDays" value="${escapeHtml(String(overrides.pdcDays || ''))}" placeholder="${escapeHtml(String(defaults.pdcDays))}">
          <small class="field-hint">Team default: ${escapeHtml(String(defaults.pdcDays))} days</small>
        </label>
        <label>
          <span>CV review target</span>
          <input type="number" min="1" inputmode="numeric" name="cadenceCvReviewDays" value="${escapeHtml(String(overrides.cvReviewDays || ''))}" placeholder="${escapeHtml(String(defaults.cvReviewDays))}">
          <small class="field-hint">Team default: ${escapeHtml(String(defaults.cvReviewDays))} days</small>
        </label>
      </div>
      ` : `
      <div class="cadence-target-grid cadence-target-grid-readonly">
        ${readonlyCell('1:1 target', overrides.oneOnOneDays, defaults.oneOnOneDays)}
        ${readonlyCell('PDC target', overrides.pdcDays, defaults.pdcDays)}
        ${readonlyCell('CV review target', overrides.cvReviewDays, defaults.cvReviewDays)}
      </div>
      `}
    </div>
  `;
}
