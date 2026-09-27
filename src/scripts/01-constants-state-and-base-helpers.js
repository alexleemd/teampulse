const APP_VERSION = 'v0.53.2';
const CURRENT_SCHEMA_VERSION = 12;
const AUTOSAVE_DEBOUNCE_MS = 160;
const TOAST_TIMEOUT_MS = 2000;
const UI_STATE_KEY = 'team-pulse-ui-state';
const CACHED_DOC_KEY = 'team-pulse-cached-doc';
const HANDLE_DB_NAME = 'team-pulse-file-db';
const HANDLE_STORE = 'handles';
const FOLDER_HANDLE_KEY = 'connected-data-folder';
const MAIN_JSON_NAME = 'team-pulse.json';
const BACKUP_JSON_NAME = 'team-pulse.backup.json';
const DAILY_JSON_NAME = 'team-pulse.daily.json';
const MONTHLY_JSON_NAME = 'team-pulse.monthly.json';
const SCHEMA_DOC_NAME = 'SCHEMA.md';

const PDC_STATUSES = ['Not started', 'In progress', 'Blocked', 'Completed', 'Needs review'];
const SUPPORT_LEVELS = ['Good', 'Monitor', 'Support needed', 'Urgent'];
const LEVEL_OPTIONS = Object.freeze(['Consultant (Developing)', 'Consultant (Skilled)', 'Consultant (Proficient)', 'Senior (Developing)', 'Senior (Skilled)', 'Senior (Proficient)']);
const LEVEL_ALIASES = Object.freeze({
  'consultant (developing)': 'Consultant (Developing)',
  'consultant developing': 'Consultant (Developing)',
  'consultant (skilled)': 'Consultant (Skilled)',
  'consultant skilled': 'Consultant (Skilled)',
  'consultant (proficient)': 'Consultant (Proficient)',
  'consultant proficient': 'Consultant (Proficient)',
  'senior (developing)': 'Senior (Developing)',
  'senior developing': 'Senior (Developing)',
  'senior (skilled)': 'Senior (Skilled)',
  'senior skilled': 'Senior (Skilled)',
  'senior (proficient)': 'Senior (Proficient)',
  'senior proficient': 'Senior (Proficient)'
});
const MEETING_TYPES = ['1:1', 'PDC', 'CV review'];
const GOAL_STATUSES = Object.freeze(['On track', 'At risk', 'Paused', 'Done']);
const FEEDBACK_KINDS = Object.freeze(['observation', 'praise', 'growth']);
const FEEDBACK_KIND_LABELS = Object.freeze({ observation: 'Observation', praise: 'Praise', growth: 'Growth area' });
const PULSE_VALUES = Object.freeze(['green', 'amber', 'red']);
const PULSE_LABELS = Object.freeze({ green: 'Good', amber: 'Mixed', red: 'Rough' });
const PDC_TEMPLATE_MARKDOWN = [
  '### Wins since last PDC',
  '- ',
  '',
  '### Growth areas',
  '- ',
  '',
  '### Focus for next period',
  '- ',
  '',
  '### Support needed',
  '- '
].join('\n');
const DEFAULT_THRESHOLDS = Object.freeze({
  oneOnOneDays: 14,
  pdcDays: 90,
  cvReviewDays: 180
});
const DEFAULT_PROMOTION_CONVERSATION_MONTHS = 24;
const DEFAULT_EVIDENCE_CATEGORIES = Object.freeze(['Leadership', 'Technical depth', 'Client relationship', 'Autonomy', 'Collaboration', 'Ownership', 'Growth']);
const SNOOZE_RULE_LABELS = Object.freeze({
  oneOnOneOverdue: '1:1 overdue',
  developmentOverdue: 'PDC overdue',
  cvReviewOverdue: 'CV review overdue',
  blockedPlans: 'Blocked PDC status',
  noMentor: 'No mentor assigned',
  supportLevel: 'Support level',
  oneOnOneDuringVacation: '1:1 planned during vacation',
  pdcDuringVacation: 'PDC planned during vacation',
  pulseTrend: '1:1 pulse trending down',
  all: 'All attention items'
});
const DEFAULT_SETTINGS = Object.freeze({
  thresholds: { ...DEFAULT_THRESHOLDS },
  missingMentorCounts: true,
  blockedPdcCounts: true,
  evidenceCategories: [...DEFAULT_EVIDENCE_CATEGORIES],
  promotionConversationMonths: DEFAULT_PROMOTION_CONVERSATION_MONTHS,
  themesWindowDays: 90,
  lastExportDate: '',
  stableMode: true,
  latestExportFiles: [],
  pulseTrendCounts: true,
  density: 'comfortable',
  pdcRoundAutoReset: true,
  pdcRoundStartMonth: 1,
  lastPdcRoundKey: ''
});
const DEFAULT_UI = Object.freeze({
  selectedId: null,
  activeThemeFilter: '',
  searchTerm: '',
  planFilter: '',
  attentionFilter: '',
  exportReminderSnoozedUntil: '',
  startupHasConnectedFolder: false,
  creatingReport: false,
  detailDrawerTab: 'profile',
  profileEditMode: false,
  vacationEditMode: false,
  cadenceEditMode: false,
  teamTenureMode: 'tenure',
  cdpTeamMode: 'heatmap',
  cdpDrawerStage: '',
  teamHealthTab: 'overview',
  mainView: 'teamHealth',
  meetingsFilterReportId: '',
  meetingsTypeFilter: '',
  meetingsSearch: '',
  pdcSummaryEditId: '',
  pdcViewMode: 'list',
  pdcBoardDateId: '',
  reportsViewMode: 'tiles',
  meetingRoomReportId: '',
  meetingRoomReturnView: 'reports',
  timelineFilter: 'all'
});

