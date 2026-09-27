
function applyProjectedState() {
  app.doc = ensureDocShape(app.doc || makeEmptyDoc());
  app.projections = projectDoc(app.doc, { normalized: true });
  if (app.ui.selectedId && !app.projections.reportMap.has(app.ui.selectedId)) {
    app.ui.selectedId = null;
    clearWorkspaceDraft();
  }
  persistUiState();
}

function getThemeWindowDays(settings = app.doc?.settings || normalizeSettings({})) {
  return safePositiveInteger(settings?.themesWindowDays, THEMES_WINDOW_DEFAULT);
}

function renderRuleInputs() {
  const settings = app.doc?.settings || normalizeSettings({});
  oneOnOneThresholdEl.value = settings.thresholds.oneOnOneDays;
  developmentThresholdEl.value = settings.thresholds.pdcDays;
  cvReviewThresholdEl.value = settings.thresholds.cvReviewDays;
  if (promotionConversationThresholdEl) promotionConversationThresholdEl.value = settings.promotionConversationMonths || DEFAULT_PROMOTION_CONVERSATION_MONTHS;
  const themesWindowDaysEl = document.getElementById('themesWindowDays');
  if (themesWindowDaysEl) themesWindowDaysEl.value = settings.themesWindowDays || THEMES_WINDOW_DEFAULT;
  missingMentorCountsEl.checked = !!settings.missingMentorCounts;
  blockedPlanCountsEl.checked = !!settings.blockedPdcCounts;
  const pulseTrendCountsEl = document.getElementById('pulseTrendCounts');
  if (pulseTrendCountsEl) pulseTrendCountsEl.checked = settings.pulseTrendCounts !== false;
  const densitySettingEl = document.getElementById('densitySetting');
  if (densitySettingEl) densitySettingEl.value = settings.density === 'compact' ? 'compact' : 'comfortable';
  const pdcRoundAutoResetEl = document.getElementById('pdcRoundAutoReset');
  if (pdcRoundAutoResetEl) pdcRoundAutoResetEl.checked = settings.pdcRoundAutoReset !== false;
  const pdcRoundStartMonthEl = document.getElementById('pdcRoundStartMonth');
  if (pdcRoundStartMonthEl) pdcRoundStartMonthEl.value = String(Math.min(12, Math.max(1, safePositiveInteger(settings.pdcRoundStartMonth, 1))));
  if (evidenceCategoriesInputEl) evidenceCategoriesInputEl.value = resolveEvidenceCategories(settings).join('\n');
}

function currentThemeFilter() {
  return normalizeText(app.ui.activeThemeFilter);
}

function cutoffStampForWindow(windowDays) {
  const today = parseLocalDate(todayStamp()) || new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - Math.max(0, Number(windowDays || 0) - 1));
  cutoff.setHours(0, 0, 0, 0);
  return localDateStamp(cutoff);
}

function collectRecentNoteTexts(report, windowDays = getThemeWindowDays()) {
  const cutoffStamp = cutoffStampForWindow(windowDays);
  const texts = [];
  (report?.notesHistory || []).forEach((entry) => {
    const noteStamp = normalizeDate(entry.noteDate) || isoToLocalDateStamp(entry.createdAt);
    if (noteStamp && noteStamp >= cutoffStamp && noteStamp <= todayStamp() && normalizeText(entry.noteText)) {
      texts.push(normalizeText(entry.noteText));
    }
  });
  if (!texts.length && normalizeText(report?.notes) && !(report?.notesHistory || []).length) {
    texts.push(normalizeText(report.notes));
  }
  (report?.meetings || []).forEach((meeting) => {
    const meetingDate = normalizeDate(meeting.meetingDate);
    if (meetingDate && meetingDate >= cutoffStamp && meetingDate <= todayStamp() && normalizeText(meeting.notes)) {
      texts.push(normalizeText(meeting.notes));
    }
  });
  return texts;
}

