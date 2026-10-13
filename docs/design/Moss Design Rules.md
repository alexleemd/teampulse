---
title: Moss Design Rules
author: EALX (Alexander Lee)
version: 2.0
date: 2026-10-14
---

# Moss Design Rules

This is the look Team Pulse ships with. Version 2.0 rebuilds it on Apple's design guidance (the Human Interface Guidelines and Apple's WWDC design talks), so the app feels like a native Apple app. The name Moss stays.

Version 2.0 brings the system font (San Francisco on Apple devices) and Apple's grays and blue. Cards have no border and sit on a soft shadow, buttons and tags are capsules and avatars are round. Menus, toasts and search are frosted glass, and drawers and dialogs move on Apple's sheet curve. Version 1.1 changed the colors to an off white page, cool grays and a muted blue accent. Version 1.0 replaced the old bright blue and purple look, including its gradients, glows and animations.

- **Mockups:** `docs/design/mockups/` holds six reference pages. They show exact values. Open them in a browser to see them. On a Mac they show San Francisco, elsewhere Instrument Sans.
- **Tokens:** `docs/design/tokens.css` holds every color, size, corner, shadow and the motion curve as a CSS variable.
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

Apple names eight design principles: purpose, agency, responsibility, familiarity, flexibility, simplicity, craft and delight. There is no formula for combining them, so use them to weigh choices. The rules below are how they apply to Team Pulse.

1. **Calm and light.** A light gray page and white cards that lift off it on a soft shadow. Hairlines only where they separate content. No gradients or glows.
2. **One accent.** Apple blue (`--accent`) means "you can click this" or "you are here". Charts use lighter and darker steps of the same blue.
3. **Status colors only mean status.** Good, mixed and rough always come with a label or a shape, never color alone. Green also means on, for switches, as it does on Apple platforms.
4. **The system font.** San Francisco on Apple devices and the platform font elsewhere. Instrument Sans is the fallback where the browser offers no system font.
5. **Motion answers the user.** Nothing moves on its own. Feedback lasts 150 ms or less. Drawers and dialogs move on Apple's sheet curve and leave the way they came.
6. **Depth shows layers.** Cards sit on the card shadow. Dialogs, menus, toasts and search float on the deeper floating shadow, and menus, toasts and search are frosted glass.
7. **The system settings win.** Reduce Motion, Reduce Transparency and Increase Contrast each change the app (see Accessibility).

## Colors

All text pairs meet 4.5:1 contrast. Field borders, switch borders, focus outlines and status marks meet 3:1. Good, mixed and rough pass the colorblind palette check (worst pair separation 8.1 under red green color blindness, 16.3 with normal vision, no warnings).

