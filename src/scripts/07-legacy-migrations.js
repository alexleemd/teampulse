function readLegacyState(rawState) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  const reports = Array.isArray(safe.reports) ? safe.reports : [];
  const settings = normalizeSettings({
    thresholds: {
      oneOnOneDays: safe.thresholds?.oneOnOneDays || DEFAULT_THRESHOLDS.oneOnOneDays,
      pdcDays: safe.thresholds?.developmentConversationDays || safe.thresholds?.pdcDays || DEFAULT_THRESHOLDS.pdcDays,
      cvReviewDays: safe.thresholds?.cvReviewDays || DEFAULT_THRESHOLDS.cvReviewDays
    },
    missingMentorCounts: safe.settings?.missingMentorCounts,
    blockedPdcCounts: safe.settings?.blockedPdcCounts,
    blockedPlanCounts: safe.settings?.blockedPlanCounts,
    promotionConversationMonths: safe.settings?.promotionConversationMonths,
    lastExportDate: safe.settings?.lastExportDate,
    stableMode: safe.settings?.stableMode
  });
  return { reports, settings };
}

function migrateLegacyStateToV2(rawState) {
  const stamp = nowIso();
  const { reports, settings } = readLegacyState(rawState);
  const doc = makeEmptyDoc();
  doc.schemaVersion = 2;
  doc.createdAt = stamp;
  doc.savedAt = stamp;
  doc.settings = settings;

  reports.forEach((legacyReport) => {
    const personId = nextDocId(doc, 'person');
    const personCreatedAt = normalizeText(legacyReport.createdAt) || stamp;
    const basePerson = normalizePersonRecord({
      id: personId,
      name: legacyReport.name,
      level: legacyReport.level,
      mentors: legacyReport.mentors,
      hireDate: legacyReport.hireDate,
      lastPromotionDate: legacyReport.lastPromotionDate,
      nextOneOnOneDate: legacyReport.nextOneOnOneDate,
      nextPdcDate: legacyReport.nextPdcDate,
      pdcStatus: legacyReport.pdcStatus || legacyReport.planStatus,
      supportLevel: legacyReport.supportLevel || legacyReport.riskFlag,
      developmentGoalSummary: legacyReport.developmentGoalSummary,
      promotionReadiness: legacyReport.promotionReadiness,
      notes: legacyReport.notes,
      customFields: Array.isArray(legacyReport.customFields)
        ? legacyReport.customFields.map((field) => ({
            id: nextDocId(doc, 'customField'),
            label: field.label || field.key,
            value: field.value
          }))
        : [],
      createdAt: personCreatedAt,
      legacyId: normalizeText(legacyReport.id)
    });
    doc.people.push(basePerson);
    doc.events.push({
      id: nextDocId(doc, 'event'),
      type: 'person_created',
      personId,
      snapshot: deepCopy(basePerson),
      createdAt: personCreatedAt
    });
    if (basePerson.notes) {
      doc.events.push({
        id: nextDocId(doc, 'event'),
        type: 'note_added',
        personId,
        noteId: nextDocId(doc, 'note'),
        noteDate: basePerson.hireDate || todayStamp(),
        noteText: basePerson.notes,
        source: 'migration',
        createdAt: personCreatedAt
      });
    }
    const meetings = Array.isArray(legacyReport.meetings) ? legacyReport.meetings : [];
    meetings.forEach((meeting) => {
      doc.events.push({
        id: nextDocId(doc, 'event'),
        type: 'meeting_logged',
        personId,
        meetingId: nextDocId(doc, 'meeting'),
        meetingType: canonicalMeetingType(meeting.meetingType),
        meetingDate: normalizeDate(meeting.meetingDate) || todayStamp(),
        durationMinutes: Number.isFinite(Number(meeting.durationMinutes)) ? Number(meeting.durationMinutes) : null,
        notes: normalizeText(meeting.notes),
        source: meeting.externalUid ? 'ics' : (normalizeText(meeting.source) || 'migration'),
        externalUid: normalizeText(meeting.externalUid),
        createdAt: normalizeText(meeting.createdAt) || personCreatedAt
      });
    });
  });

  return syncIdCounters(doc);
}

function nextDocId(doc, kind) {
  const map = {
    person: ['person', 'p'],
    event: ['event', 'evt'],
    customField: ['customField', 'cf'],
    vacation: ['vacation', 'vac'],
    meeting: ['meeting', 'mtg'],
    note: ['note', 'note']
  };
  const [counterKey, prefix] = map[kind];
  if (!doc.idCounters[counterKey]) doc.idCounters[counterKey] = 0;
  doc.idCounters[counterKey] += 1;
  return `${prefix}_${String(doc.idCounters[counterKey]).padStart(3, '0')}`;
}

function migrateV1ToV2(docV1) {
  const safeDoc = docV1 && typeof docV1 === 'object' ? docV1 : {};
  const sourceState = safeDoc.state || safeDoc.data || {};
  const migrated = migrateLegacyStateToV2(sourceState);
  migrated.createdAt = normalizeText(safeDoc.createdAt) || migrated.createdAt;
  migrated.savedAt = normalizeText(safeDoc.savedAt) || migrated.savedAt;
  return migrated;
}

function migrateV2ToV3(docV2) {
  const safeDoc = docV2 && typeof docV2 === 'object' ? deepCopy(docV2) : makeEmptyDoc();
  safeDoc.schemaVersion = 3;
  safeDoc.people = Array.isArray(safeDoc.people) ? safeDoc.people.map((person) => ({
    ...person,
    cadenceOverrides: normalizeCadenceOverrides(person?.cadenceOverrides),
    vacations: normalizeVacationEntries(person?.vacations)
  })) : [];
  if (!safeDoc.idCounters || typeof safeDoc.idCounters !== 'object') safeDoc.idCounters = {};
  if (!safeDoc.idCounters.vacation) safeDoc.idCounters.vacation = 0;
  return syncIdCounters(safeDoc);
}

function migrateV3ToV4(docV3) {
  const safeDoc = docV3 && typeof docV3 === 'object' ? deepCopy(docV3) : makeEmptyDoc();
  safeDoc.schemaVersion = 4;
  safeDoc.people = Array.isArray(safeDoc.people) ? safeDoc.people.map((person) => ({
    ...person,
    snoozes: normalizeSnoozeEntries(person?.snoozes),
    evidence: normalizeEvidenceEntries(person?.evidence)
  })) : [];
  safeDoc.settings = normalizeSettings({ ...(safeDoc.settings || {}), evidenceCategories: safeDoc.settings?.evidenceCategories });
  if (!safeDoc.idCounters || typeof safeDoc.idCounters !== 'object') safeDoc.idCounters = {};
  if (!safeDoc.idCounters.evidence) safeDoc.idCounters.evidence = 0;
  return syncIdCounters(safeDoc);
}

function migrateV4ToV5(docV4) {
  const safeDoc = docV4 && typeof docV4 === 'object' ? deepCopy(docV4) : makeEmptyDoc();
  safeDoc.schemaVersion = 5;
  safeDoc.settings = normalizeSettings({ ...(safeDoc.settings || {}), promotionConversationMonths: safeDoc.settings?.promotionConversationMonths });
  return syncIdCounters(safeDoc);
}

