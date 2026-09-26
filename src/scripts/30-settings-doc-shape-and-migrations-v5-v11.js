const THEMES_WINDOW_DEFAULT = 90;
const SUPPORT_TREND_COLORS = Object.freeze({
  Good: '#0d7a48',
  Monitor: '#115b9c',
  'Support needed': '#b06b00',
  Urgent: '#b42318'
});
const PDC_TREND_COLORS = Object.freeze({
  'Not started': '#d9e1ef',
  'In progress': '#7fb0ff',
  'Needs review': '#f6d58d',
  Completed: '#b6ebc9',
  Blocked: '#f5b4af'
});
const RECENT_THEME_STOPWORDS = new Set([
  'about','after','again','against','almost','along','also','although','always','another','around','because','before','being','between','could','every','first','from','have','having','into','just','maybe','might','other','really','should','since','still','their','there','these','thing','think','those','through','under','until','where','which','while','would','about','above','after','along','around','being','below','could','every','further','great','maybe','other','quite','rather','shall','since','some','such','than','that','them','then','they','this','very','were','what','when','with','your','ours','ourselves','theirs','herself','himself','themselves','have','has','had','been','will','would','could','should','must','want','need','make','made','much','many','more','most','less','over','into','onto','upon','across','within','without','because','through','during','about','today','yesterday','tomorrow','week','weeks','month','months','quarter','years','year','team','manager','meeting','meetings','notes','noted','follow','followup','followups','action','actions','update','updated','review','reviews','check','checking','status','level','levels','report','reports','direct','people','person','pdc','cv','good','monitor','urgent','support'
]);

function normalizeSettings(rawSettings = {}) {
  const thresholds = rawSettings.thresholds || {};
  const merged = {
    ...deepCopy(DEFAULT_SETTINGS),
    ...(rawSettings || {}),
    thresholds: {
      ...deepCopy(DEFAULT_THRESHOLDS),
      ...(thresholds || {})
    }
  };
  merged.thresholds.oneOnOneDays = safePositiveInteger(merged.thresholds.oneOnOneDays, DEFAULT_THRESHOLDS.oneOnOneDays);
  merged.thresholds.pdcDays = safePositiveInteger(merged.thresholds.pdcDays || merged.thresholds.developmentConversationDays, DEFAULT_THRESHOLDS.pdcDays);
  merged.thresholds.cvReviewDays = safePositiveInteger(merged.thresholds.cvReviewDays, DEFAULT_THRESHOLDS.cvReviewDays);
  merged.missingMentorCounts = !!merged.missingMentorCounts;
  merged.blockedPdcCounts = rawSettings.blockedPdcCounts === undefined
    ? rawSettings.blockedPlanCounts === undefined ? DEFAULT_SETTINGS.blockedPdcCounts : !!rawSettings.blockedPlanCounts
    : !!rawSettings.blockedPdcCounts;
  merged.evidenceCategories = normalizeEvidenceCategories(merged.evidenceCategories || rawSettings.evidenceCategories);
  merged.promotionConversationMonths = safePositiveInteger(merged.promotionConversationMonths || rawSettings.promotionConversationMonths, DEFAULT_PROMOTION_CONVERSATION_MONTHS);
  merged.themesWindowDays = safePositiveInteger(merged.themesWindowDays || rawSettings.themesWindowDays, THEMES_WINDOW_DEFAULT);
  merged.stableMode = rawSettings.stableMode === undefined ? true : !!merged.stableMode;
  merged.pulseTrendCounts = rawSettings.pulseTrendCounts === undefined ? true : !!merged.pulseTrendCounts;
  merged.density = merged.density === 'compact' ? 'compact' : 'comfortable';
  merged.pdcRoundAutoReset = rawSettings.pdcRoundAutoReset === undefined ? true : !!merged.pdcRoundAutoReset;
  merged.pdcRoundStartMonth = Math.min(12, Math.max(1, safePositiveInteger(merged.pdcRoundStartMonth, 1)));
  merged.lastPdcRoundKey = normalizeText(merged.lastPdcRoundKey || '');
  merged.lastExportDate = normalizeText(merged.lastExportDate);
  merged.latestExportFiles = Array.isArray(merged.latestExportFiles) ? merged.latestExportFiles.map((value) => normalizeText(value)).filter(Boolean) : [];
  return merged;
}

