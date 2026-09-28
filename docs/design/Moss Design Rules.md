---
title: Moss Design Rules
author: EALX (Alexander Lee)
version: 1.1
date: 2026-09-28
---

# Moss Design Rules

This is the look Team Pulse ships with. It replaced the old bright blue and purple look, including its gradients, glows and animations.

Version 1.1 changed the colors only. The warm paper page and beige grays became an off white page and cool grays, and the moss green accent and chart ramp became a deep ink blue, so green now only means good status. Type, sizes, corners, layout and components are unchanged. The name Moss stays.

- **Mockups:** `docs/design/mockups/` holds six reference pages. They show exact values. Open them in a browser to see them.
- **Tokens:** `docs/design/tokens.css` holds every color, size and corner as a CSS variable.
- **Screens without a mockup:** build them from the controls sheets and the rules below.
- **When in doubt:** match the mockups, then these rules. Never invent a new color, font or effect. Ask instead.

| Mockup | Shows |
|---|---|
| Overview.html | Team Health overview: header, health score, briefing, direct report tiles |
| Meeting Room.html | The 1:1 room: talking points, follow-ups, goals, last time, this meeting |
| Controls 1 Actions and Fields.html | Buttons, header controls, save status, Data menu, every field type |
| Controls 2 Choices and Status.html | Checkboxes, pulse picker, switches, segmented control, tabs, status tags, progress, pulse |
| Controls 3 Dialog and Feedback.html | Dialog, toasts, backup banner, empty states |
| Controls 4 Lists.html | Direct reports table, quick filter, the Last time recap, navigation states |

## Principles

1. **Calm and flat.** Off white page, white cards, thin lines. No gradients, glows or blur.
2. **One accent.** Ink blue means "you can click this" or "you are here". Charts use lighter and darker steps of the same blue. Green only means good status.
3. **Status colors only mean status.** Good, mixed and rough always come with a label or a shape, never color alone.
4. **One typeface.** Instrument Sans in three weights, embedded in the file.
5. **Nothing moves on its own.** No looping or ambient animation. Motion only answers the user and lasts 150 ms or less.
6. **Shadows only on floating layers.** Dialogs, menus and toasts. Cards never have shadows.

## Colors

All text pairs meet 4.5:1 contrast. Field borders, switch borders and status marks meet 3:1. Good, mixed and rough pass the colorblind palette check (worst pair separation 8.1, no warnings).

| Token | Value | Use |
|---|---|---|
| `--page` | `#F6F7F7` | Page background and sidebar |
| `--surface` | `#FFFFFF` | Cards, panels, fields, dialogs, menus, toasts |
| `--sunken` | `#ECEEF0` | Neutral tags, avatars, progress tracks, hover fill |
| `--line` | `#E1E4E7` | Card borders and section dividers |
| `--line-soft` | `#ECEEF0` | Row dividers inside cards |
| `--button-line` | `#D1D5DA` | Secondary button borders |
| `--field-line` | `#7C838A` | Field and switch borders |
| `--outline` | `#C2C7CD` | Outline tag border |
| `--ink` | `#181C21` | Main text |
| `--ink-2` | `#5B636B` | Secondary text, labels, captions |
| `--ink-3` | `#4B525A` | Neutral tag text |
| `--placeholder` | `#636A71` | Placeholder text |
| `--accent` | `#335578` | Primary buttons, links, current nav icon, focus ring, checkbox and range color |
| `--accent-strong` | `#233F5B` | Hover and pressed state of accent items |
| `--good` | `#218462` | Good pulse, solid good tags, good progress |
| `--mixed` | `#B7791F` | Mixed pulse, attention markers, the health meter in the attention band |
| `--rough` | `#8F2733` | Rough pulse, danger buttons, solid red tags |
| `--good-tint` / `--good-text` | `#E4F0E9` / `#1D5B43` | Good tags and the Autosaved status |
| `--amber-tint` / `--amber-text` | `#FDEED6` / `#7A5212` | Attention tags |
| `--amber-strong` | `#8A5B0B` | Warning counts in navigation, overdue dates |
| `--red-tint` / `--red-text` | `#F8E3E4` / `#8F2733` | Problem tags |
| `--disabled-bg` / `--disabled-text` | `#ECEEF0` / `#82878D` | Disabled buttons |
| `--scrim` | `rgba(24, 28, 33, 0.40)` |
| `--ramp-1` to `--ramp-6` | `#EEF3F9` `#D4E0ED` `#ABBFD5` `#7691AD` `#506C88` `#2C445D` | Heatmaps and levels, light to dark | Behind dialogs |

