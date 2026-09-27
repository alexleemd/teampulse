// Screenshots every Team Pulse screen with the fictional sample team, in headless Chromium.
//
//   node tools/screenshots/shoot.cjs [outDir] [appFile]
//
// outDir defaults to tools/screenshots/out, appFile to the built index.html.
// The clock, time zone, locale, random numbers and motion are all fixed, so two
// runs of the same file give identical PNGs. hashes.json lists every screen with
// a short hash of its PNG and any page errors. Exits with an error if a screen
// failed. Setup once: "npm install", then "npx playwright install chromium".
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { teamPulseFakeInit } = require('./fake-folder.cjs');
const { TODAY, doc } = require('./sample-team.cjs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'out'));
const APP = 'file://' + path.resolve(process.argv[3] || path.join(__dirname, '..', '..', 'index.html'));
fs.mkdirSync(OUT, { recursive: true });

const withSettings = (patch) => ({ ...doc, settings: { ...doc.settings, ...patch } });

async function open(browser, o = {}) {
  const context = await browser.newContext({
    viewport: o.viewport || { width: 1440, height: 900 }, deviceScaleFactor: 1,
    locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light'
  });
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.__errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.clock.setFixedTime(new Date(`${TODAY}T09:30:00Z`));
  const files = o.files !== undefined ? o.files : { 'team-pulse.json': JSON.stringify(o.doc || doc, null, 2) };
  await page.addInitScript(teamPulseFakeInit, {
    files, folderName: 'Team Pulse Demo', seed: 42,
    storeHandle: o.storeHandle !== false, permission: o.permission || 'granted', noFsApi: !!o.noFsApi
  });
  if (o.uiState) {
    await page.addInitScript((s) => { try { localStorage.setItem('team-pulse-ui-state', JSON.stringify(s)); } catch (_) {} }, o.uiState);
  }
  await page.goto(APP);
  if (o.waitFor !== null) await page.waitForSelector(o.waitFor || '#sidebarNav .sidebar-item');
  await page.waitForTimeout(250); // IDB fake + async load settle
  return { context, page };
}

async function clearToasts(page) {
  await page.evaluate(() => document.querySelectorAll('#toastStack .toast').forEach((t) => t.remove()));
}

const results = [];
async function shot(page, name, { keepToasts = false, fullPane = false } = {}) {
  if (!keepToasts) await clearToasts(page);
  await page.mouse.move(0, 899); // park the pointer off hover targets
  const file = path.join(OUT, `${name}.png`);
  if (fullPane) {
    // The page never scrolls: #contentPane is the scroller. Unclip it for a full-length capture.
    await page.addStyleTag({ content: '.app-shell{height:auto!important;grid-template-rows:auto!important;overflow:visible!important}.content-pane{overflow:visible!important}' });
  }
  // Capture until two captures in a row are identical, so scrolls and hover or
  // focus transitions that are still settling never end up in the picture.
  let previous = null;
  let current = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    current = await page.screenshot({ animations: 'disabled', fullPage: fullPane });
    if (previous && current.equals(previous)) break;
    previous = current;
    await page.waitForTimeout(200);
  }
  fs.writeFileSync(file, current);
  const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  results.push({ name, hash, errors: [...page.__errors] });
}

