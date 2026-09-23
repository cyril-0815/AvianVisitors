#!/usr/bin/env node
'use strict';

/* The read-only copy runs this frontend on a server away from the Pi,
   switched on by a modus.json next to index.html. Two things matter:
   the Pi, which has no such file, must behave exactly as before, and
   the copy must never pretend a silent station is fine.

   The stand line's rule is a pure function inside apt.js, fenced by two
   markers, so this suite lifts it out and runs it without a DOM, a
   network or a clock. Everything else is a source check on pieces that
   have no logic to test but must not silently go missing. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let checks = 0;
function check(condition, message) {
  checks += 1;
  if (!condition) {
    process.stderr.write('FAIL: ' + message + '\n');
    process.exit(1);
  }
}

const repo = path.join(__dirname, '..');
const frontend = path.join(repo, 'avian', 'frontend');
const apt = fs.readFileSync(path.join(frontend, 'apt.js'), 'utf8');
const css = fs.readFileSync(path.join(frontend, 'styles.css'), 'utf8');

/* ---- lift the stand rule out of apt.js ---- */
const START = '// >>> stand-line';
const END = '// <<< stand-line';
const from = apt.indexOf(START);
const to = apt.indexOf(END);
check(from !== -1 && to > from, 'apt.js still fences the stand rule with ' + START + ' / ' + END);

const sandbox = {};
vm.runInNewContext(apt.slice(from, to) + '\nthis.standState = standState; this.STALE = STAND_STALE_MS;', sandbox);
const { standState, STALE } = sandbox;
const now = Date.parse('2026-09-23T14:05:00Z');
const minutes = (m) => new Date(now - m * 60000).toISOString();

check(STALE === 30 * 60 * 1000, 'the warning starts after thirty minutes');
check(standState(null, now).kind === 'none', 'no sign of life yet is its own state');
check(standState('kaputt', now).kind === 'none', 'an unreadable time counts as no sign of life');
check(standState(42, now).kind === 'none', 'only text is read as a time');
check(standState(minutes(0), now).kind === 'ok', 'a fresh sign of life is fine');
check(standState(minutes(29), now).kind === 'ok', 'one slow upload does not trip the warning');
check(standState(minutes(31), now).kind === 'stale', 'half an hour of silence does');
check(standState(minutes(-5), now).kind === 'ok', 'a Pi clock a little ahead is not a warning');
check(standState(minutes(31), now).at === now - 31 * 60000, 'the line reports when the Pi was last heard');

/* ---- the switch ---- */
check(/fetch\('\.\/modus\.json'/.test(apt), 'the copy is recognised by modus.json');
check(apt.includes("j.modus === 'nurlesen'"), 'only "nurlesen" switches to the read-only copy');
check(/fetch\('\.\/lebenszeichen\.json'/.test(apt), 'the stand line reads lebenszeichen.json');
check(apt.includes('if (READ_ONLY) startStandLine();'), 'only the copy shows the stand line');

/* ---- the Pi keeps its menu, the copy never asks for it ---- */
check(/function tryAutoUnlock\(\) \{\s*\/\/[^\n]*\n\s*if \(READ_ONLY\) return;/.test(apt),
  'the copy never asks menu.php, whatever triggers the probe');
check(apt.includes('MODUS_READY.then(tryAutoUnlock);'), 'the first probe waits until the mode is known');
check(!/\n  tryAutoUnlock\(\);\n/.test(apt), 'no probe fires before the mode is known');
check(apt.includes('menuShellEl.hidden = READ_ONLY;'), 'the menu comes back on the Pi once the mode is known');

/* ---- nothing to play on the copy ---- */
check(css.includes('.read-only .postcard-recordings { display: none; }'), 'the copy hides the recordings');
check(css.includes('.stand-line.stale'), 'a silent station is marked');

process.stdout.write('read-only copy: ' + checks + ' checks passed\n');
