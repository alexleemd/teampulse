// Runs the Team Pulse automated tests in headless Chromium.
//
//   node tools/tests/run.cjs [appFile]      (or: npm test)
//
// Without appFile it first builds src/ into a temporary file with
// "node build.mjs --out", so the tests always check the current source, not
// the committed index.html. Every test uses the fictional sample team or the
// fictional fixtures in this folder, a fake connected folder and a frozen clock.
//
// Test files are the *.test.cjs files in this folder. Each exports
// { name, run(t) }. t.open(options) opens the app, t.check(ok, message)
// records a result. The run exits with an error if any check fails.
// Setup once: "npm install", then "npx playwright install chromium".
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { teamPulseFakeInit } = require('../screenshots/fake-folder.cjs');
const { TODAY } = require('../screenshots/sample-team.cjs');

const ROOT = path.join(__dirname, '..', '..');

function buildApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-pulse-test-'));
  const file = path.join(dir, 'index.html');
  execFileSync(process.execPath, [path.join(ROOT, 'build.mjs'), '--out', file], { stdio: 'pipe' });
  return file;
}

async function main() {
  const appFile = process.argv[2] ? path.resolve(process.argv[2]) : buildApp();
  const appUrl = 'file://' + appFile;
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  const testFiles = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.cjs')).sort();
  const browser = await chromium.launch();
  let failed = 0;
  let passed = 0;
  const started = Date.now();

  for (const file of testFiles) {
    const test = require(path.join(__dirname, file));
    if (only && !only.test(test.name) && !only.test(file)) continue;
    console.log(`\n${test.name}`);
    const contexts = [];
    const t = {
      TODAY,
      // Opens the app with a fake connected folder holding `files`
      // (default: nothing) and waits until it has loaded and saved.
      async open(o = {}) {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          locale: 'en-US',
          timezoneId: o.timezoneId || 'UTC',
          reducedMotion: 'reduce'
        });
        contexts.push(context);
        const page = await context.newPage();
        page.errors = [];
        page.on('pageerror', (e) => page.errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
        page.on('dialog', (d) => d.dismiss());
        await page.clock.setFixedTime(new Date(o.now || `${TODAY}T09:30:00Z`));
        await page.addInitScript(teamPulseFakeInit, {
          files: o.files || {}, folderName: 'Team Pulse Test', seed: 42, storeHandle: true, permission: 'granted'
        });
        await page.goto(appUrl);
        await page.waitForFunction(() => typeof app !== 'undefined' && app.connectedFolderReady, null, { timeout: 10000 });
        await t.idle(page);
        return page;
      },
      // Waits until no save is queued or running.
      async idle(page) {
        await page.waitForTimeout(250);
        await page.waitForFunction(() => !app.saveInFlight && !app.saveQueued, null, { timeout: 10000 });
      },
      // Forces a save and returns the parsed team-pulse.json the app wrote.
      async save(page) {
        await t.idle(page);
        const ok = await page.evaluate(() => flushAutosaveQueue(true));
        t.check(ok === true, 'save succeeded');
        return JSON.parse(await page.evaluate(() => window.__tpFiles.get('team-pulse.json')));
      },
      // The projected people as plain JSON, for comparing two loads.
      async projection(page) {
        return page.evaluate(() => JSON.stringify(getReports(), (key, value) => (value instanceof Set ? [...value].sort() : value)));
      },
      check(ok, message) {
        if (ok) { passed += 1; console.log(`  ok    ${message}`); }
        else { failed += 1; console.log(`  FAIL  ${message}`); }
        return !!ok;
      },
      equal(actual, expected, message) {
        const same = JSON.stringify(actual) === JSON.stringify(expected);
        return t.check(same, same ? message : `${message}\n          expected ${JSON.stringify(expected)}\n          got      ${JSON.stringify(actual)}`);
      },
      noErrors(page, label) {
        return t.check(page.errors.length === 0, `${label}: no page errors${page.errors.length ? ` (${page.errors.join(' | ')})` : ''}`);
      }
    };
    try {
      await test.run(t);
    } catch (error) {
      failed += 1;
      console.log(`  FAIL  ${test.name} stopped: ${error.message.split('\n')[0]}`);
    }
    await Promise.all(contexts.map((c) => c.close().catch(() => {})));
  }

  await browser.close();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${passed} passed, ${failed} failed (${seconds} s)`);
  if (failed || !passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
