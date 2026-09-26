
function openCreateWorkspace(options = {}) {
  if (!ensureConnectedOrToast()) return false;
  if (app.ui.creatingReport) return true;
  if (!options.skipConfirm && !confirmWorkspaceClose()) return false;
  clearWorkspaceDraft();
  app.ui.creatingReport = true;
  app.ui.selectedId = null;
  app.ui.detailDrawerTab = 'profile';
  app.ui.profileEditMode = true;
  app.ui.mainView = 'reports';
  render();
  persistUiState();
  return true;
}

function selectReport(id, options = {}) {
  const targetId = normalizeText(id);
  if (!targetId) return false;
  if (!options.skipConfirm && !app.ui.creatingReport && app.ui.selectedId === targetId) return true;
  if (!options.skipConfirm && !confirmWorkspaceClose()) return false;
  clearWorkspaceDraft();
  app.ui.creatingReport = false;
  app.ui.selectedId = targetId;
  if (!options.keepTab) app.ui.detailDrawerTab = 'profile';
  app.ui.profileEditMode = false;
  app.ui.vacationEditMode = false;
  app.ui.cadenceEditMode = false;
  // Selecting a report implies we're on the Reports view.
  app.ui.mainView = 'reports';
  render();
  persistUiState();
  return true;
}

function clearSelectedReport(options = {}) {
  if (!options.skipConfirm && !confirmWorkspaceClose()) return false;
  closeMeetingModal();
  clearWorkspaceDraft();
  app.ui.creatingReport = false;
  app.ui.selectedId = null;
  app.ui.profileEditMode = false;
  app.ui.vacationEditMode = false;
  app.ui.cadenceEditMode = false;
  render();
  persistUiState();
  return true;
}


function meetingTone(report, type, thresholdDays) {
  const lastDate = latestMeetingDate(report, type);
  const age = lastDate ? dateDiffInDays(lastDate) : report.hireDate ? dateDiffInDays(report.hireDate) : null;
  if (age === null) return 'danger';
  if (reportHasActiveVacation(report) && age > thresholdDays) return 'success';
  if (age > thresholdDays) return 'warning';
  return 'success';
}









function renderAttentionBadges(metrics) {
  if (!metrics.attention.length) return badge('On track', 'success');
  const visible = metrics.attention.slice(0, 2).map((issue) => badge(issue, attentionTone(issue))).join('');
  const overflow = metrics.attention.length > 2 ? badge(`+${metrics.attention.length - 2} more`, 'soft') : '';
  return `${visible}${overflow}`;
}

function cadenceDueDate(anchorDate, fallbackDate, thresholdDays) {
  const sourceDate = normalizeDate(anchorDate || fallbackDate);
  return sourceDate ? addDays(sourceDate, thresholdDays) : '';
}

function reportNearestActionDate(report, metrics) {
  return [
    cadenceDueDate(metrics.lastOneOnOne, report.hireDate, metrics.thresholds.oneOnOneDays),
    cadenceDueDate(metrics.lastPdc, report.hireDate, metrics.thresholds.pdcDays),
    cadenceDueDate(metrics.lastCvReview, report.hireDate, metrics.thresholds.cvReviewDays),
    normalizeDate(report.nextOneOnOneDate),
    normalizeDate(report.nextPdcDate)
  ].filter(Boolean).sort()[0] || '';
}

function reportUrgencyBucket(report, metrics) {
  if (metrics.attention.length) return 0;
  if (metrics.openFollowUps.length) return 1;
  return 2;
}

function reportUrgencyScore(report, metrics) {
  let score = metrics.attention.length * 100;
  if (metrics.oneOnOneOverdue) score += 40;
  if (metrics.pdcOverdue) score += 35;
  if (metrics.cvReviewOverdue) score += 30;
  if (normalizeSupportLevel(report.supportLevel) === 'Urgent') score += 25;
  else if (normalizeSupportLevel(report.supportLevel) === 'Support needed') score += 15;
  score += Math.min(metrics.openFollowUps.length, 6) * 3;
  return score;
}

function compareReportsForTable(left, right) {
  const leftMetrics = getMetrics(left.id);
  const rightMetrics = getMetrics(right.id);
  const bucketDiff = reportUrgencyBucket(left, leftMetrics) - reportUrgencyBucket(right, rightMetrics);
  if (bucketDiff) return bucketDiff;
  const scoreDiff = reportUrgencyScore(right, rightMetrics) - reportUrgencyScore(left, leftMetrics);
  if (scoreDiff) return scoreDiff;
  const leftDate = reportNearestActionDate(left, leftMetrics) || '9999-12-31';
  const rightDate = reportNearestActionDate(right, rightMetrics) || '9999-12-31';
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  return String(left.name || '').localeCompare(String(right.name || ''));
}



function scrollToReports() {
  // In the 3-pane shell, the content pane is the scroll container.
  const contentPane = document.getElementById('contentPane');
  if (contentPane) contentPane.scrollTop = 0;
}


