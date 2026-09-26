function maxIdFromList(ids, prefix) {
  const prefixText = `${prefix}_`;
  return ids.reduce((max, id) => {
    const text = normalizeText(id);
    if (!text.startsWith(prefixText)) return max;
    const suffix = Number.parseInt(text.slice(prefixText.length), 10);
    if (!Number.isFinite(suffix)) return max;
    return Math.max(max, suffix);
  }, 0);
}

function syncIdCounters(doc) {
  const peopleIds = (doc.people || []).map((item) => item.id);
  const eventIds = (doc.events || []).map((item) => item.id);
  const eventSnapshots = (doc.events || [])
    .filter((event) => event.type === 'person_created' || event.type === 'person_updated')
    .flatMap((event) => [event.snapshot || {}, event.changes || {}]);
  const customFieldIds = [
    ...(doc.people || []).flatMap((person) => (person.customFields || []).map((field) => field.id)),
    ...eventSnapshots.flatMap((snapshot) => (snapshot.customFields || []).map((field) => field.id))
  ];
  const vacationIds = [
    ...(doc.people || []).flatMap((person) => (person.vacations || []).map((vacation) => vacation.id)),
    ...eventSnapshots.flatMap((snapshot) => (snapshot.vacations || []).map((vacation) => vacation.id))
  ];
  const evidenceIds = [
    ...(doc.people || []).flatMap((person) => (person.evidence || []).map((item) => item.id)),
    ...eventSnapshots.flatMap((snapshot) => (snapshot.evidence || []).map((item) => item.id))
  ];
  const talkingPointIds = [
    ...(doc.people || []).flatMap((person) => (person.talkingPoints || []).map((item) => item.id)),
    ...eventSnapshots.flatMap((snapshot) => (snapshot.talkingPoints || []).map((item) => item.id))
  ];
  const goalIds = [
    ...(doc.people || []).flatMap((person) => (person.goals || []).map((item) => item.id)),
    ...eventSnapshots.flatMap((snapshot) => (snapshot.goals || []).map((item) => item.id))
  ];
  const goalUpdateIds = [
    ...(doc.people || []).flatMap((person) => (person.goals || []).flatMap((goal) => (goal.updates || []).map((item) => item.id))),
    ...eventSnapshots.flatMap((snapshot) => (snapshot.goals || []).flatMap((goal) => (goal.updates || []).map((item) => item.id)))
  ];
  const meetingIds = (doc.events || []).filter((event) => event.type === 'meeting_logged').map((event) => event.meetingId);
  const noteIds = (doc.events || []).filter((event) => event.type === 'note_added').map((event) => event.noteId);
  doc.idCounters = {
    person: Math.max(doc.idCounters?.person || 0, maxIdFromList(peopleIds, 'p')),
    event: Math.max(doc.idCounters?.event || 0, maxIdFromList(eventIds, 'evt')),
    customField: Math.max(doc.idCounters?.customField || 0, maxIdFromList(customFieldIds, 'cf')),
    vacation: Math.max(doc.idCounters?.vacation || 0, maxIdFromList(vacationIds, 'vac')),
    meeting: Math.max(doc.idCounters?.meeting || 0, maxIdFromList(meetingIds, 'mtg')),
    note: Math.max(doc.idCounters?.note || 0, maxIdFromList(noteIds, 'note')),
    evidence: Math.max(doc.idCounters?.evidence || 0, maxIdFromList(evidenceIds, 'ev')),
    talkingPoint: Math.max(doc.idCounters?.talkingPoint || 0, maxIdFromList(talkingPointIds, 'tp')),
    goal: Math.max(doc.idCounters?.goal || 0, maxIdFromList(goalIds, 'goal')),
    goalUpdate: Math.max(doc.idCounters?.goalUpdate || 0, maxIdFromList(goalUpdateIds, 'gu'))
  };
  return doc;
}

function normalizePersonRecord(person = {}) {
  const createdAt = normalizeText(person.createdAt) || nowIso();
  return {
    id: normalizeText(person.id),
    name: normalizeText(person.name),
    initials: normalizeInitials(person.initials),
    level: normalizeLevel(person.level),
    mentors: normalizeText(person.mentors),
    hireDate: normalizeDate(person.hireDate),
    lastPromotionDate: normalizeDate(person.lastPromotionDate),
    nextOneOnOneDate: normalizeDate(person.nextOneOnOneDate),
    nextPdcDate: normalizeDate(person.nextPdcDate),
    pdcStatus: normalizePdcStatus(person.pdcStatus || person.planStatus),
    supportLevel: normalizeSupportLevel(person.supportLevel || person.riskFlag),
    developmentGoalSummary: normalizeText(person.developmentGoalSummary),
    promotionReadiness: normalizeText(person.promotionReadiness),
    agenda: normalizeText(person.agenda),
    notes: normalizeText(person.notes),
    talkingPoints: normalizeTalkingPoints(person.talkingPoints),
    goals: normalizeGoals(person.goals),
    cadenceOverrides: normalizeCadenceOverrides(person.cadenceOverrides),
    vacations: normalizeVacationEntries(person.vacations),
    snoozes: normalizeSnoozeEntries(person.snoozes),
    evidence: normalizeEvidenceEntries(person.evidence),
    capabilities: normalizeCapabilityTicks(person.capabilities),
    customFields: Array.isArray(person.customFields)
      ? person.customFields.map((field) => normalizeCustomField(field)).filter((field) => field.label || field.value)
      : [],
    createdAt,
    legacyId: normalizeText(person.legacyId)
  };
}

