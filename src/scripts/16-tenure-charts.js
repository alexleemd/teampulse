
function levelTimelineColor(level) {
  return LEVEL_TIMELINE_COLORS[normalizeLevel(level)] || '#6f7c93';
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

function renderTeamTenureCard(reports) {
  const settings = app.doc?.settings || normalizeSettings({});
  const context = buildTeamTenureRiverContext(reports, settings, app.ui.teamTenureMode);
  const mode = context.mode;
  const levelLegend = LEVEL_OPTIONS.map((level) => `<span class="legend-item"><span class="swatch" style="background:${escapeHtml(levelTimelineColor(level))}"></span>${escapeHtml(level)}</span>`).join('');
  if (!context.rows.length) {
    return `
      <div class="tenure-river-card">
        <div class="tenure-river-head">
          <div>
            <h3>Team Tenure</h3>
            <p>Visual tenure and promotion timing across the team.</p>
          </div>
          <div class="tenure-mode-toggle" role="tablist" aria-label="Team tenure view">
            <button type="button" class="tenure-mode-btn ${mode === 'tenure' ? 'active' : ''}" data-tenure-mode="tenure" aria-pressed="${mode === 'tenure' ? 'true' : 'false'}">Tenure</button>
            <span class="tenure-mode-sep" aria-hidden="true">·</span>
            <button type="button" class="tenure-mode-btn ${mode === 'promotion' ? 'active' : ''}" data-tenure-mode="promotion" aria-pressed="${mode === 'promotion' ? 'true' : 'false'}">Months since promotion</button>
          </div>
        </div>
        <div class="tenure-empty">Add hire dates to direct reports to unlock the team tenure view.</div>
        <div class="tenure-river-foot">
          <div class="tenure-legend">${levelLegend}</div>
          <div class="tenure-footnote">0 of ${reports.length} direct reports currently have a hire date.</div>
        </div>
      </div>
    `;
  }
  const leftGutter = 176;
  const plotWidth = 880;
  const topPad = 42;
  const rowHeight = 32;
  const height = topPad + (context.rows.length * rowHeight) + 18;
  const durationTextFor = (row) => mode === 'promotion'
    ? (row.lastPromotionDate ? `${formatMonthSpan(row.promotionMonths, { compact: true })} since promotion` : 'No promotion date')
    : `${formatMonthSpan(row.tenureMonths, { compact: true })} tenure`;
  // The duration label is drawn to the right of the plot at endX + 8, so the
  // viewBox must reserve room for the longest one or the SVG edge clips it
  // (the old fixed 24-unit pad cut "3m tenure" down to "3m"). 12px 700-weight
  // glyphs run about 7.6 viewBox units wide.
  const maxLabelChars = context.rows.reduce((max, row) => Math.max(max, durationTextFor(row).length), 0);
  const rightPad = 16 + Math.ceil(maxLabelChars * 7.6);
  const svgWidth = leftGutter + plotWidth + rightPad;
  const yearLines = context.yearBoundaries.map((boundary) => {
    const ratio = safeAxisRatio(localDateStamp(boundary), context.axisStart, context.axisEnd);
    const x = Math.round((leftGutter + ((ratio === null ? 0 : ratio) * plotWidth)) * 10) / 10;
    return `
      <g>
        <line x1="${x}" x2="${x}" y1="18" y2="${height - 12}" stroke="#d9e1ef" stroke-width="1" stroke-dasharray="4 6"></line>
        <text x="${x}" y="14" text-anchor="middle" font-size="11" font-weight="700" fill="#5f6b85">${boundary.getFullYear()}</text>
      </g>
    `;
  }).join('');
  const rowsMarkup = context.rows.map((row, index) => {
    const y = topPad + (index * rowHeight);
    const startRatio = safeAxisRatio(row.lineStart, context.axisStart, context.axisEnd);
    const lineStartX = leftGutter + ((startRatio === null ? 0 : startRatio) * plotWidth);
    const endX = leftGutter + plotWidth;
    const promotionRatio = row.lastPromotionDate ? safeAxisRatio(row.lastPromotionDate, context.axisStart, context.axisEnd) : null;
    const promotionX = promotionRatio === null ? null : leftGutter + (promotionRatio * plotWidth);
    const stroke = mode === 'promotion' && row.promotionOverdue ? 'var(--warning)' : row.levelColor;
    const dash = mode === 'promotion' && row.missingPromotion ? '7 5' : '';
    const durationText = durationTextFor(row);
    // The 176-unit gutter fits about 19 characters at 13px/700, so prefer the
    // short company initials and truncate long fallback names instead of
    // letting them run under the track. The full name stays in the tooltip.
    const rawGutterLabel = row.initials || row.name || '';
    const gutterLabel = rawGutterLabel.length > 19 ? `${rawGutterLabel.slice(0, 18)}…` : rawGutterLabel;
    const tooltip = [
      row.name,
      `Hire date: ${formatDate(row.hireDate)}`,
      `Tenure: ${formatMonthSpan(row.tenureMonths)}`,
      row.lastPromotionDate ? `Last promotion: ${formatDate(row.lastPromotionDate)} (${formatMonthSpan(row.promotionMonths)} ago)` : 'Last promotion: not recorded'
    ].join(' · ');
    return `
      <g data-tenure-open="${escapeHtml(row.id)}" tabindex="0" role="button" aria-label="Open ${escapeHtml(row.name)}">
        <title>${escapeHtml(tooltip)}</title>
        <rect x="0" y="${y - 16}" width="${svgWidth}" height="30" rx="8" fill="transparent"></rect>
        <text x="8" y="${y + 4}" font-size="13" font-weight="700" fill="#172033">${escapeHtml(gutterLabel)}</text>
        <line x1="${lineStartX}" x2="${endX}" y1="${y}" y2="${y}" stroke="${stroke}" stroke-width="5" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''}></line>
        <circle cx="${lineStartX}" cy="${y}" r="4.5" fill="#ffffff" stroke="${stroke}" stroke-width="2"></circle>
        ${promotionX === null ? '' : `<circle cx="${promotionX}" cy="${y}" r="5" fill="#ffffff" stroke="${stroke}" stroke-width="2"></circle>`}
        <text x="${endX + 8}" y="${y + 4}" font-size="12" font-weight="700" fill="#5f6b85">${escapeHtml(durationText)}</text>
      </g>
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
        <div class="tenure-mode-toggle" role="tablist" aria-label="Team tenure view">
          <button type="button" class="tenure-mode-btn ${mode === 'tenure' ? 'active' : ''}" data-tenure-mode="tenure" aria-pressed="${mode === 'tenure' ? 'true' : 'false'}">Tenure</button>
          <span class="tenure-mode-sep" aria-hidden="true">·</span>
          <button type="button" class="tenure-mode-btn ${mode === 'promotion' ? 'active' : ''}" data-tenure-mode="promotion" aria-pressed="${mode === 'promotion' ? 'true' : 'false'}">Months since promotion</button>
        </div>
      </div>
      <div class="tenure-river-svg-wrap">
        <svg class="tenure-river-svg" viewBox="0 0 ${svgWidth} ${height}" aria-label="Team tenure river chart">
          ${yearLines}
          ${rowsMarkup}
        </svg>
      </div>
      <div class="tenure-river-foot">
        <div class="tenure-legend">
          ${levelLegend}
          ${mode === 'promotion' ? '<span class="legend-item"><span class="swatch" style="background:var(--warning)"></span>At threshold</span>' : ''}
        </div>
        <div class="tenure-footnote">${escapeHtml(footnotes.join(' '))}</div>
      </div>
    </div>
  `;
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
    hireDate ? badge(`Tenure · ${formatTenureFromDate(hireDate)}`, 'neutral') : badge('Hire Date Needed', 'warning'),
    lastPromotionDate ? badge(`Since promotion · ${formatMonthSpan(promotionMonths, { compact: true })}`, promotionMonths !== null && promotionMonths >= thresholdMonths ? 'warning' : 'info') : badge('No promotion date', 'soft')
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
        <p class="tenure-mini-note">Add a hire date to unlock the timeline visualization for this direct report.</p>
      </div>
    `;
  }
  const axisStart = parseLocalDate(hireDate);
  const axisEnd = parseLocalDate(todayStamp()) || new Date();
  axisEnd.setHours(0, 0, 0, 0);
  const width = 760;
  const height = 168;
  const left = 26;
  const right = width - 24;
  const plotWidth = right - left;
  const lineY = 44;
  const labelBaseY = 112;
  const markers = [
    { key: 'hire', label: 'Hire', date: hireDate, color: '#172033', fill: '#ffffff' },
    { key: 'promotion', label: 'Promotion', date: lastPromotionDate, color: 'var(--warning)', fill: '#ffffff' },
    { key: 'pdc', label: 'Last PDC', date: lastPdcDate, color: 'var(--success)', fill: '#ffffff' },
    { key: 'cv', label: 'Last CV Review', date: lastCvReviewDate, color: 'var(--info)', fill: '#ffffff' },
    { key: 'today', label: 'Today', date: todayStamp(), color: levelTimelineColor(report.level), fill: '#ffffff' }
  ].filter((marker) => marker.date);
  const ordered = markers.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.label).localeCompare(String(b.label)));
  const markerMarkup = ordered.map((marker, index) => {
    const ratio = safeAxisRatio(marker.date, axisStart, axisEnd);
    const x = left + ((ratio === null ? 0 : ratio) * plotWidth);
    const labelY = labelBaseY + ((index % 2) * 24);
    return `
      <g>
        <title>${escapeHtml(`${marker.label} · ${formatDate(marker.date)}`)}</title>
        <line x1="${x}" x2="${x}" y1="${lineY}" y2="${labelY - 18}" stroke="#d9e1ef" stroke-width="1"></line>
        <circle cx="${x}" cy="${lineY}" r="6" fill="${marker.fill}" stroke="${marker.color}" stroke-width="2.5"></circle>
        <text x="${x}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="700" fill="#172033">${escapeHtml(marker.label)}</text>
        <text x="${x}" y="${labelY + 14}" text-anchor="middle" font-size="11" fill="#5f6b85">${escapeHtml(formatDate(marker.date))}</text>
      </g>
    `;
  }).join('');
  return `
    <div class="drawer-section">
      <div class="drawer-section-head">
        <div>
          <h3>Tenure & Promotion Timeline</h3>
          <p class="section-note">Hire to today, with markers for promotion and development checkpoints.</p>
        </div>
      </div>
      <div class="tenure-mini-summary">${summaryBadges}${promotionMonths !== null && promotionMonths >= thresholdMonths ? badge('Promotion Conversation Due', 'warning') : ''}</div>
      <div class="tenure-mini-wrap">
        <svg class="tenure-mini-svg" viewBox="0 0 ${width} ${height}" aria-label="Tenure and promotion timeline">
          <line x1="${left}" x2="${right}" y1="${lineY}" y2="${lineY}" stroke="#d9e1ef" stroke-width="6" stroke-linecap="round"></line>
          <line x1="${left}" x2="${right}" y1="${lineY}" y2="${lineY}" stroke="${levelTimelineColor(report.level)}" stroke-width="6" stroke-linecap="round"></line>
          ${markerMarkup}
        </svg>
      </div>
      <div class="tenure-mini-legend">
        <span class="legend-item"><span class="swatch" style="background:${escapeHtml(levelTimelineColor(report.level))}"></span>Tenure line</span>
        <span class="legend-item"><span class="swatch" style="background:var(--warning)"></span>Promotion marker</span>
        <span class="legend-item"><span class="swatch" style="background:var(--success)"></span>PDC marker</span>
        <span class="legend-item"><span class="swatch" style="background:var(--info)"></span>CV review marker</span>
      </div>
    </div>
  `;
}

const LEVEL_TIMELINE_COLORS = Object.freeze({
  'Consultant (Developing)': '#9fc0ff',
  'Consultant (Skilled)': '#6f97f5',
  'Consultant (Proficient)': '#2957d6',
  'Senior (Developing)': '#cdbaf6',
  'Senior (Skilled)': '#9f82e6',
  'Senior (Proficient)': '#6d46c8'
});
