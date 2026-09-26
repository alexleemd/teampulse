function thresholdKeyForMeetingType(type) {
  const meetingType = canonicalMeetingType(type);
  if (meetingType === '1:1') return 'oneOnOneDays';
  if (meetingType === 'PDC') return 'pdcDays';
  return 'cvReviewDays';
}

function effectiveThreshold(report, type, settings = app.doc?.settings || { thresholds: DEFAULT_THRESHOLDS }) {
  const key = thresholdKeyForMeetingType(type);
  const overrides = normalizeCadenceOverrides(report?.cadenceOverrides || {});
  return overrides[key] || settings.thresholds[key] || DEFAULT_THRESHOLDS[key];
}

function thresholdSourceLabel(report, type, settings = app.doc?.settings || { thresholds: DEFAULT_THRESHOLDS }) {
  const key = thresholdKeyForMeetingType(type);
  const overrides = normalizeCadenceOverrides(report?.cadenceOverrides || {});
  return overrides[key] ? 'custom' : 'team';
}

function addDays(dateString, days) {
  const text = normalizeDate(dateString);
  if (!text) return '';
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatVacationRange(vacation) {
  if (!vacation) return '';
  const start = normalizeDate(vacation.startDate);
  const end = normalizeDate(vacation.endDate);
  if (!start && !end) return '';
  if (!end || start === end) return formatDate(start || end);
  return `${formatDate(start)} → ${formatDate(end)}`;
}

function isDateWithinVacation(dateString, vacation) {
  const date = normalizeDate(dateString);
  const start = normalizeDate(vacation?.startDate);
  const end = normalizeDate(vacation?.endDate);
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

function findVacationForDate(report, dateString) {
  return normalizeVacationEntries(report?.vacations || []).find((vacation) => isDateWithinVacation(dateString, vacation)) || null;
}

function getVacationStatus(report, referenceDate = todayStamp()) {
  const vacations = normalizeVacationEntries(report?.vacations || []);
  const current = vacations.find((vacation) => isDateWithinVacation(referenceDate, vacation)) || null;
  const upcoming = vacations.filter((vacation) => normalizeDate(vacation.startDate) >= referenceDate).sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))[0] || null;
  return {
    vacations,
    active: !!current,
    current,
    upcoming: !current && !!upcoming,
    next: current ? null : upcoming
  };
}

function vacationBackDate(vacation) {
  return vacation?.endDate ? addDays(vacation.endDate, 1) : '';
}

function serializeCadenceOverrides(overrides = {}) {
  const normalized = normalizeCadenceOverrides(overrides);
  const parts = [];
  if (normalized.oneOnOneDays) parts.push(`1:1 ${normalized.oneOnOneDays}d`);
  if (normalized.pdcDays) parts.push(`PDC ${normalized.pdcDays}d`);
  if (normalized.cvReviewDays) parts.push(`CV ${normalized.cvReviewDays}d`);
  return parts.join(' | ');
}

function serializeVacations(vacations = []) {
  return normalizeVacationEntries(vacations).map((vacation) => {
    const range = [vacation.startDate, vacation.endDate].filter(Boolean).join(' to ');
    return vacation.note ? `${range} (${vacation.note})` : range;
  }).join(' | ');
}

function serializeSnoozes(snoozes = []) {
  return normalizeSnoozeEntries(snoozes).map((entry) => `${snoozeRuleLabel(entry.rule)} until ${entry.until}${entry.reason ? ` (${entry.reason})` : ''}`).join(' | ');
}

function serializeEvidence(evidence = []) {
  return normalizeEvidenceEntries(evidence).map((entry) => [entry.date, entry.category, entry.summary].filter(Boolean).join(' · ')).join(' | ');
}

function parseLocalDate(dateString) {
  const text = normalizeDate(dateString);
  if (!text) return null;
  const [year, month, day] = text.split('-').map((value) => Number.parseInt(value, 10));
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthsBetween(fromDateStr, toDate = new Date()) {
  const from = parseLocalDate(fromDateStr);
  if (!from) return null;
  const safeTo = toDate instanceof Date
    ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())
    : parseLocalDate(toDate);
  if (!safeTo || Number.isNaN(safeTo.getTime())) return null;
  let months = (safeTo.getFullYear() - from.getFullYear()) * 12 + (safeTo.getMonth() - from.getMonth());
  if (safeTo.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

function formatMonthSpan(totalMonths, options = {}) {
  if (totalMonths === null || totalMonths === undefined || !Number.isFinite(Number(totalMonths))) return '';
  const safeMonths = Math.max(0, Number(totalMonths));
  const years = Math.floor(safeMonths / 12);
  const months = safeMonths % 12;
  if (options.compact) {
    const parts = [];
    if (years) parts.push(`${years}y`);
    if (months || !parts.length) parts.push(`${months}m`);
    return parts.join(' ');
  }
  const parts = [];
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (months || !parts.length) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  return parts.join(', ');
}

function localDateStamp(date) {
  const safe = date instanceof Date ? date : null;
  if (!safe || Number.isNaN(safe.getTime())) return '';
  return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, '0')}-${String(safe.getDate()).padStart(2, '0')}`;
}

function isoToLocalDateStamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return localDateStamp(date);
}

function startOfCurrentWeek(referenceDate = new Date()) {
  const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  date.setHours(0, 0, 0, 0);
  return date;
}

function weekRangeLabel(weekStart, weekEnd) {
  const start = formatDate(localDateStamp(weekStart));
  const end = formatDate(localDateStamp(weekEnd));
  return weekStart.getMonth() === weekEnd.getMonth() ? `${start} to ${end}` : `${start} to ${end}`;
}

function latestInteractionDate(report) {
  return [...(report.meetings || [])].map((meeting) => normalizeDate(meeting.meetingDate)).filter(Boolean).sort().pop() || '';
}

function extractFollowUps(report) {
  const results = [];
  (report?.meetings || []).forEach((meeting) => {
    String(meeting.notes || '').split('\n').forEach((line, lineIndex) => {
      const match = line.match(/^\s*\[(x|X| )?\]\s+(.+)$/);
      if (!match) return;
      results.push({
        meetingId: meeting.id,
        meetingType: canonicalMeetingType(meeting.meetingType),
        meetingDate: normalizeDate(meeting.meetingDate) || '',
        lineIndex,
        done: !!match[1] && match[1].toLowerCase() === 'x',
        text: normalizeText(match[2])
      });
    });
  });
  return results.sort((a, b) => String(b.meetingDate).localeCompare(String(a.meetingDate)) || String(a.text).localeCompare(String(b.text)));
}

function latestMeeting(report, type) {
  return (report?.meetings || []).find((meeting) => canonicalMeetingType(meeting.meetingType) === canonicalMeetingType(type)) || null;
}

function firstMeaningfulLine(value) {
  return String(value || '').split('\n').map((line) => stripMarkdownLineToText(line)).find(Boolean) || '';
}

function formatValueForSummary(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const date = normalizeDate(text);
  return date ? formatDate(date) : text;
}

function customFieldComparisonKey(field = {}) {
  return normalizeText(field.id) || normalizeText(field.label).toLowerCase();
}



function reportHasActiveVacation(report) {
  return getVacationStatus(report).active;
}


