
// ============================================================================
// Overview dashboard (Team Health > Overview tab)
// ============================================================================
//
// The dashboard is an at-a-glance view. Three sections, top to bottom:
//
//   1. Briefing     - named, per-person digest of everything that needs a
//                     manager's eyes today (overdue touchpoints, elevated
//                     support levels, vacations, follow-ups, PDC round).
//                     Every person mentioned is a chip that opens their
//                     profile. This absorbed the former Cadence, Attention,
//                     and Support Levels tabs in v0.45: counts by rule and
//                     aggregate bars told you less than names do.
//   2. Health score - single composite number (0-100) + headline
//   3. Upcoming     - forward-looking list of next touchpoints
//
// Design notes:
//   - Composite score weights each cadence equally, plus a support-level penalty.
//     Rationale: all three touchpoints are management obligations with roughly
//     equal weight. Support level is a separate signal but affects overall team
//     health meaningfully, so we dock points when reports are flagged.
//   - Upcoming horizon is 14 days. Long enough to catch "this sprint" planning,
//     short enough to stay actionable.
//   - We keep `data-glyph-open` on clickable elements so existing click handlers
//     (drawer open, keyboard activation) keep working without new wiring.

const UPCOMING_HORIZON_DAYS = 14;

// Compose a single 0–100 health score from cadence adherence + support levels.
// Kept in one place so the score, the headline, and the dial stay in sync.
function computeTeamHealthScore(reportStates) {
  const total = reportStates.length;
  if (!total) return { score: 0, tone: 'neutral', headline: 'No reports yet', sub: 'Add a direct report to get started.' };
  const oneOnOneOn = reportStates.filter((item) => !item.metrics.oneOnOneOverdue).length;
  const pdcOn = reportStates.filter((item) => !item.metrics.pdcOverdue).length;
  const cvOn = reportStates.filter((item) => !item.metrics.cvReviewOverdue).length;
  const cadenceScore = ((oneOnOneOn + pdcOn + cvOn) / (total * 3)) * 100;
  // Support-level penalty: urgent costs more than "support needed".
  const urgent = reportStates.filter((item) => item.report.supportLevel === 'Urgent').length;
  const needsSupport = reportStates.filter((item) => item.report.supportLevel === 'Support needed').length;
  const supportPenalty = Math.min(30, (urgent * 8 + needsSupport * 4));
  const raw = cadenceScore - supportPenalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const onTrack = reportStates.filter((item) => item.attentionCount === 0).length;
  const needAttention = total - onTrack;
  const tone = score >= 80 ? 'success' : score >= 55 ? 'warning' : 'danger';
  const headline = score >= 80
    ? 'Team is healthy'
    : score >= 55
      ? 'Some attention needed'
      : 'Significant attention needed';
  const sub = needAttention === 0
    ? `All ${total} reports on track.`
    : `${onTrack} of ${total} on track · ${needAttention} need attention`;
  return { score, tone, headline, sub };
}

function renderHealthScoreSection(scoreInfo) {
  const { score, tone, headline, sub } = scoreInfo;
  const r = 52;
  const circ = 2 * Math.PI * r;
  // Paint the dial at the last value it showed so re-renders never flash to
  // zero. animateHealthRing() then eases it to the new target.
  const shown = healthRingShownScore === null ? 0 : healthRingShownScore;
  const initialOffset = circ - (circ * shown) / 100;
  const gradStops = tone === 'success'
    ? ['#3fd68f', 'var(--success)']
    : tone === 'warning'
      ? ['#ffc65c', 'var(--warning)']
      : ['#ff8a7e', 'var(--danger)'];
  return `
    <div class="overview-section health-score">
      <div class="health-score-dial" data-tone="${escapeHtml(tone)}" role="img" aria-label="Team health score ${score} of 100">
        <svg viewBox="0 0 120 120">
          <defs>
            <linearGradient id="healthRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${gradStops[0]}"></stop>
              <stop offset="100%" style="stop-color:${gradStops[1]}"></stop>
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="${r}" fill="none" stroke="#ecf1f9" stroke-width="10"></circle>
          <circle id="healthRingProgress" cx="60" cy="60" r="${r}" fill="none" stroke="url(#healthRingGradient)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${initialOffset.toFixed(2)}" data-circ="${circ.toFixed(2)}"></circle>
        </svg>
        <div class="health-score-dial-value">
          <div>
            <strong id="healthScoreValue" data-target="${score}">${Math.round(shown)}</strong>
            <span>of 100</span>
          </div>
        </div>
      </div>
      <div class="health-score-body">
        <div class="health-score-label">Team Health</div>
        <p class="health-score-headline" data-tone="${escapeHtml(tone)}">${escapeHtml(headline)}</p>
        <p class="health-score-sub">${escapeHtml(sub)}</p>
      </div>
    </div>
  `;
}

