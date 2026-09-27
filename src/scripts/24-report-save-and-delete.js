// Full payload snapshot of a persisted report, in the shape updateReport
// expects. Used when a view edits one or two fields outside the workspace
// form, so the untouched fields survive the diff instead of being blanked.
function buildFullPayloadFromReport(report) {
  return {
    name: report.name || '',
    initials: report.initials || '',
    level: report.level || '',
    mentors: report.mentors || '',
    hireDate: report.hireDate || '',
    lastPromotionDate: report.lastPromotionDate || '',
    nextOneOnOneDate: report.nextOneOnOneDate || '',
    nextPdcDate: report.nextPdcDate || '',
    pdcStatus: normalizePdcStatus(report.rawPdcStatus !== undefined ? report.rawPdcStatus : report.pdcStatus),
    supportLevel: report.supportLevel || SUPPORT_LEVELS[0],
    developmentGoalSummary: report.developmentGoalSummary || '',
    promotionReadiness: report.promotionReadiness || '',
    agenda: report.agenda || '',
    notes: report.notes || '',
    talkingPoints: deepCopy(report.talkingPoints || []),
    goals: deepCopy(report.goals || []),
    cadenceOverrides: deepCopy(report.cadenceOverrides || {}),
    vacations: deepCopy(report.vacations || []),
    evidence: deepCopy(report.evidence || []),
    capabilities: deepCopy(report.capabilities || []),
    customFields: deepCopy(report.customFields || [])
  };
}

function collectWorkspaceVacations() {
  return [...document.querySelectorAll('#vacationList [data-vacation-row]')].map((row) => {
    const fallbackId = row.getAttribute('data-vacation-row') || '';
    return normalizeVacationEntry({
      id: fallbackId,
      startDate: row.querySelector('[data-vacation-start]')?.value,
      endDate: row.querySelector('[data-vacation-end]')?.value,
      note: row.querySelector('[data-vacation-note]')?.value
    }, fallbackId);
  }).filter((vacation) => vacation.startDate || vacation.endDate || vacation.note);
}


function collectWorkspaceEvidence() {
  return [...document.querySelectorAll('#evidenceGroups [data-evidence-row]')].map((row) => {
    const fallbackId = row.getAttribute('data-evidence-row') || '';
    return normalizeEvidenceEntry({
      id: fallbackId,
      date: row.querySelector('[data-evidence-date]')?.value,
      category: row.querySelector('[data-evidence-category]')?.value,
      kind: row.querySelector('[data-evidence-kind]')?.value,
      shared: !!row.querySelector('[data-evidence-shared]')?.checked,
      summary: row.querySelector('[data-evidence-summary]')?.value,
      detail: row.querySelector('[data-evidence-detail]')?.value,
      linkedMeetingId: row.querySelector('[data-evidence-meeting]')?.value
    }, fallbackId);
  }).filter((entry) => entry.date || entry.category || entry.summary || entry.detail || entry.linkedMeetingId);
}

