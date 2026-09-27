async function verifyPermission(handle, readWrite = false) {
  if (!handle) return false;
  const options = readWrite ? { mode: 'readwrite' } : {};
  try {
    if (handle.queryPermission && (await handle.queryPermission(options)) === 'granted') return true;
    if (handle.requestPermission && (await handle.requestPermission(options)) === 'granted') return true;
  } catch (error) {
    console.error('Permission check failed', error);
  }
  return false;
}

async function getFileHandleFromFolder(folderHandle, fileName, create = false) {
  try {
    return await folderHandle.getFileHandle(fileName, { create });
  } catch (error) {
    if (error && error.name === 'NotFoundError' && !create) return null;
    throw error;
  }
}

async function readTextFromHandle(fileHandle) {
  const file = await fileHandle.getFile();
  return file.text();
}

async function writeValueToHandle(fileHandle, value) {
  const writable = await fileHandle.createWritable();
  await writable.write(value);
  await writable.close();
}

async function readFolderFileText(fileName) {
  if (!app.folderHandle) return '';
  const handle = await getFileHandleFromFolder(app.folderHandle, fileName, false);
  if (!handle) return '';
  return readTextFromHandle(handle);
}

async function writeFolderFileText(fileName, text) {
  if (!app.folderHandle) throw new Error('No Team Pulse folder is connected.');
  const handle = await getFileHandleFromFolder(app.folderHandle, fileName, true);
  await writeValueToHandle(handle, text);
}

async function parseSavedAtFromFolderFile(fileName) {
  try {
    const text = await readFolderFileText(fileName);
    if (!text) return '';
    if (fileName.toLowerCase().endsWith('.md')) return nowIso();
    const parsed = JSON.parse(text);
    return normalizeText(parsed.savedAt) || '';
  } catch (error) {
    return '';
  }
}

async function connectFolderHandle(handle, options = {}) {
  const { initialDoc = null, showSuccessToast = true } = options;
  if (!handle) return false;
  const permitted = await verifyPermission(handle, true);
  if (!permitted) {
    showToast('Read and write permission was not granted for that folder.', 'error');
    return false;
  }

  app.folderHandle = handle;
  startupStoredFolderHandle = handle;
  app.folderName = handle.name || '';
  app.fileStats.folderLabel = handle.name || '';
  await storeFolderHandle(handle);

  if (initialDoc) {
    app.doc = ensureDocShape(initialDoc);
    await persistDocToFolder({ reason: 'import' });
    app.connectedFolderReady = true;
    app.ui.startupHasConnectedFolder = true;
    persistUiState();
    applyProjectedState();
    render();
    if (showSuccessToast) showToast(`Connected folder ${handle.name} and saved Team Pulse there.`, 'success');
    return true;
  }

  const loaded = await loadDocFromConnectedFolder({ createIfMissing: true, showSuccessToast });
  return loaded;
}

async function chooseFolderAndConnect(options = {}) {
  if (!supportsDirectoryAccess()) {
    showToast('Choosing a Team Pulse folder works best in Edge or Chrome.', 'error');
    return false;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    return connectFolderHandle(handle, options);
  } catch (error) {
    if (error && error.name === 'AbortError') return false;
    console.error('Failed to choose folder', error);
    showToast(error?.message || 'Could not connect that folder.', 'error');
    return false;
  }
}