// Eases the health dial from whatever it last displayed to the freshly
// computed score: arc sweep and number count-up together. Snaps instantly
// when the value is unchanged, motion is reduced, or rAF is unavailable.
let healthRingShownScore = null;
let healthRingRaf = 0;
function animateHealthRing() {
  const progressEl = document.getElementById('healthRingProgress');
  const valueEl = document.getElementById('healthScoreValue');
  if (!progressEl || !valueEl) return;
  const target = Number(valueEl.getAttribute('data-target')) || 0;
  const circ = Number(progressEl.getAttribute('data-circ')) || 0;
  const setTo = (value) => {
    progressEl.setAttribute('stroke-dashoffset', (circ - (circ * value) / 100).toFixed(2));
    valueEl.textContent = String(Math.round(value));
  };
  window.cancelAnimationFrame(healthRingRaf);
  const from = healthRingShownScore === null ? 0 : healthRingShownScore;
  healthRingShownScore = target;
  const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || typeof window.requestAnimationFrame !== 'function' || from === target) {
    setTo(target);
    return;
  }
  const duration = 750;
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    setTo(from + (target - from) * ease(t));
    if (t < 1) healthRingRaf = window.requestAnimationFrame(step);
  };
  healthRingRaf = window.requestAnimationFrame(step);
}

