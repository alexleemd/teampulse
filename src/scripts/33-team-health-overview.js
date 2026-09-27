
// ============================================================================
// Overview dashboard (Team Health > Overview tab)
// ============================================================================
//
// The dashboard is an at-a-glance view laid out as in Overview.html:
//
//   1. Health score - single composite number (0-100), an 8px meter whose
//                     fill follows the health band, the band label and the
//                     on-track summary. Left card of the first row.
//   2. Briefing     - named, per-person digest of everything that needs a
//                     manager's eyes today (overdue touchpoints, elevated
//                     support levels, vacations, follow-ups, PDC round).
//                     Every person mentioned is a chip that opens their
//                     profile. This absorbed the former Cadence, Attention,
//                     and Support Levels tabs in v0.45: counts by rule and
//                     aggregate bars told you less than names do.
//                     Right card of the first row.
//   3. Direct Reports - the first tiles (attention first) with the team
//                     count and "View all →", the same tile as Direct Reports.
//   4. Upcoming     - forward-looking list of next touchpoints, as a panel.
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
//   - Nothing animates on its own: the score and meter render at their value.

const UPCOMING_HORIZON_DAYS = 14;
const OVERVIEW_TILE_LIMIT = 4;

// Compose a single 0–100 health score from cadence adherence + support levels.
// Kept in one place so the score, the headline, and the meter stay in sync.
// tone is the health band: good (80 and up), mixed (55 to 79), rough (below 55).
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
  const tone = score >= 80 ? 'good' : score >= 55 ? 'mixed' : 'rough';
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

