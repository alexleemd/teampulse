
// Jumps inside the workspace scroll smoothly, unless the person has asked the
// system for reduced motion, in which case they jump straight there.
function workspaceScrollBehavior() {
  const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduceMotion ? 'auto' : 'smooth';
}

function currentDetailDrawerTab() {
  // Clamp to the visible set: the workspace now only exposes Profile.
  return VISIBLE_DETAIL_DRAWER_TABS.includes(app.ui.detailDrawerTab) ? app.ui.detailDrawerTab : 'profile';
}

// Composes a clean A4 one-pager for a person (profile facts, development
// focus, evidence, recent meetings, open follow-ups) into #printSheet and
// prints it. The print stylesheet hides everything else. Bring it to the
// PDC itself or drop the PDF in the personnel file.
function printPdcOnePager(reportId) {
  const report = getReportById(reportId);
  const sheet = document.getElementById('printSheet');
  if (!report || !sheet) return;
  const metrics = getMetrics(reportId);
  const fact = (label, value) => `<div class="ps-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(normalizeText(value) || 'Not set')}</strong></div>`;
  const para = (value, emptyText) => normalizeText(value)
    ? `<p class="ps-para">${escapeHtml(value)}</p>`
    : `<p class="ps-para ps-empty">${escapeHtml(emptyText)}</p>`;
  const evidence = Array.isArray(report.evidence) ? report.evidence : [];
  const evidenceByCategory = new Map();
  evidence.forEach((entry) => {
    const category = normalizeText(entry.category) || 'Uncategorized';
    if (!evidenceByCategory.has(category)) evidenceByCategory.set(category, []);
    evidenceByCategory.get(category).push(entry);
  });
  const evidenceHtml = evidenceByCategory.size === 0
    ? '<p class="ps-para ps-empty">No evidence captured.</p>'
    : [...evidenceByCategory.entries()].map(([category, entries]) => `
        <h4>${escapeHtml(category)}</h4>
        <ul class="ps-list">${entries.map((entry) => `<li><strong>${escapeHtml(formatDate(entry.date) || 'Undated')}</strong> · ${escapeHtml(normalizeText(entry.summary) || 'No summary')}${normalizeText(entry.detail) ? ` · ${escapeHtml(entry.detail)}` : ''}</li>`).join('')}</ul>
      `).join('');
  const recentMeetings = [...(report.meetings || [])]
    .sort((a, b) => (b.meetingDate || '').localeCompare(a.meetingDate || ''))
    .slice(0, 5);
  const meetingsHtml = recentMeetings.length === 0
    ? '<p class="ps-para ps-empty">No meetings logged.</p>'
    : recentMeetings.map((m) => {
        const duration = Number.isFinite(Number(m.durationMinutes)) && Number(m.durationMinutes) > 0 ? ` · ${Number(m.durationMinutes)} min` : '';
        return `<div class="ps-meeting">
          <div class="ps-meeting-head"><strong>${escapeHtml(formatDate(m.meetingDate))}</strong> · ${escapeHtml(m.meetingType || '1:1')}${escapeHtml(duration)}</div>
          <div class="ps-notes">${renderNoteMarkdown(m.notes, { emptyHtml: '<p class="ps-empty">No notes.</p>' })}</div>
        </div>`;
      }).join('');
  const openFollowUps = metrics.openFollowUps || [];
  const followUpsHtml = openFollowUps.length === 0
    ? '<p class="ps-para ps-empty">Nothing open.</p>'
    : `<ul class="ps-list">${openFollowUps.map((item) => `<li>${escapeHtml(item.text)} <span class="ps-muted">(${escapeHtml(`${item.meetingType} · ${formatDate(item.meetingDate)}`)})</span></li>`).join('')}</ul>`;
  sheet.innerHTML = `
    <div class="ps-header">
      <div>
        <h1>${escapeHtml(report.name || 'Unnamed')}</h1>
        <p class="ps-sub">${escapeHtml(report.level || 'Level not set')}${normalizeText(report.mentors) ? ` · Mentor: ${escapeHtml(report.mentors)}` : ''}</p>
      </div>
      <div class="ps-brand">PDC One-Pager</div>
    </div>
    <div class="ps-facts">
      ${fact('PDC status', metrics.pdcStatus)}
      ${fact('Support level', report.supportLevel)}
      ${fact('Hire date', formatDate(report.hireDate))}
      ${fact('Last promotion', formatDate(report.lastPromotionDate))}
      ${fact('Last PDC', metrics.lastPdc ? formatDate(metrics.lastPdc) : '')}
      ${fact('Next PDC', formatDate(report.nextPdcDate))}
      ${fact('Next 1:1', formatDate(report.nextOneOnOneDate))}
      ${fact('Last 1:1', metrics.lastOneOnOne ? formatDate(metrics.lastOneOnOne) : '')}
    </div>
    <h3>Development goals</h3>
    ${(() => {
      const goals = normalizeGoals(report.goals || []);
      if (!goals.length) return para('', 'No development goals captured.');
      return goals.map((goal) => `${para(`${goal.title} · ${goal.status} · ${goal.progress}%${goal.targetDate ? ` · Target ${formatDate(goal.targetDate)}` : ''}`)}${goal.detail ? para(goal.detail) : ''}`).join('');
    })()}
    <h3>Promotion readiness / growth area</h3>
    ${para(report.promotionReadiness, 'No readiness notes captured.')}
    <h3>Growth evidence</h3>
    ${evidenceHtml}
    <h3>Open follow-ups</h3>
    ${followUpsHtml}
    <h3>Recent meetings</h3>
    ${meetingsHtml}
    <div class="ps-footer">Generated ${escapeHtml(formatDate(todayStamp()))} · Team Pulse ${escapeHtml(APP_VERSION)} · Contains personal data, handle accordingly</div>
  `;
  window.print();
}

