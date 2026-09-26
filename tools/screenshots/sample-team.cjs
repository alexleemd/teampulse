// Fictional Team Pulse document, schema v12, deterministic (no randomness).
// TODAY must match the frozen clock used by the test.
const TODAY = '2026-05-13';

function addDays(stamp, days) {
  const d = new Date(`${stamp}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const iso = (stamp, hh = '09') => `${stamp}T${hh}:00:00.000Z`;

let evt = 0, mtg = 0, note = 0;
const nextEvt = () => `evt_${String(++evt).padStart(3, '0')}`;
const nextMtg = () => `mtg_${String(++mtg).padStart(3, '0')}`;
const nextNote = () => `note_${String(++note).padStart(3, '0')}`;

const people = [
  {
    id: 'p_001', name: 'Avery Lindqvist', initials: 'AVLI', level: 'Consultant (Skilled)', mentors: 'Jordan Pike',
    hireDate: '2022-03-14', lastPromotionDate: '2024-01-01', nextOneOnOneDate: addDays(TODAY, 6), nextPdcDate: addDays(TODAY, 20),
    pdcStatus: 'In progress', supportLevel: 'Good', promotionReadiness: 'Strong analytical depth. Next step is owning client steering updates.',
    notes: 'Wants more exposure to proposal work. Check workload balance before the summer.',
    talkingPoints: [
      { id: 'tp_001', text: 'Feedback on the steering deck dry run', createdAt: iso(addDays(TODAY, -20)), done: false, doneAt: '', meetingId: '' },
      { id: 'tp_002', text: 'Proposal shadowing opportunity', createdAt: iso(addDays(TODAY, -3)), done: false, doneAt: '', meetingId: '' },
      { id: 'tp_003', text: 'Conference budget', createdAt: iso(addDays(TODAY, -40)), done: true, doneAt: iso(addDays(TODAY, -35)), meetingId: '' }
    ],
    goals: [
      { id: 'goal_001', title: 'Lead a validation deliverable end to end', detail: 'Own the plan, the review cycle, and the client sign off.', status: 'On track', targetDate: addDays(TODAY, 90), progress: 55, createdAt: iso('2026-01-10'),
        updates: [ { id: 'gu_001', date: '2026-02-12', text: 'Plan agreed with the PM', progress: 25 }, { id: 'gu_002', date: '2026-04-15', text: 'First review cycle done', progress: 55 } ] },
      { id: 'goal_002', title: 'Present at the internal knowledge session', detail: '', status: 'Done', targetDate: '2026-03-30', progress: 100, createdAt: iso('2026-01-11'), updates: [] }
    ],
    cadenceOverrides: {}, vacations: [ { id: 'vac_001', startDate: addDays(TODAY, 30), endDate: addDays(TODAY, 44), note: 'Summer leave' } ], snoozes: [],
    evidence: [
      { id: 'ev_001', date: addDays(TODAY, -18), category: 'Client relationship', kind: 'praise', shared: true, summary: 'Client lead praised the workshop facilitation', detail: 'Kept the session on time and captured every decision.', linkedMeetingId: '' },
      { id: 'ev_002', date: addDays(TODAY, -45), category: 'Technical depth', kind: 'observation', shared: false, summary: 'Found the root cause of the data mismatch', detail: '', linkedMeetingId: '' }
    ],
    capabilities: [ { id: 'cs-e1', achievedAt: '2025-11-04' }, { id: 'cs-e2', achievedAt: '2026-02-20' }, { id: 'cs-q1', achievedAt: '2026-04-02' } ],
    customFields: [], createdAt: iso('2025-06-01')
  },
  {
    id: 'p_002', name: 'Bruno Okafor', initials: 'BROK', level: 'Senior (Developing)', mentors: '',
    hireDate: '2019-09-02', lastPromotionDate: '2023-04-01', nextOneOnOneDate: '', nextPdcDate: addDays(TODAY, -5),
    pdcStatus: 'Blocked', supportLevel: 'Support needed', promotionReadiness: 'Ready on delivery. Needs a clearer business development track record.',
    notes: 'Heavy allocation across two clients. Workload is the recurring topic.',
    talkingPoints: [ { id: 'tp_004', text: 'Workload across both clients', createdAt: iso(addDays(TODAY, -30)), done: false, doneAt: '', meetingId: '' } ],
    goals: [ { id: 'goal_003', title: 'Co-author one statement of work', detail: 'Pair with the account lead on the next extension.', status: 'At risk', targetDate: addDays(TODAY, 40), progress: 20, createdAt: iso('2026-01-15'), updates: [ { id: 'gu_003', date: '2026-03-01', text: 'Blocked by client freeze', progress: 20 } ] } ],
    cadenceOverrides: {}, vacations: [], snoozes: [],
    evidence: [ { id: 'ev_003', date: addDays(TODAY, -60), category: 'Leadership', kind: 'growth', shared: true, summary: 'Delegate earlier in the sprint', detail: 'Took on the migration scripts alone again.', linkedMeetingId: '' } ],
    capabilities: [ { id: 'sd-pl', achievedAt: '2025-09-15' } ],
    customFields: [], createdAt: iso('2025-06-01')
  },
  {
    id: 'p_003', name: 'Chiara Valdes', initials: 'CHVA', level: 'Consultant (Developing)', mentors: 'Rowan Ellis',
    hireDate: '2025-08-18', lastPromotionDate: '', nextOneOnOneDate: addDays(TODAY, 3), nextPdcDate: '',
    pdcStatus: 'Not started', supportLevel: 'Monitor', promotionReadiness: '',
    notes: 'Settling in well. Onboarding buddy check in monthly.',
    talkingPoints: [], goals: [],
    cadenceOverrides: { oneOnOneDays: 10 }, vacations: [ { id: 'vac_002', startDate: addDays(TODAY, -2), endDate: addDays(TODAY, 8), note: 'Family trip' } ], snoozes: [],
    evidence: [], capabilities: [ { id: 'cd-b1', achievedAt: '2025-10-01' }, { id: 'cd-b2', achievedAt: '2025-12-12' } ],
    customFields: [], createdAt: iso('2025-08-18')
  },
  {
    id: 'p_004', name: 'Dmitri Haugen', initials: 'DMHA', level: 'Senior (Proficient)', mentors: 'Sam Whitlow',
    hireDate: '2016-01-11', lastPromotionDate: '2025-01-01', nextOneOnOneDate: addDays(TODAY, 1), nextPdcDate: '',
    pdcStatus: 'Completed', supportLevel: 'Good', promotionReadiness: 'At the top of the band. Discuss principal track.',
    notes: '', talkingPoints: [ { id: 'tp_005', text: 'Principal track expectations', createdAt: iso(addDays(TODAY, -2)), done: false, doneAt: '', meetingId: '' } ],
    goals: [ { id: 'goal_004', title: 'Coach two consultants through their first lead role', detail: '', status: 'On track', targetDate: '', progress: 70, createdAt: iso('2025-12-01'), updates: [] } ],
    cadenceOverrides: {}, vacations: [], snoozes: [],
    evidence: [ { id: 'ev_004', date: addDays(TODAY, -9), category: 'Leadership', kind: 'praise', shared: false, summary: 'Handled the steering committee escalation calmly', detail: '', linkedMeetingId: '' } ],
    capabilities: [ { id: 'sp-pl', achievedAt: '2025-06-01' }, { id: 'sp-tl', achievedAt: '2025-09-01' }, { id: 'sp-cr', achievedAt: '2026-01-20' } ],
    customFields: [], createdAt: iso('2025-06-01')
  },
  {
    id: 'p_005', name: 'Esme Tanaka-Reid', initials: 'ESTA', level: 'Consultant (Proficient)', mentors: 'Jordan Pike',
    hireDate: '2020-06-01', lastPromotionDate: '2023-10-01', nextOneOnOneDate: '', nextPdcDate: addDays(TODAY, 9),
    pdcStatus: 'Needs review', supportLevel: 'Urgent', promotionReadiness: 'On hold while workload settles.',
    notes: 'Signs of fatigue. Agreed to revisit workload every week for now.',
    talkingPoints: [ { id: 'tp_006', text: 'Weekly workload check', createdAt: iso(addDays(TODAY, -8)), done: false, doneAt: '', meetingId: '' } ],
    goals: [ { id: 'goal_005', title: 'Hand over the reporting track', detail: '', status: 'Paused', targetDate: addDays(TODAY, 60), progress: 10, createdAt: iso('2026-02-01'), updates: [] } ],
    cadenceOverrides: {}, vacations: [], snoozes: [],
    evidence: [], capabilities: [ { id: 'cp-d1', achievedAt: '2025-05-05' } ],
    customFields: [], createdAt: iso('2025-06-01')
  },
  {
    id: 'p_006', name: 'Farid Nasser', initials: '', level: 'Senior (Skilled)', mentors: 'Sam Whitlow',
    hireDate: '2018-02-19', lastPromotionDate: '2024-07-01', nextOneOnOneDate: '', nextPdcDate: '',
    pdcStatus: 'In progress', supportLevel: 'Good', promotionReadiness: '',
    notes: 'On a long client assignment abroad. 1:1s are monthly by agreement.',
    talkingPoints: [], goals: [],
    cadenceOverrides: { oneOnOneDays: 30 }, vacations: [],
    snoozes: [ { rule: 'cvReviewOverdue', until: addDays(TODAY, 30), reason: 'CV refresh after the assignment' } ],
    evidence: [], capabilities: [],
    customFields: [], createdAt: iso('2025-06-01')
  }
];

// Meetings: [personId, daysAgo, type, pulse, duration, notes]
const meetings = [
  ['p_001', 6, '1:1', 'green', 45, 'Steering deck review\n[] Send the revised deck to the PM\n[x] Book the dry run room\nWorkload feels balanced.'],
  ['p_001', 20, '1:1', 'green', 30, 'Proposal work discussed. Interested in shadowing.\n[] Ask the account lead about the next proposal'],
  ['p_001', 34, '1:1', 'amber', 30, 'Tight deadline on the validation plan. Workload spiked.'],
  ['p_001', 48, 'PDC', 'green', 60, '### Wins since last PDC\n- Workshop facilitation\n### Focus for next period\n- Validation deliverable'],
  ['p_001', 62, '1:1', 'green', 30, 'Conference budget approved.'],
  ['p_001', 120, 'CV review', '', 30, 'CV refreshed with the validation work.'],
  ['p_002', 25, '1:1', 'amber', 30, 'Workload across both clients is high. Client freeze blocks the SoW goal.\n[] Talk to the account lead about allocation'],
  ['p_002', 41, '1:1', 'red', 45, 'Frustrated with the migration scripts. Workload discussion again.\n[] Pair on delegation plan'],
  ['p_002', 130, 'PDC', 'amber', 60, 'Delivery strong. Business development still thin.'],
  ['p_003', 9, '1:1', 'green', 30, 'Onboarding going well. Workload fine. Asked about the validation training.\n[] Share the validation training link'],
  ['p_003', 19, '1:1', 'green', 30, 'First client meeting went well.'],
  ['p_004', 12, '1:1', 'green', 30, 'Principal track conversation. Coaching both consultants.'],
  ['p_004', 40, 'PDC', 'green', 60, 'Completed PDC. Principal track next.'],
  ['p_004', 70, 'CV review', '', 30, 'CV current.'],
  ['p_005', 8, '1:1', 'red', 45, 'Fatigue and workload. Agreed weekly check.\n[] Rebalance the reporting track\n[] Check in on Friday'],
  ['p_005', 22, '1:1', 'amber', 30, 'Workload rising. Validation plan slipping.'],
  ['p_005', 100, 'PDC', 'green', 60, 'Good progress before the new client.'],
  ['p_006', 26, '1:1', 'green', 30, 'Assignment abroad going well. Monthly cadence agreed.'],
  ['p_006', 55, 'PDC', 'green', 45, 'Working toward project leadership on the new client.'],
];

const events = [];
people.forEach((p) => {
  events.push({ id: nextEvt(), type: 'person_created', personId: p.id, snapshot: { ...p, supportLevel: p.id === 'p_005' ? 'Monitor' : p.supportLevel }, createdAt: p.createdAt });
});
// Change history for the timeline and the health trend.
events.push({ id: nextEvt(), type: 'person_updated', personId: 'p_005', changes: { supportLevel: 'Urgent' }, createdAt: iso(addDays(TODAY, -21)) });
people.find((p) => p.id === 'p_005').supportLevel = 'Monitor'; // base record holds the old value; the event moves it to Urgent
meetings.forEach(([personId, ago, type, pulse, duration, notes]) => {
  const date = addDays(TODAY, -ago);
  events.push({ id: nextEvt(), type: 'meeting_logged', personId, meetingId: nextMtg(), meetingType: type, meetingDate: date, durationMinutes: duration, notes, pulse, source: 'manual', externalUid: '', createdAt: iso(date, '15') });
});
people.forEach((p) => {
  if (!p.notes) return;
  events.push({ id: nextEvt(), type: 'note_added', personId: p.id, noteId: nextNote(), noteDate: addDays(TODAY, -15), noteText: p.notes, source: 'workspace', createdAt: iso(addDays(TODAY, -15), '16') });
});

const doc = {
  schemaVersion: 12,
  appVersion: 'v0.52.4',
  createdAt: iso('2025-06-01'),
  savedAt: iso(TODAY, '08'),
  idCounters: {},
  people,
  events,
  settings: {
    thresholds: { oneOnOneDays: 14, pdcDays: 90, cvReviewDays: 180 },
    missingMentorCounts: true,
    blockedPdcCounts: true,
    evidenceCategories: ['Leadership', 'Technical depth', 'Client relationship', 'Autonomy', 'Collaboration', 'Ownership', 'Growth'],
    promotionConversationMonths: 24,
    themesWindowDays: 90,
    lastExportDate: iso(addDays(TODAY, -20)),
    stableMode: true,
    latestExportFiles: [],
    pulseTrendCounts: true,
    density: 'comfortable',
    pdcRoundAutoReset: true,
    pdcRoundStartMonth: 1,
    lastPdcRoundKey: '2026-R2'
  }
};

module.exports = { TODAY, doc };
if (require.main === module) process.stdout.write(JSON.stringify(doc, null, 2));
