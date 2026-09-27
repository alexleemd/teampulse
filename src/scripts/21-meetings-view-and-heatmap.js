// Renders a global "all meetings" view (flattened across every direct report).
// Top toolbar: person filter + "Log meeting" button. Click a row to edit that meeting.
// Monday-anchored week start for a YYYY-MM-DD string (Danish weeks).
function mondayOf(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return localDateStamp(d);
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
// Cells are painted by CSS from data-level (Moss: an empty day is --sunken,
// and the count steps 1, 2 and 3 or more are --ramp-4 to --ramp-6, the ramp
// steps that reach 3:1 as marks). The SVGs are drawn at 1:1 so their labels
// render at 12px. The weekday labels sit in their own column that does not
// scroll, so they stay in view when the grid scrolls on narrow screens.
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
  const level = (c) => (c === 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : 3);
  const CELL = 12;
  const STEP = 15;
  const DAYS_W = 34;
  const TOP = 20;
  const height = TOP + 7 * STEP - (STEP - CELL);
  // One label where each month starts; every month keeps its label. A month
  // that has a single column is too narrow for its name, so its label ends at
  // that column instead of starting there: at the grid's end for the last
  // month, and just before the next label for a partial first month, which
  // then gets a little room (LEAD) before the first column.
  const monthStarts = [];
  let prevMonth = '';
  weekStarts.forEach((weekStart, col) => {
    const monthName = new Date(`${weekStart}T00:00:00`).toLocaleString(undefined, { month: 'short' });
    if (monthName !== prevMonth) {
      monthStarts.push({ col, monthName });
      prevMonth = monthName;
    }
  });
  const spanOf = (index) => (monthStarts[index + 1] ? monthStarts[index + 1].col : WEEKS) - monthStarts[index].col;
  const LEAD = monthStarts.length > 1 && spanOf(0) === 1 ? 14 : 0;
  const colX = (col) => LEAD + col * STEP;
  const width = colX(WEEKS - 1) + CELL;
  const monthLabels = monthStarts.map(({ col, monthName }, index) => {
    let x = colX(col);
    let anchor = '';
    if (spanOf(index) === 1) {
      x = index === monthStarts.length - 1 ? width : colX(monthStarts[index + 1].col) - 4;
      anchor = ' text-anchor="end"';
    }
    return `<text x="${x}" y="12"${anchor} class="hm-label hm-month">${escapeHtml(monthName)}</text>`;
  }).join('');
  const cells = weekStarts.map((weekStart, col) => {
    let colCells = '';
    for (let row = 0; row < 7; row += 1) {
      const date = addDays(weekStart, row);
      const count = dayCounts.get(date) || 0;
      const title = `${count} meeting${count === 1 ? '' : 's'} · ${formatDate(date)}`;
      colCells += `<rect class="hm-cell" x="${colX(col)}" y="${TOP + row * STEP}" width="${CELL}" height="${CELL}" rx="3" data-level="${level(count)}" data-count="${count}"><title>${escapeHtml(title)}</title></rect>`;
    }
    return colCells;
  }).join('');
  const dayLabels = [['Mon', 0], ['Wed', 2], ['Fri', 4]].map(([label, row]) => `<text x="0" y="${TOP + row * STEP + 10}" class="hm-label">${label}</text>`).join('');
  // Legend: the shared swatches, empty day first, then the three ramp steps.
  const legend = ['', ' ramp-4', ' ramp-5', ' ramp-6'].map((step) => `<span class="swatch${step}"></span>`).join('');
  return `
    <div class="sharp-panel heatmap-panel">
      <div class="sharp-panel-header">
        <h3>Meeting rhythm · trailing 12 months</h3>
        <div class="sharp-panel-header-meta"><span class="hm-total">${total} meeting${total === 1 ? '' : 's'}</span></div>
      </div>
      <div class="sharp-panel-body padded">
        <div class="hm-figure">
          <div class="hm-chart">
            <svg class="hm-days" width="${DAYS_W}" height="${height}" viewBox="0 0 ${DAYS_W} ${height}" aria-hidden="true" focusable="false">${dayLabels}</svg>
            <div class="heatmap-scroll">
              <svg id="meetingHeatmap" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Meetings per day over the trailing year">${monthLabels}${cells}</svg>
            </div>
          </div>
          <div class="hm-legend" aria-hidden="true"><span>Less</span>${legend}<span>More</span></div>
        </div>
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
  // Toolbar as on Direct Reports: search field, the Person and Type selects,
  // then the one primary button.
  const toolbar = `
    <div class="meetings-view-toolbar">
      <div class="searchbox meetings-view-search">
        <input id="meetingsSearchInput" type="search" placeholder="Search notes, names…" aria-label="Search notes, names" autocomplete="off" value="${escapeHtml(app.ui.meetingsSearch || '')}">
      </div>
      <label class="meetings-view-filter">
        <span>Person</span>
        <select id="meetingsFilterSelect">${filterOptions}</select>
      </label>
      <label class="meetings-view-filter">
        <span>Type</span>
        <select id="meetingsTypeFilter">${typeOptions}</select>
      </label>
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
      mount.innerHTML = `${toolbar}${heatmapHtml}<p class="section-note empty-note meetings-no-match">No meetings match the current filters.</p>`;
      showLatestHeatmapWeeks(mount);
      return;
    }
    mount.innerHTML = `${toolbar}${heatmapHtml}${emptyHeroHtml(
      'calendar',
      'No meetings logged yet',
      'Log the first one and it shows up here, on the heatmap, and in the person\u2019s history.'
    )}`;
    showLatestHeatmapWeeks(mount);
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

  // One list card. A month divider row starts each month, then one row per
  // meeting: date, avatar, "person · type · duration" with the pulse glyph,
  // the full date on its own line, the first line of the notes, and the
  // follow-up count tag. The title and date lines keep the v0.52.4 text.
  let lastMonthKey = '';
  const rows = items.map(({ report, meeting }) => {
    const monthKey = (meeting.meetingDate || '').slice(0, 7) || 'undated';
    const divider = monthKey !== lastMonthKey
      ? `<h3 class="meetings-month-divider">${escapeHtml(monthHeading(meeting.meetingDate))}</h3>`
      : '';
    lastMonthKey = monthKey;
    const snippet = firstMeaningfulLine(meeting.notes) || 'No notes captured.';
    const mInitials = (report.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
    const fu = followUpsByMeeting.get(meeting.id);
    const fuChip = fu && fu.open
      ? `<span class="mv-chip" data-tone="neutral">${fu.open} open follow-up${fu.open === 1 ? '' : 's'}</span>`
      : (fu && fu.total ? `<span class="mv-chip" data-tone="good">Follow-ups done</span>` : '');
    const duration = Number.isFinite(Number(meeting.durationMinutes)) && Number(meeting.durationMinutes) > 0
      ? ` · ${Number(meeting.durationMinutes)} min` : '';
    const pulse = normalizePulse(meeting.pulse);
    const pulseGlyph = pulse
      ? `<span class="pulse-dot" data-pulse="${escapeHtml(pulse)}" role="img" aria-label="${escapeHtml(PULSE_LABELS[pulse])}" title="${escapeHtml(PULSE_LABELS[pulse])}"></span>`
      : '';
    return `${divider}<button type="button" class="meetings-view-item" data-meetings-edit-report="${escapeHtml(report.id)}" data-meetings-edit-meeting="${escapeHtml(meeting.id)}">
        <span class="meetings-view-date">
          <span class="meetings-view-date-m">${escapeHtml(monthName(meeting.meetingDate))}</span>
          <span class="meetings-view-date-d">${escapeHtml(dayNum(meeting.meetingDate))}</span>
        </span>
        <span class="mv-avatar" aria-hidden="true">${escapeHtml(mInitials)}</span>
        <span class="meetings-view-main">
          <span class="meetings-view-main-title">
            <span class="meetings-view-name">${escapeHtml(report.name || 'Unnamed')} · ${escapeHtml(meeting.meetingType || '1:1')}${escapeHtml(duration)}</span>
            ${pulseGlyph}
          </span>
          <span class="meetings-view-main-sub">${escapeHtml(formatDate(meeting.meetingDate))}</span>
          <span class="meetings-view-main-snip">${escapeHtml(snippet)}</span>
        </span>
        ${fuChip ? `<span class="meetings-view-chips">${fuChip}</span>` : ''}
        <span class="meetings-view-edit">Edit →</span>
      </button>`;
  }).join('');

  mount.innerHTML = `${toolbar}${heatmapHtml}<div class="meetings-view">${rows}</div>`;
  showLatestHeatmapWeeks(mount);
}