function renderDetailDrawerTabBar(metrics = null, isCreating = false) {
  if (VISIBLE_DETAIL_DRAWER_TABS.length <= 1) return '';
  const activeTab = currentDetailDrawerTab();
  const openCount = !isCreating && metrics ? (metrics.openFollowUps || []).length : 0;
  return `
    <div class="drawer-workspace-tabs" id="detailWorkspaceTabBar" role="tablist" aria-label="Direct report workspace sections">
      ${VISIBLE_DETAIL_DRAWER_TABS.map((tab) => {
        const isActive = tab === activeTab;
        const countChip = tab === 'meetings' && openCount ? `<span class="drawer-tab-count" title="${openCount} open follow-up${openCount === 1 ? '' : 's'}">${openCount}</span>` : '';
        return `<button type="button" class="drawer-workspace-tab${isActive ? ' active' : ''}" data-drawer-tab="${escapeHtml(tab)}" role="tab" aria-selected="${isActive ? 'true' : 'false'}">${escapeHtml(DETAIL_DRAWER_TAB_LABELS[tab])}${countChip}</button>`;
      }).join('')}
    </div>
  `;
}

function renderDetailStatusStrip(editorReport, metrics, isCreating) {
  if (isCreating) return '';
  const items = [];
  if (metrics.vacationStatus.active) {
    items.push(badge(`On vacation · Back ${formatDate(vacationBackDate(metrics.vacationStatus.current))}`, 'neutral'));
  }
  items.push(badge(`PDC · ${metrics.pdcStatus}`, variantForPdcStatus(metrics.pdcStatus)));
  const openCount = (metrics.openFollowUps || []).length;
  if (openCount) items.push(badge(`${openCount} open follow-up${openCount === 1 ? '' : 's'}`, 'neutral'));
  const attentionCount = (metrics.attentionDetails || []).length;
  if (attentionCount) items.push(badge(`${attentionCount} attention item${attentionCount === 1 ? '' : 's'}`, 'neutral'));
  if (!items.length) return '';
  return `<div class="drawer-status-strip">${items.join('')}</div>`;
}