| Token | Value | Use |
|---|---|---|
| `--page` | `#F5F5F7` | Page background |
| `--sidebar` | `#EFEFF2` | Sidebar background |
| `--surface` | `#FFFFFF` | Cards, panels, fields, dialogs |
| `--sunken` | `#EDEDF0` | Neutral tags, avatars, progress tracks, the segmented track, menu item hover |
| `--fill` | `#E8E8ED` | Secondary and small buttons |
| `--fill-hover` | `#DEDEE3` | Hover and pressed fill of secondary and small buttons |
| `--nav-hover` | `#E6E6EA` | Sidebar item under the pointer |
| `--nav-current` | `#E2E2E6` | Current sidebar item |
| `--line` | `#E3E3E8` | Section dividers, table lines, the drawer edge |
| `--line-soft` | `#EFEFF2` | Row dividers inside cards |
| `--button-line` | `#D2D2D7` | Header button borders, the card edge under the pointer |
| `--field-line` | `#86868B` | Field and switch borders |
| `--outline` | `#C7C7CC` | Outline tag border |
| `--sidebar-edge` | `rgba(0, 0, 0, 0.10)` | Hairline between sidebar and page |
| `--card-edge` | `transparent` | Card border, `--field-line` with Increase Contrast |
| `--fill-edge` | `transparent` | Gray button border, `--field-line` with Increase Contrast |
| `--ink` | `#1D1D1F` | Main text |
| `--ink-2` | `#636366` | Secondary text, labels, captions, sidebar counts |
| `--ink-3` | `#515154` | Neutral tag text |
| `--placeholder` | `#6E6E73` | Placeholder text |
| `--accent` | `#0066CC` | Primary buttons, links, current nav icon, focus ring, checkbox and range color, the logo |
| `--accent-strong` | `#0051A3` | Hover and pressed state of accent items |
| `--good` | `#1B8561` | Good pulse, solid good tags, good progress, switches that are on |
| `--mixed` | `#C7750A` | Mixed pulse, attention markers, the health meter in the attention band |
| `--rough` | `#D60015` | Rough pulse, danger buttons, solid red tags |
| `--good-tint` / `--good-text` | `#E2F3EA` / `#1A6644` | Good tags and the Autosaved status |
| `--amber-tint` / `--amber-text` | `#FFF0DB` / `#8A4B00` | Attention tags |
| `--amber-strong` | `#9A5200` | Warning counts in navigation, overdue dates |
| `--red-tint` / `--red-text` | `#FDE8EA` / `#B0000F` | Problem tags |
| `--disabled-bg` / `--disabled-text` | `#EDEDF0` / `#8E8E93` | Disabled buttons |
| `--scrim` | `rgba(0, 0, 0, 0.28)` | Behind dialogs and drawers |
| `--material` | `rgba(255, 255, 255, 0.88)` | Frosted glass: the Data menu, toasts, global search |
| `--ramp-1` to `--ramp-6` | `#EAF2FC` `#C8DCF5` `#99C2EF` `#5592DB` `#1F6FC2` `#0055AA` | Heatmaps and levels, light to dark |

## Type

The main typeface is the system font: San Francisco on Apple devices (`-apple-system`, `BlinkMacSystemFont`). Instrument Sans 400, 500 and 600, latin subset, embedded as base64 woff2, is the fallback where the browser offers no system font, then `'Helvetica Neue', sans-serif`. Labels use sentence case. Never all caps.

| Use | Size | Weight | Notes |
|---|---|---|---|
| Page title | 34px | 700 | Line height 1.1, letter spacing -0.03em. Fake bold is off, so the fallback font shows its 600 |
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

Large text gets tighter letter spacing and small text keeps it at 0, as in Apple's type. Counts, scores and table dates use tabular figures (`font-variant-numeric: tabular-nums`).

## Layout, corners and elevation

- **Sidebar:** 232px wide on `--sidebar`, 1px `--sidebar-edge` right border, padding 24px 14px 20px.
- **Main area:** padding 28px 36px 26px. Sections 18 to 22px apart.
- **Spacing:** use flex or grid `gap` (8, 10, 14, 18, 22px), not margins between siblings.
- **Cards and panels:** `--surface`, radius 18px, padding 14 to 20px, no visible border (1px `--card-edge`) and the card shadow. Rows inside are divided by 1px `--line-soft`.
- **Corners:** cards, panels, dialogs and the table wrapper 18px. Toasts and the quick filter bar 16px. Menus and empty state boxes 12px. Fields 10px. List rows, sidebar items, heatmap cells and the logo 10px. Menu items 6px. Buttons, small buttons, the save status, tags, pill selects and the segmented control are capsules (999px). Avatars are round.
- **Card shadow (`--shadow-card`):** `0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 18px rgba(0, 0, 0, 0.045)`.
- **Floating shadow (`--shadow-float`):** dialogs, drawers, menus, toasts and search only: `0 24px 56px -12px rgba(0, 0, 0, 0.24), 0 0 0 0.5px rgba(0, 0, 0, 0.10)`.

## Materials

The Data menu, toasts and global search are frosted glass: `--material` (white at 88%), `--material-blur` (`blur(28px) saturate(180%)`), a 1px `--material-edge` hairline and the floating shadow. White at 88% keeps the text on them readable over whatever sits behind. With Reduce Transparency they turn solid white.

