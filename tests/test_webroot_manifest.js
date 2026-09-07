#!/usr/bin/env node
'use strict';

/* The webroot is built from an explicit manifest in link_webroot.sh, not
   from a directory listing. A file added to avian/frontend/ and wired
   into index.html therefore reaches the browser only if it is also
   listed there.

   That failure is silent and easy to miss: index.html still loads, the
   missing script simply 404s, and the page renders in whatever degraded
   state the rest of the code falls back to. This test closes that gap by
   comparing what index.html asks for against what the manifest links. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let checks = 0;
function check(condition, message) {
  checks += 1;
  if (!condition) {
    process.stderr.write('FAIL: ' + message + '\n');
    process.exit(1);
  }
}

const repo = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(repo, 'avian', 'frontend', 'index.html'), 'utf8');
const linker = fs.readFileSync(path.join(repo, 'scripts', 'link_webroot.sh'), 'utf8');

/* ---- what the manifest publishes ---- */
function arrayBlock(name) {
  const start = linker.indexOf(name + '=(');
  assert.notStrictEqual(start, -1, 'missing ' + name + ' array');
  const end = linker.indexOf(')', start);
  assert.notStrictEqual(end, -1, 'unterminated ' + name + ' array');
  return (linker.slice(start, end).match(/"([^"]+)"/g) || [])
    .map(function (raw) { return raw.slice(1, -1); });
}
const sources = arrayBlock('sources');
const targets = arrayBlock('targets');
check(sources.length === targets.length,
  'the manifest pairs up: ' + sources.length + ' sources, ' + targets.length + ' targets');
check(targets.length > 20, 'the manifest was actually parsed (' + targets.length + ' entries)');
const published = new Set(targets);

/* ---- what index.html asks the webroot for ----
   Only same-directory references matter; those resolve against the site
   root, which is exactly what the manifest fills. */
const requested = new Set();
(html.match(/(?:src|href)="\.\/([^"?]+)/g) || []).forEach(function (raw) {
  requested.add(/\.\/([^"?]+)/.exec(raw)[1]);
});
check(requested.size >= 10, 'index.html references local assets (' + requested.size + ')');

requested.forEach(function (asset) {
  const top = asset.split('/')[0];
  check(published.has(asset) || published.has(top),
    'index.html loads "' + asset + '" but link_webroot.sh never publishes it, '
    + 'so it would 404 in the webroot');
});

/* ---- every published frontend source really exists ----
   A stale manifest entry aborts the whole linking run, which would leave
   the webroot half-updated on the next install or data reset. */
sources.forEach(function (source) {
  if (source.indexOf('${frontend_dir}/') !== 0) return;
  const name = source.slice('${frontend_dir}/'.length);
  check(fs.existsSync(path.join(repo, 'avian', 'frontend', name)),
    'the manifest lists avian/frontend/' + name + ', which does not exist');
});

/* ---- the translation layer in particular ----
   It loads before stamps.js and apt.js and everything they render reads
   from it, so a missing link degrades the whole public UI to raw keys. */
check(published.has('i18n.js'), 'i18n.js is published to the webroot');

process.stdout.write('webroot manifest tests passed (' + checks + ' checks)\n');