// Health score card (Overview.html): label, the score with "/100", an 8px
// meter on --sunken whose fill follows the band, the band label with its
// status mark, and the summary line. The score and meter are one image for
// screen readers.
function renderHealthScoreSection(scoreInfo) {
  const { score, tone, headline, sub } = scoreInfo;
  return `
    <section class="card overview-card health-score" data-band="${escapeHtml(tone)}" aria-labelledby="healthScoreLabel">
      <h2 class="health-score-label" id="healthScoreLabel">Team Health</h2>
      <div class="health-score-reading" role="img" aria-label="Team health score ${score} of 100">
        <span class="health-score-value"><span class="health-score-number">${score}</span><span class="health-score-max">/100</span></span>
        <span class="health-meter"><span class="health-meter-fill" style="width:${score}%"></span></span>
      </div>
      <p class="health-score-headline"><span class="health-band-mark" aria-hidden="true"></span>${escapeHtml(headline)}</p>
      <p class="health-score-sub">${escapeHtml(sub)}</p>
    </section>
  `;
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
  // Next planned dates are neutral (Moss status table). The next two days
  // are set in ink and 600 so they stand out without a status color.
  const body = visible.length === 0
    ? `<p class="upcoming-empty">Nothing scheduled in the next ${UPCOMING_HORIZON_DAYS} days.</p>`
    : `<ul class="upcoming-list">${visible.map((item) => {
        const days = daysBetween(today, item.date);
        const whenText = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days · ${formatDate(item.date)}`;
        const soon = days <= 2;
        return `
          <li>
            <button type="button" class="upcoming-row" data-glyph-open="${escapeHtml(item.report.id)}" title="${escapeHtml(`Open ${item.report.name}`)}">
              <span class="upcoming-row-kind"><span class="tag">${escapeHtml(item.kind)}</span></span>
              <span class="upcoming-row-name">${escapeHtml(item.report.name)}</span>
              <span class="upcoming-row-when"${soon ? ' data-soon="true"' : ''}>${escapeHtml(whenText)}</span>
            </button>
          </li>
        `;
      }).join('')}${overflow > 0 ? `<li><p class="upcoming-empty upcoming-more">+${overflow} more in the next ${UPCOMING_HORIZON_DAYS} days.</p></li>` : ''}</ul>`;
  return `
    <section class="card overview-card upcoming" aria-labelledby="upcomingTitle">
      <div class="overview-section-head">
        <h2 id="upcomingTitle">Upcoming · next ${UPCOMING_HORIZON_DAYS} days</h2>
        <span class="overview-section-note">${items.length} scheduled</span>
      </div>
      ${body}
    </section>
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
// an item carries a tone (its status mark), a label, and a list of people
// rendered as chips that open the person's profile directly (data-glyph-open,
// handled by the existing teamHealthBody delegation). Aggregate-only lines may
// carry plain html plus an optional navigation target instead. This briefing
// is the single home for cadence, attention, and support-level signals since
// v0.45, so it stays specific: who, not how many.
// Tones: amber (attention), red (urgent), neutral (for information), good.
function buildBriefingItems(reportStates) {
  const items = [];
  const today = todayStamp();
  const chip = (report, extra = '', extraTone = '') => ({ id: report.id, name: report.name || 'Unnamed', extra, extraTone });

  // 1. Overdue touchpoints, one line per kind (respects snoozes and vacation
  //    suppression via the metrics flags). The chip subtext shows the last
  //    logged date of that touchpoint so the line is actionable at a glance.
  const overdueLine = (label, flagKey, lastKey) => {
    const hit = reportStates.filter(({ metrics }) => metrics[flagKey]);
    if (!hit.length) return 0;
    items.push({
      tone: 'amber',
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
  //    of a distribution bar, name the people and their exact level. Support
  //    needed and Urgent read in the red status text (Overview.html).
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
      tone: hasUrgent ? 'red' : hasNeeded ? 'amber' : 'neutral',
      label: 'Support level elevated',
      people: sorted.map(({ report }) => {
        const level = normalizeSupportLevel(report.supportLevel);
        return chip(report, level, level === 'Urgent' || level === 'Support needed' ? 'red' : '');
      })
    });
  }

  // 3. Vacations: active now, and starting within the next 7 days.
  const activeVacations = reportStates.filter(({ metrics }) => metrics.vacationStatus.active);
  if (activeVacations.length) {
    items.push({
      tone: 'neutral',
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
      tone: 'neutral',
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
      tone: followUpPeople.some((person) => person.extra.includes('stale')) ? 'amber' : 'neutral',
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
      tone: 'amber',
      label: `PDC round: ${completed} of ${reportStates.length} completed, blocked`,
      people: blocked.map(({ report }) => chip(report)),
      go: 'view:pdcSummary',
      goLabel: 'PDC summary'
    });
  } else {
    items.push({
      tone: completed === reportStates.length ? 'good' : 'neutral',
      html: `PDC round: ${completed} of ${reportStates.length} completed.`,
      go: 'view:pdcSummary'
    });
  }

  // 6. All clear, the line worth working toward.
  if (overdueTotal === 0 && openTotal === 0 && !flagged.length) {
    items.unshift({ tone: 'good', html: 'All clear. No overdue touchpoints, no open follow-ups, nobody flagged.' });
  }
  return items;
}

