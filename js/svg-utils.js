"use strict";

window.SvgUtils = Object.freeze({
  appendSvg: function (parent, name, attributes, text) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attributes || {}).forEach(function (key) {
      node.setAttribute(key, String(attributes[key]));
    });
    if (typeof text === "string") {
      node.textContent = text;
    }
    parent.appendChild(node);
    return node;
  },
  formatTick: function (value) {
    return value.toFixed(value === 0 || value === 1 ? 0 : 2);
  }
});
