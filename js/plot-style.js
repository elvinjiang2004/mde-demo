"use strict";

(function (global) {
  var S = global.SvgUtils.appendSvg;
  var records = new WeakMap();
  var CURVE_TOLERANCE = 0.2;
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function record(svg) {
    var item = records.get(svg);
    if (!item) { item = { axes: {}, resize: {} }; records.set(svg, item); }
    return item;
  }
  function units(svg, pixels) { return global.ChartLayout.svgUnits(svg, pixels); }
  function trim(text) { return text.replace(/(\.\d*?[1-9])0+(?=e|$)|\.0+(?=e|$)/, "$1").replace(/e\+?(-?)0+(\d+)/, "e$1$2"); }
  function format(value, digits, trimmed) {
    if (value === Infinity) { return "∞"; }
    if (value === -Infinity) { return "-∞"; }
    if (!Number.isFinite(value)) { return "not defined"; }
    if (value === 0) { value = 0; }
    var absolute = Math.abs(value);
    if (absolute && (absolute < Math.pow(10, -digits) / 2 || absolute >= 1e6)) {
      return trim(value.toExponential(2));
    }
    var text = value.toFixed(digits);
    if (Number(text) === 0) { text = (0).toFixed(digits); }
    return trimmed ? trim(text) : text;
  }
  function tick(value, step, percent) {
    var scale = percent ? 100 : 1;
    var number = value * scale;
    var spacing = Math.abs((step || 1) * scale);
    var digits = Math.min(12, Math.max(0, -Math.floor(Math.log10(spacing)) + 1));
    // Retain useful precision at a padded domain endpoint, e.g. 0.0224,
    // even when the interior major step is much coarser.
    if (number) { digits = Math.max(digits, Math.min(12, 2 - Math.floor(Math.log10(Math.abs(number))))); }
    if (Math.abs(number) > 0 && (Math.abs(number) < .001 || Math.abs(number) >= 1e6)) {
      var precision = clamp(Math.ceil(Math.log10(Math.abs(number) / spacing)), 2, 14);
      return trim(number.toExponential(precision)) + (percent ? "%" : "");
    }
    return format(number, digits, true) + (percent ? "%" : "");
  }
  function niceStep(raw) {
    var base = Math.pow(10, Math.floor(Math.log10(raw)));
    var fraction = raw / base;
    var factor = [1, 2, 2.5, 5, 10].find(function (n) { return n >= fraction - 1e-10; });
    return factor * base;
  }
  function ticks(domain, pixels, vertical) {
    var low = domain[0], high = domain[1], span = high - low;
    if (!Number.isFinite(span) || span <= 0) { return { values: [low], step: 1 }; }
    var count = clamp(Math.floor(pixels / (vertical ? 52 : 72)), 1, 4);
    var step = niceStep(span / count), values = [low];
    var crossesZero = low < 0 && high > 0;
    var start = crossesZero ? Math.ceil(low / step) * step : low + step;
    for (var i = 0; i < 20; i += 1) {
      var value = start + i * step;
      if (value >= high - span * 1e-10) { break; }
      var separation = Math.min(value - low, high - value) / span * pixels;
      if (value > low + span * 1e-10 && separation >= (vertical ? 24 : 36)) {
        values.push(Math.abs(value) < step * 1e-10 ? 0 : Number(value.toPrecision(15)));
      }
    }
    values.push(high);
    return { values: values, step: step };
  }
  function axis(parent, options) {
    var svg = parent.ownerSVGElement || parent;
    var id = options.id || options.orientation;
    var previous = record(svg).axes[id];
    if (previous && previous.parent === parent && previous.layer.parentNode === parent) {
      previous.options = options; previous.key = ""; drawAxis(previous); return previous;
    }
    var item = { parent: parent, svg: svg, options: options, key: "", layer: S(parent, "g", { class: "plot-axis-layer", "data-axis": id }) };
    record(svg).axes[id] = item;
    item.update = function (domain) { item.options.domain = domain; item.key = ""; drawAxis(item); };
    drawAxis(item);
    return item;
  }
  function drawAxis(item) {
    var o = item.options, b = o.frame, svg = item.svg;
    var key = JSON.stringify([o, units(svg, 1)]);
    if (item.key === key && item.layer.childNodes.length) { return; }
    item.key = key; item.layer.replaceChildren();
    var vertical = o.orientation !== "x";
    var pixels = (vertical ? b.bottom - b.top : b.right - b.left) / units(svg, 1);
    var chosen = ticks(o.domain, pixels, vertical);
    function position(value) {
      var ratio = (value - o.domain[0]) / (o.domain[1] - o.domain[0]);
      return vertical ? b.bottom - ratio * (b.bottom - b.top) : b.left + ratio * (b.right - b.left);
    }
    if (vertical && o.grid) {
      chosen.values.forEach(function (value) {
        if (value === o.domain[0] || value === o.domain[1] || value === 0) { return; }
        S(item.layer, "line", { x1: b.left, x2: b.right, y1: position(value), y2: position(value), class: "plot-grid" });
      });
    }
    if (vertical && (o.grid || o.orientation === "right") && o.domain[0] < 0 && o.domain[1] > 0) {
      S(item.layer, "line", { x1: b.left, x2: b.right, y1: position(0), y2: position(0),
        class: o.orientation === "right" ? "secondary-zero-line" : "zero-line plot-zero" });
    }
    chosen.values.forEach(function (value, index) {
      var p = position(value), text;
      if (!vertical) {
        S(item.layer, "line", { x1: p, x2: p, y1: b.bottom, y2: b.bottom + units(svg, 4), class: "axis-line" });
        text = S(item.layer, "text", { x: p, y: b.bottom + units(svg, 22), class: "axis-text plot-x-tick",
          "text-anchor": index === 0 ? "start" : (index === chosen.values.length - 1 ? "end" : "middle") }, tick(value, chosen.step, o.percent));
      } else {
        var right = o.orientation === "right";
        var x = right ? b.right - units(svg, 6) : b.left - units(svg, 8);
        if (!right) { S(item.layer, "line", { x1: b.left - units(svg, 4), x2: b.left, y1: p, y2: p, class: "axis-line" }); }
        text = S(item.layer, "text", { x: x, y: p + units(svg, 4), class: "axis-text plot-y-tick" + (right ? " secondary-tick annotation-halo" : ""), "text-anchor": "end" }, tick(value, chosen.step, o.percent));
      }
      text.dataset.value = value;
    });
  }
  function tradeFrame(parent, layout, mesh, diagonal) {
    var group = S(parent, "g", { class: "plot-frame-layer" });
    if (diagonal) { global.BilateralTradeVisuals.drawFrame(group, layout, mesh, false); }
    else { global.BilateralTradeVisuals.drawLineFrame(group, layout, mesh); }
    group.querySelectorAll("text.axis-text, line.axis-line").forEach(function (node) { node.remove(); });
    var x = axis(group, { id: "x", orientation: "x", frame: layout, domain: [0, 1] });
    var y = axis(group, { id: "y", orientation: "y", frame: layout, domain: [0, 1] });
    return { update: function (xd, yd) { x.update(xd); y.update(yd); } };
  }
  function dimensions(svg, frame) {
    var matrix = svg.getScreenCTM();
    var scale = matrix ? Math.hypot(matrix.a, matrix.b) : 1 / units(svg, 1);
    return { width: (frame.right - frame.left) * scale, height: (frame.bottom - frame.top) * scale };
  }
  function rasterSize(svg, frame, quality) {
    var size = dimensions(svg, frame);
    var ratio = clamp(global.devicePixelRatio || 1, 1, 3);
    var finalSize = clamp(Math.ceil(Math.max(size.width, size.height) * ratio / 32) * 32, 128, 1200);
    return quality === "preview" ? Math.min(finalSize, clamp(Math.ceil(finalSize / 64) * 32, 64, 384)) : finalSize;
  }
  function paintRaster(svg, canvas, frame, quality, valueAt, colorAt) {
    var size = rasterSize(svg, frame, quality), rendered = dimensions(svg, frame);
    global.SvgUtils.paintFieldRaster(canvas, size, valueAt, function (value, x, y) {
      return colorAt(value, Math.floor(x * rendered.width / size), Math.floor(y * rendered.height / size));
    });
    canvas.dataset.rasterSize = size;
    canvas.dataset.rasterQuality = quality || "final";
    return size;
  }
  function signature(svg) {
    var b = svg.getBoundingClientRect();
    return [Math.round(b.width), Math.round(b.height), global.devicePixelRatio || 1].join(":");
  }
  function watchResize(svg, id, callback, sizeKey) {
    var current = record(svg).resize[id];
    if (current) { current.callback = callback; current.sizeKey = sizeKey; return; }
    record(svg).resize[id] = { key: sizeKey ? sizeKey(svg) : signature(svg), callback: callback, sizeKey: sizeKey };
  }
  function refresh(svg) {
    var item = records.get(svg);
    if (!item || !svg.isConnected) { return; }
    Object.keys(item.axes).forEach(function (key) {
      var a = item.axes[key];
      if (a.layer.parentNode === a.parent && a.parent.isConnected) { drawAxis(a); }
      else { delete item.axes[key]; }
    });
    var size;
    Object.keys(item.resize).forEach(function (key) {
      var r = item.resize[key];
      var next = r.sizeKey ? r.sizeKey(svg) : (size === undefined ? (size = signature(svg)) : size);
      if (r.key !== next) { r.key = next; r.callback(); }
    });
  }
  function distance(point, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], denominator = dx * dx + dy * dy;
    var t = denominator ? clamp(((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / denominator, 0, 1) : 0;
    return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
  }
  function adaptive(evaluate, project, low, high, options) {
    var o = options || {}, tolerance = o.tolerance || CURVE_TOLERANCE;
    var budget = o.maxPoints || 2049, count = clamp(o.segments || 4, 1, 32), cache = new Map();
    function get(t) {
      if (!cache.has(t)) { var value = evaluate(t); cache.set(t, { t: t, value: value, projected: project(value, t) }); }
      return cache.get(t);
    }
    var result = [get(low)];
    function split(a, b, depth) {
      var quarter = get(a.t + (b.t - a.t) / 4), middle = get(a.t + (b.t - a.t) / 2), three = get(a.t + (b.t - a.t) * 3 / 4);
      var error = 0;
      [quarter, middle, three].forEach(function (p) {
        p.projected.forEach(function (xy, i) { error = Math.max(error, distance(xy, a.projected[i], b.projected[i])); });
      });
      if (error > tolerance && depth < 14 && cache.size < budget) { split(a, middle, depth + 1); split(middle, b, depth + 1); }
      else { result.push(b); }
    }
    for (var i = 0; i < count; i += 1) {
      var a = i ? get(low + (high - low) * i / count) : get(low);
      var b = i === count - 1 ? get(high) : get(low + (high - low) * (i + 1) / count);
      split(a, b, 0);
    }
    return result.map(function (p) { return p.value; });
  }
  global.PlotStyle = Object.freeze({ tick: tick,
    probe: function (value) { return format(value, 3, false); },
    summary: function (value, digits) { return format(value, digits === undefined ? 4 : digits, false); },
    ticks: ticks, axis: axis, tradeFrame: tradeFrame, dimensions: dimensions,
    rasterSize: rasterSize, paintRaster: paintRaster, watchResize: watchResize, refresh: refresh,
    adaptive: adaptive, curveTolerance: CURVE_TOLERANCE });
  var resizeFrame = 0;
  function refreshCharts() {
    if (resizeFrame) { return; }
    resizeFrame = global.requestAnimationFrame(function () {
      resizeFrame = 0;
      document.querySelectorAll(".chart-canvas-frame > svg, #tradeoff-chart").forEach(function (svg) { global.ChartLayout.refresh(svg); });
    });
  }
  function watchResolution() {
    if (!global.matchMedia) { return; }
    var media = global.matchMedia("(resolution: " + (global.devicePixelRatio || 1) + "dppx)");
    function changed() {
      if (media.removeEventListener) { media.removeEventListener("change", changed); }
      else { media.removeListener(changed); }
      refreshCharts();
      watchResolution();
    }
    if (media.addEventListener) { media.addEventListener("change", changed); }
    else { media.addListener(changed); }
  }
  global.addEventListener("resize", refreshCharts);
  document.addEventListener("DOMContentLoaded", watchResolution);
}(window));
