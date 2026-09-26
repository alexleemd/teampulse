function sanitizeMarkdownUrl(value) {
  const text = String(value ?? '').trim();
  if (!text || !/^(https?:\/\/|mailto:|tel:)/i.test(text)) return '';
  return text.replace(/[\u0000-\u001F\u007F\s]+/g, '');
}

function stripMarkdownLineToText(value) {
  let text = normalizeText(value);
  if (!text || /^```/.test(text)) return '';
  text = text
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+\.\s+/, '')
    .replace(/^\s*\[(?:x|X| )?\]\s+/, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1');
  return normalizeText(text);
}

function renderInlineMarkdown(text) {
  let source = String(text ?? '');
  const tokens = [];
  const token = (html) => `@@NOTE_TOKEN_${tokens.push(html) - 1}@@`;

  source = source.replace(/`([^`\n]+)`/g, (_, code) => token(`<code>${escapeHtml(code)}</code>`));
  source = source.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_, label, url) => {
    const safeUrl = sanitizeMarkdownUrl(url);
    if (!safeUrl) return `${label} (${url})`;
    return token(`<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  });

  let safe = escapeHtml(source);
  safe = safe.replace(/\*\*([^*][\s\S]*?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/__([^_][\s\S]*?)__/g, '<strong>$1</strong>');
  safe = safe.replace(/(^|[\s(>])\*([^*\n][\s\S]*?)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  safe = safe.replace(/(^|[\s(>])_([^_\n][\s\S]*?)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  tokens.forEach((html, index) => {
    safe = safe.replaceAll(`@@NOTE_TOKEN_${index}@@`, html);
  });
  return safe;
}

function renderNoteMarkdown(text, options = {}) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n');
  const emptyHtml = Object.prototype.hasOwnProperty.call(options, 'emptyHtml')
    ? String(options.emptyHtml)
    : '<p class="note-preview-empty">No notes yet.</p>';
  if (!normalizeText(source)) return emptyHtml;
  const lines = source.split('\n');
  const blocks = [];
  const isTaskLine = (line) => /^\s*\[(x|X| )?\]\s+(.+)$/.test(line);
  const isBulletLine = (line) => /^\s*[-*+]\s+(.+)$/.test(line) && !isTaskLine(line);
  const isNumberLine = (line) => /^\s*(\d+)\.\s+(.+)$/.test(line);
  const isHeadingLine = (line) => /^\s{0,3}(#{1,6})\s+(.+)$/.test(line);
  const isFenceLine = (line) => /^\s*```/.test(line);
  const isBlockStart = (line) => isFenceLine(line) || isHeadingLine(line) || isTaskLine(line) || isBulletLine(line) || isNumberLine(line);

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!normalizeText(line)) {
      index += 1;
      continue;
    }

    if (isFenceLine(line)) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !isFenceLine(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && isFenceLine(lines[index])) index += 1;
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (isTaskLine(line)) {
      const items = [];
      while (index < lines.length && isTaskLine(lines[index])) {
        const match = lines[index].match(/^\s*\[(x|X| )?\]\s+(.+)$/);
        const done = !!match[1] && String(match[1]).toLowerCase() === 'x';
        items.push(`<div class="note-task ${done ? 'done' : 'open'}"><span class="note-task-status">${done ? 'Done' : 'Open'}</span><span class="note-task-copy">${renderInlineMarkdown(match[2])}</span></div>`);
        index += 1;
      }
      blocks.push(`<div class="note-task-list">${items.join('')}</div>`);
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bulletMatch && !isTaskLine(line)) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!match || isTaskLine(lines[index])) break;
        items.push(`<li>${renderInlineMarkdown(match[1])}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    const numberMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (numberMatch) {
      const items = [];
      const start = Number.parseInt(numberMatch[1], 10) || 1;
      while (index < lines.length) {
        const match = lines[index].match(/^\s*(\d+)\.\s+(.+)$/);
        if (!match) break;
        items.push(`<li>${renderInlineMarkdown(match[2])}</li>`);
        index += 1;
      }
      blocks.push(`<ol start="${start}">${items.join('')}</ol>`);
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && normalizeText(lines[index]) && !isBlockStart(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    if (paragraphLines.length) {
      blocks.push(`<p>${paragraphLines.map((entry) => renderInlineMarkdown(entry)).join('<br>')}</p>`);
    }
  }

  return blocks.join('');
}

function updateRenderedNotePreview(previewEl, text, emptyMessage = 'Nothing to preview yet.') {
  if (!previewEl) return;
  previewEl.innerHTML = renderNoteMarkdown(text, { emptyHtml: `<p class="note-preview-empty">${escapeHtml(emptyMessage)}</p>` });
}

function bindMarkdownShell(shellId, { textareaEl, previewEl, onSync }) {
  const shell = document.getElementById(shellId);
  if (!shell) return;
  const setMode = (mode) => {
    if (mode !== 'write' && mode !== 'preview') return;
    shell.setAttribute('data-md-active', mode);
    shell.querySelectorAll('[data-md-target]').forEach((btn) => {
      const isActive = btn.getAttribute('data-md-mode') === mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    if (mode === 'preview' && typeof onSync === 'function') onSync();
    if (mode === 'write' && textareaEl) textareaEl.focus();
  };
  shell.querySelectorAll('[data-md-target]').forEach((btn) => {
    if (btn.getAttribute('data-md-target') !== shellId) return;
    btn.addEventListener('click', () => setMode(btn.getAttribute('data-md-mode')));
  });
  if (textareaEl && typeof onSync === 'function') {
    textareaEl.addEventListener('input', onSync);
  }
}

function syncMeetingNotesPreview() {
  updateRenderedNotePreview(meetingNotesPreviewEl, meetingNotesInputEl?.value || '');
}