## Type

Instrument Sans 400, 500 and 600, latin subset, embedded as base64 woff2. Fallback: `'Helvetica Neue', sans-serif`. Labels use sentence case. Never all caps.

| Use | Size | Weight | Notes |
|---|---|---|---|
| Page title | 34px | 600 | Line height 1.1, letter spacing -0.025em |
| Health score | 72px | 600 | Line height 0.95, letter spacing -0.045em |
| Dialog title | 20px | 600 | Letter spacing -0.015em |
| Section title | 16px | 600 | Briefing, Direct Reports |
| Panel title | 15px | 600 | Panels inside the 1:1 room |
| Navigation item | 14.5px | 400, 600 when current | |
| Body and fields | 14px | 400 | Line height 1.45 |
| List rows, buttons, descriptions | 13.5px | 400, buttons 500 or 600 | |
| Field labels and eyebrows | 12.5 to 13px | 500 | `--ink-2` |
| Captions and meta | 12px | 400 | `--ink-2` |
| Tags | 11.5px | 600 | |

Counts, scores and table dates use tabular figures (`font-variant-numeric: tabular-nums`).

## Layout, corners and elevation

- **Sidebar:** 232px wide on `--page`, 1px `--line` right border, padding 24px 14px 20px.
- **Main area:** padding 28px 36px 26px. Sections 18 to 22px apart.
- **Spacing:** use flex or grid `gap` (8, 10, 14, 18, 22px), not margins between siblings.
- **Cards and panels:** `--surface`, 1px `--line`, radius 14px, padding 14 to 20px. Rows inside are divided by 1px `--line-soft`.
- **Corners:** cards, panels, dialogs and the table wrapper 14px. Toasts 12px. Menus and empty state boxes 10px. Fields 9px. Buttons and nav items 8px. Small buttons 7px. Tags 6px. Avatars 8px (30px size) or 10px (36px size). Never 999px pills.
- **Shadow:** floating layers only: `0 12px 32px -8px rgba(24, 28, 33, 0.18), 0 2px 6px rgba(24, 28, 33, 0.06)`.

## Focus and motion

- Every interactive element shows `outline: 2px solid var(--accent); outline-offset: 2px` on `:focus-visible`.
- Fields show `border-color: var(--accent)` plus `box-shadow: 0 0 0 3px var(--focus-ring)` when focused.
- Hover and open transitions last 150 ms or less. Turn them off under `prefers-reduced-motion`.

## Components

### Buttons

| Variant | Look | Example |
|---|---|---|
| Primary | `--accent` fill, white text, 600 | Save goal, Wrap up meeting, Export now |
| Secondary | White, 1px `--button-line`, `--ink` text, 500 | Cancel, Back, Add goal |
| Danger | White, 1px `--rough` border, `--rough` text, 600. Hover `--red-tint` | Remove goal |
| Small | 28px high, radius 7px, 12.5px, secondary look | 1:1 room, Edit, Close |
| Link | No box, `--accent` text, 600 | View all →, All follow-ups →, Undo |
| Icon | 28px square, `--ink-2` icon, hover `--sunken`, needs `aria-label` | Remove talking point |
| Disabled | `--disabled-bg` fill, `--disabled-text` | Insert talking points with nothing queued |

Default height 36px, radius 8px, padding 0 14px. One primary button per area.

### Header

Left: eyebrow (the section name, 13px 500 `--ink-2`) over the page title. Right: the Search button with the `/` key hint, the save status, and the Data menu. In the 1:1 room the eyebrow is "1:1 room", the title is the person's name, and the level and mentor sit on a line below. The name appears once on the page.

### Save status

28px high, radius 7px, 12.5px 600, with a 7px dot.

| State | Look |
|---|---|
| Autosaved | Good tint, good dot |
| Saving… | Neutral, `--ink-2` dot |
| Pending save | Amber tint, mixed dot |
| Save failed | Red tint, rough dot |
| No folder connected | Outline, hollow dot |

### Data menu

Trigger is a secondary button with a chevron. The popover is 196px wide, radius 10px, padding 6px, with the floating shadow. Items are 34px high with a `--sunken` hover.

### Fields