Cards, dialogs, drawers and the sidebar stay solid. Never put frosted glass on top of frosted glass.

## Focus and motion

- Every interactive element shows `outline: 2px solid var(--accent); outline-offset: 2px` on `:focus-visible`.
- Fields show `border-color: var(--accent)` plus `box-shadow: 0 0 0 3px var(--focus-ring)` when focused.
- Hover, color and open transitions last 150 ms or less.
- Buttons dip to 97% the moment they are pressed (80 ms), before the click lands. Rows and cards highlight instead of moving.
- Drawers slide in from the right edge on Apple's sheet curve (`--ease-spring`, `cubic-bezier(0.32, 0.72, 0, 1)`) in 420 ms and slide back out to the right.
- Dialogs grow from 96% and fade in on the same curve in 360 ms. They leave the same way.
- The scrim fades in 200 ms.
- Nothing loops. Reduce Motion turns every transition and animation off, so layers simply appear and disappear.

## Components

### Buttons

| Variant | Look | Example |
|---|---|---|
| Primary | `--accent` fill, white text, 600 | Save goal, Wrap up meeting, Export now |
| Secondary | `--fill`, no visible border, `--ink` text, 500. Hover `--fill-hover` | Cancel, Back, Add goal |
| Danger | White, 1px `--rough` border, `--rough` text, 600. Hover `--red-tint` | Remove goal |
| Small | 28px high, 12.5px, secondary look | 1:1 room, Edit, Close |
| Small danger | 28px high, danger look (white) | Remove and Delete on rows in the workspace |
| Link | No box, `--accent` text, 600 | View all →, All follow-ups →, Undo |
| Icon | 28px round, `--ink-2` icon, hover `--sunken`, needs `aria-label` | Remove talking point |
| Disabled | `--disabled-bg` fill, `--disabled-text` | Insert talking points with nothing queued |

Every button is a capsule. Default height 36px, padding 0 14px. One primary button per area.

### Header

Left: eyebrow (the section name, 13px 500 `--ink-2`) over the page title. Right: the Search button with the `/` key hint, the save status and the Data menu. The Search button and the Data menu trigger are white capsules with a 1px `--button-line` border, like toolbar buttons. In the 1:1 room the eyebrow is "1:1 room", the title is the person's name, and the level and mentor sit on a line below. The name appears once on the page.

### Save status

28px high capsule, 12.5px 600, with a 7px dot.

| State | Look |
|---|---|
| Autosaved | Good tint, good dot |
| Saving… | Neutral, `--ink-2` dot |
| Pending save | Amber tint, mixed dot |
| Save failed | Red tint, rough dot |
| No folder connected | Outline, hollow dot |

### Data menu

Trigger is a header capsule with a chevron. The popover is 196px wide, radius 12px, padding 6px, frosted glass with the floating shadow. Items are 34px high, radius 6px, with a `--sunken` hover.

### Fields

- Label above the control, 12.5px 500 `--ink-2`.
- Control 38px high (36px in dense panels), radius 10px, 1px `--field-line`, white.
- **Select:** native select with `appearance: none` and a chevron icon.
- **Number with a unit:** the unit ("days", "months") sits inside the field on `--page` behind a 1px `--line` divider.
- **Textarea:** padding 10px 12px, line height 1.55.
- **Range:** native, `accent-color: var(--accent)`, value shown at the right.
- **Date:** native date input styled like a field. In the direct reports table it is 30px high with the field radius.

### Choices

