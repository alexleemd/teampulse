// Fictional team-pulse.json files as older versions of Team Pulse wrote them,
// one per schema version (0 = the pre-versioned file, then 1 to 12), with what
// each should look like after loading in the current app.
//
// expect(r, t) gets r = { reports, saved, loadedSchemaVersion }: the projected
// people (getReports()), the upgraded file the app saved, and the version the
// app reported loading.
const T = '2026-05-13'; // the frozen test day

const at = (stamp, hh = '09') => `${stamp}T${hh}:00:00.000Z`;
const byName = (r, name) => r.reports.find((p) => p.name === name);

// A small event-log document in the shape schema v2 to v11 used.
function eventDoc(version, people, extraEvents = [], settings = {}) {
  const events = [];
  let n = 0;
  const id = () => `evt_${String(++n).padStart(3, '0')}`;
  people.forEach((person) => {
    events.push({ id: id(), type: 'person_created', personId: person.id, snapshot: { ...person }, createdAt: person.createdAt });
  });
  extraEvents.forEach((event) => events.push({ id: id(), ...event }));
  return {
    schemaVersion: version,
    appVersion: `fixture-v${version}`,
    createdAt: at('2025-01-06'),
    savedAt: at('2026-05-01'),
    idCounters: {},
    people,
    events,
    settings: { thresholds: { oneOnOneDays: 14, pdcDays: 90, cvReviewDays: 180 }, ...settings }
  };
}

const basePerson = (id, name, extra = {}) => ({
  id, name, level: 'Consultant (Skilled)', mentors: 'Rowan Ashby', hireDate: '2023-02-01',
  lastPromotionDate: '', nextOneOnOneDate: '', nextPdcDate: '', pdcStatus: 'Not started', supportLevel: 'Good',
  developmentGoalSummary: '', promotionReadiness: '', notes: '', customFields: [], createdAt: at('2025-01-06'), legacyId: '',
  ...extra
});

const meeting = (personId, meetingId, meetingDate, meetingType = '1:1', notes = '') => ({
  type: 'meeting_logged', personId, meetingId, meetingType, meetingDate, durationMinutes: 30, notes, source: 'manual', externalUid: '', createdAt: at(meetingDate, '15')
});

const legacyReports = [
  {
    id: 'r1', name: 'Nora Vance', level: 'consultant skilled', mentors: 'Rowan Ashby', hireDate: '2021-02-01',
    riskFlag: 'Watch', planStatus: 'In progress', notes: 'Prefers written agendas.',
    customFields: [{ key: 'Office', value: 'Harbor Street' }],
    meetings: [
      { meetingType: '1:1', meetingDate: '2026-04-30', notes: 'Legacy check-in', durationMinutes: 25 },
      { meetingType: 'Development conversation', meetingDate: '2026-02-10', notes: 'Legacy PDC' }
    ]
  },
  { id: 'r2', name: 'Otto Brandt', level: 'Senior (Developing)', hireDate: '2019-09-15', meetings: [] }
];

function expectLegacy(r, t) {
  t.equal(r.reports.map((p) => p.name).sort(), ['Nora Vance', 'Otto Brandt'], 'both people load');
  const nora = byName(r, 'Nora Vance');
  t.equal(nora.level, 'Consultant (Skilled)', 'legacy level alias is mapped');
  t.equal(nora.supportLevel, 'Monitor', 'legacy risk flag becomes a support level');
  t.equal(nora.meetings.map((m) => [m.meetingDate, m.meetingType]).sort(), [['2026-02-10', 'PDC'], ['2026-04-30', '1:1']], 'legacy meetings keep their dates and types');
  t.equal(nora.customFields.map((f) => [f.label, f.value]), [['Office', 'Harbor Street']], 'custom field is kept');
  t.check(nora.notesHistory.some((n) => n.noteText === 'Prefers written agendas.' || n.text === 'Prefers written agendas.') || nora.notes === 'Prefers written agendas.', 'legacy notes are kept');
}