async function loadDocFromConnectedFolder(options = {}) {
  const { createIfMissing = false, showSuccessToast = true } = options;
  if (!app.folderHandle) return false;

  const mainHandle = await getFileHandleFromFolder(app.folderHandle, MAIN_JSON_NAME, false);
  if (!mainHandle) {
    if (!createIfMissing) return false;
    app.doc = makeEmptyDoc();
    applyProjectedState();
    await persistDocToFolder({ reason: 'init' });
    app.connectedFolderReady = true;
    app.ui.startupHasConnectedFolder = true;
    persistUiState();
    render();
    if (showSuccessToast) showToast(`Created ${MAIN_JSON_NAME} in ${app.folderHandle.name}.`, 'success');
    return true;
  }

  let text = '';
  try {
    text = await readTextFromHandle(mainHandle);
  } catch (error) {
    console.error('Failed to read main Team Pulse JSON', error);
    showToast('Could not read team-pulse.json from that folder.', 'error');
    return false;
  }

  if (!text.trim()) {
    app.doc = makeEmptyDoc();
    applyProjectedState();
    await persistDocToFolder({ reason: 'init' });
    app.connectedFolderReady = true;
    app.ui.startupHasConnectedFolder = true;
    persistUiState();
    render();
    if (showSuccessToast) showToast(`Created a new ${MAIN_JSON_NAME} in ${app.folderHandle.name}.`, 'success');
    return true;
  }

  // Only reading the file belongs in this try. Once the file has parsed, a
  // failure to save or draw must never offer to replace it with the backup.
  let parsed = null;
  let loadedDoc = null;
  try {
    parsed = parsePortableJsonText(text);
    loadedDoc = ensureDocShape(parsed.doc);
  } catch (error) {
    console.error('Failed to parse main Team Pulse JSON', error);
    const recovered = await maybeRecoverFromBackup(error);
    if (recovered) return true;
    showToast(error?.message || 'That Team Pulse JSON could not be loaded.', 'error');
    return false;
  }

  app.loadedSchemaVersion = parsed.migratedFromVersion || CURRENT_SCHEMA_VERSION;
  app.lastMigrationApplied = parsed.lastMigrationApplied || '';
  app.knownMainSavedAt = readSavedAtFromJsonText(text);
  app.saveConflict = false;
  await adoptLoadedDoc(loadedDoc, { saveReason: parsed.lastMigrationApplied ? 'migration' : '' });
  if (showSuccessToast) {
    showToast(parsed.lastMigrationApplied
      ? `Loaded and upgraded ${MAIN_JSON_NAME} to schema v${CURRENT_SCHEMA_VERSION}.`
      : `Loaded ${MAIN_JSON_NAME} from ${app.folderHandle.name}.`, 'success');
  }
  return true;
}

// Puts a document that was read from the folder on screen. Saving and drawing
// each get their own error handling, so a bug in either one shows an error
// but keeps the loaded data and the connection.
async function adoptLoadedDoc(doc, options = {}) {
  const { saveReason = '' } = options;
  app.doc = doc;
  app.connectedFolderReady = true;
  app.ui.startupHasConnectedFolder = true;
  persistUiState();
  let drawError = null;
  try {
    applyProjectedState();
  } catch (error) {
    drawError = error;
  }
  if (saveReason) {
    try {
      await persistDocToFolder({ reason: saveReason });
      app.lastSaveError = '';
    } catch (error) {
      console.error('Save after load failed', error);
      app.lastSaveError = error?.message || 'Could not save Team Pulse.';
      app.saveQueued = true;
      if (!error?.saveConflict) {
        showToast(app.lastSaveError, 'error');
        saveFailuresInRow += 1;
        scheduleSaveRetry();
      }
    }
  } else {
    app.lastSaveAt = app.doc.savedAt;
    try {
      await refreshFileStats();
    } catch (error) {
      console.error('Failed to read backup file dates', error);
    }
  }
  if (!drawError) {
    try {
      render();
    } catch (error) {
      drawError = error;
    }
  }
  updateFileUi();
  if (drawError) {
    console.error('Failed to show the loaded Team Pulse data', drawError);
    showToast('Your data loaded, but this screen could not be shown. Try reloading the page.', 'error');
  }
}

async function maybeRecoverFromBackup(parseError) {
  let parsed = null;
  let recoveredDoc = null;
  try {
    const backupText = await readFolderFileText(BACKUP_JSON_NAME);
    if (!backupText.trim()) return false;
    parsed = parsePortableJsonText(backupText);
    recoveredDoc = ensureDocShape(parsed.doc);
  } catch (error) {
    console.error('Backup restore failed', parseError, error);
    return false;
  }
  const shouldRestore = window.confirm(`team-pulse.json could not be loaded. Restore ${BACKUP_JSON_NAME} instead? A dated copy of the unreadable file is kept.`);
  if (!shouldRestore) return false;
  app.loadedSchemaVersion = parsed.migratedFromVersion || CURRENT_SCHEMA_VERSION;
  app.lastMigrationApplied = parsed.lastMigrationApplied || 'backup-restore';
  await adoptLoadedDoc(recoveredDoc, { saveReason: 'recover' });
  if (!app.lastSaveError) {
    showToast(`Restored ${BACKUP_JSON_NAME} into ${MAIN_JSON_NAME}.${safetyCopyNote()}`, 'success');
  }
  return true;
}

