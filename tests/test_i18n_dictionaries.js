#!/usr/bin/env node
'use strict';

/* The translation tables themselves: are German and French complete, do
   their placeholders still line up with English, and does the language
   resolution behave the way the kiosk display and the header switch
   depend on. */

const assert = require('assert');
const { loadI18N, makeElement } = require('./i18n_env');

let checks = 0;
function check(condition, message) {
  checks += 1;
  if (!condition) {
    process.stderr.write('FAIL: ' + message + '\n');
    process.exit(1);
  }
}

const base = loadI18N({});
const DICTS = base.I18N.DICTS;
const EN = DICTS.en;
const enKeys = Object.keys(EN).sort();

check(base.I18N.SUPPORTED.join(',') === 'en,de,fr', 'three supported languages');
check(enKeys.length > 100, 'the English table actually carries the UI');

/* ---- completeness: no key may go missing, none may drift in ---- */
['de', 'fr'].forEach(function (lang) {
  const keys = Object.keys(DICTS[lang]).sort();
  const missing = enKeys.filter(function (k) { return keys.indexOf(k) < 0; });
  const extra = keys.filter(function (k) { return enKeys.indexOf(k) < 0; });
  check(missing.length === 0, lang + ' is missing keys: ' + missing.join(', '));
  check(extra.length === 0, lang + ' has keys English does not: ' + extra.join(', '));
});

/* ---- no empty or untranslated-by-accident values ---- */
Object.keys(DICTS).forEach(function (lang) {
  Object.keys(DICTS[lang]).forEach(function (key) {
    const value = DICTS[lang][key];
    check(typeof value === 'string' && value.trim() !== '',
      lang + '.' + key + ' is empty');
  });
});

/* ---- placeholders must survive translation ---- */
function placeholders(text) {
  return (String(text).match(/\{(\w+)\}/g) || []).sort().join(',');
}
['de', 'fr'].forEach(function (lang) {
  enKeys.forEach(function (key) {
    check(placeholders(EN[key]) === placeholders(DICTS[lang][key]),
      lang + '.' + key + ' placeholder mismatch: "' + EN[key] + '" vs "' + DICTS[lang][key] + '"');
  });
});

/* ---- plural pairs come as pairs ---- */
enKeys.forEach(function (key) {
  if (/_one$/.test(key)) {
    check(EN[key.replace(/_one$/, '_other')] !== undefined, key + ' has no _other sibling');
  }
  if (/_other$/.test(key)) {
    check(EN[key.replace(/_other$/, '_one')] !== undefined, key + ' has no _one sibling');
  }
});

/* ---- Swiss spelling: the whole project is written without eszett ---- */
Object.keys(DICTS.de).forEach(function (key) {
  check(DICTS.de[key].indexOf('ß') < 0, 'de.' + key + ' uses eszett, Swiss spelling does not');
});

/* ---- language resolution order ----
   URL wins over the stored choice, which is how the kiosk screen pins a
   language that nobody can knock loose from the browser. */
check(loadI18N({ search: '?lang=fr', stored: { 'bird:lang': 'de' }, languages: ['en-US'] }).I18N.lang === 'fr',
  'URL parameter beats the stored choice');
check(loadI18N({ stored: { 'bird:lang': 'de' }, languages: ['en-US'] }).I18N.lang === 'de',
  'stored choice beats the browser');
check(loadI18N({ languages: ['fr-CH', 'de-CH'] }).I18N.lang === 'fr',
  'browser language is used when nothing is stored');
check(loadI18N({ languages: ['it-CH'] }).I18N.lang === 'en',
  'an unsupported browser language falls back to English');
check(loadI18N({ search: '?lang=xx', stored: { 'bird:lang': 'de' } }).I18N.lang === 'de',
  'an unsupported URL language is ignored rather than honoured');
check(loadI18N({ search: '?lang=de' }).I18N.pinned === true, 'a URL language marks itself pinned');
check(loadI18N({ stored: { 'bird:lang': 'de' } }).I18N.pinned === false,
  'a stored language is not pinned, so the switch stays visible');

