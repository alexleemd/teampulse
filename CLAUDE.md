# Team Pulse

Owner: EALX (Alexander Lee)
Repository: alexleemd/teampulse (public)
Live app: https://alexleemd.github.io/teampulse

## What Team Pulse is

A local first browser app for a line manager to track direct reports, 1:1 meetings, follow-ups, development plans (PDC) and team health. Private data, no server.

## Non-negotiables

- The app ships as one self-contained HTML file that works offline, opened from disk or from GitHub Pages.
- Nothing loads from the network at runtime. No CDNs, no web fonts from the network, no analytics or tracking. Fonts and icons are embedded in the file.
- All data stays on the user's machine: the connected folder (team-pulse.json, backups, exports, SCHEMA.md) through the File System Access API, and IndexedDB. JSON is the source of truth.
- Never change the data format without a migration and Alex's approval.
- The repository is public. Never commit real names, client names, company material or exported app data. Use fictional people in examples, tests and screenshots.
- Light mode only. No dark mode.
- Do not minify or obfuscate the built file. Keep it readable. Minified or obfuscated output raises malware scanner false positives.
- Do not add new `innerHTML` use where a DOM method works. Heavy `innerHTML` use has triggered scanner flags before.

## How we work

- Alex is not an engineer. Claude makes the technical decisions and explains results in plain language.
- Every change goes on a new branch with a pull request. Never commit to main.
- One topic per pull request. The description says what changed, why, and exactly how Alex can check it: which screen to open, what to click, what he should see.
- Any visual change includes before and after screenshots with fictional data.
- Bump the app version in each pull request that changes the app, following the existing numbering (v0.52.4 today).
- Code review findings are grouped as A (safety and stability), B (cleanup) and C (nice to have). Alex approves a group before it is worked on.
- If something needed is missing, such as access, a file or a decision, say exactly what and stop. Don't guess or work around it.

## Source and build

Today the whole app is the single `index.html` at the repository root. The `packages` folder holds old releases. Leave it alone.

The plan is to split the source into organized files (styles by purpose, scripts by feature, markup) and add a build script that inlines everything, including the embedded fonts, into one `index.html`. GitHub Actions runs the build on every pull request and on main. GitHub Pages must always serve the latest build from main.

Update this section once the build exists, so it describes the real layout and the commands to run.

## Design

- The design is called Moss. Read `docs/design/Moss Design Rules.md` before any visual change.
- Match the reference mockups in `docs/design/mockups/`. Open them in a browser to see them.
- Use the variables in `docs/design/tokens.css`. No new colors, fonts, shadows or effects without Alex's approval.
- Never use gradients, glows, blur, looping animation, 999px pill corners, emoji, colored left borders, or Inter, Roboto, Arial or the system font as the main typeface.
- The mockups were made on a private design canvas: https://claude.ai/artifact/46VtB19p2SSrHAYbSfG2qf. The files in `docs/design` are the copy to follow.

## Writing in the interface

- Plain American English.
- No em dashes. No semicolons in interface text.
- Keep existing wording unless Alex asks to change it.

## Accessibility

- Real `button`, `input`, `select` and `textarea` elements with visible labels. Icon only buttons get an `aria-label`.
- Visible keyboard focus on everything you can tab to.
- Text contrast at least 4.5:1. Field borders and status marks at least 3:1.
- Status is never shown by color alone.
