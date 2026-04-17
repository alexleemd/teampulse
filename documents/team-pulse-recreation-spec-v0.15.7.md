# Team Pulse recreation spec (authoritative as of v0.15.7)

This document is the cumulative product and build specification for recreating **Team Pulse v0.15.7** from scratch.

Use this together with the one-prompt file as the release-authoritative target.

v0.15.7 is a scanner hygiene release. The user-visible feature surface is identical to v0.15.6 except that the Data health section of Settings no longer contains a **Download full archive** button, and the app contains no built-in ZIP archive builder. Use this document as the authoritative description of the current app.

---

## 1. Product identity

- **Product name:** Team Pulse
- **Eyebrow:** Manager Notebook
- **Browser tab title:** Team Pulse
- **Audience:** one manager, personal use, roughly 1 to 10 direct reports
- **Primary use case:** track direct reports, touchpoint cadence, development context, hire and promotion dates, meeting history, and private manager notes in an offline-first browser app

### Design principles

- Keep the app simple and calm.
- Optimize for one-manager workflows, not enterprise complexity.
- Prefer scanability over dense dashboards.
- Avoid duplicated information.
- Containers close only through explicit in-app actions.

---

## 2. Technical constraints

Build Team Pulse as a **single self-contained HTML file** with inline CSS and inline JavaScript.

### Hard requirements

- No server
- No accounts
- No cloud database
- No external runtime dependencies
- No CDN assets
- Must work offline after the HTML file is opened
- Use the **File System Access API** for folder-based durable writes in Chromium browsers
- Use **IndexedDB only to remember the chosen folder handle** in the same browser profile
- **JSON is the durable source of truth**
- Pretty-print JSON with 2-space indentation
- Use human-readable IDs, not UUIDs
- Do **not** implement an in-app ZIP archive builder. The release bundle ZIP described in section 3 is a build artifact, not something the running app produces.

### Browser target

- Primary target: Edge or Chrome

---

## 3. Versioning and release artifacts

- Current target version: **v0.15.7**
- Visible version badge must match the real version constant.
- Pre-v1 normal releases use minor versions like `v0.x`.
- Quick fixes use patch versions like `v0.x.y`.

### Required artifacts for every release

Generate and version these files:

- `team-pulse-vX.Y[.Z].html`
- `team-pulse-vX.Y[.Z].zip`
- `team-pulse-vX.Y[.Z]-release-notes.txt`
- `team-pulse-vX.Y[.Z]-readme.txt`
- `team-pulse-vX.Y[.Z]-schema.md`
- `team-pulse-vX.Y[.Z]-tests.html`
- `team-pulse-one-prompt-vX.Y[.Z].txt`
- `team-pulse-recreation-spec-vX.Y[.Z].md`

The **versioned ZIP must include the versioned one-prompt file and the versioned recreation-spec file for every release**.

The release-bundle ZIP is a build artifact produced by the release engineer or generator pipeline. It is **not** produced by the running app at runtime.

---

## 4. Main shell and startup behavior

### Header shell

Show:

- eyebrow `Manager Notebook`
- title `Team Pulse`
- version pill, e.g. `v0.15.7`
- save-state pill beside the version
- top-right buttons in this exact order:
  1. `Save now` or `Choose folder` when disconnected
  2. `Import JSON`
  3. `Import .ics`
  4. `Settings`

There is **no top-toolbar Add direct report button**.

### Blank-first startup rule

On first launch, the app stays blank and gated until the user connects a Team Pulse folder or imports a Team Pulse JSON file.

The startup gate explains that the Team Pulse folder will hold:

- `team-pulse.json`
- `team-pulse.backup.json`
- `team-pulse.daily.json`
- `team-pulse.monthly.json`
- `SCHEMA.md`
- export files

After a folder has been connected once:

- remember it in IndexedDB
- attempt to reopen it automatically later if permission is still granted
- if permission is missing, stay gated and require reconnection

---

