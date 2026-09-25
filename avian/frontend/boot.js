/* ============================================================
   boot.js - runs in <head>, before the first paint and before any
   other script.

   1. Theme. Resolves the saved preference before first paint so
      automatic dark mode never flashes light. Mirrors the resolver in
      apt.js. It used to sit inline in index.html; a page served under
      a Content-Security-Policy without 'unsafe-inline' refuses inline
      scripts, so it lives in its own file now.

   2. Inline styles under a strict CSP. The collage, the stats and the
      stamps build their markup as HTML strings with style="..." on
      them: positions, sizes, custom properties. A policy without
      'unsafe-inline' in style-src makes the browser drop every one of
      those attributes, and the page falls apart. Styles set through
      the CSSOM (element.style) are not covered by the policy, so this
      file re-applies each blocked attribute that way, synchronously,
      right where the markup is inserted - code that measures directly
      after an innerHTML sees the styled layout.

      It only switches itself on when the browser actually blocks
      inline styles. On the Pi, which serves no such policy, it does
      nothing at all.
   ============================================================ */
(function () {
  'use strict';

  var d = document.documentElement;

  /* ---- 1. theme ---- */
  var q = '(prefers-color-scheme: dark)';
  function systemTheme() {
    try { return window.matchMedia && window.matchMedia(q).matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function preference() {
    try {
      var v = localStorage.getItem('bird:theme:v2');
      if (v === 'auto' || v === 'light' || v === 'dark') return v;
      var old = localStorage.getItem('bird:theme');
      return old === 'light' || old === 'dark' ? old : 'auto';
    } catch (e) { return 'auto'; }
  }
  var p = preference();
  d.setAttribute('data-theme', p === 'light' || p === 'dark' ? p : systemTheme());

  /* ---- 2. inline styles under a strict CSP ---- */
  // >>> csp-blocked
  // True when this document refuses style attributes from markup.
  function inlineStylesBlocked() {
    try {
      var probe = document.createElement('div');
      probe.innerHTML = '<span style="order:7"></span>';
      return probe.firstChild.style.order !== '7';
    } catch (e) { return false; }
  }
  // <<< csp-blocked
  if (!inlineStylesBlocked()) return;

  // Last text applied per element. Setting cssText rewrites the attribute
  // in normalised form; remembering that form keeps the observer below
  // from applying the same style twice.
  var applied = typeof WeakMap === 'function' ? new WeakMap() : null;
  function applyOne(el) {
    if (!el || !el.getAttribute || !el.style) return;
    var text = el.getAttribute('style');
    if (text === null || (applied && applied.get(el) === text)) return;
    el.style.cssText = text;
    if (applied) applied.set(el, el.getAttribute('style'));
  }
  function applyTree(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) applyOne(root);
    var styled = root.querySelectorAll ? root.querySelectorAll('[style]') : [];
    for (var i = 0; i < styled.length; i++) applyOne(styled[i]);
    // A <template>'s markup lives in its content fragment, not below it.
    if (root.content && root.content.nodeType === 11) applyTree(root.content);
  }

  var proto = Element.prototype;
  function wrapSetter(name, after) {
    var desc = Object.getOwnPropertyDescriptor(proto, name);
    if (!desc || !desc.set) return;
    Object.defineProperty(proto, name, {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function (value) {
        var parent = this.parentNode;
        desc.set.call(this, value);
        after(this, parent);
      }
    });
  }
  wrapSetter('innerHTML', function (el) { applyTree(el); });
  // outerHTML replaces the element itself; its new markup is in the parent.
  wrapSetter('outerHTML', function (el, parent) { applyTree(parent); });

  var insertAdjacentHTML = proto.insertAdjacentHTML;
  if (insertAdjacentHTML) {
    proto.insertAdjacentHTML = function (where, html) {
      var result = insertAdjacentHTML.call(this, where, html);
      applyTree(/^(beforebegin|afterend)$/i.test(where) ? this.parentNode : this);
      return result;
    };
  }

  // A clone copies the style attribute, and the browser blocks it again on
  // the copy. Code that touches the copy's style right after cloning (the
  // postcard sets a custom property on its stamp) would otherwise rewrite
  // the attribute from an empty declaration and lose it for good.
  var cloneNode = Node.prototype.cloneNode;
  Node.prototype.cloneNode = function (deep) {
    var copy = cloneNode.call(this, deep);
    if (deep) applyTree(copy);
    else if (copy.nodeType === 1) applyOne(copy);
    return copy;
  };

  var setAttribute = proto.setAttribute;
  proto.setAttribute = function (name, value) {
    var result = setAttribute.call(this, name, value);
    if (String(name).toLowerCase() === 'style') applyOne(this);
    return result;
  };

  // Everything else that can put a style attribute into the page - a
  // cloned template, markup the parser inserted - is caught here, one
  // microtask later.
  if (typeof MutationObserver === 'function') {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === 'attributes') applyOne(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) applyTree(r.addedNodes[j]);
      }
    }).observe(d, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  }
  document.addEventListener('DOMContentLoaded', function () { applyTree(d); });
})();