function renderUpcomingSection(reportStates) {
  const today = todayStamp();
  const horizon = addDays(today, UPCOMING_HORIZON_DAYS);
  const items = [];
  reportStates.forEach((state) => {
    const r = state.report;
    const push = (kind, date) => {
      if (!date) return;
      if (date < today || date > horizon) return;
      items.push({ kind, date, report: r });
    };
    push('1:1', normalizeDate(r.nextOneOnOneDate));
    push('PDC', normalizeDate(r.nextPdcDate));
  });
  items.sort((a, b) => a.date.localeCompare(b.date) || a.report.name.localeCompare(b.report.name));
  const MAX = 8;
  const visible = items.slice(0, MAX);
  const overflow = items.length > MAX ? items.length - MAX : 0;
  const body = visible.length === 0
    ? `<p class="upcoming-empty">Nothing scheduled in the next ${UPCOMING_HORIZON_DAYS} days.</p>`
    : `<ul class="upcoming-list">${visible.map((item) => {
        const days = daysBetween(today, item.date);
        const whenText = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days · ${formatDate(item.date)}`;
        const tone = days === 0 ? 'warning' : days <= 2 ? 'warning' : days <= 7 ? 'success' : '';
        return `
          <li>
            <button type="button" class="upcoming-row" data-glyph-open="${escapeHtml(item.report.id)}" title="${escapeHtml(`Open ${item.report.name}`)}">
              <span class="upcoming-row-kind">${escapeHtml(item.kind)}</span>
              <span class="upcoming-row-name">${escapeHtml(item.report.name)}</span>
              <span class="upcoming-row-when" ${tone ? `data-tone="${escapeHtml(tone)}"` : ''}>${escapeHtml(whenText)}</span>
            </button>
          </li>
        `;
      }).join('')}${overflow > 0 ? `<li><p class="upcoming-empty">+${overflow} more in the next ${UPCOMING_HORIZON_DAYS} days.</p></li>` : ''}</ul>`;
  return `
    <div class="overview-section">
      <div class="overview-section-head">
        <h3>Upcoming · next ${UPCOMING_HORIZON_DAYS} days</h3>
        <span class="overview-section-note">${items.length} scheduled</span>
      </div>
      ${body}
    </div>
  `;
}

// Compute whole-day difference between two YYYY-MM-DD strings. Positive when b > a.
function daysBetween(a, b) {
  if (!a || !b) return 0;
  const d1 = new Date(a + 'T00:00:00');
  const d2 = new Date(b + 'T00:00:00');
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

// Builds the daily briefing lines from current state. Each line names names:
// an item carries a tone (dot color), a label, and a list of people rendered
// as chips that open the person's profile directly (data-glyph-open, handled
// by the existing teamHealthBody delegation). Aggregate-only lines may carry
// plain html plus an optional navigation target instead. This briefing is the
// single home for cadence, attention, and support-level signals since v0.45,
// so it stays specific: who, not how many.
function buildBriefingItems(reportStates) {
  const items = [];
  const today = todayStamp();
  const chip = (report, extra = '') => ({ id: report.id, name: report.name || 'Unnamed', extra });

  // 1. Overdue touchpoints, one line per kind (respects snoozes and vacation
  //    suppression via the metrics flags). The chip subtext shows the last
  //    logged date of that touchpoint so the line is actionable at a glance.
  const overdueLine = (label, flagKey, lastKey) => {
    const hit = reportStates.filter(({ metrics }) => metrics[flagKey]);
    if (!hit.length) return 0;
    items.push({
      tone: 'warning',
      label: `${label} overdue`,
      people: hit.map(({ report, metrics }) => chip(report, metrics[lastKey] ? `last ${formatDate(metrics[lastKey])}` : 'never held'))
    });
    return hit.length;
  };
  let overdueTotal = 0;
  overdueTotal += overdueLine('1:1', 'oneOnOneOverdue', 'lastOneOnOne');
  overdueTotal += overdueLine('PDC', 'pdcOverdue', 'lastPdc');
  overdueTotal += overdueLine('CV review', 'cvReviewOverdue', 'lastCvReview');

  // 2. Elevated support levels. This absorbed the Support Levels tab: instead
  //    of a distribution bar, name the people and their exact level.
  const flagged = reportStates.filter(({ report }) => {
    const level = normalizeSupportLevel(report.supportLevel);
    return level && level !== 'Good';
  });
  if (flagged.length) {
    const rank = { 'Urgent': 0, 'Support needed': 1, 'Monitor': 2 };
    const sorted = [...flagged].sort((a, b) => (rank[normalizeSupportLevel(a.report.supportLevel)] ?? 9) - (rank[normalizeSupportLevel(b.report.supportLevel)] ?? 9));
    const hasUrgent = sorted.some(({ report }) => normalizeSupportLevel(report.supportLevel) === 'Urgent');
    const hasNeeded = sorted.some(({ report }) => normalizeSupportLevel(report.supportLevel) === 'Support needed');
    items.push({
      tone: hasUrgent ? 'danger' : hasNeeded ? 'warning' : 'info',
      label: 'Support level elevated',
      people: sorted.map(({ report }) => chip(report, normalizeSupportLevel(report.supportLevel)))
    });
  }

  // 3. Vacations: active now, and starting within the next 7 days.
  const activeVacations = reportStates.filter(({ metrics }) => metrics.vacationStatus.active);
  if (activeVacations.length) {
    items.push({
      tone: 'info',
      label: 'On vacation',
      people: activeVacations.map(({ report, metrics }) => chip(report, `back ${formatDate(vacationBackDate(metrics.vacationStatus.current))}`))
    });
  }
  const startingSoon = reportStates.filter(({ metrics }) => {
    const next = metrics.vacationStatus.next;
    return next && normalizeDate(next.startDate) && daysBetween(today, normalizeDate(next.startDate)) <= 7;
  });
  if (startingSoon.length) {
    items.push({
      tone: 'info',
      label: 'Vacation ahead',
      people: startingSoon.map(({ report, metrics }) => chip(report, `from ${formatDate(metrics.vacationStatus.next.startDate)}`))
    });
  }

  // 4. Open follow-ups per person, flagging the ones going stale.
  let openTotal = 0;
  const followUpPeople = [];
  reportStates.forEach(({ report, metrics }) => {
    const open = metrics.openFollowUps || [];
    if (!open.length) return;
    openTotal += open.length;
    const stale = open.filter((item) => {
      const d = normalizeDate(item.meetingDate);
      return d && daysBetween(d, today) > 30;
    }).length;
    followUpPeople.push(chip(report, `${open.length} open${stale ? `, ${stale} stale` : ''}`));
  });
  if (openTotal > 0) {
    items.push({
      tone: followUpPeople.some((person) => person.extra.includes('stale')) ? 'warning' : 'info',
      label: `${openTotal} open follow-up${openTotal === 1 ? '' : 's'}`,
      people: followUpPeople,
      go: 'view:followUps',
      goLabel: 'All follow-ups'
    });
  }

  // 5. PDC round progress across the team. Blocked people get named chips.
  const completed = reportStates.filter(({ metrics }) => metrics.pdcStatus === 'Completed').length;
  const blocked = reportStates.filter(({ metrics }) => metrics.pdcStatus === 'Blocked');
  if (blocked.length) {
    items.push({
      tone: 'warning',
      label: `PDC round: ${completed} of ${reportStates.length} completed, blocked`,
      people: blocked.map(({ report }) => chip(report)),
      go: 'view:pdcSummary',
      goLabel: 'PDC summary'
    });
  } else {
    items.push({
      tone: completed === reportStates.length ? 'success' : 'info',
      html: `PDC round: ${completed} of ${reportStates.length} completed.`,
      go: 'view:pdcSummary'
    });
  }

  // 6. All clear, the line worth working toward.
  if (overdueTotal === 0 && openTotal === 0 && !flagged.length) {
    items.unshift({ tone: 'success', html: 'All clear. No overdue touchpoints, no open follow-ups, nobody flagged.' });
  }
  return items;
}

// Always-on daily briefing at the top of the Overview tab: a short narrated
// digest of what needs a manager's eyes today, computed fresh on every render.
// Rows with people render as plain containers holding one profile chip per
// person (buttons cannot nest, so the row itself stays a div); aggregate rows
// without people keep the original full-row button behavior.
function renderBriefingSection(reportStates) {
  if (!reportStates.length) return '';
  const items = buildBriefingItems(reportStates);
  if (!items.length) return '';
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const rows = items.map((item) => {
    if (item.people && item.people.length) {
      const chips = item.people.map((person) => `
        <button type="button" class="briefing-person" data-glyph-open="${escapeHtml(person.id)}" title="${escapeHtml(`Open ${person.name}`)}">
          <span class="bp-name">${escapeHtml(person.name)}</span>${person.extra ? `<span class="bp-extra">${escapeHtml(person.extra)}</span>` : ''}
        </button>`).join('');
      const trailing = item.go ? `<button type="button" class="briefing-link" data-briefing-go="${escapeHtml(item.go)}">${escapeHtml(item.goLabel || 'Open')} →</button>` : '';
      return `<div class="briefing-row has-people">
        <span class="briefing-dot" data-tone="${escapeHtml(item.tone)}" aria-hidden="true"></span>
        <span class="briefing-text"><strong>${escapeHtml(item.label)}</strong><span class="briefing-people">${chips}</span></span>
        ${trailing}
      </div>`;
    }
    const inner = `<span class="briefing-dot" data-tone="${escapeHtml(item.tone)}" aria-hidden="true"></span><span class="briefing-text">${item.html}</span>`;
    return item.go
      ? `<button type="button" class="briefing-row" data-briefing-go="${escapeHtml(item.go)}">${inner}<span class="briefing-go" aria-hidden="true">→</span></button>`
      : `<div class="briefing-row">${inner}</div>`;
  }).join('');
  return `
    <div class="overview-section briefing" id="dailyBriefing">
      <div class="overview-section-head">
        <h3>Briefing</h3>
        <span class="overview-section-note">${escapeHtml(dateLabel)}</span>
      </div>
      <div class="briefing-list">${rows}</div>
    </div>
  `;
}

function renderOverviewTabHtml(reports, entering = false) {
  const reportStates = [...reports].map((report) => {
    const metrics = getMetrics(report.id);
    return {
      report,
      metrics,
      attentionCount: metrics.attention.length
    };
  });
  const scoreInfo = computeTeamHealthScore(reportStates);
  return `
    <div class="overview-tab${entering ? ' anim-entry' : ''}">
      ${renderBriefingSection(reportStates)}
      ${renderHealthScoreSection(scoreInfo)}
      ${renderUpcomingSection(reportStates)}
    </div>
  `;
}

function renderInsightsTabHtml(reports, entering = false) {
  return `
    <div class="insights-tab${entering ? ' anim-entry' : ''}">
      ${renderHealthTrendCard(reports)}
      ${renderCdpTeamCard(reports)}
      ${renderTeamTenureCard(reports)}
      ${renderRecentThemesCard(reports)}
    </div>
  `;
}


function renderTeamHealth() {
  const reports = getReports();
  teamHealthTabBarEl.classList.toggle('hidden', !reports.length);
  if (!reports.length) {
    teamHealthBodyEl.innerHTML = emptyHeroHtml(
      'people',
      'No direct reports yet',
      'Add your first direct report and Team Pulse starts tracking 1:1 cadence, development, and follow-ups from day one.',
      '<button id="teamHealthEmptyAddBtn" type="button">Add your first direct report</button>'
    );
    document.getElementById('teamHealthEmptyAddBtn')?.addEventListener('click', () => navigateRender(() => openCreateWorkspace()));
    return;
  }
  renderTeamHealthTabBar();
  const tab = currentTeamHealthTab();
  const overviewEntering = viewJustEntered('overviewTab', app.ui.mainView === 'teamHealth' && tab === 'overview');
  const insightsEntering = viewJustEntered('insightsTab', app.ui.mainView === 'teamHealth' && tab === 'insights');
  let panelHtml = '';
  if (tab === 'overview') panelHtml = renderOverviewTabHtml(reports, overviewEntering);
  else if (tab === 'insights') panelHtml = renderInsightsTabHtml(reports, insightsEntering);
  teamHealthBodyEl.innerHTML = panelHtml;
  animateHealthRing();
}

function updateThemeWindowSettingFromForm() {
  if (!app.doc) return;
  const input = document.getElementById('themesWindowDays');
  const nextValue = safePositiveInteger(input?.value || app.doc.settings?.themesWindowDays || THEMES_WINDOW_DEFAULT, THEMES_WINDOW_DEFAULT);
  app.doc.settings.themesWindowDays = nextValue;
}
