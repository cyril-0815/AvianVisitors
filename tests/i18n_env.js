'use strict';

/* Minimal browser stand-in for loading avian/frontend/i18n.js under node.
   i18n.js touches location.search, localStorage, navigator.languages and a
   handful of DOM calls; nothing here pretends to be a real DOM beyond what
   that file actually uses. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'avian', 'frontend', 'i18n.js'),
  'utf8'
);

function makeElement(attrs, tag) {
  return {
    tagName: tag || 'div',
    attributes: Object.assign({}, attrs || {}),
    textContent: '',
    innerHTML: '',
    children: [],
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name)
        ? this.attributes[name]
        : null;
    },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    querySelectorAll() { return []; }
  };
}

/* options: { search, stored, languages, elements, readyState } */
function loadI18N(options) {
  const opts = options || {};
  const elements = opts.elements || [];
  const store = Object.assign({}, opts.stored || {});

  function matches(el, selector) {
    // Supports the two shapes i18n.js uses: "[data-i18n]" and
    // "meta[name=\"description\"]".
    const parsed = /^([a-zA-Z]*)\[([^\]]+)\]$/.exec(String(selector).trim());
    if (!parsed) return false;
    if (parsed[1] && el.tagName !== parsed[1]) return false;
    const attr = parsed[2];
    if (attr.indexOf('=') >= 0) {
      const bits = attr.split('=');
      const name = bits[0];
      const value = bits[1].replace(/^["']|["']$/g, '');
      return el.getAttribute(name) === value;
    }
    return el.getAttribute(attr) !== null;
  }

  const documentElement = makeElement({}, 'html');
  const doc = {
    readyState: opts.readyState || 'complete',
    documentElement: documentElement,
    listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    querySelectorAll(selector) {
      return elements.filter(function (el) { return matches(el, selector); });
    },
    querySelector(selector) {
      const hits = this.querySelectorAll(selector);
      return hits.length ? hits[0] : null;
    }
  };

  const reloads = { count: 0 };
  const sandbox = {
    console: console,
    document: doc,
    navigator: { languages: opts.languages || [] },
    location: {
      search: opts.search || '',
      reload() { reloads.count += 1; }
    },
    localStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      setItem(key, value) { store[key] = String(value); },
      removeItem(key) { delete store[key]; }
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'i18n.js' });
  return { I18N: sandbox.window.I18N, document: doc, store: store, reloads: reloads };
}

module.exports = { loadI18N: loadI18N, makeElement: makeElement, SOURCE: SOURCE };
