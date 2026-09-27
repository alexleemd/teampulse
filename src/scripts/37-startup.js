
// Startup. If anything below throws, show a user-visible error panel so the
// user isn't stuck staring at the blank startup gate with no clue why nothing
// works. We render the error directly into the toast stack since that
// element exists in the static HTML and is independent of render().
try {
  bindStaticEvents();
  applyProjectedState();
  updateFileUi();
  render();
  initializeFolderRestore();
} catch (error) {
  console.error('Team Pulse failed to start', error);
  try {
    const stack = document.getElementById('toastStack');
    if (stack) {
      const panel = document.createElement('div');
      panel.className = 'toast error';
      panel.setAttribute('data-toast-icon', 'error');
      panel.setAttribute('role', 'alert');
      try { panel.appendChild(createToastIcon('error')); } catch (_) { /* the message alone still helps */ }
      const message = (error && error.message) ? error.message : String(error);
      const messageEl = document.createElement('div');
      messageEl.className = 'toast-message';
      messageEl.textContent = `Team Pulse could not start: ${message}. Try reloading the page. If this persists, open your browser's developer tools for details.`;
      panel.appendChild(messageEl);
      stack.appendChild(panel);
    }
  } catch (_) { /* last-ditch: leave console error only */ }
}

