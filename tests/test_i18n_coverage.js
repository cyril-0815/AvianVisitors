#!/usr/bin/env node
'use strict';

/* Does the translation layer actually cover the public UI?

   The dictionary test proves the tables agree with each other. This one
   proves they agree with the code: every key the markup and the collage
   script ask for exists, every family the stamp taxonomy can produce has
   a label, and none of the English strings that used to be hard-coded
   are still sitting in the public part of apt.js.

   The admin overlays stay English by design, so everything below stops
   at ADMIN_BOUNDARY. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadI18N } = require('./i18n_env');

let checks = 0;
function check(condition, message) {
  checks += 1;
  if (!condition) {
    process.stderr.write('FAIL: ' + message + '\n');
    process.exit(1);
  }
}

const frontend = path.join(__dirname, '..', 'avian', 'frontend');
const apt = fs.readFileSync(path.join(frontend, 'apt.js'), 'utf8');
const stamps = fs.readFileSync(path.join(frontend, 'stamps.js'), 'utf8');
const html = fs.readFileSync(path.join(frontend, 'index.html'), 'utf8');
const EN = loadI18N({}).I18N.DICTS.en;

/* apt.js is one file with public and admin code interleaved, so the
   split has to be explicit. Two public stretches were translated:

     start            .. "Menu dropdown"      collage, stats, atlas
     "Hash routing"   .. ADMIN_TITLES         the postcard

   and two admin stretches were deliberately left in English: the menu
   with its unlock form and session handling, and the Settings / System /
   Logs / Tools screens at the end. */
function offset(marker) {
  const at = apt.indexOf(marker);
  assert.notStrictEqual(at, -1, 'missing section marker: ' + marker);
  return at;
}
const MENU_START = offset('  // ---- Menu dropdown');
const POSTCARD_START = offset('  // ---- Hash routing + atlas detail modal ----');
const ADMIN_SCREENS_START = offset('  var ADMIN_TITLES = {');
check(MENU_START < POSTCARD_START && POSTCARD_START < ADMIN_SCREENS_START,
  'the section markers are in the expected order');

const publicApt = apt.slice(0, MENU_START) + apt.slice(POSTCARD_START, ADMIN_SCREENS_START);
const adminApt = apt.slice(MENU_START, POSTCARD_START) + apt.slice(ADMIN_SCREENS_START);

/* ---- script order: i18n.js must be parsed before anything renders ---- */
const orderI18n = html.indexOf('i18n.js');
const orderStamps = html.indexOf('stamps.js?');
const orderApt = html.indexOf('apt.js?');
check(orderI18n > 0, 'index.html loads i18n.js');
check(orderI18n < orderStamps, 'i18n.js loads before stamps.js');
check(orderI18n < orderApt, 'i18n.js loads before apt.js');

/* ---- every key the markup asks for exists ---- */
const markupKeys = new Set();
(html.match(/data-i18n(?:-html)?="([^"]+)"/g) || []).forEach(function (hit) {
  markupKeys.add(/="([^"]+)"/.exec(hit)[1]);
});
(html.match(/data-i18n-attr="([^"]+)"/g) || []).forEach(function (hit) {
  /="([^"]+)"/.exec(hit)[1].split(';').forEach(function (pair) {
    const bits = pair.split(':');
    if (bits.length === 2) markupKeys.add(bits[1].trim());
  });
});
check(markupKeys.size > 40, 'the static markup is actually annotated (' + markupKeys.size + ' keys)');
markupKeys.forEach(function (key) {
  check(EN[key] !== undefined, 'index.html asks for unknown key ' + key);
});

/* ---- every key the collage script asks for exists ---- */
const codeKeys = new Set();
const pluralKeys = new Set();
let hit;
/* TP() keys name a pair, so they are checked as _one/_other below rather
   than as literal entries. */