// Keeps letters from every language (\p{L}, plus accent marks \p{M}), so
// "café" or "Übergabe" stay whole words. NFC joins a letter typed as letter
// plus accent into one character, so both spellings count as the same word.
function normalizeThemeSearchText(value) {
  return String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{M}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractThemeTokens(text) {
  return normalizeThemeSearchText(text)
    .split(' ')
    .map((token) => normalizeText(token))
    .filter((token) => token.length >= 4 && !RECENT_THEME_STOPWORDS.has(token) && !/^\d+$/.test(token));
}

function addThemeCount(map, token, reportId) {
  if (!token) return;
  if (!map.has(token)) map.set(token, { count: 0, reportIds: new Set() });
  const entry = map.get(token);
  entry.count += 1;
  entry.reportIds.add(reportId);
}

function computeRecentThemes(reports, windowDays = getThemeWindowDays()) {
  const wordCounts = new Map();
  const bigramCounts = new Map();
  (Array.isArray(reports) ? reports : []).forEach((report) => {
    const texts = collectRecentNoteTexts(report, windowDays);
    texts.forEach((text) => {
      const tokens = extractThemeTokens(text);
      tokens.forEach((token) => addThemeCount(wordCounts, token, report.id));
      for (let index = 0; index < tokens.length - 1; index += 1) {
        addThemeCount(bigramCounts, `${tokens[index]} ${tokens[index + 1]}`, report.id);
      }
    });
  });
  const toSortedList = (map, limit) => [...map.entries()]
    .filter(([, value]) => value.reportIds.size >= 2)
    .sort((a, b) => (b[1].reportIds.size - a[1].reportIds.size) || (b[1].count - a[1].count) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, value]) => ({
      term,
      count: value.count,
      reportCount: value.reportIds.size,
      reportIds: [...value.reportIds]
    }));
  return {
    topWords: toSortedList(wordCounts, 15),
    topBigrams: toSortedList(bigramCounts, 10)
  };
}

function reportMatchesThemeFilter(report, term, windowDays = getThemeWindowDays()) {
  const needle = normalizeThemeSearchText(term);
  if (!needle) return true;
  const haystack = collectRecentNoteTexts(report, windowDays).map((text) => normalizeThemeSearchText(text)).join(' ');
  return ` ${haystack} `.includes(` ${needle} `);
}

function getFilteredReports() {
  const term = normalizeText(app.ui.searchTerm).toLowerCase();
  const plan = normalizeText(app.ui.planFilter);
  const attentionFilter = normalizeText(app.ui.attentionFilter);
  const activeTheme = currentThemeFilter();
  const themeWindowDays = getThemeWindowDays();
  return getReports().filter((report) => {
    const metrics = getMetrics(report.id);
    const blob = [
      report.name,
      report.initials,
      report.level,
      report.mentors,
      report.hireDate,
      report.lastPromotionDate,
      report.nextPdcDate,
      report.pdcStatus,
      report.supportLevel,
      report.developmentGoalSummary,
      normalizeGoals(report.goals || []).map((goal) => `${goal.title} ${goal.detail}`).join(' '),
      normalizeTalkingPoints(report.talkingPoints || []).map((point) => point.text).join(' '),
      report.promotionReadiness,
      report.notes,
      serializeCadenceOverrides(report.cadenceOverrides),
      serializeVacations(report.vacations),
      serializeSnoozes(report.snoozes),
      metrics.openFollowUps.map((item) => item.text).join(' '),
      (report.customFields || []).map((field) => `${field.label} ${field.value}`).join(' '),
      metrics.attention.join(' ')
    ].join(' ').toLowerCase();
    if (term && !blob.includes(term)) return false;
    if (plan && report.pdcStatus !== plan) return false;
    if (attentionFilter === 'needs-attention' && metrics.attention.length === 0) return false;
    if (attentionFilter === 'on-track' && metrics.attention.length > 0) return false;
    if (attentionFilter === 'open-followups' && metrics.openFollowUps.length === 0) return false;
    if (attentionFilter === 'on-vacation' && !metrics.vacationStatus.active) return false;
    if (activeTheme && !reportMatchesThemeFilter(report, activeTheme, themeWindowDays)) return false;
    return true;
  }).sort(compareReportsForTable);
}

