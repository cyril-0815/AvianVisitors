#!/usr/bin/env node
'use strict';

/* The kiosk display (a Pi with no keyboard) picks its own time window,
   and that is the one part of the kiosk work with rules worth arguing
   about: when to climb, when to come back down, and how hard to make it
   change its mind. Getting the brake wrong is not a cosmetic bug - the
   screen would repack the whole collage every 30 seconds.

   The rules are therefore written as a pure function inside apt.js,
   fenced by two markers, so this suite can lift it out and exercise it
   without a DOM, a network or a clock. Everything else here is a source
   check on the pieces that have no logic to test but must not silently
   go missing. */

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
const apt = fs.readFileSync(path.join(repo, 'avian', 'frontend', 'apt.js'), 'utf8');
const css = fs.readFileSync(path.join(repo, 'avian', 'frontend', 'styles.css'), 'utf8');
const api = fs.readFileSync(path.join(repo, 'avian', 'api', 'birdnet-api.php'), 'utf8');

/* ---- lift the decision out of apt.js ---- */
const START = '// >>> autowindow-decide';
const END = '// <<< autowindow-decide';
const from = apt.indexOf(START);
const to = apt.indexOf(END);
check(from !== -1 && to > from,
  'apt.js still fences the decision with ' + START + ' / ' + END
  + ' - this suite lifts that block out and cannot run without it');
const sandbox = {};
vm.runInNewContext(apt.slice(from, to), sandbox);
const choose = sandbox.autoWindowChoice;
check(typeof choose === 'function', 'the fenced block defines autoWindowChoice()');

const LADDER = [1, 12, 24, 168, 1000000];
const ALL = 1000000;
function decide(counts, current, state) {
  return choose({
    ladder: LADDER, counts: counts, current: current,
    minUp: 4, minDown: 5, checks: 3,
    downTarget: (state && state.downTarget) || null,
    downStreak: (state && state.downStreak) || 0
  });
}
// Species counts for every rung, written the way the API returns them.
function counts(one, twelve, day, week, all) {
  return { '1': one, '12': twelve, '24': day, '168': week, '1000000': all };
}

/* ---- climbing ---- */
let out = decide(counts(2, 6, 9, 20, 34), 1);
check(out.hours === 12, 'a thin hour climbs to the next window that clears the bar');

out = decide(counts(1, 3, 9, 20, 34), 1);
check(out.hours === 24, 'climbing skips a window that is thin as well');

out = decide(counts(0, 0, 0, 2, 2), 1);
check(out.hours === ALL,
  'when nothing clears the bar the screen stands on ALL and shows what there is');

out = decide(counts(0, 0, 0, 0, 0), 24);
check(out.hours === ALL, 'an empty database lands on ALL rather than climbing into nothing');

out = decide(counts(4, 9, 12, 20, 34), 1);
check(out.hours === 1, 'a window that exactly meets the threshold is kept');

/* ---- climbing is immediate, and clears a pending descent ---- */
out = decide(counts(6, 9, 12, 20, 34), 24, { downTarget: 1, downStreak: 1 });
check(out.hours === 24 && out.downTarget === 1 && out.downStreak === 2,
  'a descent that is one check short is still pending, not applied');
out = decide(counts(2, 2, 2, 20, 34), 24, { downTarget: 1, downStreak: 2 });
check(out.hours === 168 && out.downTarget === null && out.downStreak === 0,
  'a climb drops any half-finished descent');

/* ---- descending needs three agreeing checks ---- */
let state = { downTarget: null, downStreak: 0 };
const busy = counts(6, 9, 12, 20, 34);
state = decide(busy, 24, state);
check(state.hours === 24 && state.downStreak === 1, 'first full check only starts the run');
state = decide(busy, 24, state);
check(state.hours === 24 && state.downStreak === 2, 'second check still holds the window');
state = decide(busy, 24, state);
check(state.hours === 1, 'the third check in a row is what moves the screen down');
check(state.downTarget === null && state.downStreak === 0, 'the run resets after it fires');

/* ---- descending needs one species more than climbing did ---- */
state = { downTarget: null, downStreak: 0 };
const borderline = counts(4, 4, 12, 20, 34);
for (let i = 0; i < 5; i++) state = decide(borderline, 24, state);
check(state.hours === 24 && state.downTarget === null && state.downStreak === 0,
  'a shorter window that only meets the climb threshold never pulls the screen down: '
  + 'that is the whole point of the asymmetry');

/* ---- an interrupted run starts over ---- */
state = { downTarget: null, downStreak: 0 };
state = decide(busy, 24, state);
state = decide(busy, 24, state);
check(state.downStreak === 2, 'two checks in');
state = decide(counts(4, 4, 12, 20, 34), 24, state);
check(state.downStreak === 0 && state.downTarget === null,
  'one check where the shorter window falls back wipes the run');
state = decide(busy, 24, state);
check(state.hours === 24 && state.downStreak === 1, 'and the run starts from one again');

/* ---- descending goes to the shortest window that qualifies ---- */
state = { downTarget: null, downStreak: 0 };
const rich = counts(6, 9, 12, 20, 34);
for (let i = 0; i < 3; i++) state = decide(rich, ALL, state);
check(state.hours === 1, 'from ALL the screen returns to the liveliest window, not the next one');

