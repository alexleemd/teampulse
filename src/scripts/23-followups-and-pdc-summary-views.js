// Renders the global Follow-Ups view: every open [ ] line from meeting notes
// across the team, grouped by person, toggleable in place.
function renderFollowUpsView() {
  if (viewSectionHidden('followUpsSection')) return;
  const mount = document.getElementById('followUpsBody');
  if (!mount) return;
  const reports = getReports();
  if (reports.length === 0) {
    mount.innerHTML = emptyHeroHtml(
      'inbox',
      'Nothing to follow up on yet',
      'Add a direct report first. Open follow-ups from their meeting notes will collect here.'
    );
    return;
  }
  const groups = reports.map((report) => {
    const metrics = getMetrics(report.id);
    return { report, items: metrics.openFollowUps || [] };
  }).filter((group) => group.items.length > 0)
    .sort((a, b) => (b.items.length - a.items.length) || (a.report.name || '').localeCompare(b.report.name || ''));

  const totalOpen = groups.reduce((sum, group) => sum + group.items.length, 0);

  const helpNote = `<p class="followups-help">Follow-ups are captured inside meeting notes: start a line with <code>[]</code> to create one, and it becomes checkable here and in the person's workspace. Ticking a box updates the note itself.</p>`;

  if (!groups.length) {
    mount.innerHTML = `${emptyHeroHtml(
      'clear',
      'All clear',
      'Every follow-up across the team is done. Nice work.'
    )}${helpNote}`;
    return;
  }

  // Each checkbox is named by its item text and source meta only (through
  // aria-labelledby), so the "Open meeting" button inside the row label does
  // not become part of the checkbox's name.
  mount.innerHTML = `
    <div class="followups-summary">${badge(`${totalOpen} open across ${groups.length} ${groups.length === 1 ? 'person' : 'people'}`, 'neutral')}</div>
    <div class="followups-view">
      ${groups.map(({ report, items }, groupIndex) => `
        <div class="sharp-panel followup-panel">
          <div class="sharp-panel-header">
            <h3><span class="fu-avatar" aria-hidden="true">${escapeHtml(personInitials(report.name))}</span><button type="button" class="fu-person-link" data-followup-open-profile="${escapeHtml(report.id)}">${escapeHtml(report.name || 'Unnamed')}</button></h3>
            <div class="sharp-panel-header-meta">${badge(`${items.length} open`, 'neutral')}</div>
          </div>
          <div class="sharp-panel-body">
            <div class="followup-list">
              ${items.map((item, itemIndex) => `
                <label class="followup-item">
                  <input type="checkbox" data-followup-global="${escapeHtml(report.id)}::${escapeHtml(item.meetingId)}::${item.lineIndex}" ${item.done ? 'checked' : ''} aria-labelledby="fuv-${groupIndex}-${itemIndex}-text fuv-${groupIndex}-${itemIndex}-meta">
                  <span class="followup-copy">
                    <strong id="fuv-${groupIndex}-${itemIndex}-text">${escapeHtml(item.text)}</strong>
                    <span class="followup-meta">
                      <span id="fuv-${groupIndex}-${itemIndex}-meta">${escapeHtml(`${item.meetingType} · ${formatDate(item.meetingDate)}`)}</span>
                      <button type="button" class="followup-jump" data-followup-open="${escapeHtml(report.id)}::${escapeHtml(item.meetingId)}">Open meeting</button>
                    </span>
                  </span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    ${helpNote}
  `;
}

// Kanban lanes in workflow order. Every lane accepts drops and a card stays
// exactly where it is dropped. Dates never move cards; they show as chips.
const PDC_BOARD_COLUMNS = Object.freeze(['Not started', 'In progress', 'Needs review', 'Blocked', 'Completed']);
const PDC_BOARD_HINTS = Object.freeze({
  'Not started': 'Nothing planned yet.',
  'In progress': 'Conversation planned or underway.',
  'Needs review': 'Outcome or follow-up needs a look.',
  'Blocked': 'Stuck. Needs unblocking.',
  'Completed': 'PDC held for this round.'
});

// Moves a card, kanban style: the drop sets the stored status and the card
// stays put. Two follow-through helpers are offered but never forced: moving
// to Completed offers to log the PDC meeting via a toast action, and moving
// to In progress offers to plan the date. The card menu exposes the same
// helpers directly ('plan-date' and 'log-pdc' pseudo-targets).
// v0.44.1: PDC rounds. The year splits into equal rounds derived from the
// PDC cadence rule (thresholds.pdcDays): 90 days gives 4 rounds, 180 gives 2,
// 365 gives 1. Rounds are calendar aligned starting in January. When a new
// round begins, every card can be moved back to Not started automatically
// (settings.pdcRoundAutoReset, on by default). The reset writes normal
// person_updated events, so the change log and timeline keep a full audit
// trail per person, and the last handled round is remembered in
// settings.lastPdcRoundKey so it runs exactly once per rollover.
function pdcRoundInfo(settings = app.doc?.settings || normalizeSettings({}), stamp = todayStamp()) {
  const pdcDays = safePositiveInteger(settings?.thresholds?.pdcDays, DEFAULT_THRESHOLDS.pdcDays);
  const anchor0 = Math.min(12, Math.max(1, safePositiveInteger(settings?.pdcRoundStartMonth, 1))) - 1;
  const options = [1, 2, 3, 4, 6, 12];
  const ideal = 365 / pdcDays;
  const roundsPerYear = options.reduce((best, option) => Math.abs(option - ideal) < Math.abs(best - ideal) ? option : best, options[0]);
  const monthsPerRound = 12 / roundsPerYear;
  const year = Number(stamp.slice(0, 4));
  const month0 = Number(stamp.slice(5, 7)) - 1;
  const anchorYear = month0 >= anchor0 ? year : year - 1;
  const monthsSinceAnchor = (month0 - anchor0 + 12) % 12;
  const index = Math.floor(monthsSinceAnchor / monthsPerRound) + 1;
  const startAbs = anchor0 + (index - 1) * monthsPerRound;
  const endAbs = startAbs + monthsPerRound - 1;
  const startYear = anchorYear + Math.floor(startAbs / 12);
  const startMonth0 = startAbs % 12;
  const endYear = anchorYear + Math.floor(endAbs / 12);
  const endMonth0 = endAbs % 12;
  const startStamp = `${startYear}-${String(startMonth0 + 1).padStart(2, '0')}-01`;
  const endStamp = localDateStamp(new Date(endYear, endMonth0 + 1, 0));
  const monthLabel = (m0, y) => FORMATTERS.monthShort.format(new Date(y, m0, 1));
  const rangeLabel = startYear === endYear
    ? `${monthLabel(startMonth0, startYear)} to ${monthLabel(endMonth0, endYear)} ${endYear}`
    : `${monthLabel(startMonth0, startYear)} ${startYear} to ${monthLabel(endMonth0, endYear)} ${endYear}`;
  const daysLeft = Math.max(0, Math.round((Date.parse(`${endStamp}T00:00:00Z`) - Date.parse(`${stamp}T00:00:00Z`)) / 86400000));
  return {
    key: `${startYear}-R${index}`,
    index,
    roundsPerYear,
    pdcDays,
    startMonth: anchor0 + 1,
    label: `Round ${index} of ${roundsPerYear}`,
    rangeLabel,
    startStamp,
    endStamp,
    daysLeft
  };
}

function maybeResetPdcRoundOnRollover() {
  if (!app.doc) return;
  const settings = app.doc.settings;
  const info = pdcRoundInfo(settings);
  if (settings.lastPdcRoundKey === info.key) return;
  const firstRun = !settings.lastPdcRoundKey;
  settings.lastPdcRoundKey = info.key;
  if (firstRun || !settings.pdcRoundAutoReset) {
    scheduleAutosave();
    return;
  }
  const toReset = getReports().filter((report) => getMetrics(report.id).pdcStatus !== 'Not started');
  toReset.forEach((report) => {
    appendEvent({
      id: nextId('event'),
      type: 'person_updated',
      personId: report.id,
      changes: { pdcStatus: 'Not started' },
      createdAt: nowIso()
    });
  });
  applyProjectedState();
  scheduleAutosave();
  if (toReset.length) {
    showToast(`New PDC round: ${info.label} (${info.rangeLabel}). ${toReset.length} card${toReset.length === 1 ? '' : 's'} moved back to Not started.`, 'info');
  }
}

async function performBoardMove(personId, targetStatus) {
  const report = getReportById(personId);
  if (!report) return;
  if (targetStatus === 'plan-date') {
    app.ui.pdcBoardDateId = personId;
    renderPdcSummaryView();
    document.querySelector(`[data-board-date-input="${CSS.escape(personId)}"]`)?.focus();
    return;
  }
  if (targetStatus === 'log-pdc') {
    openMeetingModal(personId, { presetType: 'PDC' });
    return;
  }
  if (targetStatus === 'open-room') {
    openMeetingRoom(personId);
    return;
  }
  if (!PDC_STATUSES.includes(targetStatus)) return;
  if (targetStatus === getMetrics(personId).pdcStatus) return;
  await updateReport(personId, { ...buildFullPayloadFromReport(report), pdcStatus: targetStatus }, { silentToast: true });
  if (targetStatus === 'Completed') {
    showToast(`${report.name} moved to Completed.`, 'success', { actionLabel: 'Log the PDC', duration: 7000, onAction: () => openMeetingModal(personId, { presetType: 'PDC' }) });
  } else if (targetStatus === 'In progress') {
    showToast(`${report.name} moved to In progress.`, 'success', { actionLabel: 'Plan date', duration: 7000, onAction: () => performBoardMove(personId, 'plan-date') });
  } else {
    showToast(`${report.name} moved to ${targetStatus}.`, 'success');
  }
}

function renderPdcBoardHtml(reports) {
  const grouped = new Map(PDC_BOARD_COLUMNS.map((status) => [status, []]));
  reports.forEach((r) => {
    const status = getMetrics(r.id).pdcStatus;
    (grouped.get(status) || grouped.get('Not started')).push(r);
  });
  const columns = PDC_BOARD_COLUMNS.map((status) => {
    const people = grouped.get(status);
    const cards = people.map((r) => {
      const metrics = getMetrics(r.id);
      const initials = personInitials(r.name);
      const primaryGoal = metrics.primaryGoal;
      const goal = primaryGoal ? primaryGoal.title : 'No development goal set';
      // Two unbreakable parts, so a date never splits across lines.
      const metaLast = `Last: ${metrics.lastPdc ? formatDate(metrics.lastPdc) : 'Never'} ·`;
      const metaNext = `Next: ${r.nextPdcDate ? formatDate(r.nextPdcDate) : 'Not planned'}`;
      const isDatePrompt = app.ui.pdcBoardDateId === r.id;
      const moveOptions = PDC_BOARD_COLUMNS
        .filter((s) => s !== status)
        .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
        .join('') + `<option value="open-room">Open 1:1 room…</option><option value="plan-date">Plan PDC date…</option><option value="log-pdc">Log PDC meeting…</option>`;
      const nextPdc = normalizeDate(r.nextPdcDate);
      const cardChips = [];
      if (nextPdc && nextPdc < todayStamp()) cardChips.push('<span class="mv-chip" data-tone="amber">Planned date passed</span>');
      else if (metrics.pdcOverdue) cardChips.push('<span class="mv-chip" data-tone="amber">PDC overdue</span>');
      const chipRow = cardChips.length ? `<div class="pdc-board-card-chips">${cardChips.join('')}</div>` : '';
      const dateBlock = isDatePrompt ? `
        <div class="pdc-board-date">
          <input type="date" data-board-date-input="${escapeHtml(r.id)}" value="${escapeHtml(addDays(todayStamp(), 14))}" min="${escapeHtml(todayStamp())}" aria-label="Planned PDC date">
          <div class="pdc-board-date-actions">
            <button type="button" class="primary" data-board-date-save="${escapeHtml(r.id)}">Plan</button>
            <button type="button" class="secondary" data-board-date-cancel="${escapeHtml(r.id)}">Cancel</button>
          </div>
        </div>` : '';
      return `<div class="pdc-board-card${isDatePrompt ? ' date-open' : ''}" draggable="${isDatePrompt ? 'false' : 'true'}" data-board-card="${escapeHtml(r.id)}">
        <div class="pdc-board-card-top">
          <div class="pdc-board-card-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
          <button type="button" class="pdc-board-card-name" data-pdc-summary-open="${escapeHtml(r.id)}" title="Open profile">${escapeHtml(r.name || 'Unnamed')}</button>
        </div>
        <span class="pdc-board-card-goal">${escapeHtml(goal)}</span>
        ${primaryGoal ? `<span class="pdc-board-card-goal-row">${statusPillHtml('goal', primaryGoal.status || GOAL_STATUSES[0])}${renderGoalProgressBar(primaryGoal, { compact: true })}</span>` : ''}
        <span class="pdc-board-card-meta"><span>${escapeHtml(metaLast)}</span> <span>${escapeHtml(metaNext)}</span></span>
        ${chipRow}
        ${dateBlock}
        <span class="select-wrap pdc-board-move-wrap"><select class="pdc-board-move" data-board-move="${escapeHtml(r.id)}" aria-label="Move ${escapeHtml(r.name || 'Unnamed')}">
          <option value="">Move…</option>
          ${moveOptions}
        </select></span>
      </div>`;
    }).join('');
    // Decision 5: board columns are categories, so the column itself carries
    // no status color. The label and the count say what it holds.
    const emptyBody = '<div class="pdc-board-empty">Drop here</div>';
    return `<div class="pdc-board-col" data-status="${escapeHtml(status)}">
      <div class="pdc-board-col-head">
        <h3>${escapeHtml(status)}</h3>
        <span class="pdc-board-count">${people.length}</span>
      </div>
      <p class="pdc-board-col-hint">${escapeHtml(PDC_BOARD_HINTS[status])}</p>
      <div class="pdc-board-drop" data-board-drop="${escapeHtml(status)}">${cards || emptyBody}</div>
    </div>`;
  }).join('');
  return `<div class="pdc-board">${columns}</div>`;
}

// v0.44.1: a derived kanban for 1:1 hygiene. Columns are computed from the
// cadence rules, planned dates, vacations, and snoozes, so cards cannot be
// dragged. Every card carries the fastest paths to act: open the 1:1 room,
// log a meeting, or set the next planned date inline.
const ONE_ON_ONE_BOARD_COLUMNS = Object.freeze(['Overdue', 'Due soon', 'Planned', 'On track']);
// Column headers stay neutral. The status mark next to each label: an
// overdue 1:1 is amber, on track is good, the other two are a neutral ring.
const ONE_ON_ONE_BOARD_TONES = Object.freeze({ 'Overdue': 'amber', 'Due soon': 'neutral', 'Planned': 'neutral', 'On track': 'good' });
const ONE_ON_ONE_BOARD_HINTS = Object.freeze({
  'Overdue': 'Past the cadence rule with nothing planned',
  'Due soon': 'Due within 7 days, nothing planned yet',
  'Planned': 'A future 1:1 date is set',
  'On track': 'Inside cadence, on vacation, or snoozed'
});
function renderOneOnOneBoardHtml(reports) {
  const today = todayStamp();
  const buckets = new Map(ONE_ON_ONE_BOARD_COLUMNS.map((column) => [column, []]));
  reports.forEach((report) => {
    const metrics = getMetrics(report.id);
    const planned = normalizeDate(report.nextOneOnOneDate);
    let column = 'On track';
    if (planned && planned >= today) column = 'Planned';
    else if (metrics.oneOnOneOverdue) column = 'Overdue';
    else if (Number.isFinite(metrics.oneOnOneDueInDays) && metrics.oneOnOneDueInDays <= 7) column = 'Due soon';
    buckets.get(column).push(report);
  });
  const columns = ONE_ON_ONE_BOARD_COLUMNS.map((column) => {
    const people = buckets.get(column);
    const cards = people.map((report) => {
      const metrics = getMetrics(report.id);
      const initials = personInitials(report.name);
      const daysSince = metrics.lastOneOnOne ? dateDiffInDays(metrics.lastOneOnOne) : null;
      const lastText = metrics.lastOneOnOne
        ? `Last 1:1 ${formatDate(metrics.lastOneOnOne)}${daysSince !== null ? ` · ${daysSince}d ago` : ''}`
        : 'No 1:1 logged yet';
      const planned = normalizeDate(report.nextOneOnOneDate);
      const chips = [];
      // Counts, next planned dates and On vacation are neutral tags.
      if (column === 'Planned' && planned) chips.push(`<span class="mv-chip" data-tone="neutral">${escapeHtml(formatDate(planned))}</span>`);
      if (column === 'Due soon' && Number.isFinite(metrics.oneOnOneDueInDays)) chips.push(`<span class="mv-chip" data-tone="neutral">Due in ${Math.max(0, metrics.oneOnOneDueInDays)}d</span>`);
      const openFu = (metrics.openFollowUps || []).length;
      if (openFu) chips.push(`<span class="mv-chip" data-tone="neutral">${openFu} follow-up${openFu === 1 ? '' : 's'}</span>`);
      if (metrics.vacationStatus?.active) chips.push('<span class="mv-chip" data-tone="neutral">On vacation</span>');
      return `<div class="pdc-board-card oo-board-card" data-board-card="${escapeHtml(report.id)}">
        <div class="pdc-board-card-top">
          <div class="pdc-board-card-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
          <button type="button" class="pdc-board-card-name" data-pdc-summary-open="${escapeHtml(report.id)}" title="Open profile">${escapeHtml(report.name || 'Unnamed')}</button>
        </div>
        <span class="pdc-board-card-meta">${escapeHtml(lastText)}</span>
        ${(metrics.pulseSeries || []).length ? renderPulseDots(metrics.pulseSeries, { emptyHtml: '' }) : ''}
        ${chips.length ? `<div class="pdc-board-card-chips">${chips.join('')}</div>` : ''}
        <label class="oo-plan"><span>Next 1:1</span><input type="date" data-oo-plan="${escapeHtml(report.id)}" value="${escapeHtml(planned || '')}" aria-label="Next planned 1:1 for ${escapeHtml(report.name || 'Unnamed')}"></label>
        <div class="oo-card-actions">
          <button type="button" class="small" data-open-room="${escapeHtml(report.id)}">1:1 room</button>
          <button type="button" class="small" data-oo-log="${escapeHtml(report.id)}">Log 1:1</button>
        </div>
      </div>`;
    }).join('');
    return `<div class="pdc-board-col" data-status="${escapeHtml(column)}" data-mark="${ONE_ON_ONE_BOARD_TONES[column]}">
      <div class="pdc-board-col-head">
        <span class="pdc-board-col-dot" aria-hidden="true"></span>
        <h3>${escapeHtml(column)}</h3>
        <span class="pdc-board-count">${people.length}</span>
      </div>
      <p class="pdc-board-col-hint">${escapeHtml(ONE_ON_ONE_BOARD_HINTS[column])}</p>
      <div class="pdc-board-drop">${cards || '<div class="pdc-board-empty">No one here</div>'}</div>
    </div>`;
  }).join('');
  return `<div class="pdc-board oo-board">${columns}</div>`;
}

// Renders a global PDC Summary across all reports. Each card shows the derived
// PDC status, last and next PDC dates, and the two focus fields — editable in
// place so a whole PDC round can be captured from this one screen.
function renderPdcSummaryView() {
  if (viewSectionHidden('pdcSummarySection')) return;
  const mount = document.getElementById('pdcSummaryBody');
  if (!mount) return;
  const reports = getSortedReports();
  if (reports.length === 0) {
    mount.innerHTML = `<p class="section-note empty-note">Add a direct report first. Their PDC summaries will show up here.</p>`;
    return;
  }
  const editingId = app.ui.pdcSummaryEditId || '';
  const mode = ['board', 'oneOnOneBoard'].includes(app.ui.pdcViewMode) ? app.ui.pdcViewMode : 'list';
  const roundInfo = pdcRoundInfo(app.doc?.settings);
  const roundChip = mode === 'oneOnOneBoard' ? '' : `<span class="pdc-round-chip" title="Derived from the PDC cadence rule (every ${roundInfo.pdcDays} days, so ${roundInfo.roundsPerYear} round${roundInfo.roundsPerYear === 1 ? '' : 's'} per year, anchored to month ${roundInfo.startMonth}).${app.doc?.settings?.pdcRoundAutoReset ? ' Cards move back to Not started when a new round begins.' : ' Automatic reset is off in Settings.'}">${escapeHtml(roundInfo.label)} · ${escapeHtml(roundInfo.rangeLabel)} · ${roundInfo.daysLeft} days left</span>`;
  const toolbar = `<div class="pdc-view-toolbar">
    <div class="pdc-view-toggle" role="group" aria-label="Board layout">
      <button type="button" class="${mode === 'list' ? 'active' : ''}" data-pdc-view="list" aria-pressed="${mode === 'list'}">List</button>
      <button type="button" class="${mode === 'board' ? 'active' : ''}" data-pdc-view="board" aria-pressed="${mode === 'board'}">PDC board</button>
      <button type="button" class="${mode === 'oneOnOneBoard' ? 'active' : ''}" data-pdc-view="oneOnOneBoard" aria-pressed="${mode === 'oneOnOneBoard'}">1:1 board</button>
    </div>
    ${roundChip}
  </div>`;
  if (mode === 'board') {
    mount.innerHTML = `${toolbar}${renderPdcBoardHtml(reports)}`;
    return;
  }
  if (mode === 'oneOnOneBoard') {
    mount.innerHTML = `${toolbar}${renderOneOnOneBoardHtml(reports)}`;
    return;
  }
  mount.innerHTML = `${toolbar}<div class="pdc-summary-view">
    ${reports.map((r) => {
      const metrics = getMetrics(r.id);
      const cardGoals = metrics.goals || [];
      const cardPrimaryGoal = metrics.primaryGoal;
      const prom = normalizeText(r.promotionReadiness);
      const isEditing = editingId === r.id;
      const initials = personInitials(r.name);
      const lastPdcText = metrics.lastPdc ? formatDate(metrics.lastPdc) : 'Never';
      const nextPdcText = r.nextPdcDate ? formatDate(r.nextPdcDate) : 'Not planned';
      const actions = isEditing
        ? `<div class="pdc-summary-card-actions">
             <button type="button" class="primary" data-pdc-save="${escapeHtml(r.id)}">Save</button>
             <button type="button" class="secondary" data-pdc-cancel="${escapeHtml(r.id)}">Cancel</button>
           </div>`
        : `<div class="pdc-summary-card-actions">
             <button type="button" class="small" data-pdc-edit="${escapeHtml(r.id)}">Edit</button>
             <button type="button" class="link-button pdc-summary-card-open" data-pdc-summary-open="${escapeHtml(r.id)}">Open profile →</button>
           </div>`;
      const body = isEditing
        ? `<div class="pdc-summary-card-body">
            <label class="pdc-summary-block pdc-summary-edit">
              <span class="pdc-summary-block-label">Primary goal title</span>
              <textarea data-pdc-dev placeholder="What are they working toward? Full goal editing lives in the workspace.">${escapeHtml(cardPrimaryGoal?.title || '')}</textarea>
            </label>
            <label class="pdc-summary-block pdc-summary-edit">
              <span class="pdc-summary-block-label">Promotion readiness / growth area</span>
              <textarea data-pdc-prom placeholder="Readiness notes, strengths, gaps, growth focus">${escapeHtml(prom)}</textarea>
            </label>
          </div>`
        : `<div class="pdc-summary-card-body">
            <div class="pdc-summary-block">
              <span class="pdc-summary-block-label">Development goals</span>
              ${cardGoals.length ? cardGoals.map((goal) => `<div class="pdc-summary-goal-row"><span class="pdc-summary-goal-title">${escapeHtml(goal.title)}</span>${statusPillHtml('goal', goal.status)}${renderGoalProgressBar(goal, { compact: true })}</div>`).join('') : `<p class="pdc-summary-block-empty">Not set</p>`}
            </div>
            <div class="pdc-summary-block">
              <span class="pdc-summary-block-label">Promotion readiness / growth area</span>
              ${prom ? `<p>${escapeHtml(prom)}</p>` : `<p class="pdc-summary-block-empty">Not set</p>`}
            </div>
          </div>`;
      return `<article class="pdc-summary-card${isEditing ? ' editing' : ''}" data-pdc-card="${escapeHtml(r.id)}">
        <header class="pdc-summary-card-head">
          <div class="pdc-summary-card-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
          <div class="pdc-summary-card-title">
            <h3>${escapeHtml(r.name || 'Unnamed')}</h3>
            <span class="pdc-summary-card-meta">${escapeHtml(r.level || 'Level not set')}</span>
          </div>
          ${actions}
        </header>
        <div class="pdc-summary-card-status">
          ${badge(metrics.pdcStatus, variantForPdcStatus(metrics.pdcStatus))}
          <span class="pdc-summary-card-dates">Last PDC: ${escapeHtml(lastPdcText)} · Next: ${escapeHtml(nextPdcText)}</span>
        </div>
        ${body}
      </article>`;
    }).join('')}
  </div>`;
}

