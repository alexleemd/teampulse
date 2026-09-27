
function buildCadenceStrip(report, weeksShown = 12) {
  const currentMonday = startOfCurrentWeek(new Date());
  const meetings = [...(report?.meetings || [])]
    .map((meeting) => ({
      ...meeting,
      meetingType: canonicalMeetingType(meeting.meetingType),
      meetingDate: normalizeDate(meeting.meetingDate)
    }))
    .filter((meeting) => meeting.meetingDate)
    .sort((a, b) => String(a.meetingDate).localeCompare(String(b.meetingDate)) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const cells = [];
  for (let i = weeksShown - 1; i >= 0; i -= 1) {
    const weekStart = new Date(currentMonday);
    weekStart.setDate(currentMonday.getDate() - (i * 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(0, 0, 0, 0);
    const startStr = localDateStamp(weekStart);
    const endStr = localDateStamp(weekEnd);
    const weekMeetings = meetings.filter((meeting) => meeting.meetingDate >= startStr && meeting.meetingDate <= endStr);
    const firstByType = { '1:1': null, PDC: null, 'CV review': null };
    weekMeetings.forEach((meeting) => {
      if (!firstByType[meeting.meetingType]) firstByType[meeting.meetingType] = meeting;
    });
    const parts = [];
    if (firstByType['1:1']) parts.push(`1:1 on ${formatDate(firstByType['1:1'].meetingDate)}`);
    if (firstByType.PDC) parts.push(`PDC on ${formatDate(firstByType.PDC.meetingDate)}`);
    if (firstByType['CV review']) parts.push(`CV review on ${formatDate(firstByType['CV review'].meetingDate)}`);
    cells.push({
      weekStart: startStr,
      weekEnd: endStr,
      oneOnOne: !!firstByType['1:1'],
      pdc: !!firstByType.PDC,
      cvReview: !!firstByType['CV review'],
      jumpMeetingId: firstByType['1:1']?.id || firstByType.PDC?.id || firstByType['CV review']?.id || '',
      tooltip: `Week of ${formatDate(startStr)}${parts.length ? `: ${parts.join(', ')}` : ': No meetings'}`,
      isCurrentWeek: i === 0
    });
  }
  return cells;
}

function renderCadenceStripMarkup(report, weeksShown = 12, options = {}) {
  const cells = buildCadenceStrip(report, weeksShown);
  const compact = !!options.compact;
  const interactive = !!options.interactive;
  const stripClass = `pulse-strip${compact ? ' compact' : ''}`;
  const renderCell = (cell) => {
    const content = `
      <span class="pulse-bar one-on-one ${cell.oneOnOne ? 'active' : ''}"></span>
      <span class="pulse-bar pdc ${cell.pdc ? 'active' : ''}"></span>
      <span class="pulse-bar cv-review ${cell.cvReview ? 'active' : ''}"></span>
    `;
    if (interactive) {
      return `<button type="button" class="pulse-cell ${cell.isCurrentWeek ? 'current' : ''} interactive" ${cell.jumpMeetingId ? `data-pulse-jump-meeting="${escapeHtml(cell.jumpMeetingId)}"` : 'disabled'} title="${escapeHtml(cell.tooltip)}" aria-label="${escapeHtml(cell.tooltip)}">${content}</button>`;
    }
    return `<div class="pulse-cell ${cell.isCurrentWeek ? 'current' : ''}" title="${escapeHtml(cell.tooltip)}" role="img" aria-label="${escapeHtml(cell.tooltip)}">${content}</div>`;
  };
  return `<div class="${stripClass}">${cells.map((cell) => renderCell(cell)).join('')}</div>`;
}

function renderCadencePulseSection(report) {
  return `
    <div class="drawer-section" id="cadencePulseSection">
      <div class="pulse-strip-block">
        <div class="pulse-strip-head">
          <div>
            <h3>Cadence Pulse</h3>
            <p class="section-note">Twelve weeks of rhythm, oldest to newest. Click a week to jump into the meeting history.</p>
          </div>
          <div class="pulse-legend">
            <span class="legend-item"><span class="swatch ramp-6" aria-hidden="true"></span>1:1</span>
            <span class="legend-item"><span class="swatch ramp-5" aria-hidden="true"></span>PDC</span>
            <span class="legend-item"><span class="swatch ramp-4" aria-hidden="true"></span>CV Review</span>
            <span class="legend-item"><span class="swatch empty" aria-hidden="true"></span>No meeting</span>
          </div>
        </div>
        ${renderCadenceStripMarkup(report, 12, { interactive: true })}
        <div class="pulse-strip-caption">Current week is highlighted on the right.</div>
      </div>
    </div>
  `;
}

function snoozeComposerOptions(metrics) {
  const rules = [...new Set((metrics.attentionDetails || []).map((item) => item.rule))];
  if (!rules.length) return [{ rule: 'all', label: snoozeRuleLabel('all') }];
  return [{ rule: 'all', label: snoozeRuleLabel('all') }, ...rules.map((rule) => ({ rule, label: snoozeRuleLabel(rule) }))];
}

async function addSnooze(reportId, entry = {}) {
  captureWorkspaceDraftFromDom();
  clearLastDestructiveAction();
  const report = getReportById(reportId);
  if (!report) return false;
  const normalized = normalizeSnoozeEntry(entry);
  if (!normalized.rule || !normalized.until) {
    showToast('Choose an attention item and until date before snoozing.', 'warning');
    return false;
  }
  const existing = normalizeSnoozeEntries(report.snoozes || []);
  const nextSnoozes = normalized.rule === 'all'
    ? [normalized]
    : [...existing.filter((item) => item.rule !== 'all' && item.rule !== normalized.rule), normalized];
  appendEvent({ id: nextId('event'), type: 'person_updated', personId: reportId, changes: { snoozes: nextSnoozes }, createdAt: nowIso() });
  applyProjectedState();
  render();
  scheduleAutosave();
  showToast(`${snoozeRuleLabel(normalized.rule)} snoozed.`, 'success');
  return true;
}

async function removeSnoozeByIndex(reportId, snoozeIndex) {
  captureWorkspaceDraftFromDom();
  clearLastDestructiveAction();
  const report = getReportById(reportId);
  if (!report) return false;
  const active = activeSnoozeEntries(report);
  const target = active[Number(snoozeIndex)];
  if (!target) return false;
  let removed = false;
  const nextSnoozes = normalizeSnoozeEntries(report.snoozes || []).filter((entry) => {
    if (!removed && sameSnoozeEntry(entry, target)) {
      removed = true;
      return false;
    }
    return true;
  });
  appendEvent({ id: nextId('event'), type: 'person_updated', personId: reportId, changes: { snoozes: nextSnoozes }, createdAt: nowIso() });
  applyProjectedState();
  render();
  scheduleAutosave();
  showToast('Snooze removed.', 'success');
  return true;
}

function renderAttentionControlsMarkup(editorReport, metrics) {
  const defaultUntil = metrics.vacationStatus.current?.endDate || metrics.vacationStatus.next?.endDate || addDays(todayStamp(), 14);
  const options = snoozeComposerOptions(metrics);
  return `
    <div class="drawer-section">
      <div class="drawer-section-head">
        <div>
          <h3>Attention Controls</h3>
          <p class="section-note">Snooze noisy attention items for leave windows, assignments, or temporary exceptions.</p>
        </div>
        <div class="badges">
          ${badge(`${metrics.attentionDetails.length} active`, 'neutral')}
          ${metrics.activeSnoozes.length ? badge(`${metrics.activeSnoozes.length} snoozed`, 'neutral') : ''}
        </div>
      </div>
      ${metrics.attentionDetails.length ? `
        <div class="attention-list">
          ${metrics.attentionDetails.map((item) => `
            <div class="attention-item-row">
              <div class="attention-item-copy">
                ${badge(item.label, attentionTone(item.label))}
                <span class="attention-item-meta">Use Snooze if this should stop counting for a fixed period.</span>
              </div>
              <div class="attention-item-actions">
                <button type="button" class="small" data-prefill-snooze-rule="${escapeHtml(item.rule)}">Snooze</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="attention-empty">No active attention items right now.</div>'}
      <div class="attention-form">
        <div class="attention-form-grid">
          <label><span>Attention item</span><select id="attentionSnoozeRule">${options.map((option) => `<option value="${escapeHtml(option.rule)}">${escapeHtml(option.label)}</option>`).join('')}</select></label>
          <label><span>Until</span><input id="attentionSnoozeUntil" type="date" value="${escapeHtml(defaultUntil || todayStamp())}"></label>
          <label><span>Reason</span><input id="attentionSnoozeReason" type="text" placeholder="Optional"></label>
          <button type="button" class="secondary" id="saveSnoozeBtn">Snooze</button>
        </div>
        <div class="field-hint">Snoozed items stay out of attention counts until the selected date.</div>
      </div>
      ${metrics.activeSnoozes.length ? `
        <div class="snooze-list">
          ${metrics.activeSnoozes.map((entry, index) => `
            <div class="snooze-item">
              <div class="snooze-item-copy">
                ${badge(`Snoozed · ${snoozeRuleLabel(entry.rule)}`, 'outline')}
                <span class="snooze-item-meta">Until ${escapeHtml(formatDate(entry.until))}${entry.reason ? ` · ${escapeHtml(entry.reason)}` : ''}</span>
              </div>
              <div class="snooze-item-actions">
                <button type="button" class="danger small" data-remove-snooze-index="${index}">Remove</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