/* ---- fallback: never render an empty box ---- */
const de = loadI18N({ stored: { 'bird:lang': 'de' } }).I18N;
check(de.t('title.heardRecently') === DICTS.de['title.heardRecently'], 'German lookup');
check(de.t('does.not.exist') === 'does.not.exist', 'an unknown key returns the key, not empty');

/* A key present in English but not in a translation must render English.
   Simulated by deleting it from the loaded table, which is exactly the
   state a half-finished translation would leave behind. */
const patched = loadI18N({ stored: { 'bird:lang': 'de' } }).I18N;
delete patched.DICTS.de['pc.rarity'];
check(patched.t('pc.rarity') === EN['pc.rarity'], 'a missing translation falls back to English');

/* ---- interpolation and plurals ---- */
check(de.t('stats.mostHeardOf', { n: 3, total: 9 }).indexOf('3') >= 0
  && de.t('stats.mostHeardOf', { n: 3, total: 9 }).indexOf('9') >= 0,
  'placeholders are filled');
check(de.t('stats.mostHeardOf', { n: 3 }).indexOf('{total}') >= 0,
  'an unsupplied placeholder is left visible rather than blanked');
check(de.plural('pc.recCount', 1) === '1 Aufnahme', 'German singular');
check(de.plural('pc.recCount', 4) === '4 Aufnahmen', 'German plural');
check(de.plural('pc.recCount', 0) === '0 Aufnahmen', 'zero takes the plural form');
const fr = loadI18N({ search: '?lang=fr' }).I18N;
check(fr.plural('atlas.speciesCount', 1) === '1 espèce', 'French singular');
check(fr.plural('atlas.speciesCount', 2) === '2 espèces', 'French plural');

/* ---- locale-aware formatting ---- */
check(de.locale() === 'de-CH', 'German uses the Swiss locale');
check(fr.locale() === 'fr-CH', 'French uses the Swiss locale');
check(de.weekdayLetters().length === 7, 'seven weekday initials for the calendar header');
check(fr.weekdayLetters()[0] === 'D', 'French weeks start on dimanche in this header');

/* ---- family labels ---- */
check(de.familyLabel('Thrushes') === 'Drosseln', 'family label translated');
check(de.familyLabel('') === DICTS.de['family.Other'], 'empty family falls back to Other');
check(de.familyLabel('Nonexistent Family') === 'family.Nonexistent Family',
  'an unmapped family is visible as such rather than silently blank');

/* ---- static markup application ---- */
const textEl = makeElement({ 'data-i18n': 'pc.close' });
const attrEl = makeElement({ 'data-i18n-attr': 'aria-label:cal.prevDay;title:cal.nextDay' });
const htmlEl = makeElement({ 'data-i18n-html': 'about.body' });
const metaEl = makeElement({ name: 'description' }, 'meta');
const dom = loadI18N({
  stored: { 'bird:lang': 'de' },
  elements: [textEl, attrEl, htmlEl, metaEl]
});
check(textEl.textContent === DICTS.de['pc.close'], 'data-i18n sets text');
check(attrEl.getAttribute('aria-label') === DICTS.de['cal.prevDay'], 'data-i18n-attr sets the first attribute');
check(attrEl.getAttribute('title') === DICTS.de['cal.nextDay'], 'data-i18n-attr sets the second attribute');
check(htmlEl.innerHTML === DICTS.de['about.body'], 'data-i18n-html sets markup');
check(htmlEl.innerHTML.indexOf('birdnet.cornell.edu') >= 0, 'the BirdNET credit link survives translation');
check(dom.document.documentElement.getAttribute('lang') === 'de', 'the document language attribute follows');
check(metaEl.getAttribute('content') === DICTS.de['meta.description'], 'the page description follows');

/* ---- switching language ---- */
const switcher = loadI18N({ stored: { 'bird:lang': 'de' } });
switcher.I18N.setLang('fr');
check(switcher.store['bird:lang'] === 'fr', 'the choice is stored');
check(switcher.reloads.count === 1, 'switching reloads once so every surface re-resolves');
switcher.I18N.setLang('fr');
check(switcher.reloads.count === 1, 'choosing the language already in use does nothing');
switcher.I18N.setLang('it');
check(switcher.reloads.count === 1, 'an unsupported language is refused');

process.stdout.write('i18n dictionary tests passed (' + checks + ' checks)\n');