const MAIN_VIEWS = Object.freeze(['teamHealth', 'reports', 'meetings', 'followUps', 'pdcSummary', 'meetingRoom', 'settings']);

const TEAM_HEALTH_TABS = Object.freeze(['overview', 'insights']);
const TEAM_HEALTH_TAB_LABELS = Object.freeze({
  'overview': 'Overview',
  'insights': 'Insights'
});
// All three workspace tabs are visible. The top-level Meetings and PDC Summary
// sidebar views are the cross-team rollups; these tabs are the per-person deep
// dive (and the only place PDC focus, notes, evidence, and snoozes are edited).
const DETAIL_DRAWER_TABS = Object.freeze(['profile', 'meetings', 'pdc-summary', 'timeline']);
const VISIBLE_DETAIL_DRAWER_TABS = DETAIL_DRAWER_TABS;
const DETAIL_DRAWER_TAB_LABELS = Object.freeze({
  'profile': 'Profile',
  'meetings': 'Meetings & Talking Points',
  'pdc-summary': 'Development',
  'timeline': 'Timeline'
});

const FORMATTERS = {
  shortDate: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }),
  longDate: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
  dateTime: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
  monthDay: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }),
  clock: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
};


const app = {
  doc: null,
  folderHandle: null,
  ui: loadUiState(),
  projections: { reports: [], reportMap: new Map(), metrics: new Map() },
  folderName: '',
  connectedFolderReady: false,
  lastSaveAt: '',
  lastSaveReason: '',
  lastSaveError: '',
  saveInFlight: false,
  saveQueued: false,
  saveTimer: null,
  loadedSchemaVersion: CURRENT_SCHEMA_VERSION,
  lastMigrationApplied: '',
  exportReminderVisible: false,
  fileStats: {
    mainSavedAt: '',
    backupSavedAt: '',
    dailySavedAt: '',
    monthlySavedAt: '',
    schemaWrittenAt: '',
    folderLabel: ''
  },
  workspaceDraft: {
    key: '',
    payload: null,
    dirty: false
  },
  lastDestructiveAction: null
};

const toastStackEl = document.getElementById('toastStack');
const startupGateEl = document.getElementById('startupGate');
const startupPromptOverlayEl = document.getElementById('startupPromptOverlay');
const startupPromptTitleEl = document.getElementById('startupPromptTitle');
const startupPromptCopyEl = document.getElementById('startupPromptCopy');
const startupSavedFolderCardEl = document.getElementById('startupSavedFolderCard');
const startupSavedFolderLabelEl = document.getElementById('startupSavedFolderLabel');
const startupUseSavedFolderBtn = document.getElementById('startupUseSavedFolderBtn');
const startupChooseFolderBtn = document.getElementById('startupChooseFolderBtn');
const startupImportJsonBtn = document.getElementById('startupImportJsonBtn');
const createJsonFileBtn = document.getElementById('createJsonFileBtn');
const openJsonFileBtn = document.getElementById('openJsonFileBtn');
const teamHealthSectionEl = document.getElementById('teamHealthSection');
const teamHealthBodyEl = document.getElementById('teamHealthBody');
const teamHealthTabBarEl = document.getElementById('teamHealthTabBar');
const detailDrawerOverlayEl = document.getElementById('detailDrawerOverlay');
const detailDrawerEl = document.getElementById('detailDrawer');
const rulesDrawerOverlayEl = document.getElementById('rulesDrawerOverlay');
const addReportBtn = document.getElementById('addReportBtn');
const dataMenuEl = document.getElementById('dataMenu');
const saveFileBtn = document.getElementById('saveFileBtn');
const connectDataFileBtn = document.getElementById('connectDataFileBtn');
const importIcsBtn = document.getElementById('importIcsBtn');
const icsFileInputEl = document.getElementById('icsFileInput');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const appVersionEl = document.getElementById('appVersion');
const fileStatePillEl = document.getElementById('fileStatePill');
const saveDockEl = document.getElementById('saveDock');
const saveDockTitleEl = document.getElementById('saveDockTitle');
const saveDockTextEl = document.getElementById('saveDockText');
const saveDockBtn = document.getElementById('saveDockBtn');
const dismissDockBtn = document.getElementById('dismissDockBtn');
const thresholdFormEl = document.getElementById('thresholdForm');
const oneOnOneThresholdEl = document.getElementById('oneOnOneThreshold');
const developmentThresholdEl = document.getElementById('developmentThreshold');
const cvReviewThresholdEl = document.getElementById('cvReviewThreshold');
const promotionConversationThresholdEl = document.getElementById('promotionConversationThreshold');
const missingMentorCountsEl = document.getElementById('missingMentorCounts');
const blockedPlanCountsEl = document.getElementById('blockedPlanCounts');
const evidenceCategoriesInputEl = document.getElementById('evidenceCategoriesInput');
const thresholdStatusEl = document.getElementById('thresholdStatus');
const resetRulesBtn = document.getElementById('resetRulesBtn');
const closeRulesDrawerBtn = document.getElementById('closeRulesDrawerBtn');
const quickFilterBarEl = document.getElementById('quickFilterBar');
const quickFilterTitleEl = document.getElementById('quickFilterTitle');
const quickFilterDescriptionEl = document.getElementById('quickFilterDescription');
const clearQuickFilterBtn = document.getElementById('clearQuickFilterBtn');
const reportsSectionEl = document.getElementById('reportsSection');