async function restoreLatestBackup() {
  if (!app.folderHandle) {
    showToast('Choose a Team Pulse folder first.', 'error');
    return false;
  }
  try {
    const backupText = await readFolderFileText(BACKUP_JSON_NAME);
    if (!backupText.trim()) {
      showToast('No latest backup file exists yet.', 'warning');
      return false;
    }
    const parsed = parsePortableJsonText(backupText);
    if (!window.confirm(`Restore ${BACKUP_JSON_NAME} into ${MAIN_JSON_NAME}? This replaces the current main file. A dated copy of it is saved first.`)) {
      return false;
    }
    app.doc = ensureDocShape(parsed.doc);
    applyProjectedState();
    await persistDocToFolder({ reason: 'restore' });
    render();
    showToast(`Restored ${BACKUP_JSON_NAME} into ${MAIN_JSON_NAME}.${safetyCopyNote()}`, 'success');
    return true;
  } catch (error) {
    console.error('Failed to restore backup', error);
    showToast(error?.message || 'Could not restore the latest backup.', 'error');
    return false;
  }
}

function scheduleAutosave() {
  if (!app.folderHandle || !app.connectedFolderReady) return;
  app.saveQueued = true;
  updateFileUi();
  window.clearTimeout(app.saveTimer);
  app.saveTimer = window.setTimeout(() => {
    flushAutosaveQueue();
  }, AUTOSAVE_DEBOUNCE_MS);
}

// After a failed save Team Pulse tries again by itself: after 5 seconds, then
// every 30 seconds until a save works. Only the first failure in a row shows a
// message (a Save now click always does), so a lasting problem such as a
// removed drive does not fill the screen with messages.
const SAVE_RETRY_DELAYS_MS = [5000, 30000];
let saveFailuresInRow = 0;
let saveRetryTimer = null;

function scheduleSaveRetry() {
  window.clearTimeout(saveRetryTimer);
  const delay = SAVE_RETRY_DELAYS_MS[Math.min(saveFailuresInRow, SAVE_RETRY_DELAYS_MS.length) - 1] || SAVE_RETRY_DELAYS_MS[0];
  saveRetryTimer = window.setTimeout(() => {
    saveRetryTimer = null;
    flushAutosaveQueue();
  }, delay);
}

async function flushAutosaveQueue(force = false) {
  if (!app.folderHandle || !app.connectedFolderReady) return false;
  if (!app.saveQueued && !force) return true;
  if (app.saveInFlight) {
    app.saveQueued = true;
    if (!force) return true;
    // Save now (or the final save before Disconnect) during a running save:
    // wait for it, then save again as a manual save and report that result.
    while (app.saveInFlight) await new Promise((resolve) => window.setTimeout(resolve, 50));
    return flushAutosaveQueue(true);
  }
  window.clearTimeout(saveRetryTimer);
  saveRetryTimer = null;
  app.saveInFlight = true;
  // Capture-and-clear: clear the queued flag NOW so that mutations during the
  // in-flight write correctly re-raise it and trigger a follow-up flush in the
  // finally block. Without this, a mutation that arrives while a save is
  // in-flight can be lost if no further mutation arrives to restart the debounce.
  app.saveQueued = false;
  updateFileUi();
  let succeeded = false;
  let conflict = false;
  try {
    await persistDocToFolder({ reason: force ? 'manual' : 'autosave' });
    app.lastSaveError = '';
    saveFailuresInRow = 0;
    updateFileUi();
    succeeded = true;
    return true;
  } catch (error) {
    conflict = !!error?.saveConflict;
    app.lastSaveError = error?.message || 'Could not save Team Pulse.';
    app.saveQueued = true;
    updateFileUi();
    // A conflict already shows its own question.
    if (!conflict && (force || saveFailuresInRow === 0)) showToast(app.lastSaveError, 'error');
    if (!conflict) saveFailuresInRow += 1;
    return false;
  } finally {
    app.saveInFlight = false;
    updateFileUi();
    // Drain: if a mutation arrived during a successful in-flight write, kick
    // off the next save now rather than waiting for another mutation to do it.
    // After a failure, try again later by itself. A conflict waits for the
    // person's choice instead.
    if (succeeded && app.saveQueued) {
      scheduleAutosave();
    } else if (!succeeded && !conflict) {
      scheduleSaveRetry();
    }
  }
}

function buildDocForSave() {
  const doc = ensureDocShape(app.doc || makeEmptyDoc());
  doc.schemaVersion = CURRENT_SCHEMA_VERSION;
  doc.appVersion = APP_VERSION;
  doc.savedAt = nowIso();
  return syncIdCounters(doc);
}

function readSavedAtFromJsonText(text) {
  try {
    const parsed = JSON.parse(text);
    return normalizeText(parsed.savedAt) || '';
  } catch (error) {
    return '';
  }
}