function renderQuickFilterBar() {
  const themeTerm = currentThemeFilter();
  if (themeTerm) {
    quickFilterTitleEl.textContent = `Showing Recent Theme: ${themeTerm}`;
    quickFilterDescriptionEl.textContent = `Filtered to direct reports whose manager or meeting notes mention “${themeTerm}” in the last ${getThemeWindowDays()} days.`;
    quickFilterBarEl.classList.remove('hidden');
    return;
  }
  quickFilterBarEl.classList.add('hidden');
  quickFilterTitleEl.textContent = '';
  quickFilterDescriptionEl.textContent = '';
}

function renderRecentThemesCard(reports) {
  const windowDays = getThemeWindowDays();
  const themes = computeRecentThemes(reports, windowDays);
  const activeTheme = currentThemeFilter();

  // Combine unigrams + bigrams into one list, sorted by the same comparator
  // computeRecentThemes uses (report-coverage > count > term), capped at 15.
  const combined = [...themes.topWords, ...themes.topBigrams]
    .sort((a, b) => (b.reportCount - a.reportCount) || (b.count - a.count) || a.term.localeCompare(b.term))
    .slice(0, 15);

  // Size classes assigned by rank, not absolute count, so the hierarchy
  // stays legible across different team sizes and note volumes.
  const chipSizeForRank = (rank) => {
    if (rank < 3) return 'chip-lg';
    if (rank < 8) return 'chip-md';
    return 'chip-sm';
  };

  const chipsHtml = combined.map((item, index) => {
    const size = chipSizeForRank(index);
    const activeClass = activeTheme === item.term ? ' active' : '';
    return `<button type="button" class="theme-chip ${size}${activeClass}" data-theme-filter="${escapeHtml(item.term)}" aria-pressed="${activeClass ? 'true' : 'false'}" title="Filter reports whose notes mention ${escapeHtml(item.term)}">${escapeHtml(item.term)}<span>${item.reportCount}</span></button>`;
  }).join('');

  const body = combined.length
    ? `<div class="theme-chip-cloud">${chipsHtml}</div>`
    : '<div class="theme-empty">No recurring themes yet.</div>';

  return `
    <div class="recent-themes-card">
      <div class="recent-themes-head">
        <div>
          <h3>Recent Themes</h3>
          <p>Frequency-based themes from manager notes and meeting notes in the last ${windowDays} days. Click a chip to filter the table.</p>
        </div>
      </div>
      ${body}
      <div class="recent-themes-footnote">Words shorter than four characters, numbers, and common stopwords are excluded. Terms must appear across at least two people to surface here.</div>
    </div>
  `;
}

function currentTeamHealthTab() {
  // Map legacy tab names to their new homes. Cadence, Attention, and Support
  // Levels were folded into the Overview briefing in v0.45, so any UI state
  // saved while they existed resolves back to Overview.
  const raw = app.ui.teamHealthTab;
  let mapped = raw;
  if (raw === 'tenure' || raw === 'themes') mapped = 'insights';
  else if (raw === 'pdc-mix' || raw === 'cadence' || raw === 'attention' || raw === 'support') mapped = 'overview';
  return TEAM_HEALTH_TABS.includes(mapped) ? mapped : 'overview';
}

function renderTeamHealthTabBar() {
  const activeTab = currentTeamHealthTab();
  teamHealthTabBarEl.innerHTML = TEAM_HEALTH_TABS.map((tab) => {
    const isActive = tab === activeTab;
    return `<button type="button" role="tab" class="team-health-tab${isActive ? ' active' : ''}" data-team-health-tab="${escapeHtml(tab)}" aria-selected="${isActive ? 'true' : 'false'}">${escapeHtml(TEAM_HEALTH_TAB_LABELS[tab])}</button>`;
  }).join('');
}