const meetingModalEl = document.getElementById('meetingModal');
const meetingModalTitleEl = document.getElementById('meetingModalTitle');
const meetingModalSubtitleEl = document.getElementById('meetingModalSubtitle');
const closeMeetingModalBtn = document.getElementById('closeMeetingModalBtn');
const cancelMeetingModalBtn = document.getElementById('cancelMeetingModalBtn');
const meetingFormEl = document.getElementById('meetingForm');
const meetingStatusEl = document.getElementById('meetingStatus');
const meetingImportIcsBtn = document.getElementById('meetingImportIcsBtn');
const meetingNotesInputEl = document.getElementById('meetingNotes');
const meetingNotesPreviewEl = document.getElementById('meetingNotesPreview');

let pendingIcsImportContext = { preferredReportId: null, statusElementId: '', closeMeetingModalOnSuccess: false };
let startupStoredFolderHandle = null;

function nowIso() {
  return new Date().toISOString();
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function monthStamp(value = nowIso()) {
  return String(value).slice(0, 7);
}

function loadUiState() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (!raw) return { ...DEFAULT_UI };
    const parsed = JSON.parse(raw);
    const merged = {
      ...DEFAULT_UI,
      ...parsed,
      selectedId: null,
      activeThemeFilter: '',
      pdcSummaryEditId: '',
      pdcBoardDateId: '',
      meetingRoomReportId: '',
      meetingRoomReturnView: 'reports'
    };
    if (!MAIN_VIEWS.includes(merged.mainView) || merged.mainView === 'meetingRoom') merged.mainView = 'teamHealth';
    if (merged.reportsViewMode !== 'table') merged.reportsViewMode = 'tiles';
    if (merged.exportReminderSnoozedUntil && !Number.isFinite(Date.parse(merged.exportReminderSnoozedUntil))) merged.exportReminderSnoozedUntil = '';
    return merged;
  } catch (error) {
    console.error('Failed to load UI state', error);
    return { ...DEFAULT_UI };
  }
}

function persistUiState() {
  const payload = {
    searchTerm: app.ui.searchTerm,
    planFilter: app.ui.planFilter,
    attentionFilter: app.ui.attentionFilter,
    detailDrawerTab: DETAIL_DRAWER_TABS.includes(app.ui.detailDrawerTab) ? app.ui.detailDrawerTab : 'profile',
    teamTenureMode: app.ui.teamTenureMode === 'promotion' ? 'promotion' : 'tenure',
    teamHealthTab: currentTeamHealthTab(),
    mainView: MAIN_VIEWS.includes(app.ui.mainView) ? app.ui.mainView : 'teamHealth',
    startupHasConnectedFolder: !!app.ui.startupHasConnectedFolder,
    meetingsFilterReportId: app.ui.meetingsFilterReportId || '',
    meetingsTypeFilter: app.ui.meetingsTypeFilter || '',
    pdcViewMode: ['board', 'oneOnOneBoard'].includes(app.ui.pdcViewMode) ? app.ui.pdcViewMode : 'list',
    reportsViewMode: app.ui.reportsViewMode === 'table' ? 'table' : 'tiles',
    cdpTeamMode: app.ui.cdpTeamMode === 'web' ? 'web' : 'heatmap',
    exportReminderSnoozedUntil: app.ui.exportReminderSnoozedUntil || ''
  };
  localStorage.setItem(UI_STATE_KEY, JSON.stringify(payload));
}

function cacheDocSnapshot() {
  try {
    if (!app.doc) return;
    localStorage.setItem(CACHED_DOC_KEY, JSON.stringify(app.doc));
  } catch (error) {
    console.error('Failed to cache doc snapshot', error);
  }
}

function supportsDirectoryAccess() {
  return typeof window.showDirectoryPicker === 'function';
}

function supportsJsonOpen() {
  return typeof window.showOpenFilePicker === 'function';
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (ch) => map[ch]);
}