// Saves that replace team-pulse.json with different data first keep a dated
// copy of the file they replace, named after what happened.
const SAFETY_COPY_KIND_BY_REASON = { import: 'import', restore: 'restore', recover: 'restore', overwrite: 'overwrite' };
// These saves replace the file on purpose, so they skip the check for a
// change made by another tab or computer.
const REPLACING_SAVE_REASONS = ['import', 'restore', 'recover', 'overwrite'];
const SAVE_CONFLICT_MESSAGE = `${MAIN_JSON_NAME} was changed from another tab or computer. Choose which version to keep.`;

function makeSaveConflictError() {
  const error = new Error(SAVE_CONFLICT_MESSAGE);
  error.saveConflict = true;
  return error;
}

function safetyCopyStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// Writes text to team-pulse.before-<kind>-<date and time>.json and returns the
// file name. Never overwrites an earlier copy.
async function writeSafetyCopy(kind, text) {
  if (!text || !text.trim()) return '';
  const base = `team-pulse.before-${kind}-${safetyCopyStamp()}`;
  let name = `${base}.json`;
  for (let n = 2; await getFileHandleFromFolder(app.folderHandle, name, false); n += 1) {
    name = `${base}-${n}.json`;
  }
  await writeFolderFileText(name, text);
  return name;
}

function safetyCopyNote() {
  return app.lastSafetyCopyName ? ` The previous data was saved as ${app.lastSafetyCopyName}.` : '';
}

// How many saves are running. The change check skips while one is, since a
// save writes the file before it records the new savedAt.
let persistsRunning = 0;

async function persistDocToFolder(options = {}) {
  persistsRunning += 1;
  try {
    await writeDocToFolder(options);
  } finally {
    persistsRunning -= 1;
  }
}

async function writeDocToFolder(options = {}) {
  const { reason = 'autosave' } = options;
  if (!app.folderHandle) throw new Error('Choose a Team Pulse folder first.');
  const replacing = REPLACING_SAVE_REASONS.includes(reason);
  if (app.saveConflict && !replacing) {
    openSaveConflictPrompt();
    throw makeSaveConflictError();
  }
  const doc = buildDocForSave();
  app.doc = doc;
  applyProjectedState();

  const previousMainText = await readFolderFileText(MAIN_JSON_NAME);
  const previousSavedAt = readSavedAtFromJsonText(previousMainText);
  // Another tab or computer saved since this tab last read or wrote the file:
  // stop and ask, never overwrite its work silently.
  if (!replacing && previousMainText.trim() && previousSavedAt !== app.knownMainSavedAt) {
    app.saveConflict = true;
    openSaveConflictPrompt();
    throw makeSaveConflictError();
  }
  const newText = JSON.stringify(doc, null, 2);
  const schemaText = generateSchemaMarkdown();

  const safetyKind = SAFETY_COPY_KIND_BY_REASON[reason];
  app.lastSafetyCopyName = safetyKind ? await writeSafetyCopy(safetyKind, previousMainText) : '';

  await writeFolderFileText(MAIN_JSON_NAME, newText);
  // Import and restore always move the replaced file into the backup. Other
  // saves do so at most once per BACKUP_ROTATE_MS, so the backup is a real
  // step back. A recovery keeps the backup it just restored from.
  const rotateBackup = previousMainText.trim() && reason !== 'recover'
    && (reason === 'import' || reason === 'restore' || !app.backupRotatedAt || Date.now() - app.backupRotatedAt >= BACKUP_ROTATE_MS);
  if (rotateBackup) {
    await writeFolderFileText(BACKUP_JSON_NAME, previousMainText);
    app.backupRotatedAt = Date.now();
    app.fileStats.backupSavedAt = previousSavedAt;
  }

  const today = todayStamp();
  const thisMonth = monthStamp();
  const dailySavedAt = await parseSavedAtFromFolderFile(DAILY_JSON_NAME);
  const monthlySavedAt = await parseSavedAtFromFolderFile(MONTHLY_JSON_NAME);
  if (!dailySavedAt || isoToLocalDateStamp(dailySavedAt) !== today) {
    await writeFolderFileText(DAILY_JSON_NAME, newText);
  }
  if (!monthlySavedAt || monthStamp(monthlySavedAt) !== thisMonth) {
    await writeFolderFileText(MONTHLY_JSON_NAME, newText);
  }
  await writeFolderFileText(SCHEMA_DOC_NAME, schemaText);

  app.lastSaveAt = doc.savedAt;
  app.knownMainSavedAt = doc.savedAt;
  app.lastSaveReason = reason;
  app.fileStats.mainSavedAt = doc.savedAt;
  app.fileStats.schemaWrittenAt = doc.savedAt;
  await refreshFileStats();
  if (reason === 'manual') {
    showToast(`Saved ${MAIN_JSON_NAME} at ${formatClock(new Date(doc.savedAt))}.`, 'success');
  }
}

