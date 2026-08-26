"use strict";

// Shared pure-number helpers for every module's model layer. Kept free of
// any DOM or economics-specific assumptions so every model.js can use them
// without coupling to another mechanism's domain.
window.NumberUtils = Object.freeze({
  clamp: function (value, lower, upper) {
    return Math.min(upper, Math.max(lower, value));
  },
  isFiniteNumber: function (value) {
    return typeof value === "number" && Number.isFinite(value);
  }
});
