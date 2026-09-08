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

/* ---- switching language ----
   The switch used to reload the page. It must never do that again: a
   reload re-rolls the collage's per-species pose, and the birds visibly
   re-shuffle under what is meant to be a change of lettering only. */
const switcher = loadI18N({ stored: { 'bird:lang': 'de' } });
const heard = [];
switcher.I18N.onChange(function (what) { heard.push(what); });
switcher.I18N.setLang('fr');
check(switcher.store['bird:lang'] === 'fr', 'the choice is stored');
check(switcher.reloads.count === 0, 'switching never reloads the page');
check(heard.join(',') === 'lang', 'it announces the change so the surfaces re-resolve in place');
check(switcher.I18N.t('nav.collage') === DICTS.fr['nav.collage'], 'and the live dictionary followed');
switcher.I18N.setLang('fr');
check(heard.length === 1, 'choosing the language already in use does nothing');
switcher.I18N.setLang('it');
check(heard.length === 1, 'an unsupported language is refused');

/* ---- bird name mode ----
   Independent of the language: the interface can be German while the
   birds are named in Latin. Nothing server-side depends on it, because
   every payload already carries both names. */
const names = loadI18N({});
const namesHeard = [];
names.I18N.onChange(function (what) { namesHeard.push(what); });
check(names.I18N.nameMode === 'common', 'common names are the default');
check(names.I18N.speciesName('Great Tit', 'Parus major') === 'Great Tit',
  'common mode prints the common name');
names.I18N.setNameMode('sci');
check(names.store['bird:names'] === 'sci', 'the name mode is stored');
check(names.reloads.count === 0, 'the name mode never reloads either');
check(namesHeard.join(',') === 'names', 'a name change announces itself as a name change');
check(names.I18N.speciesName('Great Tit', 'Parus major') === 'Parus major',
  'scientific mode prints the binomial');
check(names.I18N.speciesName('Great Tit', '') === 'Great Tit',
  'a row with no binomial keeps its common name');
check(names.I18N.speciesName('', 'Parus major') === 'Parus major',
  'and a row with no common name is never nameless');
names.I18N.setNameMode('klingon');
check(namesHeard.length === 1, 'an unknown name mode is refused');
check(names.I18N.t('nav.collage') === DICTS.en['nav.collage'],
  'switching bird names leaves the interface language alone');

const pinnedNames = loadI18N({ search: '?names=sci', stored: { 'bird:names': 'common' } });
check(pinnedNames.I18N.nameMode === 'sci', 'the URL pins the name mode over the stored choice');
check(pinnedNames.I18N.namesPinned === true, 'a pinned mode hides its switch, as the kiosk needs');
const storedNames = loadI18N({ stored: { 'bird:names': 'sci' } });
check(storedNames.I18N.nameMode === 'sci', 'the stored choice wins when nothing is pinned');
check(storedNames.I18N.namesPinned === false, 'and it leaves the switch on screen');

process.stdout.write('i18n dictionary tests passed (' + checks + ' checks)\n');
