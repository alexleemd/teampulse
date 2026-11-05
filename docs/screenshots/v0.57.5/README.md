# Screenshots for v0.57.5 (no backup reminder on a new file)

The screens that change between v0.57.4 and v0.57.5, taken with `tools/screenshots/shoot.cjs`. These are the screens of a new, empty file, so they show no people at all.

- `before/` shows v0.57.4. A new, empty file opens with "Time for a backup export. It has been more than 90 days since the last plain-format export."
- `after/` shows v0.57.5, with no reminder. A file that was never exported now counts its 90 days from its oldest change.

The screen with the sample team and no export date (`overview-export-banner`) still shows the reminder, because its oldest change is about a year old. The other 59 screens are pixel for pixel identical, apart from the version number in the sidebar.
