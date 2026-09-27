// Calendar (.ics) import: escaped text and the meeting date of UTC times.
const BS = '\\'; // one backslash

const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:late-utc@example.test',
  'SUMMARY:1:1 Hana Weiss',
  `DESCRIPTION:Notes in C:${BS}${BS}new${BS}${BS}notes${BS}nSecond line${BS}, with comma${BS}; and semicolon`,
  'DTSTART:20260513T223000Z',
  'DTEND:20260513T230000Z',
  'END:VEVENT',
  'END:VCALENDAR',
  ''
].join('\r\n');

module.exports = {
  name: 'Calendar import text and dates',
  async run(t) {
    const cases = [
      // [time zone, expected meeting date of 2026-05-13 22:30 UTC]
      ['UTC', '2026-05-13'],
      ['Europe/Copenhagen', '2026-05-14'],
      ['America/Los_Angeles', '2026-05-13']
    ];
    for (const [timezoneId, expectedDate] of cases) {
      const page = await t.open({ timezoneId });
      const r = await page.evaluate((text) => {
        const [event] = parseIcsEvents(text);
        return {
          description: event.description,
          startDate: event.startDate,
          earlyUtc: parseIcsDate('20260514T053000Z'),
          floating: parseIcsDate('20260513T233000'),
          allDay: parseIcsDate('20260513')
        };
      }, ICS);
      t.equal(r.description, `Notes in C:${BS}new${BS}notes\nSecond line, with comma; and semicolon`,
        `${timezoneId}: escaped backslash, line break, comma and semicolon are read correctly`);
      t.equal(r.startDate, expectedDate, `${timezoneId}: a meeting at 22:30 UTC is dated ${expectedDate}`);
      t.equal(r.earlyUtc, timezoneId === 'America/Los_Angeles' ? '2026-05-13' : '2026-05-14', `${timezoneId}: a meeting at 05:30 UTC gets the local date`);
      t.equal([r.floating, r.allDay], ['2026-05-13', '2026-05-13'], `${timezoneId}: local and all-day times keep their written date`);
      t.noErrors(page, timezoneId);
      await page.context().close();
    }
  }
};
