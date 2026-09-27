
let cdpCapabilityIndex = null;
function cdpCapabilityById(capabilityId) {
  if (!cdpCapabilityIndex) {
    cdpCapabilityIndex = new Map();
    CDP_FRAMEWORK.forEach((stage) => {
      stage.groups.forEach((group) => {
        group.items.forEach((item) => cdpCapabilityIndex.set(item.id, { stage, group, item }));
      });
    });
  }
  return cdpCapabilityIndex.get(capabilityId) || null;
}

function normalizeCapabilityTick(entry = {}) {
  const safe = entry && typeof entry === 'object' ? entry : {};
  return {
    id: normalizeText(safe.id || safe.capabilityId),
    achievedAt: normalizeDate(String(safe.achievedAt || '').slice(0, 10)) || todayStamp()
  };
}

function normalizeCapabilityTicks(entries = []) {
  const seen = new Set();
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizeCapabilityTick(entry))
    .filter((entry) => {
      if (!entry.id || seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function capabilityTickMap(report) {
  const map = new Map();
  normalizeCapabilityTicks(report?.capabilities || []).forEach((tick) => map.set(tick.id, tick));
  return map;
}

function cdpStageIndexForLevel(level) {
  const normalized = normalizeLevel(level);
  return CDP_FRAMEWORK.findIndex((stage) => stage.level === normalized);
}

// Per stage stats for one person. Stages earlier than the current level are
// complete by definition (their level proves it), so pct is forced to 100
// there and the implied flag lets the UI say so instead of demanding
// 28 backfill ticks for every senior.
function cdpStageStats(report, stageIndex) {
  const stage = CDP_FRAMEWORK[stageIndex];
  const ticks = capabilityTickMap(report);
  const total = stage.groups.reduce((sum, group) => sum + group.items.length, 0);
  const done = stage.groups.reduce((sum, group) => sum + group.items.filter((item) => ticks.has(item.id)).length, 0);
  const currentIndex = cdpStageIndexForLevel(report.level);
  const isEarlier = currentIndex > -1 && stageIndex < currentIndex;
  const explicitPct = total ? Math.round((done / total) * 100) : 0;
  return {
    stage,
    total,
    done,
    pct: isEarlier ? 100 : explicitPct,
    explicitPct,
    implied: isEarlier && done < total,
    current: stageIndex === currentIndex
  };
}

function cdpSeriesForReport(report) {
  return CDP_FRAMEWORK.map((stage, index) => cdpStageStats(report, index));
}

// Overlay series in the team web are people, a category, not status
// (decision 5): they never use the accent or the status colors. Each person
// gets an ink or dark ramp stroke plus a dash pattern, so shapes are told
// apart by pattern as well as by tone, and the legend shows the same line.
const CDP_OVERLAY_STYLES = Object.freeze([
  { stroke: 'var(--ramp-6)', dash: '' },
  { stroke: 'var(--ink-2)', dash: '' },
  { stroke: 'var(--ramp-4)', dash: '' },
  { stroke: 'var(--ramp-6)', dash: '7 4' },
  { stroke: 'var(--ink-2)', dash: '7 4' },
  { stroke: 'var(--ramp-4)', dash: '7 4' },
  { stroke: 'var(--ramp-6)', dash: '1.5 4' },
  { stroke: 'var(--ink-2)', dash: '1.5 4' },
  { stroke: 'var(--ramp-4)', dash: '1.5 4' }
]);

function cdpOverlayStyle(index) {
  return CDP_OVERLAY_STYLES[index % CDP_OVERLAY_STYLES.length];
}

function cdpLegendLineSvg(style) {
  return `<svg class="cdp-legend-line" width="22" height="10" viewBox="0 0 22 10" aria-hidden="true" focusable="false"><line x1="2" y1="5" x2="20" y2="5" style="stroke:${style.stroke}"${style.dash ? ` stroke-dasharray="${style.dash}"` : ''}></line></svg>`;
}

// Shared radar renderer. seriesList = [{ name, stroke, dash, values: [6 x
// 0-100], currentIndex }]. One series is the person's own web: a 2px accent
// outline with a 12% accent fill and value dots with tooltips. Several
// series are the team overlay: outlines only, one stroke style per person,
// so every shape stays readable. Rings and axes are thin --line marks.
// The geometry is an SVG that scales with the card (strokes keep their width
// through non-scaling-stroke), and the stage labels are HTML placed around
// the plot, so they always render at 12px however wide the card is.
// options.diameter is the plot's full size in px; it only ever shrinks.
const CDP_RADAR_R = 100;

function cdpRadarArea(values) {
  // Polygon area in radius units, used to draw the larger team shapes first.
  return values.reduce((sum, value, i) => {
    const next = values[(i + 1) % values.length];
    return sum + (Math.max(0, Math.min(100, value)) * Math.max(0, Math.min(100, next)));
  }, 0);
}

function renderCdpRadarSvg(seriesList, options = {}) {
  const diameter = options.diameter || 220;
  const R = CDP_RADAR_R;
  const axes = CDP_FRAMEWORK.length;
  const single = seriesList.length === 1;
  const angleFor = (i) => (-90 + i * (360 / axes)) * (Math.PI / 180);
  const pointFor = (i, value) => {
    const r = (R * Math.max(0, Math.min(100, value))) / 100;
    return [r * Math.cos(angleFor(i)), r * Math.sin(angleFor(i))];
  };
  const ringPoints = (v) => CDP_FRAMEWORK.map((stage, i) => pointFor(i, v).map((n) => n.toFixed(2)).join(',')).join(' ');
  const ringPolys = [25, 50, 75, 100].map((v) => `<polygon class="cdp-radar-ring${v === 100 ? ' outer' : ''}" points="${ringPoints(v)}"></polygon>`).join('');
  const axisLines = CDP_FRAMEWORK.map((stage, i) => {
    const [x, y] = pointFor(i, 100);
    return `<line class="cdp-radar-axis" x1="0" y1="0" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"></line>`;
  }).join('');
  const currentIndexSingle = single ? seriesList[0].currentIndex : -1;
  // Each label sits 16px beyond its ring vertex, centered, or starting or
  // ending there on the sides.
  const labels = CDP_FRAMEWORK.map((stage, i) => {
    const angle = angleFor(i);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const anchor = Math.abs(cos) < 0.35 ? 'middle' : (cos > 0 ? 'start' : 'end');
    const isCurrent = i === currentIndexSingle;
    return `<span class="cdp-radar-label${isCurrent ? ' current' : ''}" data-anchor="${anchor}" style="--lx:${cos.toFixed(4)};--ly:${sin.toFixed(4)}" aria-hidden="true">${escapeHtml(stage.short)}</span>`;
  }).join('');
  // Team shapes are drawn from the largest to the smallest, so the smaller
  // shapes and their dash patterns sit on top where edges are shared.
  const drawOrder = seriesList
    .map((series, index) => ({ series, index, area: cdpRadarArea(series.values) }))
    .sort((a, b) => (single ? 0 : (b.area - a.area) || (a.index - b.index)));
  const polygons = drawOrder.map(({ series, index }) => {
    const pts = series.values.map((value, ax) => pointFor(ax, value).map((n) => n.toFixed(2)).join(',')).join(' ');
    const styleAttrs = single
      ? ''
      : ` style="stroke:${series.stroke || 'var(--ink-2)'}"${series.dash ? ` stroke-dasharray="${series.dash}"` : ''}`;
    return `<polygon class="cdp-radar-shape${single ? ' is-single' : ' is-team'}" points="${pts}"${styleAttrs} data-series="${index}" data-name="${escapeHtml(series.name || '')}"><title>${escapeHtml(series.name || '')}</title></polygon>`;
  }).join('');
  // Value dots are 3.5px at the full diameter.
  const dotR = ((3.5 * 2 * R) / diameter).toFixed(2);
  const dots = single
    ? seriesList[0].values.map((value, i) => {
      const [x, y] = pointFor(i, value);
      return `<circle class="cdp-radar-dot" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${dotR}"><title>${escapeHtml(`${CDP_FRAMEWORK[i].docTitle} · ${Math.round(value)}%`)}</title></circle>`;
    }).join('')
    : '';
  return `
    <div class="cdp-radar${single ? '' : ' cdp-radar-overlay'}" style="--radar-d:${diameter}px">
      <div class="cdp-radar-plot">
        <svg class="cdp-radar-svg" viewBox="${-R} ${-R} ${2 * R} ${2 * R}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Development path web across the six stages">
          ${ringPolys}
          ${axisLines}
          ${polygons}
          ${dots}
        </svg>
        ${labels}
      </div>
    </div>`;
}
async function setCapabilityAchieved(reportId, capabilityId, achieved) {
  const report = getReportById(reportId);
  if (!report || !cdpCapabilityById(capabilityId)) return false;
  const ticks = normalizeCapabilityTicks(report.capabilities || []).filter((tick) => tick.id !== capabilityId);
  if (achieved) ticks.push({ id: capabilityId, achievedAt: todayStamp() });
  const payload = buildFullPayloadFromReport(report);
  payload.capabilities = normalizeCapabilityTicks(ticks);
  markTickPop(`cdp:${capabilityId}`);
  return updateReport(reportId, payload, { silentToast: true });
}

async function setCapabilityAchievedDate(reportId, capabilityId, date) {
  const report = getReportById(reportId);
  if (!report) return false;
  const normalized = normalizeDate(date);
  if (!normalized) {
    renderDetailDrawer();
    return false;
  }
  const ticks = normalizeCapabilityTicks(report.capabilities || []);
  const index = ticks.findIndex((tick) => tick.id === capabilityId);
  if (index === -1) return false;
  ticks[index] = { ...ticks[index], achievedAt: normalized };
  const payload = buildFullPayloadFromReport(report);
  payload.capabilities = normalizeCapabilityTicks(ticks);
  return updateReport(reportId, payload, { silentToast: true });
}

// The Development tab section: radar, stage pills, and the checklist for the
// viewed stage. Ticks save instantly through the same event path as every
// other person update, so they land in the JSON and the timeline.
function renderDevelopmentPathPanel(editorReport) {
  const report = getReportById(editorReport.id);
  if (!report) return '';
  const series = cdpSeriesForReport(report);
  const currentIndex = cdpStageIndexForLevel(report.level);
  const requestedIndex = cdpStageIndexForLevel(app.ui.cdpDrawerStage);
  const viewedIndex = requestedIndex > -1 ? requestedIndex : (currentIndex > -1 ? currentIndex : 0);
  const viewed = series[viewedIndex];
  const ticks = capabilityTickMap(report);
  const radar = renderCdpRadarSvg([
    { name: report.name, values: series.map((s) => s.pct), currentIndex }
  ], { diameter: 212 });
  const summary = currentIndex > -1
    ? `<strong>${escapeHtml(series[currentIndex].stage.docTitle)}</strong><span>${series[currentIndex].done} of ${series[currentIndex].total} capabilities ticked${series[currentIndex].done === series[currentIndex].total ? ' · stage complete, worth a next stage conversation' : ''}</span>`
    : '<strong>No level set</strong><span>Set a level on the Profile tab to anchor the current stage. Ticks still work.</span>';
  const pills = CDP_FRAMEWORK.map((stage, index) => {
    const stat = series[index];
    const state = stat.current ? ' current' : (index === viewedIndex ? ' viewing' : '');
    const marker = stat.pct >= 100 ? ' ✓' : '';
    return `<button type="button" class="cdp-stage-pill${state}${index === viewedIndex ? ' active' : ''}" data-cdp-stage="${escapeHtml(stage.level)}" aria-pressed="${index === viewedIndex ? 'true' : 'false'}" title="${escapeHtml(`${stage.docTitle} · ${stat.pct}%${stat.implied ? ' (implied by level)' : ''}`)}">${escapeHtml(stage.short)}${marker}</button>`;
  }).join('');
  const impliedNote = viewed.implied
    ? '<p class="cdp-implied-note">Earlier stage. It counts as complete because their level is beyond it, so ticking here is optional backfill.</p>'
    : '';
  const checklist = viewed.stage.groups.map((group) => `
    <div class="cdp-group">
      <div class="cdp-group-title">${escapeHtml(group.title)}</div>
      ${group.items.map((item) => {
        const tick = ticks.get(item.id);
        return `
          <div class="cdp-item${tick ? ' done' : ''}${tickPopClass(`cdp:${item.id}`)}">
            <label class="cdp-item-main">
              <input type="checkbox" data-cdp-toggle="${escapeHtml(item.id)}" ${tick ? 'checked' : ''}>
              <span class="cdp-item-copy">
                <span class="cdp-item-text">${escapeHtml(item.text)}</span>
                ${item.hint ? `<span class="cdp-hint">${escapeHtml(item.hint)}</span>` : ''}
              </span>
            </label>
            ${tick ? `
            <label class="cdp-item-side">
              <span class="cdp-date-label">Achieved</span>
              <input type="date" class="cdp-date" data-cdp-date="${escapeHtml(item.id)}" value="${escapeHtml(String(tick.achievedAt).slice(0, 10))}" title="Edit the achieved date, backdating is fine">
            </label>` : ''}
          </div>`;
      }).join('')}
    </div>`).join('');
  return `
    <div class="drawer-section cdp-section">
      <div class="drawer-section-head">
        <div>
          <h3>Consultant Development Path</h3>
          <p class="section-note">Mirrors the capability grid from the PDP template. These ticks are your manager view and save instantly. The consultant's own PDP document stays theirs, and a gap between the two is PDC conversation material.</p>
        </div>
      </div>
      <div class="cdp-layout">
        <div class="cdp-radar-wrap">${radar}</div>
        <div class="cdp-side">
          <div class="cdp-summary">${summary}</div>
          <div class="cdp-stage-pills">${pills}</div>
        </div>
      </div>
      <div class="cdp-stage-title">${escapeHtml(viewed.stage.docTitle)} · ${viewed.done} of ${viewed.total} ticked</div>
      ${impliedNote}
      ${checklist}
    </div>`;
}

// Heatmap shading on the one hue ramp: completion is bucketed into the six
// steps, 0% on --ramp-1 up to a complete stage on --ramp-6.
function cdpHeatmapStep(pct) {
  const value = Math.max(0, Math.min(100, Number(pct) || 0));
  if (value <= 0) return 1;
  if (value >= 100) return 6;
  return 2 + Math.min(3, Math.floor(value / 25));
}

// Insights: the team card. Heatmap mode is the scanner (people by stages,
// shaded by completion), web mode overlays everyone on one radar since the
// axes are identical for all.
function renderCdpTeamCard(reports) {
  const mode = app.ui.cdpTeamMode === 'web' ? 'web' : 'heatmap';
  const head = `
    <div class="tenure-river-head">
      <div>
        <h3>Development Path</h3>
        <p>Progress across the six CDP stages. Earlier stages count as complete once a person's level is beyond them.</p>
      </div>
      <div class="tenure-mode-toggle" role="group" aria-label="Development path view">
        <button type="button" class="tenure-mode-btn ${mode === 'heatmap' ? 'active' : ''}" data-cdp-team-mode="heatmap" aria-pressed="${mode === 'heatmap' ? 'true' : 'false'}">Heatmap</button>
        <span class="tenure-mode-sep" aria-hidden="true">·</span>
        <button type="button" class="tenure-mode-btn ${mode === 'web' ? 'active' : ''}" data-cdp-team-mode="web" aria-pressed="${mode === 'web' ? 'true' : 'false'}">Web</button>
      </div>
    </div>`;
  if (!reports.length) {
    return `<div class="cdp-card">${head}<div class="trend-empty">Add a direct report to start tracking the development path.</div></div>`;
  }
  const rows = reports.map((report, index) => ({
    report,
    series: cdpSeriesForReport(report),
    currentIndex: cdpStageIndexForLevel(report.level),
    style: cdpOverlayStyle(index)
  }));
  let body = '';
  if (mode === 'heatmap') {
    const headerCells = CDP_FRAMEWORK.map((stage) => `<th scope="col" title="${escapeHtml(stage.docTitle)}">${escapeHtml(stage.short)}</th>`).join('');
    const bodyRows = rows.map(({ report, series, currentIndex }) => {
      const cells = series.map((stat, index) => {
        if (stat.implied || (stat.pct >= 100 && index < currentIndex)) {
          return `<td class="cdp-hm-cell implied step-6${index === currentIndex ? ' current' : ''}" title="${escapeHtml(`${stat.stage.docTitle} · complete (implied by level)`)}">✓</td>`;
        }
        return `<td class="cdp-hm-cell step-${cdpHeatmapStep(stat.pct)}${index === currentIndex ? ' current' : ''}" title="${escapeHtml(`${stat.stage.docTitle} · ${stat.done} of ${stat.total} ticked`)}">${stat.pct}%</td>`;
      }).join('');
      return `
        <tr>
          <th scope="row" class="cdp-hm-person-cell">
            <button type="button" class="cdp-hm-person" data-cdp-open="${escapeHtml(report.id)}">
              <span class="fu-avatar" aria-hidden="true">${escapeHtml((report.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?')}</span>
              <span class="cdp-hm-name">${escapeHtml(report.name || 'Unnamed')}</span>
            </button>
          </th>
          ${cells}
        </tr>`;
    }).join('');
    body = `
      <div class="cdp-hm-scroll">
        <table class="cdp-hm-table">
          <thead><tr><td class="cdp-hm-person-cell"></td>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      <p class="cdp-card-footnote">Click a person to open their Development tab. ✓ means the stage is behind their current level.</p>`;
  } else {
    const overlay = renderCdpRadarSvg(rows.map(({ report, series, style }) => ({
      name: report.name || 'Unnamed',
      stroke: style.stroke,
      dash: style.dash,
      values: series.map((stat) => stat.pct)
    })), { diameter: 292 });
    const legend = rows.map(({ report, style }, index) => `
      <button type="button" class="cdp-legend-chip" data-cdp-open="${escapeHtml(report.id)}" data-series="${index}">
        ${rows.length > 1 ? cdpLegendLineSvg(style) : '<span class="cdp-legend-swatch" aria-hidden="true"></span>'}${escapeHtml(report.name || 'Unnamed')}
      </button>`).join('');
    body = `
      <div class="cdp-web-wrap">${overlay}</div>
      <div class="cdp-legend">${legend}</div>
      <p class="cdp-card-footnote">Each shape is one person. The polygon grows along the path as stages fill. Click a name to open their Development tab.</p>`;
  }
  return `<div class="cdp-card">${head}${body}</div>`;
}