function makeEmptyDoc() {
  const stamp = nowIso();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt: stamp,
    savedAt: stamp,
    idCounters: {
      person: 0,
      event: 0,
      customField: 0,
      vacation: 0,
      meeting: 0,
      note: 0,
      evidence: 0,
      talkingPoint: 0,
      goal: 0,
      goalUpdate: 0
    },
    people: [],
    events: [],
    settings: normalizeSettings({})
  };
}

function ensureDocShape(doc) {
  const safe = doc && typeof doc === 'object' ? deepCopy(doc) : makeEmptyDoc();
  safe.schemaVersion = Math.max(Number(safe.schemaVersion) || 0, CURRENT_SCHEMA_VERSION);
  safe.appVersion = normalizeText(safe.appVersion) || APP_VERSION;
  safe.createdAt = normalizeText(safe.createdAt) || nowIso();
  safe.savedAt = normalizeText(safe.savedAt) || safe.createdAt;
  safe.people = Array.isArray(safe.people) ? safe.people.map((person) => normalizePersonRecord(person)).filter((person) => person.id) : [];
  safe.events = Array.isArray(safe.events) ? safe.events.map((event) => normalizeEventRecord(event)).filter((event) => event.id && event.type) : [];
  safe.settings = normalizeSettings(safe.settings || {});
  safe.idCounters = safe.idCounters && typeof safe.idCounters === 'object' ? safe.idCounters : {};
  return syncIdCounters(safe);
}

function migrateV5ToV6(docV5) {
  const safeDoc = docV5 && typeof docV5 === 'object' ? deepCopy(docV5) : makeEmptyDoc();
  safeDoc.schemaVersion = 6;
  // v5->v6 historically initialized weeklySnapshots and seeded themesWindowDays.
  // weeklySnapshots is removed in v7, so we only touch settings here; the
  // v6->v7 migration will strip any snapshots field that arrives on this path.
  safeDoc.settings = normalizeSettings({ ...(safeDoc.settings || {}), themesWindowDays: safeDoc.settings?.themesWindowDays });
  return syncIdCounters(safeDoc);
}

function migrateV6ToV7(docV6) {
  const safeDoc = docV6 && typeof docV6 === 'object' ? deepCopy(docV6) : makeEmptyDoc();
  // Remove the weeklySnapshots field entirely. v0.25.0 dropped the Trend tab
  // which was the only reader, so carrying this field forward is pure waste.
  // One-way migration: the field and its contents are discarded.
  delete safeDoc.weeklySnapshots;
  safeDoc.schemaVersion = 7;
  return syncIdCounters(safeDoc);
}

function migrateV7ToV8(docV7) {
  const safeDoc = docV7 && typeof docV7 === 'object' ? deepCopy(docV7) : makeEmptyDoc();
  // v8 adds the per-person agenda field (talking points for the next 1:1).
  // normalizePersonRecord defaults it to '' for every person on load, so this
  // migration only needs to stamp the version.
  if (Array.isArray(safeDoc.people)) {
    safeDoc.people = safeDoc.people.map((person) => ({ agenda: '', ...person }));
  }
  safeDoc.schemaVersion = 8;
  return syncIdCounters(safeDoc);
}

