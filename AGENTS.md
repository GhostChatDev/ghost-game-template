# AGENTS.md

## Rules
- No OrbitControls, no post-processing, no WebGPU, no physics library, no external art.
- WebGL2 only: it has to run on an iPad and an Android phone.
- three.js comes from the import map in index.html at one pinned version. No bundler, no build step.
- The camera is fixed: its position and lookAt are constants set once. No zoom, no follow.
- src/daylight.js holds only setTimeOfDay(t).
- window.__game is read-only debug output. Every check reads it, so keep its shape.
- Modules need http: test with a local server or GitHub Pages, never file://.
- First run on a copy: fill in PRODUCT.md and DESIGN.md from the templates, then stop before building.

## File map
- index.html: import map (three pinned), HUD, help line, no-WebGL message, loads src/main.js
- style.css: full-viewport canvas, HUD and help line
- src/main.js: renderer, fixed camera, lights, ground and grid, player box, tap-to-move, fixed step, save/load, window.__game
- src/daylight.js: setTimeOfDay(t[, sun]) returns sun colour/intensity/position, morning white to hard orange
- tests/base.check.mjs: the 7 browser checks (Playwright), screenshots in test-results/
- .github/workflows/base-checks.yml: runs the 7 checks on every push
- PRODUCT.template.md, DESIGN.template.md: stubs a new game fills in first
