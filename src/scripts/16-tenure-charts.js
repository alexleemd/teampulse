
// Levels map in order onto the one hue ramp (Moss decision 6): Consultant
// (Developing) is --ramp-1 and Senior (Proficient) is --ramp-6. 0 means the
// level is not one of the six.
function levelRampStep(level) {
  const index = LEVEL_OPTIONS.indexOf(normalizeLevel(level));
  return index > -1 ? index + 1 : 0;
}

function levelTimelineColor(level) {
  const step = levelRampStep(level);
  return step ? `var(--ramp-${step})` : 'var(--field-line)';
}

function safeAxisRatio(dateString, axisStart, axisEnd) {
  const date = parseLocalDate(dateString);
  if (!date || !axisStart || !axisEnd) return null;
  const startMs = axisStart.getTime();
  const endMs = axisEnd.getTime();
  if (endMs <= startMs) return 0;
  const ratio = (date.getTime() - startMs) / (endMs - startMs);
  return Math.max(0, Math.min(1, ratio));
}

function formatTenureFromDate(dateString) {
  const months = monthsBetween(dateString);
  return months === null ? '' : formatMonthSpan(months, { compact: true });
}

function axisYearBoundaries(axisStart, axisEnd) {
  if (!axisStart || !axisEnd) return [];
  const years = [];
  for (let year = axisStart.getFullYear(); year <= axisEnd.getFullYear(); year += 1) {
    const boundary = new Date(year, 0, 1);
    boundary.setHours(0, 0, 0, 0);
    if (boundary >= axisStart && boundary <= axisEnd) years.push(boundary);
  }
  return years;
}

// Chart positions are percentages of the plot width, so the charts stretch
// with the card while their text keeps the Moss sizes.
function tenureAxisPercent(ratio) {
  return `${((ratio === null || ratio === undefined ? 0 : ratio) * 100).toFixed(2)}%`;
}

// Tenure markers are categories, not status (decision 5): neutral shapes,
// an ink outline on white, told apart by shape and by their labels.
const TENURE_MARKER_SHAPES = Object.freeze({
  hire: '<circle cx="7" cy="7" r="4.6"></circle>',
  promotion: '<path d="M7 1.7 12.3 7 7 12.3 1.7 7Z"></path>',
  pdc: '<rect x="2.5" y="2.5" width="9" height="9" rx="1.2"></rect>',
  cv: '<path d="M7 1.8 12.5 11.6H1.5Z"></path>',
  today: '<circle cx="7" cy="7" r="4.6"></circle>'
});

function tenureMarkerGlyph(kind) {
  const shape = TENURE_MARKER_SHAPES[kind] || TENURE_MARKER_SHAPES.hire;
  return `<svg class="tenure-glyph tenure-glyph-${kind}" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">${shape}</svg>`;
}

// Promotion timing at or past the threshold is attention status: amber, and
// always with this triangle so it never relies on color alone.
const TENURE_THRESHOLD_GLYPH = '<svg class="tenure-threshold-glyph" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.2 22.2 20.6H1.8Z"></path><path d="M12 9.6v4.8M12 17.4v.2"></path></svg>';

function buildTeamTenureRiverContext(reports, settings = app.doc?.settings || normalizeSettings({}), mode = app.ui.teamTenureMode) {
  const safeMode = mode === 'promotion' ? 'promotion' : 'tenure';
  const included = [...reports]
    .filter((report) => normalizeDate(report.hireDate))
    .sort((a, b) => String(a.hireDate).localeCompare(String(b.hireDate)) || String(a.name).localeCompare(String(b.name)));
  const excludedCount = reports.length - included.length;
  const thresholdMonths = settings.promotionConversationMonths || DEFAULT_PROMOTION_CONVERSATION_MONTHS;
  const rows = included.map((report) => {
    const hireDate = normalizeDate(report.hireDate);
    const lastPromotionDate = normalizeDate(report.lastPromotionDate);
    const lastPdcDate = latestMeetingDate(report, 'PDC');
    const lastCvReviewDate = latestMeetingDate(report, 'CV review');
    const promotionMonths = monthsBetween(lastPromotionDate);
    const promotionOverdue = promotionMonths !== null && promotionMonths >= thresholdMonths;
    const levelColor = levelTimelineColor(report.level);
    const lineStart = safeMode === 'promotion' ? (lastPromotionDate || hireDate) : hireDate;
    return {
      id: report.id,
      name: report.name,
      initials: report.initials || '',
      hireDate,
      lastPromotionDate,
      lastPdcDate,
      lastCvReviewDate,
      lineStart,
      level: normalizeLevel(report.level),
      levelColor,
      levelStep: levelRampStep(report.level),
      promotionMonths,
      promotionOverdue,
      tenureMonths: monthsBetween(hireDate),
      missingPromotion: !lastPromotionDate
    };
  });
  const starts = rows.map((row) => parseLocalDate(row.lineStart)).filter(Boolean).sort((a, b) => a - b);
  const today = parseLocalDate(todayStamp()) || new Date();
  today.setHours(0, 0, 0, 0);
  return {
    mode: safeMode,
    thresholdMonths,
    rows,
    excludedCount,
    axisStart: starts[0] || today,
    axisEnd: today,
    yearBoundaries: axisYearBoundaries(starts[0] || today, today),
    overdueCount: rows.filter((row) => row.promotionOverdue).length,
    missingPromotionCount: rows.filter((row) => row.missingPromotion).length
  };
}