function buildReportPayloadFromForm(formData, existingReport = null) {
  const customFieldContainer = document.getElementById('detailCustomFieldsList');
  const customFields = customFieldContainer
    ? collectWorkspaceCustomFields(existingReport?.customFields || [])
    : deepCopy(existingReport?.customFields || []);
  const cadenceOverrideInputsPresent = !!document.querySelector('[name="cadenceOneOnOneDays"], [name="cadencePdcDays"], [name="cadenceCvReviewDays"]');
  const evidenceInputsPresent = !!document.getElementById('evidenceGroups');
  const profileInputsPresent = !!document.querySelector('[name="name"]');
  const pickProfileField = (key, normalizer, fallback = '') => {
    if (profileInputsPresent) return normalizer(formData.get(key));
    return existingReport && existingReport[key] !== undefined ? existingReport[key] : fallback;
  };
  // Muscle-memory guard: initials used to be typed into the name as a
  // parenthesized suffix ("Avery Lindqvist (AVLI)"). If that pattern arrives in
  // the name while the initials field is empty, split it the same way the
  // v10->v11 migration does so no new parenthesized names enter the data.
  let profileName = pickProfileField('name', normalizeText);
  let profileInitials = pickProfileField('initials', normalizeInitials);
  if (!profileInitials) {
    const split = splitLegacyInitialsFromName(profileName);
    if (split.initials) {
      profileName = split.name;
      profileInitials = split.initials;
    }
  }
  return {
    name: profileName,
    initials: profileInitials,
    level: pickProfileField('level', normalizeLevel),
    mentors: pickProfileField('mentors', normalizeText),
    hireDate: pickProfileField('hireDate', normalizeDate),
    lastPromotionDate: pickProfileField('lastPromotionDate', normalizeDate),
    nextOneOnOneDate: pickProfileField('nextOneOnOneDate', normalizeDate),
    nextPdcDate: pickProfileField('nextPdcDate', normalizeDate),
    supportLevel: profileInputsPresent
      ? normalizeSupportLevel(formData.get('supportLevel'))
      : normalizeSupportLevel(existingReport?.supportLevel),
    pdcStatus: document.querySelector('[name="pdcStatus"]')
      ? normalizePdcStatus(formData.get('pdcStatus'))
      : normalizePdcStatus(existingReport?.rawPdcStatus !== undefined ? existingReport.rawPdcStatus : existingReport?.pdcStatus),
    developmentGoalSummary: document.querySelector('[name="developmentGoalSummary"]')
      ? normalizeText(formData.get('developmentGoalSummary'))
      : normalizeText(existingReport?.developmentGoalSummary),
    promotionReadiness: normalizeText(formData.get('promotionReadiness')),
    agenda: document.querySelector('[name="agenda"]')
      ? normalizeText(formData.get('agenda'))
      : normalizeText(existingReport?.agenda),
    talkingPoints: normalizeTalkingPoints(existingReport?.talkingPoints || []),
    goals: normalizeGoals(existingReport?.goals || []),
    notes: normalizeText(formData.get('notes')),
    cadenceOverrides: cadenceOverrideInputsPresent
      ? normalizeCadenceOverrides({
        oneOnOneDays: formData.get('cadenceOneOnOneDays'),
        pdcDays: formData.get('cadencePdcDays'),
        cvReviewDays: formData.get('cadenceCvReviewDays')
      })
      : deepCopy(existingReport?.cadenceOverrides || {}),
    vacations: document.getElementById('vacationList')
      ? collectWorkspaceVacations()
      : normalizeVacationEntries(existingReport?.vacations || []),
    evidence: evidenceInputsPresent ? collectWorkspaceEvidence() : deepCopy(existingReport?.evidence || []),
    customFields
  };
}

function collectWorkspaceCustomFields(existingFields = []) {
  return [...document.querySelectorAll('#detailCustomFieldsList [data-custom-field]')]
    .map((row, index) => {
      const id = row.getAttribute('data-custom-field') || existingFields[index]?.id || nextId('customField');
      return normalizeCustomField({
        id,
        label: row.querySelector('[data-custom-field-label]')?.value,
        value: row.querySelector('[data-custom-field-value]')?.value
      }, id);
    })
    .filter((field) => field.label || field.value);
}

function appendEvent(event) {
  app.doc.events.push(normalizeEventRecord(event));
}

async function createReport(payload, options = {}) {
  clearLastDestructiveAction();
  const createdAt = nowIso();
  const personId = nextId('person');
  const normalizedPayload = normalizePersonRecord({ id: personId, ...payload, vacations: assignVacationIds(payload.vacations), evidence: assignEvidenceIds(payload.evidence), createdAt });
  app.doc.people.push(normalizedPayload);
  appendEvent({ id: nextId('event'), type: 'person_created', personId, snapshot: normalizedPayload, createdAt });
  if (normalizedPayload.notes) {
    appendEvent({
      id: nextId('event'),
      type: 'note_added',
      personId,
      noteId: nextId('note'),
      noteDate: todayStamp(),
      noteText: normalizedPayload.notes,
      source: 'workspace',
      createdAt
    });
  }
  applyProjectedState();
  if (!options.skipRender) render();
  scheduleAutosave();
  showToast(`Added ${normalizedPayload.name}.`, 'success');
  return personId;
}

