// Renders a global "all meetings" view (flattened across every direct report).
// Top toolbar: person filter + "Log meeting" button. Click a row to edit that meeting.
// Monday-anchored week start for a YYYY-MM-DD string (Danish weeks).
function mondayOf(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d.toISOString().slice(0, 10);
}

// Buckets meetings into the trailing N weeks (oldest first), used by the
// tile sparklines and, per day, mirrored by the heatmap.
function buildWeeklyMeetingBuckets(meetings, weeksCount) {
  const currentWeek = mondayOf(todayStamp());
  const weeks = [];
  for (let i = weeksCount - 1; i >= 0; i -= 1) weeks.push(addDays(currentWeek, -7 * i));
  const counts = new Map(weeks.map((key) => [key, 0]));
  (meetings || []).forEach((m) => {
    const key = mondayOf(normalizeDate(m.meetingDate));
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });
  return weeks.map((key) => ({ key, count: counts.get(key) }));
}

// GitHub-style contribution grid: one cell per day, trailing 52 weeks,
// Monday rows on top. Reflects the person and type filters of the view.
function renderMeetingHeatmapHtml(meetings) {
  const WEEKS = 52;
  const start = mondayOf(todayStamp());
  const weekStarts = [];
  for (let i = WEEKS - 1; i >= 0; i -= 1) weekStarts.push(addDays(start, -7 * i));
  const rangeEnd = addDays(start, 6);
  const dayCounts = new Map();
  let total = 0;
  (meetings || []).forEach((m) => {
    const key = normalizeDate(m.meetingDate);
    if (!key || key < weekStarts[0] || key > rangeEnd) return;
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
    total += 1;
  });
  const level = (c) => (c === 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : c <= 4 ? 3 : 4);
  const COLORS = ['#edf1f8', '#cfe0ff', '#9ec1ff', '#5b8ffb', '#2957d6'];
  const CELL = 11;
  const STEP = 14;
  const GUTTER = 30;
  const TOP = 16;
  const width = GUTTER + WEEKS * STEP;
  const height = TOP + 7 * STEP;
  let monthLabels = '';
  let prevMonth = '';
  const cells = weekStarts.map((weekStart, col) => {
    const monthName = new Date(`${weekStart}T00:00:00`).toLocaleString(undefined, { month: 'short' });
    if (monthName !== prevMonth) {
      monthLabels += `<text x="${GUTTER + col * STEP}" y="10" class="hm-label">${escapeHtml(monthName)}</text>`;
      prevMonth = monthName;
    }
    let colCells = '';
    for (let row = 0; row < 7; row += 1) {
      const date = addDays(weekStart, row);
      const count = dayCounts.get(date) || 0;
      const title = `${count} meeting${count === 1 ? '' : 's'} · ${formatDate(date)}`;
      colCells += `<rect x="${GUTTER + col * STEP}" y="${TOP + row * STEP}" width="${CELL}" height="${CELL}" rx="2.5" fill="${COLORS[level(count)]}" data-count="${count}"><title>${escapeHtml(title)}</title></rect>`;
    }
    return colCells;
  }).join('');
  const dayLabels = [['Mon', 0], ['Wed', 2], ['Fri', 4]].map(([label, row]) => `<text x="0" y="${TOP + row * STEP + 9}" class="hm-label">${label}</text>`).join('');
  const legend = COLORS.map((c) => `<span class="hm-swatch" style="background:${c}"></span>`).join('');
  return `
    <div class="sharp-panel heatmap-panel">
      <div class="sharp-panel-header">
        <h3>Meeting rhythm · trailing 12 months</h3>
        <div class="sharp-panel-header-meta"><span class="hm-total">${total} meeting${total === 1 ? '' : 's'}</span></div>
      </div>
      <div class="sharp-panel-body padded heatmap-scroll">
        <svg id="meetingHeatmap" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Meetings per day over the trailing year">${monthLabels}${dayLabels}${cells}</svg>
        <div class="hm-legend"><span>Less</span>${legend}<span>More</span></div>
      </div>
    </div>`;
}

