function unescapeIcsText(value) {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseIcsDate(value) {
  const text = normalizeText(value);
  if (!text) return '';
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  if (/^\d{8}T\d{6}Z?$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  return '';
}

function parseIcsDurationMinutes(start, end) {
  const startText = normalizeText(start);
  const endText = normalizeText(end);
  if (!startText || !endText) return null;
  const startDate = new Date(startText.replace(/^([0-9]{8})T([0-9]{6})Z?$/, '$1T$2Z'));
  const endDate = new Date(endText.replace(/^([0-9]{8})T([0-9]{6})Z?$/, '$1T$2Z'));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const diff = Math.round((endDate - startDate) / 60000);
  return diff > 0 ? diff : null;
}

function parseIcsEvents(text) {
  const unfolded = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').replace(/\r/g, '\n');
  const chunks = unfolded.split('BEGIN:VEVENT').slice(1);
  return chunks.map((chunk) => {
    const body = chunk.split('END:VEVENT')[0] || '';
    const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
    const data = { raw: body };
    lines.forEach((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).split(';')[0].toUpperCase();
      const value = line.slice(idx + 1);
      if (!data[key]) data[key] = [];
      data[key].push(value);
    });
    return {
      uid: normalizeText(data.UID?.[0]),
      summary: unescapeIcsText(data.SUMMARY?.[0] || ''),
      description: unescapeIcsText(data.DESCRIPTION?.[0] || data['X-ALT-DESC']?.[0] || ''),
      startDate: parseIcsDate(data.DTSTART?.[0] || ''),
      durationMinutes: parseIcsDurationMinutes(data.DTSTART?.[0] || '', data.DTEND?.[0] || ''),
      rawText: unescapeIcsText(body)
    };
  }).filter((event) => event.summary || event.description || event.startDate || event.uid);
}

function detectIcsMeetingType(event) {
  const haystack = `${event.summary} ${event.description} ${event.rawText}`.toLowerCase();
  if (/\b(pdc|personal development conversation|development conversation)\b/.test(haystack)) return 'PDC';
  if (/\bcv review\b/.test(haystack)) return 'CV review';
  if (/\b1[:\- ]?1\b|\bone on one\b/.test(haystack)) return '1:1';
  return '1:1';
}

function scoreReportNameInText(report, normalizedText) {
  const normalizedName = normalizeSearchText(report.name);
  if (!normalizedName || !normalizedText) return 0;
  let score = 0;
  if (normalizedText.includes(normalizedName)) score += 200;
  const tokens = normalizedName.split(' ').filter(Boolean);
  let matchedTokens = 0;
  tokens.forEach((token) => {
    if (token.length > 1 && normalizedText.includes(token)) matchedTokens += 1;
  });
  score += matchedTokens * 20;
  if (tokens.length && matchedTokens === tokens.length) score += 40;
  return score;
}

function normalizeSearchText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolveIcsTargetReport(event, preferredReportId = null) {
  if (preferredReportId) return getReportById(preferredReportId);
  const reports = getReports();
  if (reports.length === 1) return reports[0];
  const normalizedText = normalizeSearchText(`${event.summary} ${event.description} ${event.rawText}`);
  const ranked = reports
    .map((report) => ({ report, score: scoreReportNameInText(report, normalizedText) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  if (ranked.length === 1) return ranked[0].report;
  if (ranked[0].score >= ranked[1].score + 40) return ranked[0].report;
  return null;
}

function beginIcsImport(preferredReportId = null, statusElementId = '', options = {}) {
  if (!ensureConnectedOrToast()) return;
  pendingIcsImportContext = { preferredReportId, statusElementId, closeMeetingModalOnSuccess: !!options.closeMeetingModalOnSuccess };
  icsFileInputEl.value = '';
  icsFileInputEl.click();
}

async function importIcsFiles(files, preferredReportId = null, statusElementId = '', options = {}) {
  if (!getReports().length) {
    showToast('Add a direct report before importing calendar files.', 'warning');
    return;
  }
  let importedCount = 0;
  let skippedCount = 0;
  let unmatchedCount = 0;
  let firstMatchedReportId = null;

  for (const file of files) {
    const text = await file.text();
    const events = parseIcsEvents(text);
    if (!events.length) {
      skippedCount += 1;
      continue;
    }
    for (const event of events) {
      const target = resolveIcsTargetReport(event, preferredReportId);
      if (!target) {
        unmatchedCount += 1;
        continue;
      }
      const meetingType = detectIcsMeetingType(event);
      const meetingDate = event.startDate || todayStamp();
      const notes = [event.summary, event.description].filter(Boolean).join('\n\n').trim();
      const currentTarget = getReportById(target.id);
      if (!currentTarget || meetingExistsForReport(currentTarget, meetingType, meetingDate, notes, event.uid)) {
        skippedCount += 1;
        continue;
      }
      appendEvent({
        id: nextId('event'),
        type: 'meeting_logged',
        personId: target.id,
        meetingId: nextId('meeting'),
        meetingType,
        meetingDate,
        durationMinutes: event.durationMinutes,
        notes,
        source: 'ics',
        externalUid: event.uid,
        createdAt: nowIso()
      });
      importedCount += 1;
      if (!firstMatchedReportId) firstMatchedReportId = target.id;
    }
  }

  if (importedCount > 0) {
    applyProjectedState();
    if (preferredReportId) {
      app.ui.selectedId = preferredReportId;
    } else if (firstMatchedReportId) {
      app.ui.selectedId = firstMatchedReportId;
    }
    render();
    scheduleAutosave();
  }

  const statusEl = statusElementId ? document.getElementById(statusElementId) : null;
  if (importedCount > 0 && options.closeMeetingModalOnSuccess && meetingModalEl.classList.contains('open')) {
    closeMeetingModal();
  }
  if (importedCount > 0) {
    const message = `Imported ${importedCount} meeting${importedCount === 1 ? '' : 's'} from .ics file${files.length === 1 ? '' : 's'}.`;
    showToast(message, 'success');
    setStatus(statusEl, message, 'success');
  } else if (unmatchedCount > 0) {
    const message = preferredReportId
      ? 'No new meetings were imported from that .ics file.'
      : 'No meetings were imported. Open a direct report first or use clearer meeting titles in the .ics file.';
    showToast(message, 'warning');
    setStatus(statusEl, message, 'error');
  } else {
    const message = skippedCount ? 'No new meetings were imported from that .ics file.' : 'No meetings were imported.';
    showToast(message, skippedCount ? 'warning' : 'error');
    setStatus(statusEl, message, skippedCount ? 'warning' : 'error');
  }
}

async function handleIcsFileSelection(event) {
  const files = [...(event.target.files || [])];
  if (!files.length) return;
  await importIcsFiles(files, pendingIcsImportContext.preferredReportId, pendingIcsImportContext.statusElementId, { closeMeetingModalOnSuccess: pendingIcsImportContext.closeMeetingModalOnSuccess });
  pendingIcsImportContext = { preferredReportId: null, statusElementId: '', closeMeetingModalOnSuccess: false };
}

async function importLegacyJsonFlow() {
  if (!supportsJsonOpen()) {
    showToast('Importing a JSON file works best in Edge or Chrome.', 'error');
    return false;
  }
  try {
    const handles = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'Team Pulse JSON', accept: { 'application/json': ['.json'] } }]
    });
    const handle = handles?.[0] || null;
    if (!handle) return false;
    const permitted = await verifyPermission(handle, false);
    if (!permitted) {
      showToast('Read permission was not granted for that JSON file.', 'error');
      return false;
    }
    const text = await readTextFromHandle(handle);
    const parsed = parsePortableJsonText(text);
    const shouldReplace = !app.doc || !getReports().length || window.confirm('Importing this JSON will replace the Team Pulse data currently on screen, and you will be asked to choose the folder where the imported data should be saved. Continue?');
    if (!shouldReplace) return false;
    if (app.folderHandle) {
      app.doc = ensureDocShape(parsed.doc);
      app.loadedSchemaVersion = parsed.migratedFromVersion || CURRENT_SCHEMA_VERSION;
      app.lastMigrationApplied = parsed.lastMigrationApplied || '';
      applyProjectedState();
      await persistDocToFolder({ reason: 'import' });
      render();
      showToast(`Imported and saved ${handle.name} into ${app.folderName || 'your Team Pulse folder'}.`, 'success');
      return true;
    }
    const connected = await chooseFolderAndConnect({ initialDoc: parsed.doc, showSuccessToast: false });
    if (connected) {
      app.loadedSchemaVersion = parsed.migratedFromVersion || CURRENT_SCHEMA_VERSION;
      app.lastMigrationApplied = parsed.lastMigrationApplied || '';
      render();
      showToast(`Imported ${handle.name} and saved it into ${app.folderName || 'your Team Pulse folder'}.`, 'success');
      return true;
    }
    return false;
  } catch (error) {
    if (error && error.name === 'AbortError') return false;
    console.error('Failed to import JSON', error);
    showToast(error?.message || 'Could not import that Team Pulse JSON file.', 'error');
    return false;
  }
}



function closeDataMenu() {
  dataMenuEl?.removeAttribute('open');
}

