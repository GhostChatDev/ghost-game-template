# Ghost Game Template — Project Instructions

Use these rules in every session of this Project. Each new game starts as a copy of
https://github.com/GhostChatDev/ghost-game-template (on GitHub: "Use this template").
Live base scene: https://ghostchatdev.github.io/ghost-game-template/

## First run on a new copy
1. Read AGENTS.md, PRODUCT.template.md and DESIGN.template.md.
2. Write PRODUCT.md and DESIGN.md from the templates, using what I asked for. Mark anything you guessed as "assumed".
3. Commit them, then STOP. Don't build until I approve both files.

## Hard rules (from AGENTS.md)
- three.js only from the import map in index.html, at one pinned version. No bundler, no build step.
- WebGL2 only. It has to run on an iPad and an Android phone.
- No OrbitControls, no post-processing, no WebGPU, no physics library, no external art.
- Fixed camera: position and lookAt are constants set once. No zoom, no follow.
- src/daylight.js holds only setTimeOfDay(t) (t from 0 to 1, morning white to hard orange).
- window.__game = { player: {x,y,z}, camera: {x,y,z}, frames, ready } is read-only debug output.
  Keep its shape: every check reads it. New fields may be added, but never rename or remove one.
- Modules need http. Test with a local server or GitHub Pages, never file://.

## File map
- index.html: import map, HUD, help line, no-WebGL message, loads src/main.js
- style.css: full-viewport canvas, HUD, help line
- src/main.js: renderer, fixed camera, lights, ground and grid, player box, tap-to-move, fixed step, save/load, window.__game
- src/daylight.js: setTimeOfDay(t) only
- tests/base.check.mjs: the 7 browser checks (Playwright), screenshots in test-results/
- .github/workflows/base-checks.yml: runs the checks on every push
- PRODUCT.template.md, DESIGN.template.md: stubs that the first run fills in

## The 7 base checks (never weaken or delete them)
1. Loads with no console error. window.__game.ready is true within 5 s.
2. The canvas fills the viewport at 360x640 and 844x390, and the aspect ratio updates on resize.
3. Frame check: the two canvas screenshots, taken 2 s apart, differ and aren't one flat colour.
4. A tap on the ground: within 3 s the player x/z is within 0.5 of the tap point, and frames increased.
5. The camera is identical at frame 10 and frame 200.
6. Player y stays within 0.05 of the ground.
7. Save, reload: the state object comes back identical.
New features get NEW checks in new files. Every new check must fail when its feature is removed.

## How to work
- Build one feature at a time, in small commits. Run the checks after each one.
- Report which check proved what, and say plainly what wasn't verified (real devices, feel, sound).
- Put new state in the save object, and add it to check 7's round trip.
- Never merge and never touch main. I merge.
