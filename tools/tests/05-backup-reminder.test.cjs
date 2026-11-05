// The backup export reminder: due 90 days after the last export. A file that
// was never exported counts from its oldest change, so a new, empty file
// shows no reminder.
const { doc } = require('../screenshots/sample-team.cjs');

function sampleFile(lastExportDate, events) {
  return JSON.stringify({
    ...doc,
    settings: { ...doc.settings, lastExportDate },
    events: events || doc.events
  }, null, 2);
}

module.exports = {
  name: 'Backup export reminder',
  async run(t) {
    const reminder = (page) => page.evaluate(() => ({
      due: quarterlyExportDue(),
      shown: !!document.querySelector('.export-banner')
    }));

    let page = await t.open();
    t.equal(await reminder(page), { due: false, shown: false }, 'a new, empty file shows no backup reminder');
    t.noErrors(page, 'new file');
    await page.context().close();

    page = await t.open({ files: { 'team-pulse.json': sampleFile('') } });
    t.equal(await reminder(page), { due: true, shown: true }, 'never exported, oldest change about a year ago: the reminder shows');
    await page.context().close();

    // The same events, all from the last hour, in their original order.
    const now = Date.parse(`${t.TODAY}T09:00:00.000Z`);
    const recent = doc.events.map((event, index) => ({
      ...event,
      createdAt: new Date(now - (doc.events.length - index) * 60000).toISOString()
    }));
    page = await t.open({ files: { 'team-pulse.json': sampleFile('', recent) } });
    t.equal(await reminder(page), { due: false, shown: false }, 'never exported, every change from today: no reminder yet');
    await page.context().close();

    page = await t.open({ files: { 'team-pulse.json': sampleFile('2026-04-23T09:00:00.000Z') } });
    t.equal(await reminder(page), { due: false, shown: false }, 'exported 20 days ago: no reminder');
    t.noErrors(page, 'exported file');
    await page.context().close();
  }
};
