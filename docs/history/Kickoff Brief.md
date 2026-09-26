# Kickoff Brief

One-time instructions from Alex for the restructure and the Moss redesign. In pull request 2, move this file to docs/history so later sessions don't treat it as current instructions.

Read CLAUDE.md and everything in docs/design before you start. If either is missing from the main branch, stop and tell me.

The job has two pull requests. Do them in order. Open the first pull request, or if you can't open it yourself, push the branch and tell me it's ready. Then stop and wait for me to merge it before you start the second.

## Pull request 1: restructure, no visual change

- Split today's single index.html into organized source files (styles by purpose, scripts by feature, markup), plus a build script that produces one self-contained index.html from them.
- Add a GitHub Actions workflow that runs the build on every pull request and on main.
- The built file must look and behave exactly like today's v0.52.4. Prove it, for example by comparing the old and new file screen by screen with fictional sample data, and explain in the pull request how you checked.
- Keep https://alexleemd.github.io/teampulse working. First find out how GitHub Pages serves the app today. If keeping it working needs a GitHub setting change, don't make it yourself. Tell me exactly what to click.
- Leave the packages folder as it is.
- Update the "Source and build" section of CLAUDE.md so it describes the new layout and build.

## Pull request 2: apply Moss

- Restyle every screen to match docs/design/mockups and follow docs/design/Moss Design Rules.md.
- Embed Instrument Sans 400, 500 and 600 (latin woff2) in the built file, and add its SIL Open Font License file to the repository. Nothing may load from the network.
- Remove everything on the "Never use" list, including the ambient background canvas and the cursor trail. Today's file has about 33 gradients, 12 backdrop-filter declarations, 8 infinite animations and 27 pill corners.
- Keep every feature, setting, label and the data format as they are. If a setting only controlled an effect you removed, leave it in place and list it in the pull request for me to decide.
- Build the screens that have no mockup (Direct Reports, person workspace, Meetings, Follow-Ups, PDC Summary, Insights, Settings, startup and search) from the controls sheets and the rules.
- In the pull request, include before and after screenshots of every screen with fictional data, and a short list of anything you could not match.

Stop and ask me if anything is unclear. Don't guess.