## 5. Main app layout

The main page is arranged in this order:

1. KPI tile row
2. Team health overview
3. Direct reports section

### KPI tile row

Exactly four tiles:

- `Direct reports`
- `1:1s overdue`
- `PDCs overdue`
- `CV reviews overdue`

Tiles are clickable and open a summary modal.

Do not create separate tiles for blocked plans, missing mentors, or general attention.

### Team health overview

- Non-clickable
- Shows overall on-track ring plus counts
- Shows three cadence progress rows: 1:1, PDC, CV review
- Shows PDC status mix

### Direct reports section

- Title `Direct reports`
- Helper copy
- Buttons: `Add direct report`, `Export files`
- Search input, PDC status filter, attention filter, quick-filter bar
- Table columns: Name, Level, Touchpoints, Next 1:1, PDC status, Support, Attention
- Rows open the direct report workspace
- Name cell includes mentor summary underneath
- Touchpoints cell shows last 1:1, PDC, and CV review dates with overdue styling

---

## 6. Direct report workspace

### Container behavior

- Centered, wide, scrollable overlay
- Not a side drawer
- Must not close on backdrop click
- Must not close on Escape

### Header actions

For existing people:

- `Close`
- `Save changes`
- `Delete`

For create mode:

- `Close`
- `Save direct report`

### Header presentation

- Large person name
- Prominent level directly underneath
- **Do not show mentor names beside the level**
- For existing people, show compact chips below the level for:
  - `Hire date`
  - `Last promotion`

### Workspace top summary

- Show a prominent `Workspace focus` panel
- Do **not** show a duplicated top tile row for hire date / last promotion / last PDC / last 1:1 / last CV review
- For existing people, keep the `Cadence snapshot` section with three cards: `1:1`, `PDC`, `CV review`

### Workspace section order

1. Profile
2. Development focus
3. Meetings
4. Notes

### Profile fields

- Name (required)
- Level
- Mentor(s)
- Hire date
- Last promotion / remuneration
- Next planned 1:1
- Next planned PDC
- Support level

### Development focus fields

- Development goal summary
- Promotion readiness / growth area

### Meetings section

- No inline meeting-entry form
- Use a separate meeting modal
- Show meeting history
- History rows support `Edit` and `Delete`
- Deletes require confirmation

### Notes section

- Freeform manager notes
- Must handle long notes cleanly

### Legacy creation modal must not exist

v0.15.6 removed a legacy `#reportModal` DOM block that was no longer wired up. The direct report workspace in create mode is the only creation surface. Do not recreate a separate Add direct report modal with duplicate fields.

### Custom fields UI must not exist (v0.15.7 clarification)

`customFields` on each person is retained **in the durable JSON only**, for migration compatibility. Do **not** render a custom fields editor in the direct report workspace:

- No `#addCustomFieldBtn` button.
- No `#detailCustomFieldsList` container.
- No inline label/value input grid for custom fields.
- No `bindWorkspaceCustomFieldControls`, `renderCustomFieldsMarkup`, or equivalent wiring.

v0.15.7 removed two leftover functions that were binding handlers to DOM nodes the current workspace no longer renders. Do not reintroduce them.

---

## 7. Meeting modal and import behavior

### Meeting modal

- Opens above the workspace
- Closes only through explicit buttons
- Supports manual logging and `.ics` import
- Manual fields are only:
  - `Meeting type`
  - `Meeting date`
  - `Notes`
- Supported meeting types:
  - `1:1`
  - `PDC`
  - `CV review`

### ICS import

- Available from the top toolbar and the meeting modal
- Parse `VEVENT` entries and extract `UID`, `SUMMARY`, `DESCRIPTION`, `DTSTART`, `DTEND`
- Infer meeting type from keywords
- If a workspace is open, import into that report
- Otherwise auto-match by person name when possible; if exactly one report exists, use it
- Deduplicate by `UID` first, then by meeting type + meeting date + notes

---