async function updateReport(reportId, payload, options = {}) {
  clearLastDestructiveAction();
  const report = getReportById(reportId);
  if (!report) return false;
  const createdAt = nowIso();
  const preparedPayload = { ...payload };
  if ('vacations' in preparedPayload) preparedPayload.vacations = assignVacationIds(preparedPayload.vacations);
  if ('evidence' in preparedPayload) preparedPayload.evidence = assignEvidenceIds(preparedPayload.evidence);
  const changes = {};
  ['name','initials','level','mentors','hireDate','lastPromotionDate','nextOneOnOneDate','nextPdcDate','pdcStatus','supportLevel','developmentGoalSummary','promotionReadiness','agenda','talkingPoints','goals','cadenceOverrides','vacations','evidence','capabilities','customFields'].forEach((key) => {
    // Absent key = the caller makes no claim about that field. Diffing it
    // anyway would compare an empty value against stored data and wipe it,
    // which is exactly how instant saves used to erase initials. Skip.
    if (!(key in preparedPayload)) return;
    // report.pdcStatus holds the derived status after projection; the stored
    // (user-set) value lives in rawPdcStatus, so diff against that instead.
    const prevSource = key === 'pdcStatus' && report.rawPdcStatus !== undefined ? report.rawPdcStatus : report[key];
    const nextValue = ['customFields','cadenceOverrides','vacations','evidence','capabilities','talkingPoints','goals'].includes(key) ? JSON.stringify(preparedPayload[key] || (key === 'cadenceOverrides' ? {} : [])) : String(preparedPayload[key] || '');
    const prevValue = ['customFields','cadenceOverrides','vacations','evidence','capabilities','talkingPoints','goals'].includes(key) ? JSON.stringify(prevSource || (key === 'cadenceOverrides' ? {} : [])) : String(prevSource || '');
    if (nextValue !== prevValue) changes[key] = preparedPayload[key];
  });
  const notesChanged = ('notes' in preparedPayload) && preparedPayload.notes !== String(report.notes || '');
  const anyChange = Object.keys(changes).length > 0 || notesChanged;
  if (!anyChange) {
    return true;
  }
  if (Object.keys(changes).length) {
    appendEvent({ id: nextId('event'), type: 'person_updated', personId: reportId, changes, createdAt });
  }
  if (notesChanged) {
    appendEvent({ id: nextId('event'), type: 'note_added', personId: reportId, noteId: nextId('note'), noteDate: todayStamp(), noteText: preparedPayload.notes, source: 'workspace', createdAt });
  }
  applyProjectedState();
  render();
  scheduleAutosave();
  if (!options.silentToast) showToast('Direct report updated.', 'success');
  return true;
}

async function deleteReport(reportId) {
  const report = getReportById(reportId);
  if (!report) return;
  if (!window.confirm(`Delete ${report.name} from Team Pulse?`)) return;
  clearLastDestructiveAction();
  const eventId = nextId('event');
  appendEvent({ id: eventId, type: 'person_archived', personId: reportId, createdAt: nowIso() });
  clearWorkspaceDraft();
  app.ui.selectedId = null;
  const undoAction = { kind: 'deleteReport', eventId, undoMessage: `${report.name} restored.` };
  app.lastDestructiveAction = undoAction;
  applyProjectedState();
  render();
  scheduleAutosave();
  showToast(`${report.name} was removed.`, 'success', { actionLabel: 'Undo', duration: 8000, onAction: () => undoDestructiveAction(undoAction) });
}

// GDPR right-to-erasure: removes the person record and every event that
// references them from the document. Unlike deleteReport (archive event,
// undoable), nothing about the person survives in the working file after the
// next save. Rolling backups in the folder still hold prior copies until
// they rotate; SCHEMA.md documents this.
async function purgeReportPermanently(reportId) {
  const report = getReportById(reportId);
  if (!report) return;
  const name = report.name || 'this person';
  if (!window.confirm(`Erase ${name} permanently?\n\nThis removes their profile, all meetings, notes, evidence, and history from the document. There is no undo.`)) return;
  if (!window.confirm(`Last check: erase ${name} and all of their history permanently?`)) return;
  clearLastDestructiveAction();
  clearWorkspaceDraft();
  app.doc.people = (app.doc.people || []).filter((person) => person.id !== reportId);
  app.doc.events = (app.doc.events || []).filter((event) => event.personId !== reportId);
  app.ui.selectedId = null;
  app.ui.creatingReport = false;
  applyProjectedState();
  render();
  scheduleAutosave();
  showToast(`${name} was erased permanently.`, 'success');
}