function renderTeamTenureModeToggle(mode) {
  return `
    <div class="tenure-mode-toggle" role="group" aria-label="Team tenure view">
      <button type="button" class="tenure-mode-btn ${mode === 'tenure' ? 'active' : ''}" data-tenure-mode="tenure" aria-pressed="${mode === 'tenure' ? 'true' : 'false'}">Tenure</button>
      <span class="tenure-mode-sep" aria-hidden="true">·</span>
      <button type="button" class="tenure-mode-btn ${mode === 'promotion' ? 'active' : ''}" data-tenure-mode="promotion" aria-pressed="${mode === 'promotion' ? 'true' : 'false'}">Months since promotion</button>
    </div>`;
}

function renderTeamTenureCard(reports) {
  const settings = app.doc?.settings || normalizeSettings({});
  const context = buildTeamTenureRiverContext(reports, settings, app.ui.teamTenureMode);
  const mode = context.mode;
  const levelLegend = LEVEL_OPTIONS.map((level) => `<span class="legend-item"><span class="swatch ramp-${levelRampStep(level)}" aria-hidden="true"></span>${escapeHtml(level)}</span>`).join('');
  if (!context.rows.length) {
    return `
      <div class="tenure-river-card">
        <div class="tenure-river-head">
          <div>
            <h3>Team Tenure</h3>
            <p>Visual tenure and promotion timing across the team.</p>
          </div>
          ${renderTeamTenureModeToggle(mode)}
        </div>
        <div class="tenure-empty">Add hire dates to direct reports to unlock the team tenure view.</div>
        <div class="tenure-river-foot">
          <div class="tenure-legend">${levelLegend}</div>
          <div class="tenure-footnote">0 of ${reports.length} direct reports currently have a hire date.</div>
        </div>
      </div>
    `;
  }
  const durationTextFor = (row) => mode === 'promotion'
    ? (row.lastPromotionDate ? `${formatMonthSpan(row.promotionMonths, { compact: true })} since promotion` : 'No promotion date')
    : `${formatMonthSpan(row.tenureMonths, { compact: true })} tenure`;
  // The river is an HTML grid: name, track, duration. The year labels sit
  // above the track column, and each track draws its own year lines, so the
  // lines run behind the bars and never through a name or a duration, even
  // when narrow cards put the track on its own line.
  const years = context.yearBoundaries.map((boundary) => ({
    year: boundary.getFullYear(),
    left: tenureAxisPercent(safeAxisRatio(localDateStamp(boundary), context.axisStart, context.axisEnd))
  }));
  const yearLabels = years.map((entry) => `<span class="tenure-river-year" style="left:${entry.left}">${entry.year}</span>`).join('');
  const yearLines = years.map((entry) => `<span class="tenure-river-gridline" style="left:${entry.left}"></span>`).join('');
  const rowsMarkup = context.rows.map((row, index) => {
    const startRatio = safeAxisRatio(row.lineStart, context.axisStart, context.axisEnd);
    const promotionRatio = row.lastPromotionDate ? safeAxisRatio(row.lastPromotionDate, context.axisStart, context.axisEnd) : null;
    const overdue = mode === 'promotion' && row.promotionOverdue;
    const missing = mode === 'promotion' && row.missingPromotion;
    const barClass = ['tenure-river-bar', `level-${row.levelStep}`, overdue ? 'overdue' : '', missing ? 'missing' : ''].filter(Boolean).join(' ');
    const startLeft = tenureAxisPercent(startRatio);
    // In promotion mode the line starts at the promotion, so the promotion
    // marker already sits on the start and the start ring is left out.
    const startIsPromotion = promotionRatio !== null && Math.abs(promotionRatio - (startRatio === null ? 0 : startRatio)) < 0.0001;
    const durationText = durationTextFor(row);
    // Prefer the short company initials in the name column and truncate long
    // fallback names instead of letting them push the track. The full name
    // stays in the tooltip.
    const rawGutterLabel = row.initials || row.name || '';
    const gutterLabel = rawGutterLabel.length > 19 ? `${rawGutterLabel.slice(0, 18)}…` : rawGutterLabel;
    const tooltip = [
      row.name,
      `Hire date: ${formatDate(row.hireDate)}`,
      `Tenure: ${formatMonthSpan(row.tenureMonths)}`,
      row.lastPromotionDate ? `Last promotion: ${formatDate(row.lastPromotionDate)} (${formatMonthSpan(row.promotionMonths)} ago)` : 'Last promotion: not recorded'
    ].join(' · ');
    return `
      <button type="button" class="tenure-river-row" style="grid-row:${index + 2}" data-tenure-open="${escapeHtml(row.id)}" title="${escapeHtml(tooltip)}" aria-label="Open ${escapeHtml(row.name)}">
        <span class="tenure-river-name">${escapeHtml(gutterLabel)}</span>
        <span class="tenure-river-track" aria-hidden="true">
          ${yearLines}
          <span class="${barClass}" style="left:${startLeft}"></span>
          ${startIsPromotion ? '' : `<span class="tenure-river-marker" style="left:${startLeft}">${tenureMarkerGlyph('hire')}</span>`}
          ${promotionRatio === null ? '' : `<span class="tenure-river-marker" style="left:${tenureAxisPercent(promotionRatio)}">${tenureMarkerGlyph('promotion')}</span>`}
        </span>
        <span class="tenure-river-duration${overdue ? ' overdue' : ''}">${overdue ? TENURE_THRESHOLD_GLYPH : ''}${escapeHtml(durationText)}</span>
      </button>
    `;
  }).join('');
  const footnotes = [];
  if (context.excludedCount) footnotes.push(`${context.excludedCount} ${context.excludedCount === 1 ? 'person was' : 'people were'} omitted because hire date is missing.`);
  if (mode === 'promotion') footnotes.push(`${context.overdueCount} ${context.overdueCount === 1 ? 'person is' : 'people are'} at or beyond the ${context.thresholdMonths}-month threshold.`);
  if (mode === 'promotion' && context.missingPromotionCount) footnotes.push(`${context.missingPromotionCount} ${context.missingPromotionCount === 1 ? 'person has' : 'people have'} no promotion date on file.`);
  return `
    <div class="tenure-river-card">
      <div class="tenure-river-head">
        <div>
          <h3>Team Tenure</h3>
          <p>${escapeHtml(mode === 'tenure' ? 'Tenure river from hire date to today, sorted by hire date.' : `Months since last promotion or remuneration. Warning highlight starts at ${context.thresholdMonths} months.`)}</p>
        </div>
        ${renderTeamTenureModeToggle(mode)}
      </div>
      <div class="tenure-river-svg-wrap">
        <div class="tenure-river" role="group" aria-label="Team tenure river chart">
          <div class="tenure-river-scale" aria-hidden="true">
            <div class="tenure-river-years">${yearLabels}</div>
          </div>
          ${rowsMarkup}
        </div>
      </div>
      <div class="tenure-river-foot">
        <div class="tenure-legend">
          ${levelLegend}
          ${mode === 'promotion' ? `<span class="legend-item legend-threshold"><span class="swatch threshold" aria-hidden="true"></span>${TENURE_THRESHOLD_GLYPH}At threshold</span>` : ''}
        </div>
        ${footnotes.length ? `<div class="tenure-footnote">${escapeHtml(footnotes.join(' '))}</div>` : ''}
      </div>
    </div>
  `;
}