- Label above the control, 12.5px 500 `--ink-2`.
- Control 38px high (36px in dense panels), radius 9px, 1px `--field-line`, white.
- **Select:** native select with `appearance: none` and a chevron icon.
- **Number with a unit:** the unit ("days", "months") sits inside the field on `--page` behind a 1px `--line` divider.
- **Textarea:** padding 10px 12px, line height 1.55.
- **Range:** native, `accent-color: var(--accent)`, value shown at the right.
- **Date:** native date input styled like a field.

### Choices

- **Checkbox:** native, 16px, `accent-color: var(--accent)`, wrapped in a label with its text.
- **Pulse picker:** three bordered options (Good, Mixed, Rough), each with its pulse glyph. The selected option uses its status tint, a 1.5px status border and 600 text. Clear is a link button.
- **Switch:** 36 by 20px on a real checkbox with `role="switch"`. On: accent fill, white knob. Off: white track, 1.5px `--field-line` border, `--field-line` knob.
- **Segmented control:** `--sunken` track, radius 9px, padding 3px. The current option is white with a 1px `--line` ring and 600 text. Used for Tiles and Table.
- **Tabs:** text tabs 22px apart. The current tab has 600 text and a 2px accent underline. Counts sit in a small amber tint chip. Used for Markdown and Preview, and the person workspace tabs.

### Tags and status

Tags are 22px high, radius 6px, 11.5px 600.

| Tone | Look |
|---|---|
| Neutral | `--sunken` fill, `--ink-3` text |
| Outline | Transparent, 1px `--outline`, `--ink-3` text |
| Good | `--good-tint`, `--good-text` |
| Amber | `--amber-tint`, `--amber-text` |
| Red | `--red-tint`, `--red-text` |
| Solid good | `--good` fill, white text |
| Solid red | `--rough` fill, white text |

| Status | Tone |
|---|---|
| Support level: Good | Good |
| Support level: Monitor | Neutral |
| Support level: Support needed | Red |
| Support level: Urgent | Solid red |
| PDC: Not started | Outline |
| PDC: In progress | Neutral |
| PDC: Needs review | Amber |
| PDC: Blocked | Red |
| PDC: Completed | Solid good |
| Goal: On track | Good |
| Goal: At risk | Red |
| Goal: Paused | Outline |
| Goal: Done | Solid good |

Other badges use the same tones. An overdue last 1:1 is amber. Counts, next planned dates and On vacation are neutral. The old blue "info" tone becomes neutral.

### Pulse, progress and the health meter

- **Pulse:** a full circle is Good, a half circle is Mixed, an empty ring is Rough, in `--good`, `--mixed` and `--rough`. Always the three shapes. Oldest to newest, left to right.
- **Goal progress:** 6px track in `--sunken`, radius 3px. Fill: On track and Done `--good`, At risk `--rough`, Paused `--disabled-text`. Percentage at the right in 12px `--ink-2`.
- **Health meter:** 8px track in `--sunken`. The fill follows the health band: 80 and up `--good`, 55 to 79 `--mixed`, below 55 `--rough`.
- **Meeting sparkline:** 3px bars in `--accent`, 2px stubs in `--line` for weeks with no meeting.

### Cards, panels and the Last time recap

- Section titles sit above cards. Panel titles sit inside panels, with a short note under them in 12.5px `--ink-2`.
- The Last time recap is a `details` element styled as a panel. The summary row holds the title, the pulse glyph, the meta line and a chevron.

### Tables

- White wrapper, 1px `--line`, radius 14px.
- Header row 38px, labels 12px 500 `--ink-2`, sentence case.
- Group rows ("Needs attention · 4", "On track · 1") are 34px on `--page` with a 7px status dot.
- Rows are 52px with `--line-soft` dividers.
- Inline status selects look like tags with a small chevron.
- Row actions are small buttons.

### Dialogs

- `--scrim` behind. White, radius 14px, floating shadow, 560px wide for forms, padding 22px 24px 24px.
- Header: title, one line description in 13.5px `--ink-2`, and a small Close button.
- Forms use a two column grid with 14px by 16px gaps. Full width fields span both columns.
- Actions at the bottom left: primary, then secondary, then danger last.

### Toasts, banner and empty states

- **Toasts:** top right, white, 1px `--line`, radius 12px, floating shadow, 360px wide. A leading 18px icon in the status color (check circle, triangle, x circle, info circle), the message in 13.5px, and an optional link button such as Undo. No colored side borders.
- **Backup banner:** white card, radius 14px. Title 14.5px 600, text 13.5px `--ink-2`, then Remind me later (secondary) and Export now (primary).
- **Empty states:** 13.5px `--ink-2` text in a `--page` box with a 1px dashed `--button-line` border, radius 10px.

