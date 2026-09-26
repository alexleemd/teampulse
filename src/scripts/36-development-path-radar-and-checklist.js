
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

const CDP_OVERLAY_COLORS = Object.freeze(['#2957d6', '#7c3aed', '#0d9488', '#d97706', '#dc2626', '#0284c7', '#65a30d', '#c026d3', '#475569', '#be185d', '#4d7c0f', '#b45309']);

// Shared radar renderer. seriesList = [{ name, color, values: [6 x 0-100],
// currentIndex }]. Single mode draws value dots with tooltips; overlay mode
// keeps just the polygons so shapes stay readable.
// Shared radar renderer, upgraded in v0.50.0 for depth: a dished plate
// under the grid, per-series gradient fills with a colored glow filter,
// axis endpoint dots, and in single mode a charge current flowing along
// the shape perimeter (CSS animated, reduced-motion aware). Gradient and
// filter ids are namespaced per instance so several radars can coexist
// in the DOM without collisions. seriesList = [{ name, color,
// values: [6 x 0-100], currentIndex }].
let cdpRadarUid = 0;
function renderCdpRadarSvg(seriesList, options = {}) {
  const size = options.size || 320;
  const width = size + 96;
  const cx = width / 2;
  const cy = size / 2 + 4;
  const R = size / 2 - 44;
  const axes = CDP_FRAMEWORK.length;
  const uid = `cdpg${++cdpRadarUid}`;
  const angleFor = (i) => (-90 + i * (360 / axes)) * (Math.PI / 180);
  const pointFor = (i, value) => {
    const r = (R * Math.max(0, Math.min(100, value))) / 100;
    return [cx + r * Math.cos(angleFor(i)), cy + r * Math.sin(angleFor(i))];
  };
  const ringPoints = (v) => CDP_FRAMEWORK.map((stage, i) => pointFor(i, v).map((n) => n.toFixed(1)).join(',')).join(' ');
  const defs = `
    <defs>
      <radialGradient id="${uid}-plate" cx="50%" cy="44%" r="64%">
        <stop offset="0%" stop-color="#ffffff"></stop>
        <stop offset="76%" stop-color="#f4f7fd"></stop>
        <stop offset="100%" stop-color="#e8eefb"></stop>
      </radialGradient>
      ${seriesList.map((series, i) => `
      <linearGradient id="${uid}-s${i}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${series.color}" stop-opacity="0.42"></stop>
        <stop offset="100%" stop-color="${series.color}" stop-opacity="0.08"></stop>
      </linearGradient>
      <filter id="${uid}-g${i}" x="-45%" y="-45%" width="190%" height="190%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${series.color}" flood-opacity="0.38"></feDropShadow>
      </filter>`).join('')}
    </defs>`;
  const plate = `<polygon class="cdp-radar-plate" points="${ringPoints(100)}" fill="url(#${uid}-plate)"></polygon>`;
  const band = `<polygon class="cdp-radar-band" points="${ringPoints(50)}"></polygon>`;
  const ringPolys = [25, 50, 75, 100].map((v) => `<polygon class="cdp-radar-ring${v === 100 ? ' outer' : ''}" points="${ringPoints(v)}"></polygon>`).join('');
  const axisLines = CDP_FRAMEWORK.map((stage, i) => {
    const [x, y] = pointFor(i, 100);
    return `<line class="cdp-radar-axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"></line><circle class="cdp-radar-axis-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.1"></circle>`;
  }).join('');
  const currentIndexSingle = seriesList.length === 1 ? seriesList[0].currentIndex : -1;
  const labels = CDP_FRAMEWORK.map((stage, i) => {
    const angle = angleFor(i);
    const lx = cx + (R + 16) * Math.cos(angle);
    const ly = cy + (R + 16) * Math.sin(angle);
    const anchor = Math.abs(Math.cos(angle)) < 0.35 ? 'middle' : (Math.cos(angle) > 0 ? 'start' : 'end');
    const isCurrent = i === currentIndexSingle;
    return `<text class="cdp-radar-label${isCurrent ? ' current' : ''}" x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="${anchor}">${escapeHtml(stage.short)}</text>`;
  }).join('');
  const polygons = seriesList.map((series, i) => {
    const pts = series.values.map((value, ax) => pointFor(ax, value).map((n) => n.toFixed(1)).join(',')).join(' ');
    return `<polygon class="cdp-radar-shape" points="${pts}" stroke="${series.color}" fill="url(#${uid}-s${i})" style="filter:url(#${uid}-g${i})" data-name="${escapeHtml(series.name || '')}"><title>${escapeHtml(series.name || '')}</title></polygon>`;
  }).join('');
  const flow = seriesList.length === 1
    ? `<polygon class="cdp-radar-flow" points="${seriesList[0].values.map((value, ax) => pointFor(ax, value).map((n) => n.toFixed(1)).join(',')).join(' ')}" stroke="${seriesList[0].color}"></polygon>`
    : '';
  const dots = seriesList.length === 1
    ? seriesList[0].values.map((value, i) => {
      const [x, y] = pointFor(i, value);
      return `<circle class="cdp-radar-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" style="stroke:${seriesList[0].color}"><title>${escapeHtml(`${CDP_FRAMEWORK[i].docTitle} · ${Math.round(value)}%`)}</title></circle>`;
    }).join('')
    : '';
  return `
    <svg class="cdp-radar" viewBox="0 0 ${width} ${size}" role="img" aria-label="Development path web across the six stages">
      ${defs}
      ${plate}
      ${band}
      ${ringPolys}
      ${axisLines}
      ${polygons}
      ${flow}
      ${dots}
      ${labels}
    </svg>`;
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
    { name: report.name, color: '#2957d6', values: series.map((s) => s.pct), currentIndex }
  ], { size: 300 });
  const summary = currentIndex > -1
    ? `<strong>${escapeHtml(series[currentIndex].stage.docTitle)}</strong><span>${series[currentIndex].done} of ${series[currentIndex].total} capabilities ticked${series[currentIndex].done === series[currentIndex].total ? ' · stage complete, worth a next stage conversation' : ''}</span>`
    : '<strong>No level set</strong><span>Set a level on the Profile tab to anchor the current stage. Ticks still work.</span>';
  const pills = CDP_FRAMEWORK.map((stage, index) => {
    const stat = series[index];
    const state = stat.current ? ' current' : (index === viewedIndex ? ' viewing' : '');
    const marker = stat.pct >= 100 ? ' ✓' : '';
    return `<button type="button" class="cdp-stage-pill${state}${index === viewedIndex ? ' active' : ''}" data-cdp-stage="${escapeHtml(stage.level)}" title="${escapeHtml(`${stage.docTitle} · ${stat.pct}%${stat.implied ? ' (implied by level)' : ''}`)}">${escapeHtml(stage.short)}${marker}</button>`;
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
            <span class="cdp-item-side">
              <span class="cdp-date-label">Achieved</span>
              <input type="date" class="cdp-date" data-cdp-date="${escapeHtml(item.id)}" value="${escapeHtml(String(tick.achievedAt).slice(0, 10))}" title="Edit the achieved date, backdating is fine">
            </span>` : ''}
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
      <div class="tenure-mode-toggle" role="tablist" aria-label="Development path view">
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
    color: CDP_OVERLAY_COLORS[index % CDP_OVERLAY_COLORS.length]
  }));
  let body = '';
  if (mode === 'heatmap') {
    const headerCells = CDP_FRAMEWORK.map((stage) => `<th title="${escapeHtml(stage.docTitle)}">${escapeHtml(stage.short)}</th>`).join('');
    const bodyRows = rows.map(({ report, series, currentIndex }) => {
      const cells = series.map((stat, index) => {
        if (stat.implied || (stat.pct >= 100 && index < currentIndex)) {
          return `<td class="cdp-hm-cell implied${index === currentIndex ? ' current' : ''}" title="${escapeHtml(`${stat.stage.docTitle} · complete (implied by level)`)}">✓</td>`;
        }
        const alpha = stat.pct === 0 ? 0.04 : 0.10 + (stat.pct / 100) * 0.78;
        const dark = stat.pct >= 60;
        return `<td class="cdp-hm-cell${index === currentIndex ? ' current' : ''}${dark ? ' dark' : ''}" style="background:rgba(41,87,214,${alpha.toFixed(2)})" title="${escapeHtml(`${stat.stage.docTitle} · ${stat.done} of ${stat.total} ticked`)}">${stat.pct}%</td>`;
      }).join('');
      return `
        <tr>
          <td class="cdp-hm-person-cell">
            <button type="button" class="cdp-hm-person" data-cdp-open="${escapeHtml(report.id)}">
              <span class="fu-avatar" style="${avatarGradient(report.id)}" aria-hidden="true">${escapeHtml((report.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?')}</span>
              <span class="cdp-hm-name">${escapeHtml(report.name || 'Unnamed')}</span>
            </button>
          </td>
          ${cells}
        </tr>`;
    }).join('');
    body = `
      <div class="cdp-hm-scroll">
        <table class="cdp-hm-table">
          <thead><tr><th class="cdp-hm-person-cell"></th>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      <p class="cdp-card-footnote">Click a person to open their Development tab. ✓ means the stage is behind their current level.</p>`;
  } else {
    const overlay = renderCdpRadarSvg(rows.map(({ report, series, color }) => ({
      name: report.name || 'Unnamed',
      color,
      values: series.map((stat) => stat.pct)
    })), { size: 380 });
    const legend = rows.map(({ report, color }) => `
      <button type="button" class="cdp-legend-chip" data-cdp-open="${escapeHtml(report.id)}">
        <span class="cdp-legend-swatch" style="background:${color}"></span>${escapeHtml(report.name || 'Unnamed')}
      </button>`).join('');
    body = `
      <div class="cdp-web-wrap">${overlay}</div>
      <div class="cdp-legend">${legend}</div>
      <p class="cdp-card-footnote">Each shape is one person. The polygon grows along the path as stages fill. Click a name to open their Development tab.</p>`;
  }
  return `<div class="cdp-card">${head}${body}</div>`;
}
