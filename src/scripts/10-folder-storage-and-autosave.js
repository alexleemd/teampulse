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
    cacheDocSnapshot();
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
      showToast(app.lastSaveError, 'error');
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

async function flushAutosaveQueue(force = false) {
  if (!app.folderHandle || !app.connectedFolderReady) return false;
  if (!app.saveQueued && !force) return true;
  if (app.saveInFlight) {
    app.saveQueued = true;
    return true;
  }
  app.saveInFlight = true;
  // Capture-and-clear: clear the queued flag NOW so that mutations during the
  // in-flight write correctly re-raise it and trigger a follow-up flush in the
  // finally block. Without this, a mutation that arrives while a save is
  // in-flight can be lost if no further mutation arrives to restart the debounce.
  app.saveQueued = false;
  updateFileUi();
  let succeeded = false;
  try {
    await persistDocToFolder({ reason: force ? 'manual' : 'autosave' });
    app.lastSaveError = '';
    updateFileUi();
    succeeded = true;
    return true;
  } catch (error) {
    app.lastSaveError = error?.message || 'Could not save Team Pulse.';
    app.saveQueued = true;
    updateFileUi();
    showToast(app.lastSaveError, 'error');
    return false;
  } finally {
    app.saveInFlight = false;
    updateFileUi();
    // Drain: if a mutation arrived during a successful in-flight write, kick
    // off the next save now rather than waiting for another mutation to do it.
    // Only drain on success — on error, leave the retry to the next user
    // mutation to avoid a persistent-error toast loop.
    if (succeeded && app.saveQueued) {
      scheduleAutosave();
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
const SAFETY_COPY_KIND_BY_REASON = { import: 'import', restore: 'restore', recover: 'restore' };

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

async function persistDocToFolder(options = {}) {
  const { reason = 'autosave' } = options;
  if (!app.folderHandle) throw new Error('Choose a Team Pulse folder first.');
  const doc = buildDocForSave();
  app.doc = doc;
  applyProjectedState();

  const previousMainText = await readFolderFileText(MAIN_JSON_NAME);
  const previousSavedAt = readSavedAtFromJsonText(previousMainText);
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
  app.lastSaveReason = reason;
  app.fileStats.mainSavedAt = doc.savedAt;
  app.fileStats.schemaWrittenAt = doc.savedAt;
  cacheDocSnapshot();
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