// When the heatmap is wider than its card (narrow screens), start it scrolled
// to the most recent weeks.
function showLatestHeatmapWeeks(mount) {
  const scroller = mount.querySelector('.heatmap-scroll');
  if (!scroller) return;
  if (scroller.scrollWidth > scroller.clientWidth) scroller.scrollLeft = scroller.scrollWidth;
  hideCutHeatmapMonths(scroller);
}

// A month label that the scrolled edge cuts in half (the "c" of Dec) is
// hidden until it is fully in view again.
function hideCutHeatmapMonths(scroller) {
  const left = scroller.scrollLeft;
  const right = left + scroller.clientWidth;
  const scrolls = scroller.scrollWidth > scroller.clientWidth + 1;
  scroller.querySelectorAll('.hm-month').forEach((label) => {
    let cut = false;
    if (scrolls && scroller.clientWidth > 0) {
      const box = label.getBBox();
      cut = box.x < left - 0.5 || box.x + box.width > right + 0.5;
    }
    label.classList.toggle('hm-cut', cut);
  });
}

document.addEventListener('scroll', (event) => {
  const target = event.target;
  if (target instanceof Element && target.classList.contains('heatmap-scroll')) hideCutHeatmapMonths(target);
}, { capture: true, passive: true });
window.addEventListener('resize', () => {
  document.querySelectorAll('.heatmap-scroll').forEach(hideCutHeatmapMonths);
});

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
    // Moss motion lasts 150ms or less, so the jump is immediate.
    if (target) target.scrollIntoView({ block: 'center' });
  }, 0);
}