// Always-on daily briefing next to the health score: a short narrated digest
// of what needs a manager's eyes today, computed fresh on every render.
// Each row is a status mark, a fixed label column and the chips (name plus
// meta) with an optional link such as "All follow-ups →" at the end of the
// chips (Overview.html). Rows with people are plain containers holding one
// profile chip per person (buttons cannot nest, so the row itself stays a
// div); aggregate rows without people keep the original full-row button.
function renderBriefingSection(reportStates) {
  if (!reportStates.length) return '';
  const items = buildBriefingItems(reportStates);
  if (!items.length) return '';
  const dateLabel = FORMATTERS.weekdayDate.format(new Date());
  const rows = items.map((item) => {
    if (item.people && item.people.length) {
      const chips = item.people.map((person) => `
        <button type="button" class="briefing-person" data-glyph-open="${escapeHtml(person.id)}" title="${escapeHtml(`Open ${person.name}`)}">
          <span class="bp-name">${escapeHtml(person.name)}</span>${person.extra ? `<span class="bp-extra"${person.extraTone ? ` data-tone="${escapeHtml(person.extraTone)}"` : ''}>${escapeHtml(person.extra)}</span>` : ''}
        </button>`).join('');
      const trailing = item.go ? `<button type="button" class="briefing-link" data-briefing-go="${escapeHtml(item.go)}">${escapeHtml(item.goLabel || 'Open')} →</button>` : '';
      return `<div class="briefing-row has-people">
        <span class="briefing-dot" data-tone="${escapeHtml(item.tone)}" aria-hidden="true"></span>
        <span class="briefing-text"><strong>${escapeHtml(item.label)}</strong><span class="briefing-people">${chips}${trailing}</span></span>
      </div>`;
    }
    const inner = `<span class="briefing-dot" data-tone="${escapeHtml(item.tone)}" aria-hidden="true"></span><span class="briefing-text">${item.html}</span>`;
    return item.go
      ? `<button type="button" class="briefing-row" data-briefing-go="${escapeHtml(item.go)}">${inner}<span class="briefing-go" aria-hidden="true">→</span></button>`
      : `<div class="briefing-row">${inner}</div>`;
  }).join('');
  return `
    <section class="card overview-card briefing" id="dailyBriefing" aria-labelledby="dailyBriefingTitle">
      <div class="overview-section-head">
        <h2 id="dailyBriefingTitle">Briefing</h2>
        <span class="overview-section-note">${escapeHtml(dateLabel)}</span>
      </div>
      <div class="briefing-list">${rows}</div>
    </section>
  `;
}

// "Direct Reports" on the Overview (Overview.html): the team count, "View
// all →" to Direct Reports, and the first tiles in the app's urgency order
// (compareReportsForTable, the order of the table), so the people who need
// attention come first. The tiles are the Direct Reports tile
// (renderReportTileHtml in 20).
function renderOverviewReportsSection(reports) {
  const shown = [...reports].sort(compareReportsForTable).slice(0, OVERVIEW_TILE_LIMIT);
  return `
    <section class="overview-reports" aria-labelledby="overviewReportsTitle">
      <div class="overview-reports-head">
        <div class="overview-reports-title">
          <h2 id="overviewReportsTitle">Direct Reports</h2>
          <span class="overview-reports-count">${reports.length}</span>
        </div>
        <button type="button" class="link-button" data-briefing-go="view:reports">View all →</button>
      </div>
      <div class="overview-reports-grid">${shown.map((report) => renderReportTileHtml(report, { context: 'overview' })).join('')}</div>
    </section>
  `;
}

function renderOverviewTabHtml(reports) {
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
    <div class="overview-tab">
      <div class="overview-top">
        ${renderHealthScoreSection(scoreInfo)}
        ${renderBriefingSection(reportStates)}
      </div>
      ${renderOverviewReportsSection(reports)}
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
  const insightsEntering = viewJustEntered('insightsTab', app.ui.mainView === 'teamHealth' && tab === 'insights');
  let panelHtml = '';
  if (tab === 'overview') panelHtml = renderOverviewTabHtml(reports);
  else if (tab === 'insights') panelHtml = renderInsightsTabHtml(reports, insightsEntering);
  teamHealthBodyEl.innerHTML = panelHtml;
}

// The Overview tiles' 1:1 room buttons (data-overview-room). Clicking the
// rest of a tile, or Enter or Space on it, opens the workspace through its
// data-glyph-open hook, which the #teamHealthBody delegation in 29 handles.
// The room button is a sibling of the tile's main button, so that
// delegation never sees it. Bound once, here.
teamHealthBodyEl.addEventListener('click', (event) => {
  const roomBtn = event.target.closest('[data-overview-room]');
  if (!roomBtn || !teamHealthBodyEl.contains(roomBtn)) return;
  openMeetingRoom(roomBtn.getAttribute('data-overview-room'));
});

function updateThemeWindowSettingFromForm() {
  if (!app.doc) return;
  const input = document.getElementById('themesWindowDays');
  const nextValue = safePositiveInteger(input?.value || app.doc.settings?.themesWindowDays || THEMES_WINDOW_DEFAULT, THEMES_WINDOW_DEFAULT);
  app.doc.settings.themesWindowDays = nextValue;
}