module.exports = [
  {
    version: 0,
    label: 'pre-versioned file',
    doc: { reports: legacyReports, thresholds: { oneOnOneDays: 21, developmentConversationDays: 120, cvReviewDays: 200 } },
    expect(r, t) {
      expectLegacy(r, t);
      t.equal(r.saved.settings.thresholds, { oneOnOneDays: 21, pdcDays: 120, cvReviewDays: 200 }, 'legacy thresholds are kept');
    }
  },
  {
    version: 1,
    label: 'schema v1 (state wrapper)',
    doc: { schemaVersion: 1, createdAt: at('2024-03-01'), savedAt: at('2026-04-30'), state: { reports: legacyReports, thresholds: { oneOnOneDays: 21 } } },
    expect(r, t) {
      expectLegacy(r, t);
      t.equal(r.saved.createdAt, at('2024-03-01'), 'createdAt is kept');
      t.equal(r.saved.settings.thresholds.oneOnOneDays, 21, '1:1 threshold is kept');
    }
  },
  {
    version: 2,
    label: 'schema v2 (event log, no vacations)',
    doc: eventDoc(2, [basePerson('p_001', 'Priya Holm')], [meeting('p_001', 'mtg_001', '2026-05-04', '1:1', 'Weekly sync')]),
    expect(r, t) {
      const p = byName(r, 'Priya Holm');
      t.equal(p.meetings.map((m) => m.meetingDate), ['2026-05-04'], 'meeting is kept');
      t.equal(p.vacations, [], 'vacations start empty');
      t.check(r.saved.people[0].cadenceOverrides && typeof r.saved.people[0].cadenceOverrides === 'object', 'cadence overrides are added');
    }
  },
  {
    version: 3,
    label: 'schema v3 (vacations)',
    doc: eventDoc(3, [basePerson('p_001', 'Quentin Moss', { vacations: [{ id: 'vac_001', startDate: '2026-05-11', endDate: '2026-05-22', note: 'Hiking trip' }], cadenceOverrides: { oneOnOneDays: 21 } })]),
    expect(r, t) {
      const p = byName(r, 'Quentin Moss');
      t.equal(p.vacations.map((v) => [v.startDate, v.endDate, v.note]), [['2026-05-11', '2026-05-22', 'Hiking trip']], 'vacation is kept');
      t.equal(p.cadenceOverrides.oneOnOneDays, 21, 'cadence override is kept');
      t.equal(p.snoozes, [], 'snoozes start empty');
    }
  },
  {
    version: 4,
    label: 'schema v4 (evidence and snoozes)',
    doc: eventDoc(4, [basePerson('p_001', 'Rosa Lindgren', {
      evidence: [{ id: 'ev_001', date: '2026-04-02', category: 'Leadership', summary: 'Ran the retro' }],
      snoozes: [{ rule: 'oneOnOne', until: '2026-06-01', reason: 'Parental leave' }]
    })], [], { evidenceCategories: ['Leadership', 'Ownership'] }),
    expect(r, t) {
      const p = byName(r, 'Rosa Lindgren');
      t.equal(p.evidence.map((e) => [e.date, e.category, e.summary]), [['2026-04-02', 'Leadership', 'Ran the retro']], 'evidence is kept');
      t.equal(r.saved.settings.evidenceCategories, ['Leadership', 'Ownership'], 'evidence categories are kept');
      t.equal(r.saved.settings.promotionConversationMonths, 24, 'promotion conversation months get the default');
    }
  },
  {
    version: 5,
    label: 'schema v5',
    doc: eventDoc(5, [basePerson('p_001', 'Sami Okafor')], [], { promotionConversationMonths: 18 }),
    expect(r, t) {
      t.equal(r.saved.settings.promotionConversationMonths, 18, 'promotion conversation months are kept');
      t.equal(r.saved.settings.themesWindowDays, 90, 'themes window gets the default');
    }
  },
  {
    version: 6,
    label: 'schema v6 (weekly snapshots)',
    doc: { ...eventDoc(6, [basePerson('p_001', 'Tove Aalto')], [], { themesWindowDays: 60 }), weeklySnapshots: [{ weekStart: '2026-04-27', score: 70 }] },
    expect(r, t) {
      t.check(!('weeklySnapshots' in r.saved), 'weekly snapshots are removed');
      t.equal(r.saved.settings.themesWindowDays, 60, 'themes window is kept');
    }
  },
  {
    version: 7,
    label: 'schema v7',
    doc: eventDoc(7, [basePerson('p_001', 'Uma Castell', { supportLevel: 'Support needed' })], [meeting('p_001', 'mtg_001', '2026-03-02', 'CV review')]),
    expect(r, t) {
      const p = byName(r, 'Uma Castell');
      t.equal(p.supportLevel, 'Support needed', 'support level is kept');
      t.equal(p.meetings.map((m) => m.meetingType), ['CV review'], 'CV review meeting is kept');
    }
  },
  {
    version: 8,
    label: 'schema v8 (date driven PDC status)',
    doc: eventDoc(8, [
      basePerson('p_001', 'Vera Nyman', { pdcStatus: '' }),
      basePerson('p_002', 'Wim Dekker', { pdcStatus: '', nextPdcDate: '2026-06-10' }),
      basePerson('p_003', 'Xenia Pohl', { pdcStatus: '', hireDate: '2020-01-01' }),
      basePerson('p_004', 'Yusuf Kaya', { pdcStatus: 'Blocked' })
    ], [meeting('p_001', 'mtg_001', '2026-04-13', 'PDC'), meeting('p_003', 'mtg_002', '2025-06-02', 'PDC')]),
    expect(r, t) {
      t.equal(r.reports.map((p) => [p.name, p.pdcStatus]).sort(), [
        ['Vera Nyman', 'Completed'], ['Wim Dekker', 'In progress'], ['Xenia Pohl', 'Needs review'], ['Yusuf Kaya', 'Blocked']
      ].sort(), 'the PDC status each person showed is kept');
    }
  },
  {
    version: 9,
    label: 'schema v9 (agenda and goal summary text)',
    doc: eventDoc(9, [basePerson('p_001', 'Zara Ekholm', { agenda: '', developmentGoalSummary: '' })], [
      { type: 'person_updated', personId: 'p_001', changes: { agenda: '[x] Review the onboarding plan\n- Conference budget', developmentGoalSummary: 'Lead a client workshop\nBefore the autumn planning cycle' }, createdAt: at('2026-04-20') }
    ]),
    expect(r, t) {
      const p = byName(r, 'Zara Ekholm');
      t.equal(p.talkingPoints.map((x) => [x.text, x.done]), [['Review the onboarding plan', true], ['Conference budget', false]], 'agenda lines become talking points');
      t.equal(p.goals.map((g) => [g.title, g.detail]), [['Lead a client workshop', 'Before the autumn planning cycle']], 'goal summary becomes a goal');
      t.check(r.saved.events.every((e) => !(e.changes && ('agenda' in e.changes || 'developmentGoalSummary' in e.changes)) || (!e.changes.agenda && !e.changes.developmentGoalSummary)),
        'old agenda text is removed from the event log');
    }
  },
  {
    version: 10,
    label: 'schema v10 (initials in the name)',
    doc: eventDoc(10, [basePerson('p_001', 'Tessa Quill (TEQU)'), basePerson('p_002', 'Ivo Marsh')]),
    expect(r, t) {
      t.equal(r.reports.map((p) => [p.name, p.initials]).sort(), [['Ivo Marsh', ''], ['Tessa Quill', 'TEQU']], 'initials move out of the name');
      t.check(r.saved.events.every((e) => !e.snapshot || !/\(TEQU\)/.test(e.snapshot.name)), 'the old name form is removed from the event log');
    }
  },
  {
    version: 11,
    label: 'schema v11 (no capabilities)',
    doc: eventDoc(11, [basePerson('p_001', 'Lena Varga', { initials: 'LEVA' })]),
    expect(r, t) {
      const p = byName(r, 'Lena Varga');
      t.equal(p.capabilities, [], 'capabilities start empty');
      t.equal(p.initials, 'LEVA', 'initials are kept');
    }
  },
  {
    version: 12,
    label: 'schema v12 (current)',
    doc: eventDoc(12, [basePerson('p_001', 'Mika Soren', { initials: 'MISO', capabilities: [{ id: 'unknown-capability', achievedAt: '2026-03-03' }] })],
      [meeting('p_001', 'mtg_001', '2026-05-12', '1:1', 'Current format')], { lastPdcRoundKey: '2026-R2' }),
    expect(r, t) {
      t.equal(r.loadedSchemaVersion, 12, 'loads as v12 without a migration');
      const p = byName(r, 'Mika Soren');
      t.equal(p.meetings.map((m) => m.notes), ['Current format'], 'meeting is kept');
      t.equal(p.capabilities.map((c) => c.achievedAt), ['2026-03-03'], 'capability date is kept');
    }
  }
];

module.exports.TODAY = T;
