'use strict';

// Expose minimal shared helpers under a single namespace
window.Utils = (function createUtils() {
  function linearInterpolate(a, b, t) { return a + (b - a) * t; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function qs(selector, scope) { return (scope || document).querySelector(selector); }
  function qsa(selector, scope) { return Array.from((scope || document).querySelectorAll(selector)); }
  function on(target, type, handler, options) { target.addEventListener(type, handler, options); }
  return { linearInterpolate, clamp, qs, qsa, on };
})();