function migrateV8ToV9(docV8) {
  const safeDoc = docV8 && typeof docV8 === 'object' ? deepCopy(docV8) : makeEmptyDoc();
  // v9 makes pdcStatus fully manual. To keep boards visually identical at
  // cutover, bake the status each person DISPLAYED under the old date-driven
  // derivation into the stored field, replicating the old precedence here
  // against the raw document (event log plus any embedded meeting arrays).
  const today = todayStamp();
  const settingsThresholds = safeDoc.settings?.thresholds || {};
  const events = Array.isArray(safeDoc.events) ? safeDoc.events : [];
  safeDoc.people = (Array.isArray(safeDoc.people) ? safeDoc.people : []).map((person) => {
    const explicit = normalizePdcStatus(person.pdcStatus);
    const nextPdcDate = normalizeDate(person.nextPdcDate);
    const deleted = new Set(events.filter((e) => e.personId === person.id && e.type === 'meeting_deleted').map((e) => e.meetingId));
    let lastPdc = '';
    events.forEach((e) => {
      if (e.personId !== person.id || e.type !== 'meeting_logged') return;
      if (deleted.has(e.meetingId)) return;
      if (canonicalMeetingType(e.meetingType) !== 'PDC') return;
      const d = normalizeDate(e.meetingDate);
      if (d && d > lastPdc) lastPdc = d;
    });
    if (!lastPdc && Array.isArray(person.meetings)) {
      person.meetings.forEach((m) => {
        if (canonicalMeetingType(m.meetingType) !== 'PDC') return;
        const d = normalizeDate(m.meetingDate);
        if (d && d > lastPdc) lastPdc = d;
      });
    }
    const overrides = normalizeCadenceOverrides(person.cadenceOverrides || {});
    const pdcThreshold = overrides.pdcDays || settingsThresholds.pdcDays || DEFAULT_THRESHOLDS.pdcDays;
    const anchor = lastPdc || normalizeDate(person.hireDate);
    const pdcOverdue = anchor ? daysBetween(anchor, today) > pdcThreshold : true;
    let baked;
    if (explicit === 'Blocked') baked = 'Blocked';
    else if (nextPdcDate && nextPdcDate >= today) baked = 'In progress';
    else if (lastPdc && !pdcOverdue) baked = 'Completed';
    else if (nextPdcDate && nextPdcDate < today) baked = 'Needs review';
    else if (explicit === 'In progress' || explicit === 'Needs review' || explicit === 'Completed') baked = explicit;
    else if (lastPdc && pdcOverdue) baked = 'Needs review';
    else baked = 'Not started';
    return { ...person, pdcStatus: baked };
  });
  safeDoc.schemaVersion = 9;
  return syncIdCounters(safeDoc);
}

