// Runs the sample team in three time zones. Dates are calendar dates, so every
// zone must show the same sparklines, vacation Back date, heatmap start and
// PDC round as UTC. A second pass checks "today" late in the evening, when
// the local date and the UTC date differ.
const { doc } = require('../screenshots/sample-team.cjs');

const ZONES = ['UTC', 'Europe/Copenhagen', 'America/Los_Angeles'];

async function readScreens(page) {
  return page.evaluate(() => {
    const titles = (root, selector) => [...root.querySelectorAll(selector)].map((el) => el.textContent.trim());
    // Direct reports tiles: one sparkline per person.
    app.ui.mainView = 'reports';
    render();
    const sparklines = {};
    document.querySelectorAll('[data-report-card]').forEach((tile) => {
      sparklines[tile.getAttribute('data-report-card')] = titles(tile, '.tile-spark-bar title, .tile-spark-stub title').join(' | ');
    });
    // Team health overview: the vacation chip says when the person is back.
    app.ui.mainView = 'teamHealth';
    render();
    const backDates = (document.getElementById('contentPane') || document.body).textContent.match(/back [A-Z][a-z]{2} \d{1,2}, \d{4}/gi) || [];
    // Meetings view: the heatmap.
    app.ui.mainView = 'meetings';
    render();
    const cells = titles(document, '#meetingHeatmap rect title');
    const heatmap = { first: cells[0], last: cells[cells.length - 1], total: document.querySelector('.hm-total')?.textContent || '' };
    // PDC summary: the round chip.
    app.ui.mainView = 'pdcSummary';
    render();
    const round = pdcRoundInfo();
    return {
      today: todayStamp(),
      sparklines,
      backDates,
      heatmap,
      round: { key: round.key, rangeLabel: round.rangeLabel, daysLeft: round.daysLeft, chip: document.querySelector('.pdc-round-chip')?.textContent.trim() || '' }
    };
  });
}

module.exports = {
  name: 'Dates in Copenhagen and Los Angeles match UTC',
  async run(t) {
    const files = { 'team-pulse.json': JSON.stringify(doc, null, 2) };
    const results = {};
    for (const timezoneId of ZONES) {
      const page = await t.open({ files, timezoneId });
      results[timezoneId] = await readScreens(page);
      t.noErrors(page, timezoneId);
      await page.context().close();
    }

    const utc = results.UTC;
    // Known values for the sample team on 2026-05-13 (a Wednesday).
    t.equal(utc.today, '2026-05-13', 'UTC: today is May 13');
    t.check(utc.sparklines.p_001.endsWith('week of May 11, 2026'), 'UTC: the last sparkline week starts Monday May 11');
    t.check(Object.values(utc.sparklines).every((line) => /(^|\| )[1-9] meetings? · week of/.test(line)), 'UTC: every sample person has meetings in their sparkline');
    t.check(utc.backDates.some((d) => /May 22, 2026/.test(d)), 'UTC: the vacation ending May 21 says back May 22');
    t.check(/May 19, 2025$/.test(utc.heatmap.first), 'UTC: the heatmap starts on Monday May 19, 2025');
    t.equal(utc.round.rangeLabel, 'Apr to Jun 2026', 'UTC: the PDC round is Apr to Jun 2026');

    for (const zone of ZONES.slice(1)) {
      const r = results[zone];
      t.equal(r.today, utc.today, `${zone}: same today`);
      t.equal(r.sparklines, utc.sparklines, `${zone}: same tile sparklines`);
      t.equal(r.backDates, utc.backDates, `${zone}: same vacation Back date`);
      t.equal(r.heatmap, utc.heatmap, `${zone}: same heatmap start, end and total`);
      t.equal(r.round, utc.round, `${zone}: same PDC round label`);
    }

    // Late evening: 22:30 UTC is already the next day in Copenhagen, and
    // 05:30 UTC the next morning is still the evening before in Los Angeles.
    const late = [
      ['Europe/Copenhagen', '2026-05-13T22:30:00Z', '2026-05-14'],
      ['America/Los_Angeles', '2026-05-14T05:30:00Z', '2026-05-13'],
      ['UTC', '2026-05-13T23:59:00Z', '2026-05-13']
    ];
    for (const [timezoneId, now, expected] of late) {
      const page = await t.open({ files, timezoneId, now });
      const r = await page.evaluate(() => ({
        today: todayStamp(),
        tomorrow: addDays(todayStamp(), 1),
        monday: mondayOf(todayStamp()),
        month: monthStamp()
      }));
      t.equal(r, { today: expected, tomorrow: expected === '2026-05-14' ? '2026-05-15' : '2026-05-14', monday: '2026-05-11', month: '2026-05' },
        `${timezoneId} at ${now}: today is the local date ${expected}`);
      t.noErrors(page, `${timezoneId} late evening`);
      await page.context().close();
    }
  }
};