async function refreshFileStats() {
  app.fileStats.mainSavedAt = await parseSavedAtFromFolderFile(MAIN_JSON_NAME);
  app.fileStats.backupSavedAt = await parseSavedAtFromFolderFile(BACKUP_JSON_NAME);
  app.fileStats.dailySavedAt = await parseSavedAtFromFolderFile(DAILY_JSON_NAME);
  app.fileStats.monthlySavedAt = await parseSavedAtFromFolderFile(MONTHLY_JSON_NAME);
  app.fileStats.schemaWrittenAt = app.fileStats.mainSavedAt || app.lastSaveAt || '';
  app.fileStats.folderLabel = app.folderName || app.folderHandle?.name || '';
}

// --- Save conflict: another tab or computer saved team-pulse.json -----------

function saveConflictOverlayEl() {
  return document.getElementById('saveConflictOverlay');
}

function isSaveConflictPromptOpen() {
  return !!saveConflictOverlayEl()?.classList.contains('open');
}

function openSaveConflictPrompt() {
  const overlayEl = saveConflictOverlayEl();
  if (!overlayEl) return;
  app.lastSaveError = SAVE_CONFLICT_MESSAGE;
  updateFileUi();
  if (overlayEl.classList.contains('open')) return;
  overlayEl.classList.add('open');
  overlayEl.setAttribute('aria-hidden', 'false');
  syncBodyOverlayLock();
  window.setTimeout(() => document.getElementById('saveConflictReloadBtn')?.focus(), 0);
}

function closeSaveConflictPrompt() {
  const overlayEl = saveConflictOverlayEl();
  if (!overlayEl) return;
  overlayEl.classList.remove('open');
  overlayEl.setAttribute('aria-hidden', 'true');
  syncBodyOverlayLock();
}

function setSaveConflictButtonsBusy(busy) {
  ['saveConflictReloadBtn', 'saveConflictKeepBtn'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.disabled = busy;
  });
}

// Reads only the savedAt of team-pulse.json and asks the conflict question if
// another tab or computer saved since this tab last read or wrote it.
async function checkMainFileUnchanged() {
  if (!app.folderHandle || !app.connectedFolderReady || app.saveConflict || app.saveInFlight || persistsRunning) return;
  try {
    const text = await readFolderFileText(MAIN_JSON_NAME);
    if (app.saveInFlight || app.saveConflict || persistsRunning || !text.trim()) return;
    if (readSavedAtFromJsonText(text) !== app.knownMainSavedAt) {
      app.saveConflict = true;
      openSaveConflictPrompt();
    }
  } catch (error) {
    console.error('Could not check team-pulse.json for changes', error);
  }
}

// choice 'reload': this tab's version goes to a dated copy, then the file is
// loaded again. choice 'keep': the file goes to a dated copy, then this tab's
// version is saved over it. Either way nothing is lost.
async function resolveSaveConflict(choice) {
  if (!app.saveConflict || !app.folderHandle) {
    closeSaveConflictPrompt();
    return;
  }
  setSaveConflictButtonsBusy(true);
  window.clearTimeout(app.saveTimer);
  try {
    // Let a save that is still running finish first. It stops at the conflict.
    while (app.saveInFlight) await new Promise((resolve) => window.setTimeout(resolve, 50));
    if (choice === 'reload') {
      const copyName = await writeSafetyCopy('reload', JSON.stringify(buildDocForSave(), null, 2));
      app.saveConflict = false;
      app.saveQueued = false;
      app.lastSaveError = '';
      closeSaveConflictPrompt();
      const loaded = await loadDocFromConnectedFolder({ showSuccessToast: false });
      if (loaded) showToast(`Reloaded ${MAIN_JSON_NAME}. This tab's version was saved as ${copyName}.`, 'success');
    } else {
      app.saveInFlight = true;
      updateFileUi();
      try {
        await persistDocToFolder({ reason: 'overwrite' });
      } finally {
        app.saveInFlight = false;
      }
      app.saveConflict = false;
      app.saveQueued = false;
      app.lastSaveError = '';
      saveFailuresInRow = 0;
      closeSaveConflictPrompt();
      updateFileUi();
      showToast(`Saved this tab's version to ${MAIN_JSON_NAME}.${safetyCopyNote()}`, 'success');
    }
  } catch (error) {
    console.error('Could not settle the save conflict', error);
    showToast(error?.message || 'Could not save Team Pulse.', 'error');
    updateFileUi();
  } finally {
    setSaveConflictButtonsBusy(false);
  }
}
