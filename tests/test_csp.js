#!/usr/bin/env node
'use strict';

/* The page must also run under a strict Content-Security-Policy without
   'unsafe-inline', the way a copy behind a login portal is
   served. Two rules follow from that for index.html: no code in the
   page itself, and no style="..." in its markup. Styles that the
   scripts build as HTML strings are re-applied by boot.js, which is why
   boot.js has to be the first script the page loads.

   Whether boot.js really rescues those styles can only be seen in a
   browser; this suite guards the pieces that must not silently go
   missing. */

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

const frontend = path.join(__dirname, '..', 'avian', 'frontend');
const html = fs.readFileSync(path.join(frontend, 'index.html'), 'utf8');
const boot = fs.readFileSync(path.join(frontend, 'boot.js'), 'utf8');

/* ---- no code and no looks inside the page ---- */
const scripts = html.match(/<script\b[^>]*>/gi) || [];
check(scripts.length > 0, 'index.html loads scripts');
scripts.forEach(function (tag) {
  check(/\bsrc=/.test(tag), 'every script comes from a file: ' + tag);
});
check(!/<style\b/i.test(html), 'no <style> block in index.html');
check(!/\sstyle="/i.test(html), 'no style="..." in the markup of index.html');
check(!/\son[a-z]+="/i.test(html), 'no onclick="..." or other inline handler in index.html');
check(!/javascript:/i.test(html), 'no javascript: address in index.html');

/* ---- boot.js runs first ---- */
const head = html.slice(0, html.indexOf('</head>'));
const firstScript = head.search(/<script\b/i);
const firstSheet = head.search(/<link rel="stylesheet"/i);
check(firstScript !== -1, 'boot.js is loaded in <head>');
check(/^<script src="\.\/boot\.js\?v=r\d+"><\/script>/.test(head.slice(firstScript)),
  'the first script in <head> is boot.js, with a version for the cache');
check(firstScript < firstSheet, 'boot.js comes before the stylesheets, so the theme is set before first paint');

/* ---- boot.js keeps both jobs ---- */
check(boot.includes("d.setAttribute('data-theme'"), 'boot.js still resolves the theme');
check(boot.includes('// >>> csp-blocked') && boot.includes('// <<< csp-blocked'),
  'boot.js still fences its CSP detection');
check(boot.includes('if (!inlineStylesBlocked()) return;'),
  'boot.js stays idle where inline styles are allowed, as on the Pi');
['innerHTML', 'outerHTML'].forEach(function (name) {
  check(boot.includes("wrapSetter('" + name + "'"), 'boot.js re-applies styles after ' + name);
});
check(boot.includes('proto.insertAdjacentHTML = function'), 'boot.js re-applies styles after insertAdjacentHTML');
check(boot.includes('Node.prototype.cloneNode = function'), 'boot.js re-applies styles on a clone');
check(boot.includes('applyTree(root.content)'), 'boot.js reaches into <template> content');
check(boot.includes('proto.setAttribute = function'), "boot.js re-applies setAttribute('style', ...)");
check(boot.includes('el.style.cssText = text'), 'styles are re-applied through the CSSOM, which the policy allows');

process.stdout.write('csp: ' + checks + ' checks passed\n');
