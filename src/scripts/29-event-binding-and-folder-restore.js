function bindStaticEvents() {
  const reportsPlanFilterEl = document.getElementById('reportsPlanFilter');
  const reportsAttentionFilterEl = document.getElementById('reportsAttentionFilter');
  populateSelect(reportsPlanFilterEl, PDC_STATUSES, true, 'All PDC statuses');
  if (reportsPlanFilterEl) reportsPlanFilterEl.value = app.ui.planFilter || '';
  if (reportsAttentionFilterEl) reportsAttentionFilterEl.value = app.ui.attentionFilter || '';
  if (appVersionEl) appVersionEl.textContent = APP_VERSION;
  // Set version as sidebar brand tooltip.
  const brandEl = document.querySelector('.sidebar-brand');
  if (brandEl) brandEl.title = `Team Pulse ${APP_VERSION}`;

  // Unified sidebar: click delegation for main-view nav + Team Health sub-tabs.
  const sidebarEl = document.getElementById('sidebar');
  if (sidebarEl) {
    sidebarEl.addEventListener('click', (event) => {
      // Team Health sub-tab (Overview / Cadence / Attention / Support / Insights).
      const thBtn = event.target.closest('[data-nav-team-health]');
      if (thBtn) {
        const nextTab = thBtn.getAttribute('data-nav-team-health');
        if (!TEAM_HEALTH_TABS.includes(nextTab)) return;
        if (!confirmWorkspaceClose()) return;
        // If we were on a non-Team-Health view, also switch main view.
        const switchingView = app.ui.mainView !== 'teamHealth';
        if (switchingView) {
          app.ui.selectedId = null;
          app.ui.creatingReport = false;
          app.ui.mainView = 'teamHealth';
        }
        app.ui.teamHealthTab = nextTab;
        persistUiState();
        navigateRender(() => render());
        return;
      }
      // Main-view nav (Direct Reports / Meetings / Settings).
      const mainBtn = event.target.closest('[data-nav-main]');
      if (mainBtn) {
        const nextView = mainBtn.getAttribute('data-nav-main');
        if (!MAIN_VIEWS.includes(nextView)) return;
        if (app.ui.mainView === nextView) return;
        if (!confirmWorkspaceClose()) return;
        if (nextView !== 'reports') {
          app.ui.selectedId = null;
          app.ui.creatingReport = false;
        }
        app.ui.mainView = nextView;
        persistUiState();
        if (nextView === 'settings') {
          render();
          openRulesDrawer();
          return;
        }
        navigateRender(() => render());
        return;
      }
    });
  }

  // Reports tile grid: click on tile opens the detail drawer; click on add-tile creates.
  const reportsGridEl = document.getElementById('reportsGrid');
  if (reportsGridEl) {
    reportsGridEl.addEventListener('click', (event) => {
      const addBtn = event.target.closest('[data-report-add]');
      if (addBtn) {
        navigateRender(() => openCreateWorkspace());
        return;
      }
      const roomBtn = event.target.closest('[data-open-room]');
      if (roomBtn) {
        openMeetingRoom(roomBtn.getAttribute('data-open-room'));
        return;
      }
      // (keyboard equivalent for the tile's role=button span is below)
      const logBtn = event.target.closest('[data-table-log]');
      if (logBtn) {
        openMeetingModal(logBtn.getAttribute('data-table-log'));
        return;
      }
      const personBtn = event.target.closest('[data-table-person]');
      if (personBtn) {
        navigateRender(() => selectReport(personBtn.getAttribute('data-table-person')));
        return;
      }
      const tile = event.target.closest('[data-report-card]');
      if (tile) {
        const id = tile.getAttribute('data-report-card');
        navigateRender(() => selectReport(id));
      }
    });
    reportsGridEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const roomSpan = event.target.closest('[data-open-room][role="button"]');
      if (!roomSpan) return;
      event.preventDefault();
      event.stopPropagation();
      openMeetingRoom(roomSpan.getAttribute('data-open-room'));
    });
    // Table lens inline edits: PDC pill, Support pill, Next 1:1 date.
    reportsGridEl.addEventListener('change', async (event) => {
      const pdcSelect = event.target.closest('[data-table-pdc]');
      if (pdcSelect) {
        const id = pdcSelect.getAttribute('data-table-pdc');
        const report = getReportById(id);
        if (!report) return;
        const payload = buildFullPayloadFromReport(report);
        payload.pdcStatus = normalizePdcStatus(pdcSelect.value);
        await updateReport(id, payload, { silentToast: true });
        showToast(`PDC status set to ${payload.pdcStatus} for ${report.name}.`, 'success');
        return;
      }
      const supportSelect = event.target.closest('[data-table-support]');
      if (supportSelect) {
        const id = supportSelect.getAttribute('data-table-support');
        const report = getReportById(id);
        if (!report) return;
        const payload = buildFullPayloadFromReport(report);
        payload.supportLevel = normalizeSupportLevel(supportSelect.value);
        await updateReport(id, payload, { silentToast: true });
        showToast(`Support level set to ${payload.supportLevel} for ${report.name}.`, 'success');
        return;
      }
      const nextInput = event.target.closest('[data-table-next]');
      if (nextInput) {
        const id = nextInput.getAttribute('data-table-next');
        const report = getReportById(id);
        if (!report) return;
        const payload = buildFullPayloadFromReport(report);
        payload.nextOneOnOneDate = normalizeDate(nextInput.value);
        await updateReport(id, payload, { silentToast: true });
        showToast(payload.nextOneOnOneDate ? `Next 1:1 planned for ${formatDate(payload.nextOneOnOneDate)}.` : 'Next 1:1 date cleared.', 'success');
      }
    });
  }

  // Tiles vs Table switch in the reports toolbar.
  const reportsViewSwitchEl = document.getElementById('reportsViewSwitch');
  if (reportsViewSwitchEl) {
    reportsViewSwitchEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-reports-view]');
      if (!btn) return;
      const nextMode = btn.getAttribute('data-reports-view') === 'table' ? 'table' : 'tiles';
      if (nextMode === (app.ui.reportsViewMode === 'table' ? 'table' : 'tiles')) return;
      app.ui.reportsViewMode = nextMode;
      persistUiState();
      navigateRender(() => renderReportsGrid());
    });
  }

  // Reports grid search input.
  const reportsGridSearchEl = document.getElementById('reportsGridSearch');
  if (reportsGridSearchEl) {
    reportsGridSearchEl.addEventListener('input', (event) => {
      app.ui.searchTerm = event.target.value || '';
      renderReportsGrid();
      persistUiState();
    });
  }

  // Meetings view: filter change, Log Meeting button, edit existing meeting.
  const meetingsBodyEl = document.getElementById('meetingsBody');
  if (meetingsBodyEl) {
    meetingsBodyEl.addEventListener('change', (event) => {
      const filter = event.target.closest('#meetingsFilterSelect');
      if (filter) {
        app.ui.meetingsFilterReportId = filter.value || '';
        persistUiState();
        renderMeetingsView();
        return;
      }
      const typeFilter = event.target.closest('#meetingsTypeFilter');
      if (typeFilter) {
        app.ui.meetingsTypeFilter = typeFilter.value || '';
        persistUiState();
        renderMeetingsView();
      }
    });
    let meetingsSearchDebounce = 0;
    meetingsBodyEl.addEventListener('input', (event) => {
      const searchEl = event.target.closest('#meetingsSearchInput');
      if (!searchEl) return;
      app.ui.meetingsSearch = searchEl.value || '';
      window.clearTimeout(meetingsSearchDebounce);
      meetingsSearchDebounce = window.setTimeout(() => {
        renderMeetingsView();
        // The re-render replaces the input, so restore focus and caret.
        const restored = document.getElementById('meetingsSearchInput');
        if (restored) {
          restored.focus();
          const len = restored.value.length;
          restored.setSelectionRange(len, len);
        }
      }, 160);
    });
    const openEdit = (el) => {
      const reportId = el.getAttribute('data-meetings-edit-report');
      const meetingId = el.getAttribute('data-meetings-edit-meeting');
      if (!reportId || !meetingId) return;
      const report = getReportById(reportId);
      const meeting = (report?.meetings || []).find((m) => m.id === meetingId);
      if (!report || !meeting) return;
      openMeetingModal(reportId, { meeting });
    };
    meetingsBodyEl.addEventListener('click', (event) => {
      const logBtn = event.target.closest('#meetingsLogBtn');
      if (logBtn) {
        const filterId = app.ui.meetingsFilterReportId || '';
        const presetType = MEETING_TYPES.includes(app.ui.meetingsTypeFilter) ? app.ui.meetingsTypeFilter : '';
        if (filterId && getReportById(filterId)) {
          openMeetingModal(filterId, presetType ? { presetType } : {});
          return;
        }
        // No person picked — prompt them to select.
        const reports = getReports();
        if (reports.length === 0) return;
        const sel = document.getElementById('meetingsFilterSelect');
        if (sel) {
          sel.focus();
          sel.classList.add('meetings-filter-pulse');
          window.setTimeout(() => sel.classList.remove('meetings-filter-pulse'), 900);
        }
        showToast('Choose a person to log a meeting for, then click Log meeting again.', 'info');
        return;
      }
      const editItem = event.target.closest('[data-meetings-edit-meeting]');
      if (editItem) openEdit(editItem);
    });
    meetingsBodyEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const editItem = event.target.closest('[data-meetings-edit-meeting]');
      if (editItem) { event.preventDefault(); openEdit(editItem); }
    });
  }

  // Follow-Ups view: toggle completion in place, or jump to the source meeting.
  const followUpsBodyEl = document.getElementById('followUpsBody');
  if (followUpsBodyEl) {
    followUpsBodyEl.addEventListener('change', (event) => {
      const input = event.target.closest('[data-followup-global]');
      if (!input) return;
      const [reportId, meetingId, lineIndex] = String(input.getAttribute('data-followup-global') || '').split('::');
      toggleFollowUp(reportId, meetingId, Number(lineIndex), !!input.checked);
    });
    followUpsBodyEl.addEventListener('click', (event) => {
      const jumpBtn = event.target.closest('[data-followup-open]');
      if (jumpBtn) {
        const [reportId, meetingId] = String(jumpBtn.getAttribute('data-followup-open') || '').split('::');
        openReportMeetingsAt(reportId, meetingId);
        return;
      }
      const profileBtn = event.target.closest('[data-followup-open-profile]');
      if (profileBtn) navigateRender(() => selectReport(profileBtn.getAttribute('data-followup-open-profile')));
    });
  }

  // PDC Summary view: inline edit of the two focus fields, or open the workspace.
  const pdcSummaryBodyEl = document.getElementById('pdcSummaryBody');
  if (pdcSummaryBodyEl) {
    pdcSummaryBodyEl.addEventListener('click', async (event) => {
      const editBtn = event.target.closest('[data-pdc-edit]');
      if (editBtn) {
        app.ui.pdcSummaryEditId = editBtn.getAttribute('data-pdc-edit') || '';
        renderPdcSummaryView();
        document.querySelector(`[data-pdc-card="${app.ui.pdcSummaryEditId}"] [data-pdc-dev]`)?.focus();
        return;
      }
      const cancelBtn = event.target.closest('[data-pdc-cancel]');
      if (cancelBtn) {
        app.ui.pdcSummaryEditId = '';
        renderPdcSummaryView();
        return;
      }
      const saveBtn = event.target.closest('[data-pdc-save]');
      if (saveBtn) {
        const id = saveBtn.getAttribute('data-pdc-save') || '';
        const card = pdcSummaryBodyEl.querySelector(`[data-pdc-card="${CSS.escape(id)}"]`);
        const report = getReportById(id);
        if (!card || !report) return;
        const payload = buildFullPayloadFromReport(report);
        const nextGoalTitle = normalizeText(card.querySelector('[data-pdc-dev]')?.value);
        const currentGoals = normalizeGoals(report.goals || []);
        const currentPrimary = currentGoals.find((goal) => goal.status !== 'Done') || currentGoals[0] || null;
        if (currentPrimary) {
          payload.goals = normalizeGoals(currentGoals.map((goal) => goal.id === currentPrimary.id ? { ...goal, title: nextGoalTitle || goal.title } : goal));
        } else if (nextGoalTitle) {
          payload.goals = normalizeGoals([...currentGoals, { id: nextId('goal'), title: nextGoalTitle, detail: '', status: 'On track', targetDate: '', progress: 0, createdAt: nowIso(), updates: [] }]);
        }
        payload.promotionReadiness = normalizeText(card.querySelector('[data-pdc-prom]')?.value);
        app.ui.pdcSummaryEditId = '';
        await updateReport(id, payload, { silentToast: true });
        showToast(`PDC summary updated for ${report.name}.`, 'success');
        return;
      }
      const openBtn = event.target.closest('[data-pdc-summary-open]');
      if (openBtn) {
        const id = openBtn.getAttribute('data-pdc-summary-open');
        if (id) navigateRender(() => selectReport(id));
        return;
      }
      const roomBtn = event.target.closest('[data-open-room]');
      if (roomBtn) {
        openMeetingRoom(roomBtn.getAttribute('data-open-room'));
        return;
      }
      const ooLogBtn = event.target.closest('[data-oo-log]');
      if (ooLogBtn) {
        openMeetingModal(ooLogBtn.getAttribute('data-oo-log'), { presetType: '1:1' });
        return;
      }
      const viewBtn = event.target.closest('[data-pdc-view]');
      if (viewBtn) {
        const requested = viewBtn.getAttribute('data-pdc-view');
        const nextMode = ['board', 'oneOnOneBoard'].includes(requested) ? requested : 'list';
        if (nextMode !== (['board', 'oneOnOneBoard'].includes(app.ui.pdcViewMode) ? app.ui.pdcViewMode : 'list')) {
          app.ui.pdcViewMode = nextMode;
          app.ui.pdcBoardDateId = '';
          persistUiState();
          navigateRender(() => renderPdcSummaryView());
        }
        return;
      }
      const dateSaveBtn = event.target.closest('[data-board-date-save]');
      if (dateSaveBtn) {
        const id = dateSaveBtn.getAttribute('data-board-date-save');
        const input = pdcSummaryBodyEl.querySelector(`[data-board-date-input="${CSS.escape(id)}"]`);
        const value = normalizeDate(input?.value);
        const report = getReportById(id);
        if (!report) return;
        if (!value) {
          showToast('Pick a date for the PDC.', 'warning');
          return;
        }
        app.ui.pdcBoardDateId = '';
        await updateReport(id, { ...buildFullPayloadFromReport(report), nextPdcDate: value }, { silentToast: true });
        showToast(`PDC planned for ${formatDate(value)}.`, 'success');
        return;
      }
      const dateCancelBtn = event.target.closest('[data-board-date-cancel]');
      if (dateCancelBtn) {
        app.ui.pdcBoardDateId = '';
        renderPdcSummaryView();
      }
    });
    pdcSummaryBodyEl.addEventListener('change', (event) => {
      const ooPlanInput = event.target.closest('[data-oo-plan]');
      if (ooPlanInput) {
        const id = ooPlanInput.getAttribute('data-oo-plan');
        const report = getReportById(id);
        if (!report) return;
        const value = normalizeDate(ooPlanInput.value);
        updateReport(id, { ...buildFullPayloadFromReport(report), nextOneOnOneDate: value }, { silentToast: true }).then(() => {
          showToast(value ? `Next 1:1 with ${report.name} planned for ${formatDate(value)}.` : `Planned 1:1 date cleared for ${report.name}.`, 'success');
        });
        return;
      }
      const moveSel = event.target.closest('[data-board-move]');
      if (!moveSel) return;
      const target = moveSel.value;
      moveSel.value = '';
      if (target) performBoardMove(moveSel.getAttribute('data-board-move'), target);
    });
    // Native drag and drop between board columns.
    let boardDragId = null;
    pdcSummaryBodyEl.addEventListener('dragstart', (event) => {
      const card = event.target.closest('[data-board-card]');
      if (!card) return;
      boardDragId = card.getAttribute('data-board-card');
      card.classList.add('dragging');
      if (event.dataTransfer) {
        event.dataTransfer.setData('text/plain', boardDragId);
        event.dataTransfer.effectAllowed = 'move';
      }
    });
    pdcSummaryBodyEl.addEventListener('dragover', (event) => {
      const zone = event.target.closest('[data-board-drop]');
      if (!zone) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');
    });
    pdcSummaryBodyEl.addEventListener('dragleave', (event) => {
      const zone = event.target.closest('[data-board-drop]');
      if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('drag-over');
    });
    pdcSummaryBodyEl.addEventListener('drop', (event) => {
      const zone = event.target.closest('[data-board-drop]');
      if (!zone) return;
      event.preventDefault();
      zone.classList.remove('drag-over');
      const id = (event.dataTransfer && event.dataTransfer.getData('text/plain')) || boardDragId;
      boardDragId = null;
      if (id) performBoardMove(id, zone.getAttribute('data-board-drop'));
    });
    pdcSummaryBodyEl.addEventListener('dragend', () => {
      boardDragId = null;
      pdcSummaryBodyEl.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
      pdcSummaryBodyEl.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    });
  }

  // Settings content-pane card → open rules drawer.
  const settingsBody = document.getElementById('settingsSectionBody');
  if (settingsBody) {
    settingsBody.addEventListener('click', (event) => {
      const openBtn = event.target.closest('[data-settings-open]');
      if (openBtn) openRulesDrawer();
    });
  }

  addReportBtn.addEventListener('click', () => navigateRender(() => openCreateWorkspace()));
  startupChooseFolderBtn?.addEventListener('click', async () => {
    const connected = await chooseFolderAndConnect();
    if (connected) closeStartupPrompt();
  });
  startupImportJsonBtn?.addEventListener('click', async () => {
    const imported = await importLegacyJsonFlow();
    if (imported) closeStartupPrompt();
  });
  startupUseSavedFolderBtn?.addEventListener('click', async () => {
    if (!startupStoredFolderHandle) return;
    const connected = await connectFolderHandle(startupStoredFolderHandle);
    if (connected) closeStartupPrompt();
  });
  createJsonFileBtn.addEventListener('click', () => chooseFolderAndConnect());
  openJsonFileBtn.addEventListener('click', importLegacyJsonFlow);
  saveFileBtn.addEventListener('click', () => {
    closeDataMenu();
    if (app.folderHandle && app.connectedFolderReady) {
      flushAutosaveQueue(true);
    } else {
      chooseFolderAndConnect();
    }
  });
  connectDataFileBtn.addEventListener('click', () => {
    closeDataMenu();
    importLegacyJsonFlow();
  });
  importIcsBtn.addEventListener('click', () => {
    closeDataMenu();
    beginIcsImport(app.ui.selectedId || null, app.ui.selectedId ? 'meetingStatus' : '');
  });
  icsFileInputEl.addEventListener('change', handleIcsFileSelection);
  exportCsvBtn.addEventListener('click', () => {
    closeDataMenu();
    exportPlainFiles();
  });
  // Data menu keyboard support: while it is open, the arrow keys move between
  // the enabled items and Home and End jump to the ends. Escape (handled by
  // the document listener below) closes it; focus goes back to the trigger
  // first so it is never lost inside the closed popover.
  dataMenuEl?.addEventListener('keydown', (event) => {
    if (!dataMenuEl.hasAttribute('open')) return;
    const trigger = dataMenuEl.querySelector('summary');
    if (event.key === 'Escape') {
      if (trigger && dataMenuEl.querySelector('.toolbar-menu-popover')?.contains(document.activeElement)) trigger.focus();
      return;
    }
    const items = [...dataMenuEl.querySelectorAll('.toolbar-menu-item:not(:disabled)')];
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next < 0) return;
    event.preventDefault();
    items[next].focus();
  });
  saveDockBtn.addEventListener('click', () => flushAutosaveQueue(true));
  dismissDockBtn.addEventListener('click', () => saveDockEl.classList.add('hidden'));

  reportsPlanFilterEl?.addEventListener('change', () => {
    app.ui.planFilter = reportsPlanFilterEl.value || '';
    persistUiState();
    renderReportsGrid();
  });
  reportsAttentionFilterEl?.addEventListener('change', () => {
    app.ui.attentionFilter = reportsAttentionFilterEl.value || '';
    persistUiState();
    renderReportsGrid();
  });
  clearQuickFilterBtn.addEventListener('click', () => {
    if (!app.ui.activeThemeFilter) return;
    app.ui.activeThemeFilter = '';
    persistUiState();
    renderQuickFilterBar();
    renderReportsGrid();
  });

  closeMeetingModalBtn.addEventListener('click', dismissMeetingModal);
  cancelMeetingModalBtn.addEventListener('click', dismissMeetingModal);
  meetingFormEl.addEventListener('submit', handleMeetingSubmit);
  bindMarkdownShell('meetingNotesShell', { textareaEl: meetingNotesInputEl, previewEl: meetingNotesPreviewEl, onSync: syncMeetingNotesPreview });
  meetingImportIcsBtn.addEventListener('click', () => {
    const reportId = normalizeText(document.getElementById('meetingReportId')?.value) || app.ui.selectedId;
    if (!reportId) {
      showToast('Open a direct report before importing a meeting.', 'warning');
      return;
    }
    beginIcsImport(reportId, 'meetingStatus', { closeMeetingModalOnSuccess: true });
  });
  document.getElementById('insertAgendaBtn')?.addEventListener('click', () => {
    const reportId = normalizeText(document.getElementById('meetingReportId')?.value);
    const points = openTalkingPointsFor(getReportById(reportId));
    if (!points.length) return;
    const notesEl = document.getElementById('meetingNotes');
    if (!notesEl) return;
    const block = points.map((point) => `- ${point.text}`).join('\n');
    const existing = notesEl.value;
    notesEl.value = existing ? `${existing.replace(/\s+$/, '')}\n\n${block}` : block;
    syncMeetingNotesPreview();
    notesEl.focus();
    showToast('Talking points inserted. They stay queued until ticked off in the workspace or the 1:1 room.', 'info');
  });
  document.getElementById('insertPdcTemplateBtn')?.addEventListener('click', () => {
    const notesEl = document.getElementById('meetingNotes');
    if (!notesEl) return;
    const existing = notesEl.value;
    notesEl.value = existing ? `${existing.replace(/\s+$/, '')}\n\n${PDC_TEMPLATE_MARKDOWN}` : PDC_TEMPLATE_MARKDOWN;
    syncMeetingNotesPreview();
    notesEl.focus();
  });
  document.getElementById('meetingType')?.addEventListener('change', (event) => {
    document.getElementById('insertPdcTemplateBtn')?.classList.toggle('hidden', canonicalMeetingType(event.target.value) !== 'PDC');
  });
  document.getElementById('meetingPulseClear')?.addEventListener('click', () => {
    document.querySelectorAll('input[name="meetingPulse"]').forEach((input) => { input.checked = false; });
  });

  // v0.44: goal modal + feedback modal open, close, and submit wiring.
  const goalModalEl = document.getElementById('goalModal');
  const goalFormEl = document.getElementById('goalForm');
  const feedbackModalEl = document.getElementById('feedbackModal');
  const feedbackFormEl = document.getElementById('feedbackForm');
  const goalProgressEl = document.getElementById('goalProgress');
  goalProgressEl?.addEventListener('input', () => {
    const valueEl = document.getElementById('goalProgressValue');
    if (valueEl) valueEl.textContent = `${goalProgressEl.value}%`;
  });
  goalFormEl?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(goalFormEl);
    const reportId = normalizeText(formData.get('goalReportId'));
    if (!reportId) return;
    const ok = await saveGoal(reportId, {
      id: normalizeText(formData.get('goalId')),
      title: formData.get('goalTitle'),
      status: formData.get('goalStatus'),
      targetDate: formData.get('goalTargetDate'),
      progress: Number(formData.get('goalProgress')),
      detail: formData.get('goalDetail'),
      updateNote: formData.get('goalUpdateNote')
    });
    if (ok) closeGoalModal();
    else setStatus(document.getElementById('goalStatusLine'), 'Check the goal fields and try again.', 'error');
  });
  document.getElementById('closeGoalModalBtn')?.addEventListener('click', dismissGoalModal);
  document.getElementById('cancelGoalModalBtn')?.addEventListener('click', dismissGoalModal);
  document.getElementById('deleteGoalBtn')?.addEventListener('click', async () => {
    const reportId = normalizeText(document.getElementById('goalReportId')?.value);
    const goalId = normalizeText(document.getElementById('goalId')?.value);
    if (!reportId || !goalId) return;
    const ok = await deleteGoal(reportId, goalId);
    if (ok) closeGoalModal();
  });
  goalModalEl?.addEventListener('click', (event) => { if (event.target === goalModalEl) dismissGoalModal(); });
  feedbackFormEl?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(feedbackFormEl);
    const reportId = normalizeText(formData.get('feedbackReportId'));
    if (!reportId) return;
    const ok = await saveFeedbackEntry(reportId, {
      kind: formData.get('feedbackKind'),
      category: formData.get('feedbackCategory'),
      date: formData.get('feedbackDate'),
      linkedMeetingId: formData.get('feedbackMeeting'),
      summary: formData.get('feedbackSummary'),
      detail: formData.get('feedbackDetail'),
      shared: !!formData.get('feedbackShared')
    });
    if (ok) closeFeedbackModal();
    else setStatus(document.getElementById('feedbackStatusLine'), 'Check the feedback fields and try again.', 'error');
  });
  document.getElementById('closeFeedbackModalBtn')?.addEventListener('click', dismissFeedbackModal);
  document.getElementById('cancelFeedbackModalBtn')?.addEventListener('click', dismissFeedbackModal);
  feedbackModalEl?.addEventListener('click', (event) => { if (event.target === feedbackModalEl) dismissFeedbackModal(); });

  closeRulesDrawerBtn.addEventListener('click', closeRulesDrawer);
  thresholdFormEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      clearLastDestructiveAction();
      app.doc.settings.thresholds = {
        oneOnOneDays: parsePositiveInteger('1:1 overdue rule', oneOnOneThresholdEl.value),
        pdcDays: parsePositiveInteger('PDC overdue rule', developmentThresholdEl.value),
        cvReviewDays: parsePositiveInteger('CV review overdue rule', cvReviewThresholdEl.value)
      };
      app.doc.settings.missingMentorCounts = !!missingMentorCountsEl.checked;
      app.doc.settings.blockedPdcCounts = !!blockedPlanCountsEl.checked;
      app.doc.settings.pulseTrendCounts = !!document.getElementById('pulseTrendCounts')?.checked;
      app.doc.settings.density = document.getElementById('densitySetting')?.value === 'compact' ? 'compact' : 'comfortable';
      app.doc.settings.pdcRoundAutoReset = !!document.getElementById('pdcRoundAutoReset')?.checked;
      app.doc.settings.pdcRoundStartMonth = Math.min(12, Math.max(1, safePositiveInteger(document.getElementById('pdcRoundStartMonth')?.value, 1)));
      // Reconfiguring the cadence or the start month changes the round key.
      // Adopt the new calendar immediately so the next render never treats a
      // settings change as a rollover and mass resets the board.
      app.doc.settings.lastPdcRoundKey = pdcRoundInfo(app.doc.settings).key;
      if (evidenceCategoriesInputEl) {
        app.doc.settings.evidenceCategories = normalizeEvidenceCategories(evidenceCategoriesInputEl.value || DEFAULT_EVIDENCE_CATEGORIES);
      }
      app.doc.settings.promotionConversationMonths = parsePositiveInteger('Promotion conversation rule', promotionConversationThresholdEl?.value || DEFAULT_PROMOTION_CONVERSATION_MONTHS);
      updateThemeWindowSettingFromForm();
      applyProjectedState();
      render();
      scheduleAutosave();
      setStatus(thresholdStatusEl, 'Settings saved.', 'success');
      showToast('Settings updated.', 'success');
    } catch (error) {
      setStatus(thresholdStatusEl, error.message || 'Check the settings and try again.', 'error');
    }
  });
  resetRulesBtn.addEventListener('click', () => {
    if (!app.doc) return;
    clearLastDestructiveAction();
    app.doc.settings = normalizeSettings({});
    applyProjectedState();
    render();
    scheduleAutosave();
    setStatus(thresholdStatusEl, 'Settings reset to defaults.', 'success');
    showToast('Settings reset to defaults.', 'success');
  });

  teamHealthTabBarEl.addEventListener('click', (event) => {
    const tabBtn = event.target.closest('[data-team-health-tab]');
    if (!tabBtn) return;
    const nextTab = tabBtn.getAttribute('data-team-health-tab');
    if (!TEAM_HEALTH_TABS.includes(nextTab)) return;
    if (currentTeamHealthTab() === nextTab) return;
    app.ui.teamHealthTab = nextTab;
    persistUiState();
    navigateRender(() => renderTeamHealth());
  });
  teamHealthBodyEl.addEventListener('click', (event) => {
    const briefBtn = event.target.closest('[data-briefing-go]');
    if (briefBtn) {
      const target = briefBtn.getAttribute('data-briefing-go') || '';
      if (target.startsWith('view:')) {
        const nextView = target.slice(5);
        if (MAIN_VIEWS.includes(nextView)) {
          app.ui.mainView = nextView;
          app.ui.selectedId = null;
          app.ui.creatingReport = false;
          persistUiState();
          navigateRender(() => render());
        }
      } else if (target.startsWith('tab:')) {
        const nextTab = target.slice(4);
        if (TEAM_HEALTH_TABS.includes(nextTab)) {
          app.ui.teamHealthTab = nextTab;
          persistUiState();
          navigateRender(() => renderTeamHealth());
        }
      }
      return;
    }
    const cdpModeBtn = event.target.closest('[data-cdp-team-mode]');
    if (cdpModeBtn) {
      const nextMode = cdpModeBtn.getAttribute('data-cdp-team-mode') === 'web' ? 'web' : 'heatmap';
      if (app.ui.cdpTeamMode !== nextMode) {
        app.ui.cdpTeamMode = nextMode;
        persistUiState();
        renderTeamHealth();
      }
      return;
    }
    const cdpOpenBtn = event.target.closest('[data-cdp-open]');
    if (cdpOpenBtn) {
      app.ui.detailDrawerTab = 'pdc-summary';
      navigateRender(() => selectReport(cdpOpenBtn.getAttribute('data-cdp-open')));
      return;
    }
    const modeBtn = event.target.closest('[data-tenure-mode]');
    if (modeBtn) {
      const nextMode = modeBtn.getAttribute('data-tenure-mode') === 'promotion' ? 'promotion' : 'tenure';
      if (app.ui.teamTenureMode !== nextMode) {
        app.ui.teamTenureMode = nextMode;
        persistUiState();
        renderTeamHealth();
      }
      return;
    }
    const reportTrigger = event.target.closest('[data-tenure-open]');
    if (reportTrigger) {
      navigateRender(() => selectReport(reportTrigger.getAttribute('data-tenure-open')));
      return;
    }
    const glyphBtn = event.target.closest('[data-glyph-open]');
    if (glyphBtn) {
      navigateRender(() => selectReport(glyphBtn.getAttribute('data-glyph-open')));
      return;
    }
    const themeBtn = event.target.closest('[data-theme-filter]');
    if (themeBtn) {
      const nextTheme = normalizeText(themeBtn.getAttribute('data-theme-filter'));
      app.ui.activeThemeFilter = currentThemeFilter() === nextTheme ? '' : nextTheme;
      if (app.ui.activeThemeFilter) {
        // Jump to the Direct Reports grid so the filter is visible in action.
        app.ui.mainView = 'reports';
        app.ui.selectedId = null;
        app.ui.creatingReport = false;
      }
      persistUiState();
      navigateRender(() => render());
      return;
    }
  });
  teamHealthBodyEl.addEventListener('keydown', (event) => {
    const trigger = event.target.closest('[data-tenure-open], [data-glyph-open]');
    if (!trigger) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const id = trigger.getAttribute('data-tenure-open') || trigger.getAttribute('data-glyph-open');
      if (id) navigateRender(() => selectReport(id));
    }
  });

  document.addEventListener('click', (event) => {
    if (dataMenuEl?.hasAttribute('open') && !dataMenuEl.contains(event.target)) closeDataMenu();
    const exportBtn = event.target.closest('#exportNowBtn');
    if (exportBtn) exportPlainFiles();
    const restoreBtn = event.target.closest('#restoreBackupBtn');
    if (restoreBtn) restoreLatestBackup();
    const disconnectBtn = event.target.closest('#disconnectFolderBtn');
    if (disconnectBtn) disconnectAndWipeLocal();
  });
  // Escape closes transient overlays (modals, settings drawer, the Data menu).
  // The workspace itself is left alone so unsaved edits can never be lost to
  // a stray keypress. A dialog with unsaved changes asks before it closes.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (globalSearchEl.classList.contains('open')) { closeGlobalSearch(); return; }
      if (document.getElementById('goalModal')?.classList.contains('open')) { dismissGoalModal(); return; }
      if (document.getElementById('feedbackModal')?.classList.contains('open')) { dismissFeedbackModal(); return; }
      if (meetingModalEl.classList.contains('open')) { dismissMeetingModal(); return; }
      if (rulesDrawerOverlayEl.classList.contains('open')) { closeRulesDrawer(); return; }
      if (dataMenuEl?.hasAttribute('open')) closeDataMenu();
      return;
    }
    // v0.46: plain digits 1-7 jump between views in sidebar order (Overview,
    // Insights, Direct Reports, Meetings, Follow-Ups, PDC Summary, Settings).
    // Skipped while typing, while any overlay is up, or when a modifier is
    // held so browser tab shortcuts like Cmd+1 keep working.
    if (/^[1-7]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const activeNow = document.activeElement;
      const typingNow = !!activeNow && (/^(input|textarea|select)$/i.test(activeNow.tagName) || activeNow.isContentEditable);
      const overlayUp = globalSearchEl.classList.contains('open')
        || meetingModalEl.classList.contains('open')
        || rulesDrawerOverlayEl.classList.contains('open')
        || startupPromptOverlayEl.classList.contains('open')
        || document.getElementById('goalModal')?.classList.contains('open')
        || document.getElementById('feedbackModal')?.classList.contains('open');
      if (!typingNow && !overlayUp && app.doc && app.connectedFolderReady) {
        event.preventDefault();
        keyboardNavigateToSlot(Number(event.key));
      }
      return;
    }
    // Optional accelerators: '/' or Ctrl/Cmd+K open search when the person
    // is not typing in a field and no other overlay is up. Purely a bonus,
    // the header button is the primary entry.
    const isSlash = event.key === '/';
    const isK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (!isSlash && !isK) return;
    const active = document.activeElement;
    const typing = !!active && (/^(input|textarea|select)$/i.test(active.tagName) || active.isContentEditable);
    if (typing) return;
    if (globalSearchEl.classList.contains('open') || meetingModalEl.classList.contains('open') || rulesDrawerOverlayEl.classList.contains('open') || startupPromptOverlayEl.classList.contains('open')) return;
    event.preventDefault();
    openGlobalSearch();
  });
  document.getElementById('globalSearchTrigger')?.addEventListener('click', openGlobalSearch);
  globalSearchEl.addEventListener('click', (event) => {
    if (event.target === globalSearchEl) { closeGlobalSearch(); return; }
    const row = event.target.closest('[data-gs-index]');
    if (row) runGsResult(Number(row.getAttribute('data-gs-index')));
  });
  globalSearchInputEl.addEventListener('input', () => {
    window.clearTimeout(gsDebounce);
    gsDebounce = window.setTimeout(renderGlobalSearchResults, 120);
  });
  globalSearchInputEl.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!gsResults.length) return;
      gsActiveIndex = (gsActiveIndex + (event.key === 'ArrowDown' ? 1 : -1) + gsResults.length) % gsResults.length;
      gsUpdateActiveRow();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runGsResult(gsActiveIndex);
    }
  });
  window.addEventListener('beforeunload', (event) => {
    // Also guards typed text that is not saved yet: an open dialog's changes
    // and the 1:1 room's notes draft (kept after leaving the room).
    if (!app.saveQueued && !app.saveInFlight && !app.lastSaveError && !hasUnsavedWorkspaceChanges()
      && !anyDialogHasUnsavedChanges() && !meetingRoomDraftHasContent()) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

async function initializeFolderRestore() {
  updateFileUi();
  render();
  if (!supportsDirectoryAccess()) return;
  try {
    startupStoredFolderHandle = await getStoredFolderHandle();
  } catch (error) {
    console.error('Failed to read stored Team Pulse folder', error);
    startupStoredFolderHandle = null;
  }
  updateStartupPrompt();
  if (app.folderHandle || app.connectedFolderReady) return;

  // Silent reconnect path: if we have a saved folder handle AND the browser
  // still holds 'granted' permission for it (no prompt required), connect
  // immediately without showing the startup modal. queryPermission is a silent
  // check — only requestPermission needs a user gesture.
  if (startupStoredFolderHandle) {
    try {
      const opts = { mode: 'readwrite' };
      if (startupStoredFolderHandle.queryPermission) {
        const state = await startupStoredFolderHandle.queryPermission(opts);
        if (state === 'granted') {
          const connected = await connectFolderHandle(startupStoredFolderHandle);
          if (connected) return;
        }
      }
    } catch (error) {
      console.warn('Silent folder reconnect failed, falling back to prompt', error);
    }
  }

  openStartupPrompt();
}