function renderMeetingsView() {
  const mount = document.getElementById('meetingsBody');
  if (!mount) return;
  const reports = getReports();
  const filterId = app.ui.meetingsFilterReportId || '';
  const validFilter = filterId && reports.some((r) => r.id === filterId) ? filterId : '';
  const typeFilter = MEETING_TYPES.includes(app.ui.meetingsTypeFilter) ? app.ui.meetingsTypeFilter : '';
  const searchTerm = normalizeText(app.ui.meetingsSearch || '').toLowerCase();
  const meetingsEntering = viewJustEntered('meetingsView', app.ui.mainView === 'meetings');

  const followUpsByMeeting = new Map();
  const items = [];
  const heatmapMeetings = [];
  reports.forEach((r) => {
    if (validFilter && r.id !== validFilter) return;
    const followUps = extractFollowUps(r);
    followUps.forEach((item) => {
      if (!followUpsByMeeting.has(item.meetingId)) followUpsByMeeting.set(item.meetingId, { open: 0, total: 0 });
      const bucket = followUpsByMeeting.get(item.meetingId);
      bucket.total += 1;
      if (!item.done) bucket.open += 1;
    });
    (r.meetings || []).forEach((m) => {
      if (typeFilter && canonicalMeetingType(m.meetingType) !== typeFilter) return;
      heatmapMeetings.push(m);
      if (searchTerm) {
        const blob = `${r.name || ''} ${m.meetingType || ''} ${m.notes || ''}`.toLowerCase();
        if (!blob.includes(searchTerm)) return;
      }
      items.push({ report: r, meeting: m });
    });
  });
  items.sort((a, b) => (b.meeting.meetingDate || '').localeCompare(a.meeting.meetingDate || ''));
  const heatmapHtml = renderMeetingHeatmapHtml(heatmapMeetings);

  // Build the person filter options (sorted alphabetically).
  const sortedReports = [...reports].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const filterOptions = [`<option value="">Everyone</option>`]
    .concat(sortedReports.map((r) => `<option value="${escapeHtml(r.id)}"${r.id === validFilter ? ' selected' : ''}>${escapeHtml(r.name || 'Unnamed')}</option>`))
    .join('');
  const typeOptions = [`<option value="">All types</option>`]
    .concat(MEETING_TYPES.map((t) => `<option value="${escapeHtml(t)}"${t === typeFilter ? ' selected' : ''}>${escapeHtml(t)}</option>`))
    .join('');

  const canLog = reports.length > 0;
  const toolbar = `
    <div class="meetings-view-toolbar">
      <label class="meetings-view-filter">
        <span>Person</span>
        <select id="meetingsFilterSelect">${filterOptions}</select>
      </label>
      <label class="meetings-view-filter">
        <span>Type</span>
        <select id="meetingsTypeFilter">${typeOptions}</select>
      </label>
      <div class="searchbox meetings-view-search">
        <input id="meetingsSearchInput" type="search" placeholder="Search notes, names…" autocomplete="off" value="${escapeHtml(app.ui.meetingsSearch || '')}">
      </div>
      <button type="button" id="meetingsLogBtn"${canLog ? '' : ' disabled'}>+ Log meeting</button>
    </div>
  `;

  if (reports.length === 0) {
    mount.innerHTML = `${toolbar}${emptyHeroHtml(
      'inbox',
      'No one to meet with yet',
      'Add a direct report first. Every meeting you log will collect here across the whole team.'
    )}`;
    return;
  }

  if (items.length === 0) {
    const hasActiveFilter = validFilter || typeFilter || searchTerm;
    if (hasActiveFilter) {
      mount.innerHTML = `${toolbar}${heatmapHtml}<div class="sharp-panel"><div class="sharp-panel-body padded"><p class="section-note" style="margin:0;">No meetings match the current filters.</p></div></div>`;
      return;
    }
    mount.innerHTML = `${toolbar}${heatmapHtml}${emptyHeroHtml(
      'calendar',
      'No meetings logged yet',
      'Log the first one and it shows up here, on the heatmap, and in the person\u2019s history.'
    )}`;
    return;
  }

  const monthName = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleString(undefined, { month: 'short' });
    } catch (_) { return ''; }
  };
  const dayNum = (iso) => {
    if (!iso) return '';
    const m = iso.match(/^\d{4}-\d{2}-(\d{2})/);
    return m ? String(Number(m[1])) : '';
  };
  const monthHeading = (iso) => {
    if (!iso) return 'Undated';
    try {
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    } catch (_) { return 'Undated'; }
  };

  let lastMonthKey = '';
  const rows = items.map(({ report, meeting }, rowIndex) => {
    const monthKey = (meeting.meetingDate || '').slice(0, 7) || 'undated';
    const divider = monthKey !== lastMonthKey
      ? `<div class="meetings-month-divider">${escapeHtml(monthHeading(meeting.meetingDate))}</div>`
      : '';
    lastMonthKey = monthKey;
    const snippet = firstMeaningfulLine(meeting.notes) || 'No notes captured.';
    const mInitials = (report.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
    const fu = followUpsByMeeting.get(meeting.id);
    const fuChip = fu && fu.open
      ? `<span class="mv-chip" data-tone="warning">${fu.open} open follow-up${fu.open === 1 ? '' : 's'}</span>`
      : (fu && fu.total ? `<span class="mv-chip" data-tone="good">Follow-ups done</span>` : '');
    const duration = Number.isFinite(Number(meeting.durationMinutes)) && Number(meeting.durationMinutes) > 0
      ? ` · ${Number(meeting.durationMinutes)} min` : '';
    return `${divider}<div class="meetings-view-item" data-meetings-edit-report="${escapeHtml(report.id)}" data-meetings-edit-meeting="${escapeHtml(meeting.id)}" role="button" tabindex="0" style="--i:${Math.min(rowIndex, 12)}">
        <div class="meetings-view-date">
          <span class="meetings-view-date-m">${escapeHtml(monthName(meeting.meetingDate))}</span>
          <span class="meetings-view-date-d">${escapeHtml(dayNum(meeting.meetingDate))}</span>
        </div>
        <div class="mv-avatar" style="${avatarGradient(report.id)}" aria-hidden="true">${escapeHtml(mInitials)}</div>
        <div class="meetings-view-main">
          <span class="meetings-view-main-title">${escapeHtml(report.name || 'Unnamed')} · ${escapeHtml(meeting.meetingType || '1:1')}${escapeHtml(duration)}${normalizePulse(meeting.pulse) ? ` <span class="pulse-dot" data-pulse="${escapeHtml(normalizePulse(meeting.pulse))}" title="${escapeHtml(PULSE_LABELS[normalizePulse(meeting.pulse)])}"></span>` : ''}</span>
          <span class="meetings-view-main-sub">${escapeHtml(formatDate(meeting.meetingDate))}</span>
          <span class="meetings-view-main-snip">${escapeHtml(snippet)}</span>
          ${fuChip ? `<span class="meetings-view-chips">${fuChip}</span>` : ''}
        </div>
        <div class="meetings-view-main-sub">Edit →</div>
      </div>`;
  }).join('');

  mount.innerHTML = `${toolbar}${heatmapHtml}<div class="meetings-view${meetingsEntering ? ' anim-entry' : ''}">${rows}</div>`;
}

// Opens a report's workspace on the Meetings & Agenda tab and scrolls to a
// specific meeting. Used by the global Follow-Ups view.
function openReportMeetingsAt(reportId, meetingId) {
  if (!selectReport(reportId)) return;
  app.ui.detailDrawerTab = 'meetings';
  persistUiState();
  renderDetailDrawer();
  window.setTimeout(() => {
    const target = [...document.querySelectorAll('[data-meeting-item]')].find((item) => item.getAttribute('data-meeting-item') === meetingId);
    if (target && typeof target.open === 'boolean') target.open = true;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 0);
}