state = { downTarget: null, downStreak: 0 };
const quietHour = counts(4, 9, 12, 20, 34);
for (let i = 0; i < 3; i++) state = decide(quietHour, ALL, state);
check(state.hours === 12, 'and it stops at the shortest window that is comfortably full');

/* ---- odd input cannot wedge the screen ---- */
out = decide(counts(6, 9, 12, 20, 34), 999);
check(LADDER.indexOf(out.hours) >= 0, 'a window outside the ladder still resolves to a real rung');
out = choose({
  ladder: LADDER, counts: null, current: 24,
  minUp: 4, minDown: 5, checks: 3, downTarget: null, downStreak: 0
});
check(out.hours === ALL, 'missing counts read as empty, which is the ALL case, not a crash');

/* ---- the automatic choice must never be persisted ----
   Writing it to bird:window would let the kiosk overwrite a window
   somebody picked by hand in that browser. */
const applyFrom = apt.indexOf('function autoApplyWindow');
const applyTo = apt.indexOf('function autoDecide');
check(applyFrom !== -1 && applyTo > applyFrom, 'apt.js still has autoApplyWindow / autoDecide');
check(apt.slice(applyFrom, applyTo).indexOf('writeLS(') === -1,
  'the automatic window is applied without writeLS: it overlays the saved choice, '
  + 'it does not replace it');

/* ---- the parameters the kiosk URL is made of ---- */
[
  ["qsParam('chrome')", 'chrome'],
  ["qsParam('view')", 'view'],
  ["qsParam('window')", 'window'],
  ["qsParam('minspecies')", 'minspecies']
].forEach(function (pair) {
  check(apt.indexOf(pair[0]) !== -1, 'apt.js reads the ?' + pair[1] + '= parameter');
});
check(apt.indexOf('action=windowcounts') !== -1,
  'the picker asks the counting endpoint, not the ladder of recent calls');
check(apt.indexOf("var AUTO_LADDER = [1, 12, 24, 168, 1000000]") !== -1,
  'the frontend ladder is the five windows the header offers');

/* ---- chrome=off has to reach every control ---- */
['winPick', 'langPick', 'namePick', 'slider', 'menuShell'].forEach(function (id) {
  check(new RegExp("'" + id + "'").test(apt.slice(apt.indexOf('if (CHROME_OFF)'),
    apt.indexOf('if (CHROME_OFF)') + 600)),
    'chrome=off hides #' + id);
});
check(/\.top\[hidden\][^{]*\{[^}]*display:\s*none/.test(css)
  && /\.slider\[hidden\]|\.menu-shell\[hidden\]/.test(css),
  'styles.css beats the display rules of the header, menu and slider when they are hidden - '
  + 'plain [hidden] loses against them');

/* ---- the endpoint behind it ---- */
check(api.indexOf("case 'windowcounts'") !== -1, 'the API serves action=windowcounts');
const caseFrom = api.indexOf("case 'windowcounts'");
const caseTo = api.indexOf('case ', caseFrom + 10);
const body = api.slice(caseFrom, caseTo === -1 ? api.length : caseTo);
check(body.indexOf('$ladder = [1, 12, 24, 168, 1000000]') !== -1,
  'the API counts the same five windows the frontend climbs');
check((body.match(/one\(\$db/g) || []).length === 1,
  'the counting endpoint is one statement: walking the ladder with a query per rung is '
  + 'exactly what it exists to avoid');
check(body.indexOf('Confidence') === -1,
  'the counter applies no confidence filter of its own - CONFIDENCE already decided what '
  + 'reached the database, so filtering again would make the count disagree with the screen');

/* ---- the heading names the window ----
   With the pills gone the title is the only thing on the kiosk screen
   that says which period is on show, so it has to follow the window -
   including when the automatic picker moves it, which no click reports. */
const i18n = fs.readFileSync(path.join(repo, 'avian', 'frontend', 'i18n.js'), 'utf8');
const TITLE_KEYS = [
  'title.heardLastHour', 'title.heardLast12h', 'title.heardLast24h',
  'title.heardLast7d', 'title.heardAll'
];
TITLE_KEYS.forEach(function (key) {
  const seen = (i18n.match(new RegExp("'" + key + "':", 'g')) || []).length;
  check(seen === 3, key + ' is written in all three dictionaries (found ' + seen + ')');
  check(apt.indexOf("'" + key + "'") !== -1, 'apt.js can choose ' + key);
});
check(/function titleKeyForWindow\(hours\)/.test(apt),
  'apt.js picks the heading from the window');
const applyBody = apt.slice(applyFrom, applyTo);
check(applyBody.indexOf('refreshViewTitles()') !== -1,
  'an automatic window change re-letters the heading - otherwise the kiosk screen would '
  + 'silently show one period under the name of another');
check(/writeLS\('bird:window'[\s\S]{0,200}refreshViewTitles\(\)/.test(apt),
  'a window picked by hand re-letters the heading too');

process.stdout.write('auto window tests passed (' + checks + ' checks)\n');