const screens = [
  // ---- startup ----
  ['startup-modal-first-run', { storeHandle: false, waitFor: '#startupPromptOverlay.open' }, async () => {}],
  ['startup-modal-saved-folder', { permission: 'prompt', waitFor: '#startupPromptOverlay.open' }, async () => {}],
  ['startup-inline-gate', { noFsApi: true, waitFor: '#startupGate:not(.hidden)' }, async () => {}],
  ['empty-overview', { files: {} }, async () => {}],
  ['empty-overview-toast', { files: {} }, async () => {}, { keepToasts: true }],
  ['empty-reports', { files: {} }, async (p) => { await p.keyboard.press('3'); }],
  ['empty-meetings', { files: {} }, async (p) => { await p.keyboard.press('4'); }],
  ['empty-followups', { files: {} }, async (p) => { await p.keyboard.press('5'); }],
  ['empty-pdc-summary', { files: {} }, async (p) => { await p.keyboard.press('6'); }],
  // ---- team health ----
  ['overview', {}, async () => {}],
  ['overview-full', {}, async () => {}, { fullPane: true }],
  ['overview-export-banner', { doc: withSettings({ lastExportDate: '' }) }, async () => {}],
  ['insights', {}, async (p) => { await p.keyboard.press('2'); }, { fullPane: true }],
  ['insights-cdp-web', {}, async (p) => { await p.keyboard.press('2'); await p.click('[data-cdp-team-mode="web"]'); }, { fullPane: true }],
  ['insights-tenure-promotion', {}, async (p) => { await p.keyboard.press('2'); await p.click('[data-tenure-mode="promotion"]'); }, { fullPane: true }],
  // ---- direct reports ----
  ['reports-tiles', {}, async (p) => { await p.keyboard.press('3'); }],
  ['reports-table', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-reports-view="table"]'); }],
  ['reports-no-match', {}, async (p) => { await p.keyboard.press('3'); await p.fill('#reportsGridSearch', 'zzzz'); }],
  ['reports-needs-attention', {}, async (p) => { await p.keyboard.press('3'); await p.selectOption('#reportsAttentionFilter', 'needs-attention'); }],
  ['reports-theme-filter', {}, async (p) => { await p.keyboard.press('2'); await p.click('.theme-chip >> nth=0'); }],
  ['reports-compact', { doc: withSettings({ density: 'compact' }) }, async (p) => { await p.keyboard.press('3'); }],
  // ---- workspace ----
  ['workspace-profile', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); }, { fullPane: true }],
  ['workspace-profile-edit', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('#openProfileEditBtn'); }],
  ['workspace-vacation-edit', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('#openVacationEditBtn'); await p.locator('#vacationList').scrollIntoViewIfNeeded(); }],
  ['workspace-cadence-edit', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('#openCadenceEditBtn'); await p.locator('[name="cadenceOneOnOneDays"]').scrollIntoViewIfNeeded(); }],
  ['workspace-meetings', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('[data-drawer-tab="meetings"]'); }, { fullPane: true }],
  ['workspace-meeting-expanded', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('[data-drawer-tab="meetings"]'); await p.click('details[data-meeting-item] >> nth=0 >> summary'); await p.locator('details[data-meeting-item][open]').scrollIntoViewIfNeeded(); }],
  ['workspace-development', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('[data-drawer-tab="pdc-summary"]'); }, { fullPane: true }],
  ['workspace-development-implied-stage', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('[data-drawer-tab="pdc-summary"]'); await p.click('[data-cdp-stage="Consultant (Developing)"]'); }],
  ['workspace-notes-preview', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('[data-drawer-tab="pdc-summary"]'); await p.click('#detailNotesShell [data-md-mode="preview"]'); await p.locator('#notesSection').scrollIntoViewIfNeeded(); }],
  ['workspace-timeline', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('[data-drawer-tab="timeline"]'); }, { fullPane: true }],
  ['workspace-timeline-changes', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_005"]'); await p.click('[data-drawer-tab="timeline"]'); await p.click('[data-tl-filter="change"]'); }],
  ['workspace-create', {}, async (p) => { await p.keyboard.press('3'); await p.click('#addReportBtn'); }, { fullPane: true }],
  // ---- meetings / follow-ups / pdc ----
  ['meetings', {}, async (p) => { await p.keyboard.press('4'); }],
  ['meetings-filtered', {}, async (p) => { await p.keyboard.press('4'); await p.selectOption('#meetingsFilterSelect', 'p_001'); await p.selectOption('#meetingsTypeFilter', '1:1'); }],
  ['meetings-no-match', {}, async (p) => { await p.keyboard.press('4'); await p.fill('#meetingsSearchInput', 'zzzz'); await p.waitForTimeout(300); }],
  ['followups', {}, async (p) => { await p.keyboard.press('5'); }, { fullPane: true }],
  ['pdc-summary-list', {}, async (p) => { await p.keyboard.press('6'); }, { fullPane: true }],
  ['pdc-summary-edit', {}, async (p) => { await p.keyboard.press('6'); await p.click('[data-pdc-edit="p_001"]'); }],
  ['pdc-board', {}, async (p) => { await p.keyboard.press('6'); await p.click('[data-pdc-view="board"]'); }],
  ['pdc-board-plan-date', {}, async (p) => { await p.keyboard.press('6'); await p.click('[data-pdc-view="board"]'); await p.selectOption('[data-board-move="p_003"]', 'plan-date'); }],
  ['one-on-one-board', {}, async (p) => { await p.keyboard.press('6'); await p.click('[data-pdc-view="oneOnOneBoard"]'); }],
  // ---- 1:1 room ----
  ['meeting-room', {}, async (p) => { await p.keyboard.press('3'); await p.click('.tile-room-btn[data-open-room="p_001"]'); }, { fullPane: true }],
  ['meeting-room-last-time', {}, async (p) => { await p.keyboard.press('3'); await p.click('.tile-room-btn[data-open-room="p_001"]'); await p.click('#mrPrevDetails summary'); }],
  ['meeting-room-pdc', {}, async (p) => { await p.keyboard.press('3'); await p.click('.tile-room-btn[data-open-room="p_004"]'); await p.selectOption('#mrType', 'PDC'); }],
  // ---- settings ----
  ['settings-drawer', {}, async (p) => { await p.keyboard.press('7'); }],
  ['settings-drawer-data-health', {}, async (p) => { await p.keyboard.press('7'); await p.locator('#dataHealthPanel').scrollIntoViewIfNeeded(); }],
  ['settings-view', {}, async (p) => { await p.keyboard.press('7'); await p.keyboard.press('Escape'); }],
  // ---- dialogs and overlays ----
  ['modal-log-meeting', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('[data-drawer-tab="meetings"]'); await p.click('#openMeetingModalBtn'); }],
  ['modal-log-meeting-pdc', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('[data-drawer-tab="meetings"]'); await p.click('#openMeetingModalBtn'); await p.selectOption('#meetingType', 'PDC'); }],
  ['modal-edit-meeting', {}, async (p) => { await p.keyboard.press('4'); await p.click('.meetings-view-item >> nth=0'); }],
  ['modal-edit-meeting-preview', {}, async (p) => { await p.keyboard.press('4'); await p.click('.meetings-view-item >> nth=0'); await p.click('#meetingNotesShell [data-md-mode="preview"]'); }],
  ['modal-add-goal', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('[data-drawer-tab="pdc-summary"]'); await p.click('#addGoalBtn'); }],
  ['modal-edit-goal', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('[data-drawer-tab="pdc-summary"]'); await p.click('[data-goal-edit="goal_001"]'); }],
  ['modal-feedback', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('[data-drawer-tab="pdc-summary"]'); await p.click('#logFeedbackBtn'); }],
  ['search-empty', {}, async (p) => { await p.keyboard.press('/'); }],
  ['search-results', {}, async (p) => { await p.keyboard.press('/'); await p.fill('#globalSearchInput', 'workload'); await p.waitForTimeout(250); }],
  ['search-no-match', {}, async (p) => { await p.keyboard.press('/'); await p.fill('#globalSearchInput', 'zzzz'); await p.waitForTimeout(250); }],
  ['data-menu', {}, async (p) => { await p.click('#dataMenu > summary'); }],
  ['toast-undo', {}, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_006"]'); await p.click('#deleteSelectedBtn'); }, { keepToasts: true }],
  ['print-one-pager', {}, async (p) => { await p.evaluate(() => { window.print = () => {}; }); await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); await p.click('#printOnePagerBtn'); await p.emulateMedia({ media: 'print' }); }, { fullPane: true }],
  // ---- variants ----
  ['mobile-overview', { viewport: { width: 390, height: 844 } }, async () => {}],
  ['mobile-reports', { viewport: { width: 390, height: 844 } }, async (p) => { await p.keyboard.press('3'); }],
  ['mobile-workspace', { viewport: { width: 390, height: 844 } }, async (p) => { await p.keyboard.press('3'); await p.click('[data-report-card="p_001"]'); }],
];

(async () => {
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  // Rendering flags that make headless Chromium paint the same pixels every run.
  const browser = await chromium.launch({
    args: [
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--disable-partial-raster',
      '--disable-skia-runtime-opts',
      '--disable-threaded-animation',
      '--disable-threaded-scrolling',
      '--disable-checker-imaging',
      '--run-all-compositor-stages-before-draw',
    ],
  });
  for (const [name, o, act, shotOpts] of screens) {
    if (only && !only.test(name)) continue;
    let context, page;
    try {
      ({ context, page } = await open(browser, o));
      await act(page);
      await page.waitForTimeout(150);
      await shot(page, name, shotOpts || {});
    } catch (e) {
      results.push({ name, hash: 'FAILED', errors: [e.message.split('\n')[0]] });
    }
    if (context) await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'hashes.json'), JSON.stringify(results, null, 2));
  results.forEach((r) => console.log(`${r.hash}  ${r.name}${r.errors.length ? '  ERR: ' + r.errors.join(' | ') : ''}`));
  if (results.some((r) => r.hash === 'FAILED')) process.exitCode = 1;
})();
