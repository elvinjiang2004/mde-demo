"use strict";

(function (global) {
  var PADDING = 14;
  var entries = [];

  function frameFor(svg) {
    var parent = svg.parentElement;
    return parent && (parent.classList.contains("math-chart-frame") ||
      parent.classList.contains("envelope-chart-frame")) ? parent : svg;
  }

  function visualBounds(entry) {
    var svg = entry.svg;
    var matrix = svg.getScreenCTM();
    if (!matrix || !svg.getBoundingClientRect().width) { return null; }
    var box = svg.getBBox();
    if (!box.width && !box.height) { return null; }
    var point = svg.createSVGPoint();
    point.x = box.x;
    point.y = box.y;
    var top = point.matrixTransform(matrix).y;
    point.y = box.y + box.height;
    var bottom = point.matrixTransform(matrix).y;
    entry.content.querySelectorAll(
      ".math-chart-axis-label, .envelope-chart-axis-label"
    ).forEach(function (label) {
      var rect = label.getBoundingClientRect();
      if (rect.width && rect.height) {
        top = Math.min(top, rect.top);
        bottom = Math.max(bottom, rect.bottom);
      }
    });
    return { top: top, bottom: bottom };
  }

  function fit(entry) {
    entry.pending = false;
    var bounds = visualBounds(entry);
    if (!bounds) { return; }
    var rect = entry.content.getBoundingClientRect();
    // Trim only outer whitespace. The original SVG and canvas coordinate box
    // stays intact, so pointer conversion and percentage-positioned labels agree.
    var top = Math.round((bounds.top - rect.top) * 1000) / 1000;
    var bottom = Math.round((rect.bottom - bounds.bottom) * 1000) / 1000;
    var key = top + ":" + bottom;
    if (entry.key !== key) {
      entry.key = key;
      entry.content.style.marginTop = -top + "px";
      entry.content.style.marginBottom = -bottom + "px";
    }
    entry.viewport.dataset.chartPadding = String(PADDING);
  }

  function schedule(entry) {
    if (entry.pending) { return; }
    entry.pending = true;
    global.requestAnimationFrame(function () { fit(entry); });
  }

  function refresh() {
    entries.forEach(schedule);
  }

  function initialize() {
    document.querySelectorAll("svg[viewBox]").forEach(function (svg) {
      if (svg.closest("mjx-container") || svg.closest(".chart-viewport")) { return; }
      var content = frameFor(svg);
      var viewport = document.createElement("div");
      viewport.className = "chart-viewport";
      viewport.dataset.chartFor = svg.id;
      content.before(viewport);
      viewport.appendChild(content);
      var entry = { svg: svg, content: content, viewport: viewport,
        pending: false, key: null };
      entries.push(entry);
      var observer = new MutationObserver(function () { schedule(entry); });
      observer.observe(content, { subtree: true, childList: true,
        characterData: true, attributes: true,
        attributeFilter: ["d", "points", "x", "y", "x1", "x2", "y1", "y2",
          "width", "height", "viewBox", "transform", "class", "style",
          "hidden", "r", "cx", "cy"] });
      if (global.ResizeObserver) {
        var resize = new ResizeObserver(function () { schedule(entry); });
        resize.observe(content);
      }
      schedule(entry);
    });
  }

  global.ChartViewport = Object.freeze({ refresh: refresh });
  document.addEventListener("DOMContentLoaded", function () {
    global.requestAnimationFrame(initialize);
  });
  global.addEventListener("resize", refresh);
  global.addEventListener("beforeprint", refresh);
  global.addEventListener("afterprint", refresh);
}(window));