// A tone (from the status table) shows the value as a tag, as the support
// level does; without one the value is plain text.
function renderProfileReadonlyField(label, rawValue, tone = '') {
  const value = normalizeText(rawValue);
  const hasValue = value.length > 0;
  const valueHtml = hasValue && tone ? badge(value, tone) : escapeHtml(hasValue ? value : 'Not set');
  return `
    <div class="profile-readonly-field">
      <span class="label">${escapeHtml(label)}</span>
      <span class="value${hasValue ? '' : ' empty'}">${valueHtml}</span>
    </div>
  `;
}

function renderDetailDrawer() {
  const isCreating = !!app.ui.creatingReport;
  const persistedReport = isCreating ? null : (app.ui.selectedId ? getReportById(app.ui.selectedId) : null);
  const draftKey = workspaceDraftKeyFor(isCreating, isCreating ? '' : persistedReport?.id || app.ui.selectedId);
  const draftPayload = getWorkspaceDraft(draftKey);
  const editorReport = isCreating
    ? { ...makeDraftReport(), ...(draftPayload || {}) }
    : (persistedReport ? { ...persistedReport, ...(draftPayload || {}) } : null);
  const report = isCreating ? editorReport : persistedReport;
  if (!editorReport || !report) {
    detailDrawerEl.setAttribute('hidden', '');
    detailDrawerEl.replaceChildren();
    syncBodyOverlayLock();
    return;
  }

  const metrics = buildReportMetrics(editorReport, app.doc?.settings || normalizeSettings({}));
  const activeTab = currentDetailDrawerTab();
  const titleText = isCreating
    ? (editorReport.name || 'New Direct Report')
    : (editorReport.name || report.name || 'Direct Report');
  const levelText = isCreating
    ? (editorReport.level || 'Fill in the profile below')
    : (editorReport.level || 'Level not set');
  const profileInEditMode = isCreating || !!app.ui.profileEditMode;

  detailDrawerEl.removeAttribute('hidden');
  syncBodyOverlayLock();

  // Preserve scroll position across re-renders when we're rendering the same report & tab
  // (e.g. Edit/Cancel toggles). Resets naturally on tab switch or report change.
  const previousContentEl = detailDrawerEl.querySelector('.drawer-workspace-content');
  const previousTabEl = detailDrawerEl.querySelector('.drawer-workspace-tab.active');
  const previousTabKey = previousTabEl?.getAttribute('data-drawer-tab') || null;
  const previousReportId = detailDrawerEl.getAttribute('data-rendered-report-id') || null;
  const currentReportId = isCreating ? '__creating__' : report.id;
  const sameContext = previousTabKey === activeTab && previousReportId === currentReportId;
  const previousContentScroll = sameContext ? (previousContentEl?.scrollTop || 0) : 0;

  detailDrawerEl.setAttribute('data-rendered-report-id', currentReportId);
  detailDrawerEl.innerHTML = `
    <div class="drawer-shell">
      <div class="drawer-header">
        <div class="drawer-header-top">
          <div class="drawer-header-identity">
            <div class="detail-title-row">
              ${isCreating ? '' : `<div class="detail-page-header-avatar" style="view-transition-name:vt-${escapeHtml(report.id)};${avatarGradient(report.id)}" aria-hidden="true">${escapeHtml((titleText || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?')}</div>`}
              <h2 id="drawerTitle">${escapeHtml(titleText)}</h2>
            </div>
            <div class="detail-subhead">
              ${!isCreating && editorReport.initials ? `<span class="initials-tag">${escapeHtml(editorReport.initials)}</span>` : ''}
              <span class="detail-level">${escapeHtml(levelText)}</span>
              ${!isCreating && normalizeText(editorReport.mentors) ? `<span class="detail-mentor">Mentor: ${escapeHtml(editorReport.mentors)}</span>` : ''}
              ${isCreating ? '<span class="detail-supporting-meta">This direct report has not been saved yet.</span>' : ''}
            </div>
          </div>
          <div class="actions">
            <button type="button" class="secondary" id="closeDetailDrawerBtn">Close</button>
            ${isCreating ? '' : `<button type="button" class="secondary" data-open-room="${escapeHtml(report.id)}">1:1 room</button>`}
            ${isCreating ? '' : '<button type="button" class="secondary" id="printOnePagerBtn">One-pager</button>'}
            <button type="button" id="saveDetailChangesHeaderBtn">${isCreating ? 'Save direct report' : 'Save changes'}</button>
            ${isCreating ? '' : '<button type="button" class="danger" id="deleteSelectedBtn">Delete</button>'}
          </div>
        </div>
      </div>
      <div class="drawer-body" id="detailDrawerBody">
        <div class="drawer-header-status-block">
          ${renderDetailStatusStrip(editorReport, metrics, isCreating)}
        </div>

        <div class="drawer-workspace-layout">
          ${renderDetailDrawerTabBar(metrics, isCreating)}

          <div class="drawer-workspace-content">
            <form id="detailEditorForm" class="workspace-form-grid">
          <div class="drawer-tab-panel" data-drawer-panel="pdc-summary" ${activeTab === 'pdc-summary' ? '' : 'hidden'}>
            <div class="drawer-panel-stack">
              ${isCreating ? '' : renderDevelopmentPathPanel(editorReport)}
              <div class="drawer-section">
                <div class="drawer-section-head">
                  <div>
                    <h3>Development Focus</h3>
                    <p class="section-note">The outcome of the latest PDC: what they are working toward and where they stand. Remember to Save changes.</p>
                  </div>
                </div>
                <div class="pdc-status-row">
                  <label class="pdc-status-field">
                    <span>PDC status</span>
                    <select name="pdcStatus">${PDC_STATUSES.map((status) => `<option value="${escapeHtml(status)}" ${status === normalizePdcStatus(editorReport.rawPdcStatus !== undefined ? editorReport.rawPdcStatus : editorReport.pdcStatus) ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select>
                  </label>
                  <span class="field-hint pdc-status-hint">Fully manual, like a kanban card: shown on the board, the summary cards, and the briefing. Dragging on the PDC board changes it too. Dates never move it on their own.</span>
                </div>
                <div class="development-focus-grid">
                  <label class="development-field">
                    <span>Promotion readiness / growth area</span>
                    <textarea name="promotionReadiness" placeholder="Readiness notes, strengths, gaps, growth focus">${escapeHtml(editorReport.promotionReadiness || '')}</textarea>
                  </label>
                </div>
              </div>

              ${renderGoalsPanelMarkup(editorReport, { isCreating })}

              ${isCreating ? '' : renderEvidenceLockerMarkup(editorReport)}

              <div class="drawer-section" id="notesSection">
                <div class="drawer-section-head">
                  <div>
                    <h3>Manager Notes</h3>
                    <p class="section-note">Keep quick context, coaching notes, and review reminders here.</p>
                  </div>
                </div>
                <div class="md-shell" id="detailNotesShell" data-md-active="write">
                  <div class="md-tabs" role="tablist" aria-label="Notes editor mode">
                    <button type="button" class="md-tab active" data-md-target="detailNotesShell" data-md-mode="write" role="tab" aria-selected="true">Markdown</button>
                    <button type="button" class="md-tab" data-md-target="detailNotesShell" data-md-mode="preview" role="tab" aria-selected="false">Preview</button>
                  </div>
                  <div class="md-panel-write" role="tabpanel">
                    <textarea name="notes" id="detailNotes" class="notes-textarea" placeholder="Anything else you want to keep track of">${escapeHtml(editorReport.notes || '')}</textarea>
                  </div>
                  <div class="md-panel-preview note-markdown" id="detailNotesPreview" role="tabpanel">${renderNoteMarkdown(editorReport.notes, { emptyHtml: '<p class="note-preview-empty">Nothing to preview yet.</p>' })}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="drawer-tab-panel" data-drawer-panel="meetings" ${activeTab === 'meetings' ? '' : 'hidden'}>
            <div class="drawer-panel-stack">
              ${isCreating ? `
              <div class="sharp-panel">
                <div class="sharp-panel-header">
                  <h3>Meetings</h3>
                </div>
                <div class="sharp-panel-body padded">
                  <p class="section-note empty-note">Meeting history becomes available after the direct report has been created.</p>
                </div>
              </div>` : `
              ${renderTalkingPointsPanel(report)}
              ${renderCadencePulseSection(report)}
              ${renderOpenFollowUpsPanel(report, metrics)}
              ${renderMeetingHistory(report)}`}
            </div>
          </div>

          <div class="drawer-tab-panel" data-drawer-panel="timeline" ${activeTab === 'timeline' ? '' : 'hidden'}>
            <div class="drawer-panel-stack">
              ${renderTimelinePanel(report, { isCreating })}
            </div>
          </div>

          <div class="drawer-tab-panel" data-drawer-panel="profile" ${activeTab === 'profile' ? '' : 'hidden'}>
            <div class="drawer-panel-stack">
              <div class="drawer-section">
                <div class="drawer-section-head">
                  <div>
                    <h3>Profile</h3>
                    ${profileInEditMode ? '<p class="section-note">Edit the fields below, then Save changes to apply.</p>' : ''}
                  </div>
                  ${isCreating ? '' : (profileInEditMode
                    ? '<button type="button" class="small" id="cancelProfileEditBtn">Cancel</button>'
                    : '<button type="button" class="small" id="openProfileEditBtn">Edit</button>')}
                </div>
                ${profileInEditMode ? `
                <div class="form-grid">
                  <label><span>Name *</span><input name="name" value="${escapeHtml(editorReport.name)}" required></label>
                  <label><span>Initials</span><input name="initials" value="${escapeHtml(editorReport.initials || '')}" placeholder="e.g. MAMO" maxlength="8" autocapitalize="characters"></label>
                  <label><span>Level</span><select name="level">${renderLevelSelectOptions(editorReport.level)}</select></label>
                  <label><span>Mentor(s)</span><input name="mentors" value="${escapeHtml(editorReport.mentors || '')}" placeholder="Comma-separated if more than one"></label>
                  <label><span>Support level</span><select name="supportLevel">${SUPPORT_LEVELS.map((level) => `<option value="${escapeHtml(level)}" ${level === editorReport.supportLevel ? 'selected' : ''}>${escapeHtml(level)}</option>`).join('')}</select></label>
                  <label><span>Hire date</span><input name="hireDate" type="date" value="${escapeHtml(editorReport.hireDate || '')}"></label>
                  <label><span>Last promotion / remuneration</span><input name="lastPromotionDate" type="date" value="${escapeHtml(editorReport.lastPromotionDate || '')}"></label>
                  <label><span>Next planned 1:1</span><input name="nextOneOnOneDate" type="date" value="${escapeHtml(editorReport.nextOneOnOneDate || '')}"></label>
                  <label><span>Next planned PDC</span><input name="nextPdcDate" type="date" value="${escapeHtml(editorReport.nextPdcDate || '')}"></label>
                </div>
                ` : `
                <div class="profile-readonly-grid">
                  ${renderProfileReadonlyField('Name', editorReport.name)}
                  ${renderProfileReadonlyField('Initials', editorReport.initials)}
                  ${renderProfileReadonlyField('Level', editorReport.level)}
                  ${renderProfileReadonlyField('Mentor(s)', editorReport.mentors)}
                  ${renderProfileReadonlyField('Support level', editorReport.supportLevel || SUPPORT_LEVELS[0], variantForSupport(editorReport.supportLevel || SUPPORT_LEVELS[0]))}
                  ${renderProfileReadonlyField('Hire date', editorReport.hireDate ? formatDate(editorReport.hireDate) : '')}
                  ${renderProfileReadonlyField('Last promotion / remuneration', editorReport.lastPromotionDate ? formatDate(editorReport.lastPromotionDate) : '')}
                  ${renderProfileReadonlyField('Next planned 1:1', editorReport.nextOneOnOneDate ? formatDate(editorReport.nextOneOnOneDate) : '')}
                  ${renderProfileReadonlyField('Next planned PDC', editorReport.nextPdcDate ? formatDate(editorReport.nextPdcDate) : '')}
                </div>
                `}
              </div>

              ${isCreating ? '' : renderTenureTimelineSection(editorReport, metrics)}

              ${renderVacationTrackerMarkup(editorReport, metrics, { isCreating })}

              ${renderCadenceTargetsMarkup(editorReport, { isCreating })}

              ${isCreating ? '' : renderAttentionControlsMarkup(editorReport, metrics)}

              ${isCreating ? '' : `
              <div class="drawer-section danger-zone">
                <div class="drawer-section-head">
                  <div>
                    <h3>Danger Zone</h3>
                    <p class="section-note">Delete (header button) archives with undo and keeps history in the event log. Erase permanently removes this person and every event about them from the document — the GDPR right-to-erasure path. It cannot be undone.</p>
                  </div>
                  <button type="button" class="danger" id="purgeReportBtn">Erase permanently</button>
                </div>
              </div>`}
            </div>
          </div>
        </form>
          </div>
        </div>
      </div>
    </div>
  `;

  // Restore the content pane's scroll position (captured before innerHTML rewrite).
  if (previousContentScroll > 0) {
    const newContentEl = detailDrawerEl.querySelector('.drawer-workspace-content');
    if (newContentEl) newContentEl.scrollTop = previousContentScroll;
  }

  document.getElementById('closeDetailDrawerBtn')?.addEventListener('click', () => navigateRender(() => clearSelectedReport()));
  document.getElementById('deleteSelectedBtn')?.addEventListener('click', () => deleteReport(report.id));
  document.getElementById('saveDetailChangesHeaderBtn')?.addEventListener('click', () => {
    document.getElementById('detailEditorForm')?.requestSubmit();
  });
  document.getElementById('openProfileEditBtn')?.addEventListener('click', () => {
    app.ui.profileEditMode = true;
    renderDetailDrawer();
  });
  document.getElementById('cancelProfileEditBtn')?.addEventListener('click', () => {
    if (hasUnsavedWorkspaceChanges() && !window.confirm('Discard unsaved profile changes?')) return;
    clearWorkspaceDraft();
    app.ui.profileEditMode = false;
    renderDetailDrawer();
  });
  document.getElementById('openVacationEditBtn')?.addEventListener('click', () => {
    app.ui.vacationEditMode = true;
    renderDetailDrawer();
  });
  document.getElementById('cancelVacationEditBtn')?.addEventListener('click', () => {
    if (hasUnsavedWorkspaceChanges() && !window.confirm('Discard unsaved vacation changes?')) return;
    clearWorkspaceDraft();
    app.ui.vacationEditMode = false;
    renderDetailDrawer();
  });
  document.getElementById('openCadenceEditBtn')?.addEventListener('click', () => {
    app.ui.cadenceEditMode = true;
    renderDetailDrawer();
  });
  document.getElementById('cancelCadenceEditBtn')?.addEventListener('click', () => {
    if (hasUnsavedWorkspaceChanges() && !window.confirm('Discard unsaved cadence changes?')) return;
    clearWorkspaceDraft();
    app.ui.cadenceEditMode = false;
    renderDetailDrawer();
  });
  const detailEditorFormEl = document.getElementById('detailEditorForm');
  detailEditorFormEl?.addEventListener('submit', (event) => saveWorkspaceChanges(event, isCreating ? '' : report.id));
  bindWorkspaceDraftListeners(detailEditorFormEl);
  document.querySelectorAll('[data-drawer-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextTab = button.getAttribute('data-drawer-tab');
      if (!DETAIL_DRAWER_TABS.includes(nextTab) || currentDetailDrawerTab() === nextTab) return;
      captureWorkspaceDraftFromDom(detailEditorFormEl);
      app.ui.detailDrawerTab = nextTab;
      persistUiState();
      navigateRender(() => renderDetailDrawer());
    });
  });
  const detailNotesInputEl = document.getElementById('detailNotes');
  const detailNotesPreviewEl = document.getElementById('detailNotesPreview');
  const syncDetailNotesPreview = () => updateRenderedNotePreview(detailNotesPreviewEl, detailNotesInputEl?.value || '');
  bindMarkdownShell('detailNotesShell', { textareaEl: detailNotesInputEl, previewEl: detailNotesPreviewEl, onSync: syncDetailNotesPreview });
  syncDetailNotesPreview();
  document.getElementById('purgeReportBtn')?.addEventListener('click', () => purgeReportPermanently(report.id));
  document.getElementById('printOnePagerBtn')?.addEventListener('click', () => printPdcOnePager(report.id));
  document.getElementById('addVacationBtn')?.addEventListener('click', addVacationDraftRow);
  document.getElementById('addEvidenceBtn')?.addEventListener('click', () => {
    app.ui.detailDrawerTab = 'pdc-summary';
    persistUiState();
    addEvidenceDraftRow();
    window.setTimeout(() => {
      document.getElementById('evidenceLockerSection')?.scrollIntoView({ behavior: workspaceScrollBehavior(), block: 'start' });
      document.querySelector('#evidenceGroups [data-evidence-row] [data-evidence-summary]')?.focus();
    }, 0);
  });
  document.getElementById('saveSnoozeBtn')?.addEventListener('click', () => {
    if (!report.id) return;
    addSnooze(report.id, {
      rule: document.getElementById('attentionSnoozeRule')?.value,
      until: document.getElementById('attentionSnoozeUntil')?.value,
      reason: document.getElementById('attentionSnoozeReason')?.value
    });
  });
  document.querySelectorAll('[data-prefill-snooze-rule]').forEach((button) => {
    button.addEventListener('click', () => {
      const rule = button.getAttribute('data-prefill-snooze-rule') || 'all';
      const selectEl = document.getElementById('attentionSnoozeRule');
      if (selectEl) selectEl.value = rule;
      document.getElementById('attentionSnoozeUntil')?.focus();
    });
  });
  document.querySelectorAll('[data-remove-snooze-index]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!report.id) return;
      removeSnoozeByIndex(report.id, Number(button.getAttribute('data-remove-snooze-index')));
    });
  });
  document.querySelectorAll('[data-remove-vacation]').forEach((button) => {
    button.addEventListener('click', () => removeVacationDraftRow(button.getAttribute('data-remove-vacation')));
  });
  document.querySelectorAll('[data-remove-evidence]').forEach((button) => {
    button.addEventListener('click', () => removeEvidenceDraftRow(button.getAttribute('data-remove-evidence')));
  });
  // v0.44: talking points (instant-save), goals, feedback, timeline, 1:1 room.
  document.querySelectorAll('#detailDrawer [data-tp-toggle]').forEach((input) => {
    input.addEventListener('change', () => setTalkingPointDone(report.id, input.getAttribute('data-tp-toggle'), !!input.checked));
  });
  document.querySelectorAll('#detailDrawer [data-cdp-toggle]').forEach((input) => {
    input.addEventListener('change', () => setCapabilityAchieved(report.id, input.getAttribute('data-cdp-toggle'), !!input.checked));
  });
  document.querySelectorAll('#detailDrawer [data-cdp-stage]').forEach((button) => {
    button.addEventListener('click', () => {
      app.ui.cdpDrawerStage = button.getAttribute('data-cdp-stage') || '';
      renderDetailDrawer();
    });
  });
  document.querySelectorAll('#detailDrawer [data-cdp-date]').forEach((input) => {
    input.addEventListener('change', () => setCapabilityAchievedDate(report.id, input.getAttribute('data-cdp-date'), input.value));
  });
  document.querySelectorAll('#detailDrawer [data-tp-delete]').forEach((button) => {
    button.addEventListener('click', () => deleteTalkingPoint(report.id, button.getAttribute('data-tp-delete')));
  });
  const drawerTpInputEl = document.getElementById('drawerTpInput');
  const submitDrawerTp = async () => {
    const value = normalizeText(drawerTpInputEl?.value);
    if (!value) return;
    await addTalkingPoint(report.id, value, { silent: true });
    document.getElementById('drawerTpInput')?.focus();
  };
  drawerTpInputEl?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submitDrawerTp();
  });
  document.getElementById('drawerTpAddBtn')?.addEventListener('click', submitDrawerTp);
  document.querySelectorAll('#detailDrawer [data-open-room]').forEach((button) => {
    button.addEventListener('click', () => openMeetingRoom(button.getAttribute('data-open-room')));
  });
  document.getElementById('addGoalBtn')?.addEventListener('click', () => openGoalModal(report.id));
  document.querySelectorAll('#detailDrawer [data-goal-edit]').forEach((button) => {
    button.addEventListener('click', () => openGoalModal(report.id, button.getAttribute('data-goal-edit')));
  });
  document.getElementById('logFeedbackBtn')?.addEventListener('click', () => openFeedbackModal(report.id));
  document.querySelectorAll('#detailDrawer [data-tl-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextFilter = button.getAttribute('data-tl-filter') || 'all';
      if (app.ui.timelineFilter === nextFilter) return;
      app.ui.timelineFilter = nextFilter;
      renderDetailDrawer();
    });
  });
  document.querySelectorAll('#detailDrawer [data-tl-jump-meeting]').forEach((button) => {
    button.addEventListener('click', () => {
      const meetingId = button.getAttribute('data-tl-jump-meeting');
      captureWorkspaceDraftFromDom(detailEditorFormEl);
      app.ui.detailDrawerTab = 'meetings';
      persistUiState();
      renderDetailDrawer();
      window.setTimeout(() => {
        const target = [...document.querySelectorAll('[data-meeting-item]')].find((item) => item.getAttribute('data-meeting-item') === meetingId);
        if (target && typeof target.open === 'boolean') target.open = true;
        if (target) target.scrollIntoView({ behavior: workspaceScrollBehavior(), block: 'center' });
      }, 60);
    });
  });
  document.querySelectorAll('[data-followup-toggle]').forEach((input) => {
    input.addEventListener('change', () => {
      const [meetingId, lineIndex] = String(input.getAttribute('data-followup-toggle') || '').split('::');
      toggleFollowUp(report.id, meetingId, Number(lineIndex), !!input.checked);
    });
  });
  const jumpToMeeting = (meetingId) => {
    const target = [...document.querySelectorAll('[data-meeting-item]')].find((item) => item.getAttribute('data-meeting-item') === meetingId);
    if (target && typeof target.open === 'boolean') target.open = true;
    if (target) target.scrollIntoView({ behavior: workspaceScrollBehavior(), block: 'center' });
  };
  document.querySelectorAll('[data-jump-meeting]').forEach((button) => {
    button.addEventListener('click', () => jumpToMeeting(button.getAttribute('data-jump-meeting')));
  });
  document.querySelectorAll('[data-pulse-jump-meeting]').forEach((button) => {
    button.addEventListener('click', () => jumpToMeeting(button.getAttribute('data-pulse-jump-meeting')));
  });
  if (!isCreating) {
    document.querySelectorAll('[data-add-evidence-meeting]').forEach((button) => {
      button.addEventListener('click', () => {
        const meetingId = button.getAttribute('data-add-evidence-meeting');
        const meeting = getReportById(report.id)?.meetings.find((item) => item.id === meetingId);
        app.ui.detailDrawerTab = 'pdc-summary';
        persistUiState();
        addEvidenceDraftRow({ linkedMeetingId: meetingId, date: meeting?.meetingDate || todayStamp() });
        window.setTimeout(() => {
          document.getElementById('evidenceLockerSection')?.scrollIntoView({ behavior: workspaceScrollBehavior(), block: 'start' });
          const row = document.querySelector('#evidenceGroups [data-evidence-row]');
          row?.querySelector('[data-evidence-summary]')?.focus();
        }, 0);
      });
    });
    document.getElementById('openMeetingModalBtn')?.addEventListener('click', () => openMeetingModal(report.id));
    document.querySelectorAll('[data-edit-meeting]').forEach((button) => {
      button.addEventListener('click', () => {
        const meetingId = button.getAttribute('data-edit-meeting');
        const meeting = getReportById(report.id)?.meetings.find((item) => item.id === meetingId);
        if (meeting) openMeetingModal(report.id, { meeting });
      });
    });
    document.querySelectorAll('[data-delete-meeting]').forEach((button) => {
      button.addEventListener('click', () => deleteMeeting(report.id, button.getAttribute('data-delete-meeting')));
    });
  }

  if (isCreating && !draftPayload) {
    document.querySelector('#detailEditorForm [name="name"]')?.focus();
  }
}






