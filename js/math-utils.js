"use strict";

window.NumberUtils = Object.freeze({
  clamp: function (value, lower, upper) {
    return Math.min(upper, Math.max(lower, value));
  },
  isFiniteNumber: function (value) {
    return typeof value === "number" && Number.isFinite(value);
  }
});
