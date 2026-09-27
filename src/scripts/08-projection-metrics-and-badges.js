// Builds the reports, the report map and the metrics from the event log.
// Pass { normalized: true } when doc has just come out of ensureDocShape, so
// the document is not deep copied and normalized a second time. projectDoc
// only reads the document, it never changes it.
function projectDoc(doc, options = {}) {
  const workingDoc = options.normalized ? doc : ensureDocShape(doc);
  const reportMap = new Map();

  workingDoc.people.forEach((person) => {
    reportMap.set(person.id, {
      ...deepCopy(person),
      meetings: [],
      notesHistory: [],
      changeLog: [],
      archived: false,
      updatedAt: person.createdAt
    });
  });

  workingDoc.events.forEach((event) => {
    const type = event.type;
    if (type === 'person_created') {
      if (!reportMap.has(event.personId)) {
        reportMap.set(event.personId, {
          ...deepCopy(event.snapshot || {}),
          id: event.personId,
          meetings: [],
          notesHistory: [],
          changeLog: [],
          archived: false,
          updatedAt: event.createdAt
        });
      }
      return;
    }

    const report = reportMap.get(event.personId);
    if (!report) return;

    if (type === 'person_updated') {
      const changes = event.changes || {};
      const TRACKED_CHANGE_FIELDS = { level: 'Level', supportLevel: 'Support level', pdcStatus: 'PDC status' };
      Object.keys(TRACKED_CHANGE_FIELDS).forEach((field) => {
        if (!(field in changes)) return;
        const from = normalizeText(report[field]);
        const to = normalizeText(changes[field]);
        if (from === to) return;
        if (!Array.isArray(report.changeLog)) report.changeLog = [];
        report.changeLog.push({
          date: localDateOf(event.createdAt) || todayStamp(),
          createdAt: event.createdAt,
          field: TRACKED_CHANGE_FIELDS[field],
          from,
          to
        });
      });
      Object.assign(report, deepCopy(changes));
      report.updatedAt = event.createdAt;
      return;
    }

    if (type === 'note_added') {
      report.notes = normalizeText(event.noteText);
      report.notesHistory.push({
        noteId: event.noteId,
        noteDate: event.noteDate,
        noteText: normalizeText(event.noteText),
        source: event.source || 'workspace',
        createdAt: event.createdAt
      });
      report.updatedAt = event.createdAt;
      return;
    }

    if (type === 'meeting_logged') {
      const meeting = {
        id: event.meetingId,
        eventId: event.id,
        meetingType: canonicalMeetingType(event.meetingType),
        meetingDate: normalizeDate(event.meetingDate) || todayStamp(),
        durationMinutes: event.durationMinutes,
        notes: normalizeText(event.notes),
        pulse: normalizePulse(event.pulse),
        source: normalizeText(event.source) || 'manual',
        externalUid: normalizeText(event.externalUid),
        createdAt: event.createdAt
      };
      report.meetings.push(meeting);
      report.updatedAt = event.createdAt;
      return;
    }

    if (type === 'meeting_deleted') {
      report.meetings = report.meetings.filter((meeting) => meeting.id !== event.meetingId);
      report.updatedAt = event.createdAt;
      return;
    }

    if (type === 'person_archived') {
      report.archived = true;
      report.updatedAt = event.createdAt;
    }
  });

  const reports = [...reportMap.values()]
    .filter((report) => !report.archived)
    .map((report) => {
      const meetings = [...report.meetings].sort((a, b) => String(b.meetingDate).localeCompare(String(a.meetingDate)) || String(b.createdAt).localeCompare(String(a.createdAt)));
      const notesHistory = [...report.notesHistory].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return {
        ...report,
        cadenceOverrides: normalizeCadenceOverrides(report.cadenceOverrides),
        vacations: normalizeVacationEntries(report.vacations),
        snoozes: normalizeSnoozeEntries(report.snoozes),
        evidence: normalizeEvidenceEntries(report.evidence),
        capabilities: normalizeCapabilityTicks(report.capabilities),
        talkingPoints: normalizeTalkingPoints(report.talkingPoints),
        goals: normalizeGoals(report.goals),
        changeLog: [...(report.changeLog || [])].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
        customFields: Array.isArray(report.customFields) ? report.customFields.map((field) => normalizeCustomField(field)).filter((field) => field.id || field.label || field.value) : [],
        meetings,
        notesHistory,
        pdcStatus: normalizePdcStatus(report.pdcStatus),
        supportLevel: normalizeSupportLevel(report.supportLevel)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const metrics = new Map();
  reports.forEach((report) => {
    const reportMetrics = buildReportMetrics(report, workingDoc.settings);
    report.rawPdcStatus = normalizePdcStatus(report.pdcStatus);
    report.pdcStatus = reportMetrics.pdcStatus;
    metrics.set(report.id, reportMetrics);
  });

  return { reports, reportMap: new Map(reports.map((report) => [report.id, report])), metrics };
}

function getReports() {
  return app.projections.reports;
}

function getReportById(id) {
  return app.projections.reportMap.get(id) || null;
}

function getMetrics(id) {
  return app.projections.metrics.get(id) || {
    lastOneOnOne: '',
    lastPdc: '',
    lastCvReview: '',
    lastInteraction: '',
    oneOnOneOverdue: false,
    oneOnOneDueInDays: null,
    pdcOverdue: false,
    cvReviewOverdue: false,
    pdcStatus: PDC_STATUSES[0],
    attention: [],
    attentionDetails: [],
    activeSnoozes: [],
    snoozedAttentionCount: 0,
    snoozedAll: false,
    followUps: [],
    openFollowUps: [],
    vacationStatus: { active: false, current: null, upcoming: false, next: null },
    thresholds: { oneOnOneDays: DEFAULT_THRESHOLDS.oneOnOneDays, pdcDays: DEFAULT_THRESHOLDS.pdcDays, cvReviewDays: DEFAULT_THRESHOLDS.cvReviewDays },
    pulseSeries: [],
    pulseTrendDown: false,
    goals: [],
    primaryGoal: null,
    openTalkingPoints: []
  };
}

function latestMeetingDate(report, type) {
  return report.meetings.find((meeting) => canonicalMeetingType(meeting.meetingType) === canonicalMeetingType(type))?.meetingDate || '';
}

function isMissingTouchpointOverdue(report, lastDate, thresholdDays) {
  if (lastDate) {
    const age = dateDiffInDays(lastDate);
    return age === null ? true : age > thresholdDays;
  }
  if (report.hireDate) {
    const hireAge = dateDiffInDays(report.hireDate);
    return hireAge === null ? true : hireAge > thresholdDays;
  }
  return true;
}

function derivePdcStatus(report, context = {}) {
  // v0.42: PDC status is fully manual, classic kanban. A card sits exactly
  // where the user put it (board drag, card menu, or the Development tab
  // select) and never moves on its own. Dates now inform instead of decide:
  // they surface as chips on board cards and keep powering the attention
  // rules, but they no longer override the stored status. The v8->v9
  // migration baked each person's previously displayed status into the
  // stored field so nothing jumped at upgrade.
  return normalizePdcStatus(report.pdcStatus);
}

function buildReportMetrics(report, settings) {
  const thresholds = {
    oneOnOneDays: effectiveThreshold(report, '1:1', settings),
    pdcDays: effectiveThreshold(report, 'PDC', settings),
    cvReviewDays: effectiveThreshold(report, 'CV review', settings)
  };
  const lastOneOnOne = latestMeetingDate(report, '1:1');
  const lastPdc = latestMeetingDate(report, 'PDC');
  const lastCvReview = latestMeetingDate(report, 'CV review');
  const rawOneOnOneOverdue = isMissingTouchpointOverdue(report, lastOneOnOne, thresholds.oneOnOneDays);
  const rawPdcOverdue = isMissingTouchpointOverdue(report, lastPdc, thresholds.pdcDays);
  const rawCvReviewOverdue = isMissingTouchpointOverdue(report, lastCvReview, thresholds.cvReviewDays);
  const vacationStatus = getVacationStatus(report);
  const cadenceSuppressed = vacationStatus.active;
  const activeSnoozes = activeSnoozeEntries(report);
  const snoozedRules = new Set(activeSnoozes.map((entry) => entry.rule));
  const snoozedAll = snoozedRules.has('all');
  const oneOnOneOverdue = cadenceSuppressed ? false : (!snoozedAll && !snoozedRules.has('oneOnOneOverdue') && rawOneOnOneOverdue);
  const pdcOverdue = cadenceSuppressed ? false : (!snoozedAll && !snoozedRules.has('developmentOverdue') && rawPdcOverdue);
  const cvReviewOverdue = cadenceSuppressed ? false : (!snoozedAll && !snoozedRules.has('cvReviewOverdue') && rawCvReviewOverdue);
  const pdcStatus = derivePdcStatus(report, { lastPdc, pdcOverdue: rawPdcOverdue });
  const followUps = extractFollowUps(report);
  const openFollowUps = followUps.filter((item) => !item.done);
  const potentialAttention = [];
  if (settings.missingMentorCounts && !report.mentors) potentialAttention.push({ rule: 'noMentor', label: 'No mentor assigned' });
  if (!cadenceSuppressed && rawOneOnOneOverdue) potentialAttention.push({ rule: 'oneOnOneOverdue', label: '1:1 overdue' });
  if (!cadenceSuppressed && rawPdcOverdue) potentialAttention.push({ rule: 'developmentOverdue', label: 'PDC overdue' });
  if (!cadenceSuppressed && rawCvReviewOverdue) potentialAttention.push({ rule: 'cvReviewOverdue', label: 'CV review overdue' });
  if (settings.blockedPdcCounts && pdcStatus === 'Blocked') potentialAttention.push({ rule: 'blockedPlans', label: 'PDC status is blocked' });
  if (report.supportLevel === 'Support needed' || report.supportLevel === 'Urgent') potentialAttention.push({ rule: 'supportLevel', label: `Support level: ${report.supportLevel}` });
  if (report.nextOneOnOneDate && findVacationForDate(report, report.nextOneOnOneDate)) potentialAttention.push({ rule: 'oneOnOneDuringVacation', label: '1:1 planned during vacation' });
  if (report.nextPdcDate && findVacationForDate(report, report.nextPdcDate)) potentialAttention.push({ rule: 'pdcDuringVacation', label: 'PDC planned during vacation' });
  const pulseSeries = (report.meetings || [])
    .filter((meeting) => normalizePulse(meeting.pulse) && canonicalMeetingType(meeting.meetingType) !== 'CV review')
    .slice(0, 6)
    .map((meeting) => ({ meetingId: meeting.id, meetingDate: normalizeDate(meeting.meetingDate), meetingType: canonicalMeetingType(meeting.meetingType), pulse: normalizePulse(meeting.pulse) }));
  const recentPulses = pulseSeries.map((item) => item.pulse);
  const pulseTrendDown = recentPulses.length > 0 && (
    recentPulses[0] === 'red'
    || (recentPulses.length >= 2 && recentPulses[0] !== 'green' && recentPulses[1] !== 'green')
  );
  if (settings.pulseTrendCounts !== false && pulseTrendDown) potentialAttention.push({ rule: 'pulseTrend', label: '1:1 pulse trending down' });
  const goals = normalizeGoals(report.goals || []);
  const primaryGoal = goals.find((goal) => goal.status !== 'Done') || goals[0] || null;
  const openTalkingPoints = normalizeTalkingPoints(report.talkingPoints || []).filter((point) => !point.done);
  const attentionDetails = potentialAttention.filter((item) => !snoozedAll && !snoozedRules.has(item.rule));
  const attention = attentionDetails.map((item) => item.label);
  const snoozedAttentionCount = potentialAttention.length - attentionDetails.length;
  const daysSinceOneOnOne = lastOneOnOne ? dateDiffInDays(lastOneOnOne) : null;
  const oneOnOneDueInDays = daysSinceOneOnOne === null ? null : thresholds.oneOnOneDays - daysSinceOneOnOne;
  return {
    oneOnOneDueInDays,
    lastOneOnOne,
    lastPdc,
    lastCvReview,
    lastInteraction: latestInteractionDate(report),
    oneOnOneOverdue,
    pdcOverdue,
    cvReviewOverdue,
    rawOneOnOneOverdue,
    rawPdcOverdue,
    rawCvReviewOverdue,
    cadenceSuppressed,
    pdcStatus,
    attention,
    attentionDetails,
    activeSnoozes,
    snoozedAttentionCount,
    snoozedAll,
    followUps,
    openFollowUps,
    vacationStatus,
    thresholds,
    pulseSeries,
    pulseTrendDown,
    goals,
    primaryGoal,
    openTalkingPoints
  };
}

// Moss status tones. The returned names are tag tone classes styled in
// src/styles/04-moss-components.css: neutral, outline, good, amber, red,
// solid-good and solid-red.
function variantForPdcStatus(status) {
  return {
    'Not started': 'outline',
    'In progress': 'neutral',
    'Needs review': 'amber',
    'Blocked': 'red',
    'Completed': 'solid-good'
  }[status] || 'neutral';
}

function variantForSupport(flag) {
  return {
    'Good': 'good',
    'Monitor': 'neutral',
    'Support needed': 'red',
    'Urgent': 'solid-red'
  }[flag] || 'neutral';
}

function badge(label, variant = 'neutral') {
  return `<span class="badge ${variant}">${escapeHtml(label)}</span>`;
}

function attentionTone(issue) {
  if (issue.includes('Urgent')) return 'solid-red';
  if (issue.includes('blocked') || issue.includes('Support level')) return 'red';
  return 'amber';
}