function normalizeEventRecord(event = {}) {
  const safe = event && typeof event === 'object' ? event : {};
  const base = {
    id: normalizeText(safe.id),
    type: normalizeText(safe.type),
    personId: normalizeText(safe.personId),
    createdAt: normalizeText(safe.createdAt) || nowIso()
  };
  if (base.type === 'person_created') {
    return {
      ...base,
      snapshot: normalizePersonRecord(safe.snapshot || safe.person || {})
    };
  }
  if (base.type === 'person_updated') {
    return {
      ...base,
      changes: normalizePersonChanges(safe.changes || {})
    };
  }
  if (base.type === 'note_added') {
    return {
      ...base,
      noteId: normalizeText(safe.noteId),
      noteDate: normalizeDate(safe.noteDate) || todayStamp(),
      noteText: normalizeText(safe.noteText || safe.note),
      source: normalizeText(safe.source || 'workspace') || 'workspace'
    };
  }
  if (base.type === 'meeting_logged') {
    return {
      ...base,
      meetingId: normalizeText(safe.meetingId),
      meetingType: canonicalMeetingType(safe.meetingType),
      meetingDate: normalizeDate(safe.meetingDate) || todayStamp(),
      durationMinutes: Number.isFinite(Number(safe.durationMinutes)) ? Number(safe.durationMinutes) : null,
      notes: normalizeText(safe.notes),
      pulse: normalizePulse(safe.pulse),
      source: normalizeText(safe.source || 'manual') || 'manual',
      externalUid: normalizeText(safe.externalUid)
    };
  }
  if (base.type === 'meeting_deleted') {
    return {
      ...base,
      meetingId: normalizeText(safe.meetingId)
    };
  }
  if (base.type === 'person_archived') {
    return { ...base };
  }
  return { ...base };
}

function normalizePersonChanges(changes = {}) {
  const normalized = {};
  if ('name' in changes) normalized.name = normalizeText(changes.name);
  if ('initials' in changes) normalized.initials = normalizeInitials(changes.initials);
  if ('level' in changes) normalized.level = normalizeLevel(changes.level);
  if ('mentors' in changes) normalized.mentors = normalizeText(changes.mentors);
  if ('hireDate' in changes) normalized.hireDate = normalizeDate(changes.hireDate);
  if ('lastPromotionDate' in changes) normalized.lastPromotionDate = normalizeDate(changes.lastPromotionDate);
  if ('nextOneOnOneDate' in changes) normalized.nextOneOnOneDate = normalizeDate(changes.nextOneOnOneDate);
  if ('nextPdcDate' in changes) normalized.nextPdcDate = normalizeDate(changes.nextPdcDate);
  if ('pdcStatus' in changes || 'planStatus' in changes) normalized.pdcStatus = normalizePdcStatus(changes.pdcStatus || changes.planStatus);
  if ('supportLevel' in changes || 'riskFlag' in changes) normalized.supportLevel = normalizeSupportLevel(changes.supportLevel || changes.riskFlag);
  if ('developmentGoalSummary' in changes) normalized.developmentGoalSummary = normalizeText(changes.developmentGoalSummary);
  if ('promotionReadiness' in changes) normalized.promotionReadiness = normalizeText(changes.promotionReadiness);
  if ('agenda' in changes) normalized.agenda = normalizeText(changes.agenda);
  if ('talkingPoints' in changes) normalized.talkingPoints = normalizeTalkingPoints(changes.talkingPoints);
  if ('goals' in changes) normalized.goals = normalizeGoals(changes.goals);
  if ('notes' in changes) normalized.notes = normalizeText(changes.notes);
  if ('cadenceOverrides' in changes) normalized.cadenceOverrides = normalizeCadenceOverrides(changes.cadenceOverrides);
  if ('vacations' in changes) normalized.vacations = normalizeVacationEntries(changes.vacations);
  if ('snoozes' in changes) normalized.snoozes = normalizeSnoozeEntries(changes.snoozes);
  if ('evidence' in changes) normalized.evidence = normalizeEvidenceEntries(changes.evidence);
  if ('capabilities' in changes) normalized.capabilities = normalizeCapabilityTicks(changes.capabilities);
  if ('customFields' in changes) {
    normalized.customFields = Array.isArray(changes.customFields)
      ? changes.customFields.map((field) => normalizeCustomField(field)).filter((field) => field.id || field.label || field.value)
      : [];
  }
  return normalized;
}

function nextId(kind) {
  if (!app.doc) throw new Error('No Team Pulse document is loaded.');
  const map = {
    person: ['person', 'p'],
    event: ['event', 'evt'],
    customField: ['customField', 'cf'],
    vacation: ['vacation', 'vac'],
    meeting: ['meeting', 'mtg'],
    note: ['note', 'note'],
    evidence: ['evidence', 'ev'],
    talkingPoint: ['talkingPoint', 'tp'],
    goal: ['goal', 'goal'],
    goalUpdate: ['goalUpdate', 'gu']
  };
  const [counterKey, prefix] = map[kind] || [kind, String(kind || 'id').slice(0, 3)];
  if (!app.doc.idCounters[counterKey]) app.doc.idCounters[counterKey] = 0;
  app.doc.idCounters[counterKey] += 1;
  return `${prefix}_${String(app.doc.idCounters[counterKey]).padStart(3, '0')}`;
}