- **Checkbox:** native, 16px, `accent-color: var(--accent)`, wrapped in a label with its text.
- **Pulse picker:** three bordered capsules (Good, Mixed, Rough), each with its pulse glyph. The selected option uses its status tint, a 1.5px status border and 600 text. Clear is a link button.
- **Switch:** 36 by 20px on a real checkbox with `role="switch"`. On: `--good` fill, white knob. Off: white track, 1.5px `--field-line` border, `--field-line` knob.
- **Segmented control:** `--sunken` capsule track, padding 3px. The current option is a white capsule with the thumb shadow (`--shadow-thumb`) and 600 text. Used for Tiles and Table, the PDC views, the Insights chart modes and the timeline filter.
- **Tabs:** text tabs 22px apart. The current tab has 600 text and a 2px accent underline. Counts sit in a small amber tint chip. Used for Markdown and Preview, and the person workspace tabs.

### Tags and status

Tags are 22px high capsules, 11.5px 600.

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

Other badges use the same tones. An overdue last 1:1 is amber. Counts, next planned dates and On vacation are neutral.

### Pulse, progress and the health meter

- **Pulse:** a full circle is Good, a half circle is Mixed, an empty ring is Rough, in `--good`, `--mixed` and `--rough`. Always the three shapes. Oldest to newest, left to right.
- **Goal progress:** 6px track in `--sunken`, radius 3px. Fill: On track and Done `--good`, At risk `--rough`, Paused `--disabled-text`. Percentage at the right in 12px `--ink-2`.
- **Health meter:** 8px track in `--sunken`. The fill follows the health band: 80 and up `--good`, 55 to 79 `--mixed`, below 55 `--rough`.
- **Meeting sparkline:** 3px bars in `--accent`, 2px stubs in `--line` for weeks with no meeting.

### Cards, panels and the Last time recap

- Section titles sit above cards. Panel titles sit inside panels, with a short note under them in 12.5px `--ink-2`.
- Cards have no visible border. They lift off the page on the card shadow. Clickable cards (direct report tiles, PDC board cards) show a 1px `--button-line` edge under the pointer.
- The Add direct report tile is an empty slot, not a card: a dashed 1px `--button-line` outline on `--page`, no shadow.
- The Last time recap is a `details` element styled as a panel. The summary row holds the title, the pulse glyph, the meta line and a chevron.

### Tables

- White wrapper with the card look, radius 18px.
- Header row 38px, labels 12px 500 `--ink-2`, sentence case.
- Group rows ("Needs attention · 4", "On track · 1") are 34px on `--page` with a 7px status dot.
- Rows are 52px with `--line-soft` dividers.
- Inline status selects look like tags with a small chevron.
- Row actions are small buttons.

### Dialogs

- `--scrim` behind. White, radius 18px, floating shadow, 560px wide for forms, padding 22px 24px 24px.
- Header: title, one line description in 13.5px `--ink-2` and a small Close button.
- Forms use a two column grid with 14px by 16px gaps. Full width fields span both columns.
- Actions at the bottom left: primary, then secondary, then danger last.

### Toasts, banner and empty states

- **Toasts:** top right, frosted glass, 1px `--material-edge`, radius 16px, floating shadow, 360px wide. A leading 18px icon in the status color (check circle, triangle, x circle, info circle), the message in 13.5px and an optional link button such as Undo. No colored side borders.
- **Backup banner:** a card. Title 14.5px 600, text 13.5px `--ink-2`, then Remind me later (secondary) and Export now (primary).
- **Empty states:** 13.5px `--ink-2` text in a `--page` box with a 1px dashed `--button-line` border, radius 12px.

### Navigation and avatars

- **Brand:** 28px `--accent` rounded square, radius 10px, with the white pulse line icon. Name 16.5px 600, version 11.5px `--ink-2` below it. The browser tab icon matches.
- **Group labels:** 12px 500 `--ink-2`.
- **Items:** 36px high, radius 10px, 17px stroke icons in `--ink-2`.
- **States:** hover `--nav-hover`. Current: `--nav-current` fill, accent icon and 600 text.
- **Counts:** plain `--ink-2`. Warning counts in `--amber-strong` 600.
- **Avatars:** round, initials on `--sunken` in `--ink`. No per person gradients or colors.
- **Icons:** inline SVG on a 24 grid, stroke 1.8 to 2, round caps and joins. No icon fonts. No emoji.

