// Toast status icons (Controls 3): check circle for success, triangle for
// warning, x circle for error, info circle for everything else. Built with DOM
// methods. The stroke is currentColor, so 11-overlays.css sets the status
// color per toast kind, and the message text always carries the meaning.
const TOAST_ICON_SHAPES = {
  success: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'm8 12.5 2.8 2.8L16.5 9.5' }]],
  warning: [['path', { d: 'M12 3.5 2.5 20h19L12 3.5z' }], ['path', { d: 'M12 10v4.5M12 17.5v.01' }]],
  error: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'm15 9-6 6M9 9l6 6' }]],
  info: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M12 11v5.5M12 7.5v.01' }]]
};

function toastIconKind(kind) {
  if (kind === 'danger') return 'error';
  return TOAST_ICON_SHAPES[kind] ? kind : 'info';
}

function createToastIcon(kind) {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'toast-icon');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  TOAST_ICON_SHAPES[toastIconKind(kind)].forEach(([tag, attrs]) => {
    const shape = document.createElementNS(svgNs, tag);
    Object.entries(attrs).forEach(([name, value]) => shape.setAttribute(name, value));
    svg.appendChild(shape);
  });
  return svg;
}

// Focus return for toasts and dialogs: the saved element if it is still on the
// page, otherwise its re-rendered copy, found by the same id or, for elements
// without an id, by a data-* attribute that only this element had.
function focusReturnRecord(el) {
  if (!el || el === document.body || typeof el.focus !== 'function') return null;
  const tag = el.tagName.toLowerCase();
  let selector = '';
  if (!el.id) {
    const unique = [...el.attributes]
      .filter((attr) => attr.name.startsWith('data-') && attr.value)
      .map((attr) => `${tag}[${attr.name}="${CSS.escape(attr.value)}"]`)
      .find((candidate) => document.querySelectorAll(candidate).length === 1);
    selector = unique || '';
  }
  return { el, id: el.id || '', selector };
}

function focusReturnTarget(record) {
  if (!record) return null;
  if (record.el.isConnected) return record.el;
  if (record.id) return document.getElementById(record.id);
  if (record.selector) return document.querySelector(record.selector);
  return null;
}

function restoreFocusTo(record) {
  const target = focusReturnTarget(record);
  if (target && !target.disabled && typeof target.focus === 'function') target.focus({ preventScroll: true });
}

// Where focus was before it moved into each toast with an action, so a
// keyboard Undo, or a dialog the action opens (27), can put focus back there.
const toastReturnFocus = new WeakMap();

// Toast placement: top right, 20px in (12px on narrow screens, from
// 11-overlays.css). When a row of controls already sits in that spot, the
// stack starts 12px under it, so a toast never hides the buttons it reports
// on: the header of the open dialog, search or Settings drawer, or with no
// layer open the backup banner, the workspace action row and the page header
// controls. Only rows at the very top count, so on a scrolled page the stack
// stays put.
const TOAST_LAYER_HEADERS = [
  '#globalSearch.open .gs-input-row',
  '#meetingModal.open .modal-header',
  '.overlay.open .modal-header',
  '#rulesDrawerOverlay.open .drawer-header'
];
const TOAST_PAGE_ROWS = [
  '#exportReminderMount .export-banner',
  '#detailDrawer:not([hidden]) .drawer-header-top > .actions',
  '#contentHeader .content-header-meta'
];

function placeToastStack() {
  if (!toastStackEl) return;
  toastStackEl.style.removeProperty('--toast-top');
  if (!toastStackEl.childElementCount) return;
  const stackRect = toastStackEl.getBoundingClientRect();
  const baseTop = stackRect.top;
  const bandBottom = baseTop + toastStackEl.firstElementChild.getBoundingClientRect().height;
  const layerHeaderEl = TOAST_LAYER_HEADERS.map((selector) => document.querySelector(selector)).find(Boolean);
  const rowEls = layerHeaderEl ? [layerHeaderEl] : TOAST_PAGE_ROWS.flatMap((selector) => [...document.querySelectorAll(selector)]);
  let top = baseTop;
  rowEls.forEach((rowEl) => {
    const rect = rowEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (rect.right <= stackRect.left || rect.left >= stackRect.right) return;
    if (rect.bottom <= baseTop || rect.top >= bandBottom) return;
    top = Math.max(top, Math.ceil(rect.bottom) + 12);
  });
  if (top > baseTop) toastStackEl.style.setProperty('--toast-top', `${top}px`);
}

