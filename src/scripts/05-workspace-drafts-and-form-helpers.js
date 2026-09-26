function workspaceDraftKeyFor(isCreating = app.ui.creatingReport, reportId = app.ui.selectedId) {
  if (isCreating) return 'create:new';
  const id = normalizeText(reportId);
  return id ? `person:${id}` : '';
}

function comparableWorkspacePayload(source = {}) {
  return {
    name: normalizeText(source.name),
    level: normalizeLevel(source.level),
    mentors: normalizeText(source.mentors),
    hireDate: normalizeDate(source.hireDate),
    lastPromotionDate: normalizeDate(source.lastPromotionDate),
    nextOneOnOneDate: normalizeDate(source.nextOneOnOneDate),
    nextPdcDate: normalizeDate(source.nextPdcDate),
    supportLevel: normalizeSupportLevel(source.supportLevel),
    // Persisted reports carry the derived status in pdcStatus and the stored
    // value in rawPdcStatus; compare against the stored value so the dirty
    // check does not misfire when the derivation differs from the selection.
    pdcStatus: normalizePdcStatus(source.rawPdcStatus !== undefined ? source.rawPdcStatus : source.pdcStatus),
    developmentGoalSummary: normalizeText(source.developmentGoalSummary),
    promotionReadiness: normalizeText(source.promotionReadiness),
    agenda: normalizeText(source.agenda),
    notes: normalizeText(source.notes),
    talkingPoints: normalizeTalkingPoints(source.talkingPoints),
    goals: normalizeGoals(source.goals),
    cadenceOverrides: normalizeCadenceOverrides(source.cadenceOverrides),
    vacations: normalizeVacationEntries(source.vacations),
    evidence: normalizeEvidenceEntries(source.evidence),
    customFields: Array.isArray(source.customFields) ? source.customFields.map((field) => normalizeCustomField(field, normalizeText(field?.id))) : []
  };
}

function workspaceDraftBaseline(isCreating = app.ui.creatingReport, report = null) {
  return comparableWorkspacePayload(isCreating ? makeDraftReport() : (report || {}));
}

function workspaceDraftEquals(a, b) {
  return JSON.stringify(comparableWorkspacePayload(a)) === JSON.stringify(comparableWorkspacePayload(b));
}

function clearWorkspaceDraft() {
  app.workspaceDraft = { key: '', payload: null, dirty: false };
}

function getWorkspaceDraft(draftKey = workspaceDraftKeyFor()) {
  if (!draftKey || app.workspaceDraft.key !== draftKey || !app.workspaceDraft.payload) return null;
  return deepCopy(app.workspaceDraft.payload);
}

function storeWorkspaceDraft(payload, isCreating = app.ui.creatingReport, report = null) {
  const draftKey = workspaceDraftKeyFor(isCreating, isCreating ? '' : report?.id || app.ui.selectedId);
  if (!draftKey) {
    clearWorkspaceDraft();
    return false;
  }
  const safePayload = comparableWorkspacePayload(payload);
  const dirty = !workspaceDraftEquals(safePayload, workspaceDraftBaseline(isCreating, report));
  app.workspaceDraft = { key: draftKey, payload: safePayload, dirty };
  return dirty;
}

function captureWorkspaceDraftFromDom(formEl = document.getElementById('detailEditorForm')) {
  if (!formEl) return false;
  const isCreating = !!app.ui.creatingReport;
  const report = isCreating ? null : getReportById(app.ui.selectedId);
  if (!isCreating && !report) return false;
  const payload = buildReportPayloadFromForm(new FormData(formEl), report);
  return storeWorkspaceDraft(payload, isCreating, report);
}

function bindWorkspaceDraftListeners(formEl) {
  if (!formEl) return;
  const syncDraft = () => captureWorkspaceDraftFromDom(formEl);
  formEl.addEventListener('input', syncDraft);
  formEl.addEventListener('change', syncDraft);
}

function hasUnsavedWorkspaceChanges() {
  captureWorkspaceDraftFromDom();
  const draftKey = workspaceDraftKeyFor();
  return !!(draftKey && app.workspaceDraft.key === draftKey && app.workspaceDraft.dirty);
}

function confirmWorkspaceClose() {
  if (!hasUnsavedWorkspaceChanges()) return true;
  return window.confirm('There are unsaved changes. Are you sure you want to close without saving?');
}

function populateSelect(el, values, includeBlank = false, blankLabel = 'All') {
  const current = el.value;
  el.replaceChildren();
  if (includeBlank) {
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = blankLabel;
    el.appendChild(blank);
  }
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    el.appendChild(option);
  });
  if (current) el.value = current;
}

function parsePositiveInteger(label, value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${label} must be at least 1.`);
  return parsed;
}

function safePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