## 8. Save behavior and workspace draft rules

### Durable saves

- Autosave is the primary persistence path after data-changing actions
- Autosave debounce is about **160 ms**
- `Save now` forces an immediate flush
- The save-state pill shows:
  - `Saved <time>` after manual save
  - `Autosaved` after autosave
- Transient toast/banner notifications dismiss after about **2 seconds**
- Warn on browser exit when save is queued, in flight, failed, or the workspace has unsaved edits

### Plain-format durability files

Every save writes plain-format files into the connected Team Pulse folder:

- `team-pulse.json` — main durable document
- `team-pulse.backup.json` — rolling per-save backup
- `team-pulse.daily.json` — first save of each local calendar day
- `team-pulse.monthly.json` — first save of each local calendar month
- `SCHEMA.md` — machine-written schema doc

Export now additionally writes per-export CSVs and a notes Markdown.

There is no built-in ZIP archive of these files. v0.15.7 removed the in-app ZIP builder because it duplicated content that already lives beside it in the folder. If a consumer needs a ZIP, they can zip the folder themselves with any tool.

### No-op save rule (v0.15.6, preserved)

If the submitted workspace payload is byte-identical to the persisted record, the Save changes action must be a true no-op:

- Do not append a `person_updated` event.
- Do not append a `note_added` event.
- Do not schedule an autosave.
- Do not show a success toast.

This prevents the JSON file from accumulating meaningless events every time a manager opens and closes a workspace.

### Stable mode load rule (v0.15.6, preserved)

The `stable-mode` body class must be toggled on every render based on the current value of `settings.stableMode`.

### Workspace draft requirement (preserved from v0.15.5)

This is a key shipped behavior and must be preserved:

- The open direct-report workspace keeps an **in-memory unsaved draft** of the editable form fields.
- Logging, editing, deleting, or importing meetings must **not erase unsaved workspace form edits**.
- Re-renders while the workspace stays open must continue to show those unsaved edits.
- Workspace edits are only committed to the durable Team Pulse data when the user explicitly saves the workspace.
- If there are unsaved workspace edits, closing the workspace must ask for confirmation.
- Switching to another direct report or into create mode must also confirm before discarding unsaved workspace edits.
- The runtime draft is UI-only and is **not** written into JSON until the workspace is explicitly saved.

### Namespaced draft keys (v0.15.6 defensive change, preserved)

Workspace draft keys are namespaced so they cannot collide:

- Create mode draft key: `create:new`
- Existing person draft key: `person:${id}` (e.g. `person:p_001`)

---

## 9. Data model

### Schema version

- Current schema version: `2` (unchanged since v0.15.5; v0.15.7 made no schema changes)

### Root structure

The durable JSON contains:

- `schemaVersion`
- `appVersion`
- `createdAt`
- `savedAt`
- `idCounters`
- `people`
- `events`
- `settings`

### Event-backed model

Use these event types:

- `person_created`
- `person_updated`
- `note_added`
- `meeting_logged`
- `meeting_deleted`
- `person_archived`

Base person records live in `people`. Subsequent changes append to `events`. The UI projects current report state from people + events.

### Standard direct-report fields

- `name`
- `level`
- `mentors`
- `hireDate`
- `lastPromotionDate`
- `nextOneOnOneDate`
- `nextPdcDate`
- `pdcStatus`
- `supportLevel`
- `developmentGoalSummary`
- `promotionReadiness`
- `notes`
- `customFields` for migration compatibility only

### Settings

Settings that must exist:

- `thresholds.oneOnOneDays`
- `thresholds.pdcDays`
- `thresholds.cvReviewDays`
- `missingMentorCounts`
- `blockedPdcCounts`
- `lastExportDate`
- `stableMode`
- `latestExportFiles`

Settings that must not exist (removed in v0.15.6):

- `saveReminderMinutes` — remove from defaults, from normalization, from the settings form, from the legacy reader, and from any code that reads it. Existing JSON files that still contain this field must load without error; the field is simply ignored and dropped on the next save.