function showToast(message, kind = '', options = {}) {
  const iconKind = toastIconKind(kind);
  const hasAction = !!options.actionLabel && typeof options.onAction === 'function';
  const toast = document.createElement('div');
  toast.className = `toast ${kind}`.trim();
  toast.setAttribute('data-toast-icon', iconKind);
  // Each toast is its own live region, as in Controls 3: errors are read out
  // at once, everything else when the screen reader is free.
  toast.setAttribute('role', iconKind === 'error' ? 'alert' : 'status');
  toast.appendChild(createToastIcon(kind));
  const messageEl = document.createElement('div');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;
  toast.appendChild(messageEl);
  const button = hasAction ? document.createElement('button') : null;
  if (button) {
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = options.actionLabel;
    toast.appendChild(button);
  }
  toastStackEl.appendChild(toast);
  placeToastStack();

  const duration = options.duration || TOAST_TIMEOUT_MS;
  let timer = window.setTimeout(() => toast.remove(), duration);
  // A toast without an action ignores the pointer (11-overlays.css), so it
  // never blocks the buttons under it and always leaves on time.
  if (!button) return;

  // Where focus was before it moved into the toast, so a keyboard Undo puts
  // focus back there (or on its re-rendered copy) instead of on the page body.
  // If the action opens a dialog instead, the dialog takes this record as its
  // opener (rememberDialogOpener in 27), since the toast button goes away.
  toast.addEventListener('focusin', (event) => {
    if (toastReturnFocus.has(toast)) return;
    const from = event.relatedTarget;
    if (!from || toast.contains(from)) return;
    // From another toast: share where that one came from.
    const fromToast = toastStackEl.contains(from) ? from.closest('.toast') : null;
    const record = fromToast ? toastReturnFocus.get(fromToast) : focusReturnRecord(from);
    if (record) toastReturnFocus.set(toast, record);
  });
  const dismiss = () => {
    window.clearTimeout(timer);
    if (toast.contains(document.activeElement)) restoreFocusTo(toastReturnFocus.get(toast));
    toast.remove();
  };
  button.addEventListener('click', () => {
    options.onAction();
    dismiss();
  });

  // A toast with an action stays while the pointer is on it or focus is
  // inside it (so Undo cannot vanish under the cursor), then gets its full
  // time again.
  const hold = () => { window.clearTimeout(timer); };
  const release = () => {
    if (!toast.isConnected || toast.matches(':hover') || toast.contains(document.activeElement)) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => toast.remove(), duration);
  };
  toast.addEventListener('mouseenter', hold);
  toast.addEventListener('focusin', hold);
  toast.addEventListener('mouseleave', release);
  toast.addEventListener('focusout', () => window.setTimeout(release, 0));
}

function clearLastDestructiveAction() {
  app.lastDestructiveAction = null;
}

// Each Undo toast is bound to its own action (undoDestructiveAction), so an
// older toast's Undo reverses what that toast reported and never a later
// delete. It removes the delete event only if it is still in the log, so an
// Undo after an import, restore or erasure changes nothing.
function undoDestructiveAction(action) {
  if (!action || !app.doc) return false;
  if (action.kind === 'deleteReport' || action.kind === 'deleteMeeting') {
    const events = app.doc.events || [];
    if (!events.some((event) => event.id === action.eventId)) return false;
    app.doc.events = events.filter((event) => event.id !== action.eventId);
    if (app.lastDestructiveAction === action) clearLastDestructiveAction();
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
    || !!document.getElementById('saveConflictOverlay')?.classList.contains('open')
    || meetingModalEl.classList.contains('open')
    || rulesDrawerOverlayEl.classList.contains('open')
    || globalSearchEl.classList.contains('open')
    || !!goalModalEl?.classList.contains('open')
    || !!feedbackModalEl?.classList.contains('open');
  document.body.classList.toggle('overlay-open', locked);
  // A layer opened or closed: move any toast on screen off its header. After
  // the caller's render, so the rows are measured where they end up.
  if (toastStackEl?.childElementCount) window.requestAnimationFrame(placeToastStack);
}

function updateStartupPrompt() {
  const hasSavedFolder = !!startupStoredFolderHandle;
  if (startupPromptTitleEl) startupPromptTitleEl.textContent = hasSavedFolder ? 'Choose where Team Pulse should write this session' : 'Choose a Team Pulse folder';
  if (startupPromptCopyEl) startupPromptCopyEl.textContent = hasSavedFolder
    ? 'Use the saved Team Pulse folder or choose a different one before you start.'
    : 'Pick the folder Team Pulse should write to before you start.';
  if (startupSavedFolderCardEl) startupSavedFolderCardEl.classList.toggle('hidden', !hasSavedFolder);
  if (startupSavedFolderLabelEl) startupSavedFolderLabelEl.textContent = hasSavedFolder ? (startupStoredFolderHandle.name || 'Saved Team Pulse folder') : '';
  // One primary per dialog, first in the row: "Use saved folder" when a saved
  // folder exists, otherwise "Choose Team Pulse folder".
  if (startupUseSavedFolderBtn) {
    startupUseSavedFolderBtn.classList.toggle('hidden', !hasSavedFolder);
    startupUseSavedFolderBtn.classList.toggle('primary', hasSavedFolder);
    startupUseSavedFolderBtn.classList.toggle('secondary', !hasSavedFolder);
    startupUseSavedFolderBtn.disabled = !hasSavedFolder;
  }
  if (startupChooseFolderBtn) {
    startupChooseFolderBtn.classList.toggle('secondary', hasSavedFolder);
    startupChooseFolderBtn.disabled = !supportsDirectoryAccess();
  }
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
// data this browser holds (remembered folder handle, view state, and the old
// document copy earlier versions kept). The JSON file and backups in the folder are not touched.
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
  app.saveConflict = false;
  app.knownMainSavedAt = '';
  app.backupRotatedAt = 0;
  closeSaveConflictPrompt();
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