### Navigation and avatars

- **Brand:** 28px `--accent` square, radius 8px, with the white pulse line icon. Name 16.5px 600, version 11.5px `--ink-2` below it.
- **Group labels:** 12px 500 `--ink-2`.
- **Items:** 36px high, radius 8px, 17px stroke icons in `--ink-2`.
- **States:** hover `--sunken`. Current: white with a 1px `--line` ring, accent icon and 600 text.
- **Counts:** plain `--ink-2`. Warning counts in `--amber-strong` 600.
- **Avatars:** initials on `--sunken` in `--ink`. No per person gradients or colors.
- **Icons:** inline SVG on a 24 grid, stroke 1.8 to 2, round caps and joins. No icon fonts. No emoji.

## Charts

- Thin marks, one axis, text in ink colors, grid lines in `--line-soft`, axis labels 12px `--ink-2`.
- **Single measures** such as the health trend: a 2px line in `--accent`.
- **Heatmaps and levels** use the one hue ramp `--ramp-1` to `--ramp-6`, light to dark. The six job levels map in order, Consultant (Developing) lightest to Senior (Proficient) darkest.
- **Radar charts:** 2px `--accent` outline, `--accent` fill at 12% opacity, rings in `--line`.
- Status in charts uses good, mixed and rough with a label or shape, never color alone.
- A chart with two or more series gets a legend.

## Old look to Moss

| Today | Moss |
|---|---|
| Blue accent `#2957d6` and purple highlights | `--accent`, a deep muted ink blue (moss green in version 1.0) |
| Saturated status fills (`--sat-*`) with white text | Tag tones from the status table |
| `.badge` neutral and `.badge.info` | Neutral tag |
| `.badge.success`, `.warning`, `.danger` | Good, amber and red tints |
| Toasts with a colored left border | Toasts with a leading status icon |
| Save pill variants | Save status states above |
| Goal progress fill colors | Good, rough and disabled text fills |
| Per person avatar gradients | Flat `--sunken` avatars |
| Gradient brand mark | Flat accent square with the pulse icon |
| Ambient background canvas and cursor trail | Removed |
| Entrance animations such as `fadeSlideIn` | Removed, or a fade of 150 ms or less |
| `border-radius: 999px` pills | Radius 6 to 8px |
| System font stack | Instrument Sans, embedded |
| Blue and purple level colors (`LEVEL_TIMELINE_COLORS`) | `--ramp-1` to `--ramp-6` |
| Saturated pulse dots | Full, half and empty pulse glyphs |

## Never use

- Gradients of any kind, including on text, borders and icons.
- Glows, colored shadows and text shadows.
- `backdrop-filter`, blur or frosted glass.
- Looping, ambient or decorative animation, and decorative canvases.
- Pill shapes with 999px corners.
- Emoji anywhere in the interface.
- Inter, Roboto, Arial or the system font as the main typeface.
- Colored left border stripes on cards, rows or toasts.
- Bright blue or purple as an accent. The only accent is the muted ink blue `--accent`.
- Shadows on cards.
- All caps labels.
- More than one primary button in one area.

## Screens

| Screen | Build from |
|---|---|
| Team Health overview | Overview.html |
| 1:1 room | Meeting Room.html |
| Direct Reports, tiles | Tiles as on Overview.html. Toolbar: search field, Tiles and Table segmented control, PDC and Show selects, "+ Add direct report" primary button |
| Direct Reports, table | Controls 4 Lists.html |
| Person workspace | Workspace tabs from Controls 2, panels as in the 1:1 room, fields from Controls 1 |
| Meetings, Follow-Ups, PDC Summary, Insights | Cards, tables, tags, pulse and progress from the controls sheets, charts from the rules above |
| Settings | Fields from Controls 1, switch rows from Controls 2 |
| Startup gate and first run dialog | A card or dialog with a primary and a secondary button |
| Global search | Dialog with list rows |

## Accessibility checklist

- Text contrast at least 4.5:1, or 3:1 from 24px. Field borders and marks at least 3:1.
- Real `button`, `input`, `select` and `textarea` elements with visible labels. Icon only buttons get `aria-label`.
- Visible focus on everything you can tab to.
- Status never shown by color alone.
- Hit targets at least 28px, 36px for main actions.