### Supported vocabularies

PDC statuses:

- `Not started`
- `In progress`
- `Blocked`
- `Completed`
- `Needs review`

Support levels:

- `Good`
- `Monitor`
- `Support needed`
- `Urgent`

### Current UI rule for legacy fields

Preserve migrated `customFields` in the data model, exports, and migration compatibility, but do **not** show a visible custom fields editor in the current workspace UI.

Team-level PDC status views should be derived from cadence data and planned PDC date while preserving any legacy `Blocked` status.

---

## 10. Interaction rules that must remain true

- No container closes on backdrop click.
- No container closes on Escape.
- Meeting delete and person delete require confirmation.
- There is no role/title field.
- There is no team field.
- There is no manual meeting time field.
- There is no visible custom fields panel in the workspace.
- There is no recent-activity panel.
- There is no legacy second Add direct report modal.
- There is no Save reminder interval setting.
- There is no Download full archive button in Settings (removed in v0.15.7).
- `.ics` import is sufficient; do not build deep Outlook/Graph sync.

---

## 11. Code hygiene rules

These rules accumulate across releases. v0.15.7 extends the rule set from v0.15.6 with a set of scanner-hygiene invariants.

### Inherited from v0.15.6

- Do not keep unused DOM constants or unused helper variables in the script. Do not reintroduce `formEls`, the dead modal handles, or the four unused mousedown trackers that were removed.
- Do not reintroduce a function named `openModal` whose body opens the workspace in create mode. The function is named `openCreateWorkspace` to match what it actually does.
- The Import JSON confirmation dialog must explicitly mention that the user will be asked to choose a folder where the imported data should be saved.

### Added in v0.15.7

**No built-in ZIP archive builder.** The HTML must not contain any of these functions:

- `crc32`
- `dosDateTime`
- `uint16LE`
- `uint32LE`
- `createZipBlob`
- `buildArchiveFiles`
- `downloadFullArchive`

The Data health section of Settings must not contain a `#downloadArchiveBtn` button, and the document-level click listener must not listen for that selector.

**No reintroduction of v0.15.7-removed orphans.** These functions were removed because nothing called them and should not reappear:

- `downloadBlob`
- `valueOrEmpty`
- `variantForPlan`
- `variantForRisk`
- `focusMeetingPreset`
- `renderCustomFieldsMarkup`
- `bindWorkspaceCustomFieldControls`

**Prefer `textContent` and `createElement` over `innerHTML` in simple render paths.** The following specific sites should use `replaceChildren()` / `createElement` / `textContent`:

- `populateSelect` clear
- the export-reminder mount clear
- the detail-drawer close-path clear
- the team-health empty state
- the reports-table empty row
- the data-health grid in Settings (loop over a list of `[label, value]` pairs, one `textContent` write per value)

**`innerHTML` is acceptable at six structurally complex render sites**, each of which must pass every dynamic value through `escapeHtml()`:

- quarterly export callout wrapper content
- KPI stat tiles
- team-health grid layout
- reports table rows
- direct report workspace drawer shell
- tile modal list body

Each of these sites should carry a short in-file comment stating that `innerHTML` is intentional and that escaping is already in place. Future hygiene passes should not need to re-derive the decision.

**CSS compression is cosmetic, not structural.** The inline CSS block may be whitespace-compressed (collapse runs of whitespace, tighten spaces around `{ } ; : ,`, drop redundant trailing `;` before `}`), but must not drop, rename, or merge selectors, rules, `@media` queries, `@keyframes` animations, or `calc()` expressions relative to the v0.15.6 baseline.

**Dead-code scanner as a release gate.** Each hygiene release should re-run a scan for top-level function declarations and `UPPER_CASE` constants that have only one occurrence (the declaration itself) in the entire HTML, and either delete them or justify keeping them in the release notes. v0.15.7 introduced this practice; v0.15.6 did not.