const plurals = /\bTP\(\s*'([^']+)'/g;
while ((hit = plurals.exec(publicApt)) !== null) pluralKeys.add(hit[1]);
const direct = /\bTP?\(\s*'([^']+)'/g;
while ((hit = direct.exec(publicApt)) !== null) codeKeys.add(hit[1]);
const ternary = /\bTP?\(\s*[^)'"]*\?\s*'([^']+)'\s*:\s*'([^']+)'/g;
while ((hit = ternary.exec(publicApt)) !== null) { codeKeys.add(hit[1]); codeKeys.add(hit[2]); }
check(codeKeys.size > 40, 'apt.js actually calls into the dictionary (' + codeKeys.size + ' keys)');
codeKeys.forEach(function (key) {
  if (pluralKeys.has(key)) return;
  // T('rarity.' + key) builds its key at runtime; the grades are checked
  // against rarityLabel() further down.
  if (key.slice(-1) === '.') return;
  check(EN[key] !== undefined, 'apt.js asks for unknown key ' + key);
});

check(pluralKeys.size >= 3, 'the plural helper is in use (' + pluralKeys.size + ' pairs)');
pluralKeys.forEach(function (key) {
  check(EN[key + '_one'] !== undefined && EN[key + '_other'] !== undefined,
    'TP(' + key + ') has no _one/_other pair');
});

/* ---- every family the stamp taxonomy can hand back has a label ----
   familyOf() returns a GENUS_GROUP value or 'Other'. A new genus block
   upstream must not silently show up untranslated. */
function objectBlock(source, declaration) {
  const start = source.indexOf(declaration);
  assert.notStrictEqual(start, -1, 'missing ' + declaration);
  const end = source.indexOf('\n  }', start);
  assert.notStrictEqual(end, -1, 'unterminated ' + declaration);
  return source.slice(start, end);
}
const families = new Set(['Other']);
(objectBlock(stamps, 'var GENUS_GROUP = {').match(/:\s*'([^']+)'/g) || []).forEach(function (raw) {
  families.add(/'([^']+)'/.exec(raw)[1]);
});
(objectBlock(stamps, "var GROUP_LATIN = {").match(/'([^']+)'\s*:/g) || []).forEach(function (raw) {
  families.add(/'([^']+)'/.exec(raw)[1]);
});
check(families.size >= 20, 'found the family taxonomy (' + families.size + ' groups)');
families.forEach(function (family) {
  check(EN['family.' + family] !== undefined, 'no label for family "' + family + '"');
});

/* ---- rarity keys match what rarityLabel() can return ---- */
const rarityBody = publicApt.slice(publicApt.indexOf('function rarityLabel('));
const rarities = (rarityBody.slice(0, 500).match(/return '([a-z]+)';/g) || [])
  .map(function (raw) { return /'([a-z]+)'/.exec(raw)[1]; });
check(rarities.length === 4, 'rarityLabel returns four grades, got ' + rarities.length);
rarities.forEach(function (grade) {
  check(EN['rarity.' + grade] !== undefined, 'no label for rarity "' + grade + '"');
});

/* ---- the stamp family label goes through the dictionary, the key does not ----
   data-family and the Doves & Pigeons flight-plate rule both key off the
   English value, so translating familyOf() itself would break layout. */
check(/\{\{FAMILY\}\}\/g, esc\(familyLabel\(fam\)\)/.test(stamps.replace(/\\/g, '')),
  'the printed family label is translated');
check(/function familyOf\(sci\) \{ return groupFor\(sci\) \|\| 'Other'; \}/.test(stamps),
  'familyOf still returns the English lookup key');
check(stamps.indexOf("data-family=\"' + esc(fam)") >= 0,
  'data-family still carries the English key');
check(stamps.indexOf("fam === 'Doves & Pigeons'") >= 0,
  'the flight-plate rule still compares against the English key');

/* ---- no English left behind in the public half of apt.js ----
   These are the exact literals the translation replaced. Any of them
   reappearing means a merge dropped part of this work. */