## Charts

- Thin marks, one axis, text in the `--ink` grays, grid lines in `--line-soft`, axis labels 12px `--ink-2`.
- **Single measures** such as the health trend: a 2px line in `--accent`.
- **Heatmaps and levels** use the one hue ramp `--ramp-1` to `--ramp-6`, light to dark. The six job levels map in order, Consultant (Developing) lightest to Senior (Proficient) darkest. Steps 4 to 6 reach 3:1 as marks. Text on steps 1 to 4 is `--ink`, on steps 5 and 6 white.
- **Heatmap cells** are rounded rectangles (radius 10px), not capsules, so they read as a chart and not as tags.
- **Radar charts:** 2px `--accent` outline, `--accent` fill at 12% opacity, rings in `--line`.
- Status in charts uses good, mixed and rough with a label or shape, never color alone.
- A chart with two or more series gets a legend.

## Moss 1.1 to Moss 2.0

| Moss 1.1 | Moss 2.0 |
|---|---|
| Instrument Sans as the main typeface | The system font (San Francisco on Apple devices), Instrument Sans as fallback |
| Off white page `#F6F7F7`, sidebar on the same color | Apple light gray page `#F5F5F7`, sidebar a step darker on `--sidebar` |
| Muted blue accent `#335578` | Apple blue `#0066CC` |
| Good, mixed and rough `#218462` `#B7791F` `#8F2733` | `#1B8561` `#C7750A` `#D60015`, close to Apple's and still colorblind safe |
| Cards with a 1px `--line` border and no shadow | Cards with no visible border, on the card shadow |
| Buttons with 8px corners, white secondary buttons with a border | Capsule buttons, gray `--fill` secondary and small buttons |
| Tags with 6px corners | Capsule tags |
| Avatars with 8 or 10px corners | Round avatars |
| Current sidebar item: white with a line ring | `--nav-current` fill, no ring |
| Segmented control: white option with a line ring | White capsule thumb with a soft shadow in a capsule track |
| Solid white menus, toasts and search | Frosted glass menus, toasts and search |
| Switch on in the accent color | Switch on in green, as on Apple platforms |
| Drawers nudge in 12px in 120 ms | Drawers slide in from the edge on the sheet curve in 420 ms |
| Dialogs fade in | Dialogs grow from 96% and fade in on the sheet curve |
| Corners 14, 12, 10, 9, 8, 7 and 6px | Corners 18, 16, 12 and 10px, capsules and circles |

## Never use

- Gradients of any kind, including on text, borders and icons.
- Glows, colored shadows and text shadows.
- `backdrop-filter`, blur or frosted glass anywhere except the Data menu, toasts and global search. Never frosted glass on frosted glass.
- Looping, ambient or decorative animation, and decorative canvases.
- Capsule corners on cards, rows, fields or heatmap cells. Capsules are for buttons, tags, pill selects, the save status and the segmented control.
- Emoji anywhere in the interface.
- Inter, Roboto or Arial chosen as the typeface. The system font comes first and Instrument Sans is the fallback.
- Colored left border stripes on cards, rows or toasts.
- Purple, or any accent other than `--accent`.
- Visible borders on cards, except with Increase Contrast.
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
| Global search | Frosted glass dialog with list rows |

## Accessibility checklist

- Text contrast at least 4.5:1, or 3:1 from 24px. Field borders and marks at least 3:1.
- Real `button`, `input`, `select` and `textarea` elements with visible labels. Icon only buttons get `aria-label`.
- Visible focus on everything you can tab to.
- Status never shown by color alone.
- Hit targets at least 28px, 36px for main actions.
- **Reduce Motion:** no transitions or animations. Layers appear and disappear without moving.
- **Reduce Transparency:** frosted glass turns solid white.
- **Increase Contrast:** cards, gray buttons and frosted glass get a 1px `--field-line` edge.
