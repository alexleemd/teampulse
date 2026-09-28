function normalizeText(value) {
  return String(value ?? '').trim();
}

// Company-style person initials (e.g. AVLI, BROK): letters and digits only,
// uppercased, capped at 8 characters. Empty stays empty.
function normalizeInitials(value) {
  return normalizeText(value).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
}

// Avatar initials: the first letter of the first two words of the name,
// uppercased, "?" when there is none. Every avatar uses this one helper.
function personInitials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

// Splits a trailing parenthesized initials token off a name, the pattern used
// before initials became a first-class field ("Avery Lindqvist (AVLI)"). Returns
// { name, initials } with initials empty when the pattern does not match.
function splitLegacyInitialsFromName(rawName) {
  const name = normalizeText(rawName);
  const match = name.match(/^(.*\S)\s*\(([A-Za-z0-9]{2,8})\)$/);
  if (!match) return { name, initials: '' };
  return { name: normalizeText(match[1]), initials: normalizeInitials(match[2]) };
}

function normalizeLevel(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return LEVEL_ALIASES[text.toLowerCase()] || text;
}

function renderLevelSelectOptions(currentValue = '') {
  const normalized = normalizeLevel(currentValue);
  const options = [];
  options.push(`<option value="" ${normalized ? '' : 'selected'}>Select level</option>`);
  if (normalized && !LEVEL_OPTIONS.includes(normalized)) {
    options.push(`<option value="${escapeHtml(normalized)}" selected>${escapeHtml(`${normalized} (legacy)`)} </option>`.replace(' </option>', '</option>'));
  }
  LEVEL_OPTIONS.forEach((level) => {
    options.push(`<option value="${escapeHtml(level)}" ${level === normalized ? 'selected' : ''}>${escapeHtml(level)}</option>`);
  });
  return options.join('');
}

function normalizeDate(value) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function formatDate(dateString) {
  const text = normalizeDate(dateString);
  if (!text) return 'Not logged';
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Not logged' : FORMATTERS.longDate.format(date);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : FORMATTERS.dateTime.format(date);
}

function formatClock(date = new Date()) {
  return FORMATTERS.clock.format(date);
}

function formatSavedStamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${FORMATTERS.monthDay.format(date)} at ${formatClock(date)}`;
}

function formatManualSaveLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `Saved ${formatClock(date)}`;
}

function dateDiffInDays(dateString) {
  const text = normalizeDate(dateString);
  if (!text) return null;
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Round, not floor: a day across a daylight saving change is 23 or 25 hours.
  return Math.round((today - date) / 86400000);
}

function daysSinceIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  return Math.floor((now - date) / 86400000);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizePdcStatus(value) {
  const map = {
    'Plan status': PDC_STATUSES[0],
    'Development conversation': 'PDC',
    'Personal development conversation': 'PDC'
  };
  const normalized = map[normalizeText(value)] || normalizeText(value);
  return PDC_STATUSES.includes(normalized) ? normalized : PDC_STATUSES[0];
}

function normalizeSupportLevel(value) {
  const legacyMap = {
    'None': 'Good',
    'Watch': 'Monitor',
    'Needs attention': 'Support needed',
    'At risk': 'Support needed',
    'Critical': 'Urgent'
  };
  const normalized = legacyMap[normalizeText(value)] || normalizeText(value);
  return SUPPORT_LEVELS.includes(normalized) ? normalized : SUPPORT_LEVELS[0];
}

function canonicalMeetingType(value) {
  const normalized = normalizeText(value);
  if (!normalized) return '1:1';
  if (/^1[:\- ]?1$/i.test(normalized) || /one on one/i.test(normalized)) return '1:1';
  if (/^(pdc|personal development conversation|development conversation)$/i.test(normalized)) return 'PDC';
  if (/^cv review$/i.test(normalized)) return 'CV review';
  return MEETING_TYPES.includes(normalized) ? normalized : '1:1';
}

function normalizeCustomField(field, fallbackId = '') {
  const safe = field && typeof field === 'object' ? field : {};
  return {
    id: normalizeText(safe.id) || fallbackId,
    label: normalizeText(safe.label || safe.key),
    value: normalizeText(safe.value)
  };
}

function normalizeCadenceOverrides(overrides = {}) {
  const safe = overrides && typeof overrides === 'object' ? overrides : {};
  const normalized = {};
  const oneOnOneDays = safePositiveInteger(safe.oneOnOneDays, 0);
  const pdcDays = safePositiveInteger(safe.pdcDays || safe.developmentConversationDays, 0);
  const cvReviewDays = safePositiveInteger(safe.cvReviewDays, 0);
  if (oneOnOneDays > 0) normalized.oneOnOneDays = oneOnOneDays;
  if (pdcDays > 0) normalized.pdcDays = pdcDays;
  if (cvReviewDays > 0) normalized.cvReviewDays = cvReviewDays;
  return normalized;
}

function normalizeVacationEntry(entry = {}, fallbackId = '') {
  const safe = entry && typeof entry === 'object' ? entry : {};
  let startDate = normalizeDate(safe.startDate || safe.start || safe.from);
  let endDate = normalizeDate(safe.endDate || safe.end || safe.until);
  if (!startDate && endDate) startDate = endDate;
  if (!endDate && startDate) endDate = startDate;
  if (startDate && endDate && endDate < startDate) endDate = startDate;
  return {
    id: normalizeText(safe.id) || fallbackId,
    startDate,
    endDate,
    note: normalizeText(safe.note || safe.reason)
  };
}

function normalizeVacationEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizeVacationEntry(entry, normalizeText(entry?.id)))
    .filter((entry) => entry.startDate || entry.endDate || entry.note)
    .sort((a, b) => String(a.startDate || a.endDate || '').localeCompare(String(b.startDate || b.endDate || '')) || String(a.endDate || '').localeCompare(String(b.endDate || '')) || String(a.note || '').localeCompare(String(b.note || '')));
}

function normalizeEvidenceCategories(value = DEFAULT_EVIDENCE_CATEGORIES) {
  const rawItems = Array.isArray(value) ? value : String(value || '').split(/[\n,]+/g);
  const seen = new Set();
  const categories = [];
  rawItems.forEach((item) => {
    const text = normalizeText(item);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    categories.push(text);
  });
  return categories.length ? categories : [...DEFAULT_EVIDENCE_CATEGORIES];
}

function resolveEvidenceCategories(settings = app.doc?.settings || normalizeSettings({})) {
  return normalizeEvidenceCategories(settings?.evidenceCategories);
}

function normalizeFeedbackKind(value) {
  const normalized = normalizeText(value).toLowerCase();
  return FEEDBACK_KINDS.includes(normalized) ? normalized : 'observation';
}

function normalizePulse(value) {
  const normalized = normalizeText(value).toLowerCase();
  return PULSE_VALUES.includes(normalized) ? normalized : '';
}

function normalizeEvidenceEntry(entry = {}, fallbackId = '') {
  const safe = entry && typeof entry === 'object' ? entry : {};
  return {
    id: normalizeText(safe.id) || fallbackId,
    date: normalizeDate(safe.date || safe.evidenceDate),
    category: normalizeText(safe.category),
    kind: normalizeFeedbackKind(safe.kind),
    shared: !!safe.shared,
    summary: normalizeText(safe.summary),
    detail: normalizeText(safe.detail),
    linkedMeetingId: normalizeText(safe.linkedMeetingId || safe.meetingId)
  };
}

function normalizeTalkingPoint(point = {}, fallbackId = '') {
  const safe = point && typeof point === 'object' ? point : {};
  return {
    id: normalizeText(safe.id) || fallbackId,
    text: normalizeText(safe.text),
    createdAt: normalizeText(safe.createdAt) || nowIso(),
    done: !!safe.done,
    doneAt: normalizeText(safe.doneAt),
    meetingId: normalizeText(safe.meetingId)
  };
}

function normalizeTalkingPoints(points = []) {
  return (Array.isArray(points) ? points : [])
    .map((point) => normalizeTalkingPoint(point, normalizeText(point?.id)))
    .filter((point) => point.text)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function normalizeGoalUpdate(update = {}, fallbackId = '') {
  const safe = update && typeof update === 'object' ? update : {};
  const clamped = Math.max(0, Math.min(100, Math.round(Number(safe.progress))));
  return {
    id: normalizeText(safe.id) || fallbackId,
    date: normalizeDate(safe.date) || todayStamp(),
    text: normalizeText(safe.text),
    progress: Number.isFinite(clamped) ? clamped : 0
  };
}

function normalizeGoalStatus(value) {
  const normalized = normalizeText(value);
  return GOAL_STATUSES.includes(normalized) ? normalized : GOAL_STATUSES[0];
}

function normalizeGoal(goal = {}, fallbackId = '') {
  const safe = goal && typeof goal === 'object' ? goal : {};
  const clamped = Math.max(0, Math.min(100, Math.round(Number(safe.progress))));
  return {
    id: normalizeText(safe.id) || fallbackId,
    title: normalizeText(safe.title),
    detail: normalizeText(safe.detail),
    status: normalizeGoalStatus(safe.status),
    targetDate: normalizeDate(safe.targetDate),
    progress: Number.isFinite(clamped) ? clamped : 0,
    createdAt: normalizeText(safe.createdAt) || nowIso(),
    updates: (Array.isArray(safe.updates) ? safe.updates : [])
      .map((update, index) => normalizeGoalUpdate(update, normalizeText(update?.id) || `${normalizeText(safe.id) || fallbackId}_u${index + 1}`))
      .filter((update) => update.text || update.progress > 0)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)))
  };
}

function normalizeGoals(goals = []) {
  return (Array.isArray(goals) ? goals : [])
    .map((goal) => normalizeGoal(goal, normalizeText(goal?.id)))
    .filter((goal) => goal.title)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function primaryGoalOf(source) {
  const goals = normalizeGoals(source?.goals || []);
  return goals.find((goal) => goal.status !== 'Done') || goals[0] || null;
}

function normalizeEvidenceEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizeEvidenceEntry(entry, normalizeText(entry?.id)))
    .filter((entry) => entry.date || entry.category || entry.summary || entry.detail || entry.linkedMeetingId)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(a.category || '').localeCompare(String(b.category || '')) || String(a.summary || '').localeCompare(String(b.summary || '')));
}

function normalizeSnoozeRule(value) {
  const normalized = normalizeText(value).toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  const aliases = {
    all: 'all',
    allattentionitems: 'all',
    oneononeoverdue: 'oneOnOneOverdue',
    onetooneoverdue: 'oneOnOneOverdue',
    developmentoverdue: 'developmentOverdue',
    pdcoverdue: 'developmentOverdue',
    cvreviewoverdue: 'cvReviewOverdue',
    blockedplans: 'blockedPlans',
    blockedpdcstatus: 'blockedPlans',
    nomentor: 'noMentor',
    nomentorassigned: 'noMentor',
    supportlevel: 'supportLevel',
    oneononeduringvacation: 'oneOnOneDuringVacation',
    onetooneduringvacation: 'oneOnOneDuringVacation',
    oneononeplannedduringvacation: 'oneOnOneDuringVacation',
    pdcduringvacation: 'pdcDuringVacation',
    pdcplannedduringvacation: 'pdcDuringVacation'
  };
  return aliases[normalized] || aliases[compact] || '';
}

function normalizeSnoozeEntry(entry = {}) {
  const safe = entry && typeof entry === 'object' ? entry : {};
  const rule = normalizeSnoozeRule(safe.rule);
  const until = normalizeDate(safe.until || safe.endDate || safe.date);
  const reason = normalizeText(safe.reason || safe.note);
  return { rule, until, reason };
}

function normalizeSnoozeEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizeSnoozeEntry(entry))
    .filter((entry) => entry.rule && entry.until && entry.until >= todayStamp())
    .sort((a, b) => String(a.until).localeCompare(String(b.until)) || String(a.rule).localeCompare(String(b.rule)) || String(a.reason).localeCompare(String(b.reason)));
}

function sameSnoozeEntry(a, b) {
  return normalizeSnoozeRule(a?.rule) === normalizeSnoozeRule(b?.rule)
    && normalizeDate(a?.until) === normalizeDate(b?.until)
    && normalizeText(a?.reason) === normalizeText(b?.reason);
}

function snoozeRuleLabel(rule) {
  const normalized = normalizeSnoozeRule(rule);
  return SNOOZE_RULE_LABELS[normalized] || normalizeText(rule) || 'Attention item';
}

function activeSnoozeEntries(report) {
  return normalizeSnoozeEntries(report?.snoozes || []);
}

