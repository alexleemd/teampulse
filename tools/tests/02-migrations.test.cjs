// Opens a fictional file from every older schema version, as a user would by
// connecting a folder that holds it. Each must load without errors, be saved
// as schema v12, keep its data, and load again unchanged from what was saved.
const fixtures = require('./fixtures/migrations.cjs');

module.exports = {
  name: 'Migrations from every schema version to v12',
  async run(t) {
    for (const fixture of fixtures) {
      const label = `v${fixture.version} ${fixture.label}`;
      console.log(`  -- ${label}`);
      const page = await t.open({ files: { 'team-pulse.json': JSON.stringify(fixture.doc, null, 2) } });
      t.noErrors(page, `${label}: load`);
      const saved = await t.save(page);
      const reports = JSON.parse(await t.projection(page));
      const loadedSchemaVersion = await page.evaluate(() => app.loadedSchemaVersion);
      t.equal(saved.schemaVersion, 12, `${label}: saved as schema v12`);
      // A pre-versioned file (v0) reports as v12, since 0 means "not migrated" to the app.
      if (fixture.version > 0 && fixture.version < 12) t.equal(loadedSchemaVersion, fixture.version, `${label}: the app reports the version it upgraded from`);
      t.check(saved.events.every((e) => /^\d{4}-\d{2}-\d{2}T/.test(e.createdAt)), `${label}: event timestamps stay ISO`);
      fixture.expect({ reports, saved, loadedSchemaVersion }, t);

      const reloaded = await t.open({ files: { 'team-pulse.json': JSON.stringify(saved, null, 2) } });
      t.noErrors(reloaded, `${label}: reload`);
      t.check(await t.projection(reloaded) === JSON.stringify(reports), `${label}: the upgraded file loads back the same`);
      await page.context().close();
      await reloaded.context().close();
    }

    const page = await t.open();
    const newer = await page.evaluate(() => {
      try { parsePortableJsonText(JSON.stringify({ schemaVersion: 13, people: [], events: [] })); return ''; } catch (error) { return error.message; }
    });
    t.check(/newer/.test(newer), 'a file from a newer schema version is refused');
  }
};
