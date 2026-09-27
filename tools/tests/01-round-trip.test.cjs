// Load, edit, save and reload: what the app writes to team-pulse.json must
// load back into exactly the same team, and nothing that was there may be lost.
const { doc } = require('../screenshots/sample-team.cjs');

module.exports = {
  name: 'Load, save and reload round trip',
  async run(t) {
    const original = JSON.stringify(doc, null, 2);
    const first = await t.open({ files: { 'team-pulse.json': original } });
    t.noErrors(first, 'first load');
    t.equal(await first.evaluate(() => getReports().length), doc.people.length, 'all sample people load');

    // Two ordinary edits through the app's own functions.
    await first.evaluate(async () => {
      await addTalkingPoint('p_002', 'Round trip talking point', { silent: true });
      await addMeeting('p_004', { meetingType: '1:1', meetingDate: '2026-05-12', durationMinutes: 30, notes: 'Round trip meeting', pulse: '' });
    });
    const saved = await t.save(first);
    const afterEdit = await t.projection(first);
    const files = await first.evaluate(() => Object.fromEntries(window.__tpFiles));

    t.equal(saved.schemaVersion, 12, 'saved file is schema v12');
    t.check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(saved.savedAt), 'savedAt is an ISO timestamp');
    t.equal(saved.people.map((p) => p.id), doc.people.map((p) => p.id), 'every person is saved, in order');
    const savedEventIds = new Set(saved.events.map((e) => e.id));
    t.check(doc.events.every((e) => savedEventIds.has(e.id)), 'every original event is saved');
    t.equal(saved.events.length, doc.events.length + 2, 'the two edits are saved as two new events');
    const meeting = saved.events.find((e) => e.type === 'meeting_logged' && e.notes === 'Round trip meeting');
    t.check(meeting && meeting.meetingDate === '2026-05-12' && meeting.personId === 'p_004', 'the new meeting keeps its date and person');
    t.check(saved.events.some((e) => e.type === 'person_updated' && e.personId === 'p_002'
      && (e.changes.talkingPoints || []).some((p) => p.text === 'Round trip talking point')), 'the new talking point is saved');
    t.check(saved.events.every((e) => /^\d{4}-\d{2}-\d{2}T/.test(e.createdAt)), 'every event keeps an ISO createdAt');
    t.check(saved.events.filter((e) => e.meetingDate).every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.meetingDate)), 'meeting dates stay YYYY-MM-DD');
    t.check(typeof files['team-pulse.backup.json'] === 'string' && JSON.parse(files['team-pulse.backup.json']).people.length === doc.people.length,
      'a backup of the previous file is written');
    t.check(typeof files['SCHEMA.md'] === 'string' && files['SCHEMA.md'].includes('Schema version:** 12'), 'SCHEMA.md is written');

    // Reload the saved file in a fresh browser.
    const second = await t.open({ files: { 'team-pulse.json': JSON.stringify(saved, null, 2) } });
    t.noErrors(second, 'reload');
    t.check(await t.projection(second) === afterEdit, 'the reloaded team matches the team before saving');

    // Saving again without changes writes the same document (apart from savedAt).
    const again = await t.save(second);
    t.equal({ ...again, savedAt: '' }, { ...saved, savedAt: '' }, 'a second save changes nothing but savedAt');
  }
};
