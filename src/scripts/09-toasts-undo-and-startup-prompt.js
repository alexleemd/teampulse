function showToast(message, kind = '', options = {}) {
  const toast = document.createElement('div');
  toast.className = `toast ${kind}`.trim();
  const messageEl = document.createElement('div');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;
  toast.appendChild(messageEl);
  if (options.actionLabel && typeof options.onAction === 'function') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = options.actionLabel;
    button.addEventListener('click', () => {
      options.onAction();
      toast.remove();
    });
    toast.appendChild(button);
  }
  toastStackEl.appendChild(toast);
  window.setTimeout(() => toast.remove(), options.duration || TOAST_TIMEOUT_MS);
}

function clearLastDestructiveAction() {
  app.lastDestructiveAction = null;
}

function undoLastDestructiveAction() {
  const action = app.lastDestructiveAction;
  if (!action) return false;
  if (action.kind === 'deleteReport' || action.kind === 'deleteMeeting') {
    app.doc.events = (app.doc.events || []).filter((event) => event.id !== action.eventId);
    clearLastDestructiveAction();
    applyProjectedState();
    render();
    scheduleAutosave();
    showToast(action.undoMessage, 'success');
    return true;
  }
  return false;
}

function syncBodyOverlayLock() {
  const goalModalEl = document.getElementById('goalModal');
  const feedbackModalEl = document.getElementById('feedbackModal');
  const locked = startupPromptOverlayEl.classList.contains('open')
    || meetingModalEl.classList.contains('open')
    || rulesDrawerOverlayEl.classList.contains('open')
    || globalSearchEl.classList.contains('open')
    || !!goalModalEl?.classList.contains('open')
    || !!feedbackModalEl?.classList.contains('open');
  document.body.classList.toggle('overlay-open', locked);
}

function updateStartupPrompt() {
  const hasSavedFolder = !!startupStoredFolderHandle;
  if (startupPromptTitleEl) startupPromptTitleEl.textContent = hasSavedFolder ? 'Choose where Team Pulse should write this session' : 'Choose a Team Pulse folder';
  if (startupPromptCopyEl) startupPromptCopyEl.textContent = hasSavedFolder
    ? 'Use the saved Team Pulse folder or choose a different one before you start.'
    : 'Pick the folder Team Pulse should write to before you start.';
  if (startupSavedFolderCardEl) startupSavedFolderCardEl.classList.toggle('hidden', !hasSavedFolder);
  if (startupSavedFolderLabelEl) startupSavedFolderLabelEl.textContent = hasSavedFolder ? (startupStoredFolderHandle.name || 'Saved Team Pulse folder') : '';
  if (startupUseSavedFolderBtn) {
    startupUseSavedFolderBtn.classList.toggle('hidden', !hasSavedFolder);
    startupUseSavedFolderBtn.disabled = !hasSavedFolder;
  }
  if (startupChooseFolderBtn) startupChooseFolderBtn.disabled = !supportsDirectoryAccess();
  if (startupImportJsonBtn) startupImportJsonBtn.disabled = !supportsJsonOpen();
}

function openStartupPrompt() {
  if (!startupPromptOverlayEl) return;
  updateStartupPrompt();
  startupPromptOverlayEl.classList.add('open');
  startupPromptOverlayEl.setAttribute('aria-hidden', 'false');
  syncBodyOverlayLock();
  window.setTimeout(() => {
    const preferredTarget = startupUseSavedFolderBtn && !startupUseSavedFolderBtn.classList.contains('hidden') && !startupUseSavedFolderBtn.disabled
      ? startupUseSavedFolderBtn
      : startupChooseFolderBtn && !startupChooseFolderBtn.disabled
        ? startupChooseFolderBtn
        : startupImportJsonBtn;
    preferredTarget?.focus();
  }, 0);
}

function closeStartupPrompt() {
  if (!startupPromptOverlayEl) return;
  startupPromptOverlayEl.classList.remove('open');
  startupPromptOverlayEl.setAttribute('aria-hidden', 'true');
  syncBodyOverlayLock();
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(HANDLE_STORE)) {
        request.result.createObjectStore(HANDLE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open IndexedDB.'));
  });
}

async function storeFolderHandle(handle) {
  const db = await openHandleDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, FOLDER_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not store folder handle.'));
    tx.onabort = () => reject(tx.error || new Error('Could not store folder handle.'));
  });
  db.close();
}

async function getStoredFolderHandle() {
  const db = await openHandleDb();
  const handle = await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const request = tx.objectStore(HANDLE_STORE).get(FOLDER_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Could not read stored folder handle.'));
  });
  db.close();
  return handle;
}

async function clearStoredFolderHandle() {
  const db = await openHandleDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).delete(FOLDER_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not clear stored folder handle.'));
    tx.onabort = () => reject(tx.error || new Error('Could not clear stored folder handle.'));
  });
  db.close();
}

// Privacy control: forget the folder connection and remove every copy of the
// data this browser holds (cached document, remembered folder handle, view
// state). The JSON file and backups in the folder are not touched.
async function disconnectAndWipeLocal() {
  const unsaved = app.saveQueued || app.saveInFlight || hasUnsavedWorkspaceChanges();
  const message = unsaved
    ? 'There are unsaved changes. Team Pulse will try to save to the folder first, then disconnect and clear all copies from this browser. Continue?'
    : 'Disconnect the folder and clear all Team Pulse data from this browser? The JSON file and backups stay in the folder.';
  if (!window.confirm(message)) return;
  if (app.folderHandle && app.connectedFolderReady) {
    try { await flushAutosaveQueue(true); } catch (error) { console.error('Final save before disconnect failed', error); }
  }
  if (typeof indexedDB !== 'undefined') {
    try { await clearStoredFolderHandle(); } catch (error) { console.error('Failed to clear stored folder handle', error); }
  }
  try {
    localStorage.removeItem(CACHED_DOC_KEY);
    localStorage.removeItem(UI_STATE_KEY);
  } catch (error) { console.error('Failed to clear browser storage', error); }
  if (app.saveTimer) { window.clearTimeout(app.saveTimer); app.saveTimer = null; }
  app.doc = null;
  app.folderHandle = null;
  app.connectedFolderReady = false;
  app.folderName = '';
  app.lastSaveAt = '';
  app.lastSaveError = '';
  app.saveQueued = false;
  app.fileStats = { mainSavedAt: '', backupSavedAt: '', dailySavedAt: '', monthlySavedAt: '', schemaWrittenAt: '', folderLabel: '' };
  app.projections = { reports: [], reportMap: new Map(), metrics: new Map() };
  app.ui = { ...DEFAULT_UI };
  startupStoredFolderHandle = null;
  clearWorkspaceDraft();
  closeRulesDrawer();
  updateFileUi();
  updateStartupPrompt();
  render();
  showToast('Folder disconnected. All browser copies cleared.', 'success');
}

