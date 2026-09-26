
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
      panel.setAttribute('role', 'alert');
      panel.style.maxWidth = '520px';
      const message = (error && error.message) ? error.message : String(error);
      panel.textContent = `Team Pulse could not start: ${message}. Try reloading the page; if this persists, open your browser's developer tools for details.`;
      stack.appendChild(panel);
    }
  } catch (_) { /* last-ditch: leave console error only */ }
}