function migrateV9ToV10(docV9) {
  const safeDoc = docV9 && typeof docV9 === 'object' ? deepCopy(docV9) : makeEmptyDoc();
  // v10 introduces structured talking points (replacing the free-text agenda),
  // development goals with progress (replacing the development goal summary
  // text field), a per-meeting pulse, and feedback kind/shared flags on
  // evidence. The agenda and summary fields survive in the schema for
  // backwards compatibility but are drained here: their FINAL projected value
  // (base snapshot plus every person_updated replayed in order) is converted,
  // and the raw fields are then stripped from historical events so replays
  // cannot resurrect the old text on top of the converted records.
  syncIdCounters(safeDoc);
  if (!safeDoc.idCounters || typeof safeDoc.idCounters !== 'object') safeDoc.idCounters = {};
  const mint = (counterKey, prefix) => {
    safeDoc.idCounters[counterKey] = (safeDoc.idCounters[counterKey] || 0) + 1;
    return `${prefix}_${String(safeDoc.idCounters[counterKey]).padStart(3, '0')}`;
  };
  const events = Array.isArray(safeDoc.events) ? safeDoc.events : [];
  const people = Array.isArray(safeDoc.people) ? safeDoc.people : [];
  const finals = new Map();
  people.forEach((person) => {
    if (!person || !person.id) return;
    finals.set(person.id, {
      agenda: normalizeText(person.agenda),
      developmentGoalSummary: normalizeText(person.developmentGoalSummary)
    });
  });
  events.forEach((event) => {
    if (!event || !event.personId) return;
    if (event.type === 'person_created') {
      if (!finals.has(event.personId)) {
        finals.set(event.personId, {
          agenda: normalizeText(event.snapshot?.agenda),
          developmentGoalSummary: normalizeText(event.snapshot?.developmentGoalSummary)
        });
      }
      if (event.snapshot && typeof event.snapshot === 'object') {
        event.snapshot.agenda = '';
        event.snapshot.developmentGoalSummary = '';
      }
      return;
    }
    if (event.type === 'person_updated' && event.changes && typeof event.changes === 'object') {
      const final = finals.get(event.personId);
      if (final) {
        if ('agenda' in event.changes) final.agenda = normalizeText(event.changes.agenda);
        if ('developmentGoalSummary' in event.changes) final.developmentGoalSummary = normalizeText(event.changes.developmentGoalSummary);
      }
      delete event.changes.agenda;
      delete event.changes.developmentGoalSummary;
    }
  });
  const agendaLineToPoint = (line) => {
    let text = String(line || '').trim();
    if (!text) return null;
    let done = false;
    const checkbox = text.match(/^\[(x|X| )?\]\s*(.*)$/);
    if (checkbox) {
      done = !!checkbox[1] && checkbox[1].toLowerCase() === 'x';
      text = checkbox[2];
    }
    text = text.replace(/^[-*•]\s+/, '').trim();
    if (!text || /^#+\s*$/.test(text)) return null;
    text = text.replace(/^#+\s+/, '').trim();
    return text ? { text, done } : null;
  };
  safeDoc.people = people.map((person) => {
    if (!person || !person.id) return person;
    const final = finals.get(person.id) || { agenda: '', developmentGoalSummary: '' };
    const stamp = normalizeText(person.createdAt) || nowIso();
    const migrated = { ...person, agenda: '', developmentGoalSummary: '' };
    const existingPoints = Array.isArray(person.talkingPoints) ? person.talkingPoints : [];
    if (!existingPoints.length && final.agenda) {
      migrated.talkingPoints = final.agenda.split('\n')
        .map((line) => agendaLineToPoint(line))
        .filter(Boolean)
        .map((point) => ({
          id: mint('talkingPoint', 'tp'),
          text: point.text,
          createdAt: stamp,
          done: point.done,
          doneAt: point.done ? stamp : '',
          meetingId: ''
        }));
    }
    const existingGoals = Array.isArray(person.goals) ? person.goals : [];
    if (!existingGoals.length && final.developmentGoalSummary) {
      const lines = final.developmentGoalSummary.split('\n').map((line) => line.trim()).filter(Boolean);
      const title = (lines[0] || '').replace(/^[-*•#]+\s*/, '').slice(0, 140);
      const detail = lines.slice(1).join('\n');
      if (title) {
        migrated.goals = [{
          id: mint('goal', 'goal'),
          title,
          detail,
          status: 'On track',
          targetDate: '',
          progress: 0,
          createdAt: stamp,
          updates: []
        }];
      }
    }
    return migrated;
  });
  safeDoc.schemaVersion = 10;
  return syncIdCounters(safeDoc);
}

function migrateV10ToV11(docV10) {
  const safeDoc = docV10 && typeof docV10 === 'object' ? deepCopy(docV10) : makeEmptyDoc();
  // v11 introduces people[].initials as a first-class field. Before it existed
  // the convention was to append company initials to the name in parentheses
  // ("Avery Lindqvist (AVLI)"), so this migration extracts that pattern: the
  // token from each person's FINAL projected name becomes their initials, and
  // the parenthesized suffix is stripped from the name everywhere it appears
  // (base records, person_created snapshots, and person_updated name changes)
  // so event replay cannot resurrect the old form. Names without the pattern
  // and people who already carry initials are left untouched.
  const events = Array.isArray(safeDoc.events) ? safeDoc.events : [];
  const people = Array.isArray(safeDoc.people) ? safeDoc.people : [];
  const finalNames = new Map();
  people.forEach((person) => {
    if (!person || !person.id) return;
    finalNames.set(person.id, normalizeText(person.name));
  });
  events.forEach((event) => {
    if (!event || !event.personId) return;
    if (event.type === 'person_created') {
      if (!finalNames.has(event.personId)) finalNames.set(event.personId, normalizeText(event.snapshot?.name));
      if (event.snapshot && typeof event.snapshot === 'object' && event.snapshot.name) {
        event.snapshot.name = splitLegacyInitialsFromName(event.snapshot.name).name;
      }
      return;
    }
    if (event.type === 'person_updated' && event.changes && typeof event.changes === 'object' && 'name' in event.changes) {
      if (finalNames.has(event.personId)) finalNames.set(event.personId, normalizeText(event.changes.name));
      event.changes.name = splitLegacyInitialsFromName(event.changes.name).name;
    }
  });
  safeDoc.people = people.map((person) => {
    if (!person || !person.id) return person;
    const finalSplit = splitLegacyInitialsFromName(finalNames.get(person.id) || '');
    const ownSplit = splitLegacyInitialsFromName(person.name);
    return {
      ...person,
      name: ownSplit.name,
      initials: normalizeInitials(person.initials) || finalSplit.initials
    };
  });
  safeDoc.schemaVersion = 11;
  return safeDoc;
}