const RETIRED = [
  "'Heard Recently'", "'Avian Atlas'", "'no detections heard in this window'",
  "'this hour'", "'past 12h'", "'this week'", "'all time'",
  "'selected hour'", "'final 12h'", "'selected day'", "'selected 7 days'",
  "'through selected day'",
  "'detections, grouped by recency'", "'newest additions to the life list'",
  "'life list as of '", "'detections through '", "'most-heard, '",
  "' most-heard of '", "'no detections yet'", "'that day'", "'d ago'", "'d prior'",
  "\"Week's Rhythm\"", "\"Hour's Rhythm\"", "\"Today's Rhythm\"", "\"Day's Rhythm\"",
  "'Choose stats date, '", "'Show more'", "'Show less'",
  "'No birds detected yet.'", "' species</em>'",
  "'s ago'", "'m ago'", "'h ago'",
  "'Play recording'", "'Pause recording'", "' percent'",
  "'Repeat a selected section'", "'Stop repeating selected section'",
  "'generate image'", "'unlock in menu to generate'", "'unlock in menu to check progress'",
  "'failed, try again'", "'add a gemini key in settings'",
  "'Loading description...'", "'No description available.'",
  "'Loading recordings...'", "'No recordings yet.'", "'Failed to load recordings.'",
  "'loading spectrogram...'", "' recordings'", "' recording'",
  "'call' : 'calls'"
];
RETIRED.forEach(function (literal) {
  check(publicApt.indexOf(literal) < 0,
    'English literal still hard-coded in the public UI: ' + literal);
});

/* toLocale* calls in the public half must follow the chosen language. */
const strayLocale = (publicApt.match(/toLocale(?:Date)?String\(undefined/g) || []).length;
check(strayLocale === 0, strayLocale + ' date/number formats still use the browser locale');

/* ---- the admin side is deliberately untouched ---- */
check(adminApt.indexOf("settings: 'Settings'") >= 0, 'admin titles are still English');
check(adminApt.indexOf('Admin controls locked.') >= 0, 'the unlock flow is still English');
check((adminApt.match(/\bTP?\(\s*'/g) || []).length === 0,
  'the admin overlays were left out of the translation, as agreed');
check(publicApt.indexOf('function rarityLabel(') > 0, 'the postcard stretch is part of the public slice');
check(publicApt.indexOf("T('pc.generate')") > 0, 'the postcard generate button is part of the public slice');

/* ---- every API call carries the language ---- */
check(/function withLang\(url\)/.test(apt), 'apt.js has the language-tagging helper');
check(/return fetch\(withLang\(url\)/.test(apt), 'fetchJson routes through it');
const rawFetches = (publicApt.match(/fetch\('\.\/avian\/api\/birdnet-api\.php/g) || []).length;
check(rawFetches === 0, 'no API call bypasses withLang()');

/* ---- the language switch is public and kiosk-aware ---- */
const css = fs.readFileSync(path.join(frontend, 'styles.css'), 'utf8');
check(/\.top \.lang-pick\[hidden\] \{ display: none; \}/.test(css),
  'a pinned language really hides the pill: [hidden] alone loses to .top .window-pick');
check(/\.top \{ gap: 10px; justify-content: flex-start; \}/.test(css),
  'both header pills stay on the left, clear of the fixed menu button');
check(html.indexOf('class="window-pick lang-pick"') >= 0,
  'the language pill reuses the window picker component');

check(html.indexOf('id="langPick"') >= 0, 'the header carries the language switch');
check(html.indexOf('id="langPick"') < html.indexOf('class="menu-shell"'),
  'the switch sits in the header, not inside the admin menu');
check(/if \(I18N\.pinned\) \{\s*langPick\.hidden = true;/.test(apt),
  'a pinned language hides the switch, so the kiosk screen stays clean');

process.stdout.write('i18n coverage tests passed (' + checks + ' checks)\n');