// Label lanes for the mini timeline. Each label is centered under its
// marker, or starts or ends at it near the edges, and drops to the next lane
// when it would touch the label before it. Widths are estimated from the
// text at a given chart width. Lanes only get roomier as the chart widens, so
// the lanes worked out for the narrowest width of each layout hold at every
// wider one.
const TENURE_MINI_WIDE_MIN = 560;
const TENURE_MINI_NARROW_MIN = 300;

function tenureMiniLabelLanes(points, width) {
  const laneEnds = [];
  return points.map((point) => {
    const x = point.ratio * width;
    const w = Math.max(point.label.length * 7, point.dateText.length * 6.6) + 12;
    let anchor = 'middle';
    let from = x - (w / 2);
    if (from < 0) {
      anchor = 'start';
      from = x;
    } else if (x + (w / 2) > width) {
      anchor = 'end';
      from = x - w;
    }
    let lane = laneEnds.findIndex((end) => end <= from);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = from + w;
    return { anchor, lane };
  });
}

function renderTenureTimelineSection(report, metrics) {
  const hireDate = normalizeDate(report.hireDate);
  const lastPromotionDate = normalizeDate(report.lastPromotionDate);
  const lastPdcDate = normalizeDate(metrics.lastPdc);
  const lastCvReviewDate = normalizeDate(metrics.lastCvReview);
  const settings = app.doc?.settings || normalizeSettings({});
  const thresholdMonths = settings.promotionConversationMonths || DEFAULT_PROMOTION_CONVERSATION_MONTHS;
  const promotionMonths = monthsBetween(lastPromotionDate);
  const summaryBadges = [
    hireDate ? badge(`Tenure · ${formatTenureFromDate(hireDate)}`, 'neutral') : badge('Hire Date Needed', 'amber'),
    lastPromotionDate ? badge(`Since promotion · ${formatMonthSpan(promotionMonths, { compact: true })}`, promotionMonths !== null && promotionMonths >= thresholdMonths ? 'amber' : 'neutral') : badge('No promotion date', 'outline')
  ].join('');
  if (!hireDate) {
    return `
      <div class="drawer-section">
        <div class="drawer-section-head">
          <div>
            <h3>Tenure & Promotion Timeline</h3>
            <p class="section-note">Hire to today, with markers for promotion and development checkpoints.</p>
          </div>
        </div>
        <div class="tenure-mini-summary">${summaryBadges}</div>
        <p class="tenure-mini-note empty-note">Add a hire date to unlock the timeline visualization for this direct report.</p>
      </div>
    `;
  }
  const axisStart = parseLocalDate(hireDate);
  const axisEnd = parseLocalDate(todayStamp()) || new Date();
  axisEnd.setHours(0, 0, 0, 0);
  const levelStep = levelRampStep(report.level);
  const markers = [
    { key: 'hire', label: 'Hire', date: hireDate },
    { key: 'promotion', label: 'Promotion', date: lastPromotionDate },
    { key: 'pdc', label: 'Last PDC', date: lastPdcDate },
    { key: 'cv', label: 'Last CV Review', date: lastCvReviewDate },
    { key: 'today', label: 'Today', date: todayStamp() }
  ].filter((marker) => marker.date);
  const ordered = markers
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.label).localeCompare(String(b.label)))
    .map((marker) => {
      const ratio = safeAxisRatio(marker.date, axisStart, axisEnd);
      return { ...marker, ratio: ratio === null ? 0 : ratio, dateText: formatDate(marker.date) };
    });
  const wideLanes = tenureMiniLabelLanes(ordered, TENURE_MINI_WIDE_MIN);
  const narrowLanes = tenureMiniLabelLanes(ordered, TENURE_MINI_NARROW_MIN);
  const laneCount = (lanes) => lanes.reduce((max, entry) => Math.max(max, entry.lane + 1), 1);
  const pointsMarkup = ordered.map((marker, index) => `
          <div class="tenure-mini-point" data-marker="${marker.key}" data-anchor="${wideLanes[index].anchor}" data-anchor-n="${narrowLanes[index].anchor}" style="left:${tenureAxisPercent(marker.ratio)};--lane:${wideLanes[index].lane};--lane-n:${narrowLanes[index].lane}" title="${escapeHtml(`${marker.label} · ${marker.dateText}`)}">
            <span class="tenure-mini-marker">${tenureMarkerGlyph(marker.key)}</span>
            <span class="tenure-mini-label">
              <span class="tenure-mini-label-name">${escapeHtml(marker.label)}</span>
              <span class="tenure-mini-label-date">${escapeHtml(marker.dateText)}</span>
            </span>
          </div>`).join('');
  return `
    <div class="drawer-section">
      <div class="drawer-section-head">
        <div>
          <h3>Tenure & Promotion Timeline</h3>
          <p class="section-note">Hire to today, with markers for promotion and development checkpoints.</p>
        </div>
      </div>
      <div class="tenure-mini-summary">${summaryBadges}${promotionMonths !== null && promotionMonths >= thresholdMonths ? badge('Promotion Conversation Due', 'amber') : ''}</div>
      <div class="tenure-mini-wrap">
        <div class="tenure-mini-chart" role="group" aria-label="Tenure and promotion timeline" style="--lanes:${laneCount(wideLanes)};--lanes-n:${laneCount(narrowLanes)}">
          <span class="tenure-mini-bar level-${levelStep}" aria-hidden="true"></span>
          ${pointsMarkup}
        </div>
      </div>
      <div class="tenure-mini-legend">
        <span class="legend-item"><span class="swatch ramp-${levelStep}" aria-hidden="true"></span>Tenure line</span>
        <span class="legend-item">${tenureMarkerGlyph('promotion')}Promotion marker</span>
        <span class="legend-item">${tenureMarkerGlyph('pdc')}PDC marker</span>
        <span class="legend-item">${tenureMarkerGlyph('cv')}CV review marker</span>
      </div>
    </div>
  `;
}
