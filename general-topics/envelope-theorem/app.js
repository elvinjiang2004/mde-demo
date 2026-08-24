(function () {
  "use strict";

  var model = window.EnvelopeTheoremModel;
  var SVG_NS = "http://www.w3.org/2000/svg";

  var MAIN_LAYOUT = { viewWidth: 660, viewHeight: 450, left: 60, right: 630, top: 32, bottom: 388 };
  var DIAG_LAYOUT = { viewWidth: 440, viewHeight: 300, left: 50, right: 420, top: 28, bottom: 250 };

  // Colors are keyed to each line's own letter, not its array position, so
  // a given line keeps its color as others are added or removed. Chosen
  // distinct from the semantic blue/green/orange/red used elsewhere on the
  // site (allocation/rent/payment/violation), since here color means
  // nothing but "which arbitrary choice this is."
  var LINE_COLORS = {
    A: "#1b6fa8", B: "#a85416", C: "#237451", D: "#963c3c",
    E: "#7a4fa3", F: "#b8860b", G: "#0f8a8a", H: "#5f6872"
  };

  var POINT_RADIUS = 9;
  var POINT_HIT_RADIUS = 18;
  var VALUE_KEY_STEP = 0.02;
  var DIAG_PAD_FRACTION = 0.12;
  var DIAG_PAD_MIN = 0.05;
  var VALUE_EPSILON = 1e-6;

  var elements = {};
  var state = {
    lines: null,
    selectedIndex: 0,
    lastSummary: null
  };
  var dragActive = false;
  var dragFrameRequested = false;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    elements = {
      mainChart: byId("main-chart"),
      pointControlLabel: byId("point-control-label"),
      pointTNumber: byId("point-t-number"),
      pointTSlider: byId("point-t-slider"),
      pointVNumber: byId("point-v-number"),
      pointVSlider: byId("point-v-slider"),
      addLine: byId("add-line"),
      removeLine: byId("remove-line"),
      liveSummary: byId("live-summary"),
      slopeChart: byId("slope-chart"),
      boundChart: byId("bound-chart")
    };

    state.lines = model.defaultLines();
    state.selectedIndex = 0;

    typesetInitialHtmlMath();
    bindEvents();
    syncControls();
    recomputeAndDrawAll();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function colorForId(id) {
    return LINE_COLORS[id] || "#5f6872";
  }

  // --- MathJax: nothing in the explorable section carries TeX (all three
  // panel captions are plain SVG text), but the shared typeset call still
  // includes it, matching every other module's contract, in case the
  // derivation section's user-authored math needs it later.
  function waitForMathJax() {
    function readyMathJax() {
      var mathJax = window.MathJax;
      if (!mathJax || typeof mathJax.typesetPromise !== "function") {
        return null;
      }
      if (mathJax.startup && mathJax.startup.promise) {
        return Promise.resolve(mathJax.startup.promise).then(function () {
          return mathJax;
        });
      }
      return Promise.resolve(mathJax);
    }

    var ready = readyMathJax();
    if (ready) {
      return ready;
    }
    if (document.readyState === "complete") {
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      window.addEventListener("load", function () {
        resolve(readyMathJax());
      }, { once: true });
    });
  }

  function typesetInitialHtmlMath() {
    var targets = Array.prototype.slice.call(document.querySelectorAll(
      ".introduction, .choice-controls, .explorable, .derivation, .notes, .references"
    ));
    window.mechanismMathReady = waitForMathJax().then(function (mathJax) {
      if (!mathJax || targets.length === 0) {
        return null;
      }
      return mathJax.typesetPromise(targets);
    }).catch(function () {
      // Raw TeX remains visible when the renderer is unavailable.
    });
  }

  // --- Points: each line contributes two independently selectable points
  // (p0 and p1), flattened into one ordered list so ArrowLeft/ArrowRight
  // can cycle through all of them exactly as the sibling module cycles
  // through its shared spline's points.

  function pointList(lines) {
    var list = [];
    lines.forEach(function (line) {
      list.push({ id: line.id, which: "p0", t: line.p0.t, v: line.p0.v });
      list.push({ id: line.id, which: "p1", t: line.p1.t, v: line.p1.v });
    });
    return list;
  }

  function selectedPoint() {
    return pointList(state.lines)[state.selectedIndex];
  }

  // --- Events

  function bindEvents() {
    elements.pointTNumber.addEventListener("change", function () {
      var next = elements.pointTNumber.valueAsNumber;
      if (!Number.isFinite(next)) {
        elements.pointTNumber.value = formatValue(selectedPoint().t);
        return;
      }
      movePointTo(next, selectedPoint().v);
    });
    elements.pointTSlider.addEventListener("input", function () {
      movePointTo(Number.parseFloat(elements.pointTSlider.value), selectedPoint().v);
    });
    elements.pointVNumber.addEventListener("change", function () {
      var next = elements.pointVNumber.valueAsNumber;
      if (!Number.isFinite(next)) {
        elements.pointVNumber.value = formatValue(selectedPoint().v);
        return;
      }
      movePointTo(selectedPoint().t, next);
    });
    elements.pointVSlider.addEventListener("input", function () {
      movePointTo(selectedPoint().t, Number.parseFloat(elements.pointVSlider.value));
    });

    elements.addLine.addEventListener("click", function () {
      var result = model.addLine(state.lines);
      if (result.addedId === null) {
        return;
      }
      state.lines = result.lines;
      state.selectedIndex = pointList(state.lines).length - 2;
      syncControls();
      recomputeAndDrawAll();
    });

    elements.removeLine.addEventListener("click", function () {
      if (!model.canRemoveLine(state.lines)) {
        return;
      }
      var id = selectedPoint().id;
      state.lines = model.removeLine(state.lines, id);
      state.selectedIndex = model.clamp(state.selectedIndex, 0, pointList(state.lines).length - 1);
      syncControls();
      recomputeAndDrawAll();
    });

    elements.mainChart.addEventListener("pointerdown", function (event) {
      var index = pointerToPointIndex(event);
      if (index === -1) {
        return;
      }
      dragActive = true;
      state.selectedIndex = index;
      elements.mainChart.setPointerCapture(event.pointerId);
      syncControls();
      dragSetPointFromPointer(event);
    });

    elements.mainChart.addEventListener("pointermove", function (event) {
      if (!dragActive) {
        return;
      }
      dragSetPointFromPointer(event);
    });

    elements.mainChart.addEventListener("pointerup", function (event) {
      dragActive = false;
      if (elements.mainChart.hasPointerCapture(event.pointerId)) {
        elements.mainChart.releasePointerCapture(event.pointerId);
      }
    });
    elements.mainChart.addEventListener("pointercancel", function () {
      dragActive = false;
    });

    elements.mainChart.addEventListener("keydown", function (event) {
      var handled = true;
      var list = pointList(state.lines);
      if (event.key === "ArrowLeft") {
        selectIndex(state.selectedIndex - 1);
      } else if (event.key === "ArrowRight") {
        selectIndex(state.selectedIndex + 1);
      } else if (event.key === "Home") {
        selectIndex(0);
      } else if (event.key === "End") {
        selectIndex(list.length - 1);
      } else if (event.key === "ArrowUp") {
        movePointTo(selectedPoint().t, selectedPoint().v + VALUE_KEY_STEP);
      } else if (event.key === "ArrowDown") {
        movePointTo(selectedPoint().t, selectedPoint().v - VALUE_KEY_STEP);
      } else {
        handled = false;
      }
      if (handled) {
        event.preventDefault();
      }
    });
  }

  // --- Pointer geometry (main chart only; the two diagnostic charts are
  // read-only). Both plot axes are fixed to [0,1], so this is a plain
  // linear map, not a data-dependent one.

  function svgPointFromEvent(event) {
    var rect = elements.mainChart.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) {
      return null;
    }
    var scaleX = MAIN_LAYOUT.viewWidth / rect.width;
    var scaleY = MAIN_LAYOUT.viewHeight / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function pointerToPointIndex(event) {
    var svgPoint = svgPointFromEvent(event);
    if (!svgPoint) {
      return -1;
    }
    var list = pointList(state.lines);
    var best = -1;
    var bestDist = POINT_HIT_RADIUS;
    list.forEach(function (point, index) {
      var x = svgTOf(point.t, MAIN_LAYOUT);
      var y = svgVOf(point.v, MAIN_LAYOUT);
      var dist = Math.hypot(svgPoint.x - x, svgPoint.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    return best;
  }

  function dragSetPointFromPointer(event) {
    var svgPoint = svgPointFromEvent(event);
    if (!svgPoint) {
      return;
    }
    var rawT = pixelToT(svgPoint.x, MAIN_LAYOUT);
    var rawV = pixelToV(svgPoint.y, MAIN_LAYOUT);
    var point = selectedPoint();
    state.lines = model.movePoint(state.lines, point.id, point.which, rawT, rawV);
    syncControls();
    scheduleRepaint();
  }

  // --- State updates

  function selectIndex(index) {
    var list = pointList(state.lines);
    state.selectedIndex = model.clamp(index, 0, list.length - 1);
    syncControls();
    if (state.lastSummary) {
      drawMainChart(state.lastSummary);
    }
  }

  function movePointTo(t, v) {
    if (!Number.isFinite(t) || !Number.isFinite(v)) {
      return;
    }
    var point = selectedPoint();
    state.lines = model.movePoint(state.lines, point.id, point.which, t, v);
    syncControls();
    recomputeAndDrawAll();
  }

  function scheduleRepaint() {
    if (dragFrameRequested) {
      return;
    }
    dragFrameRequested = true;
    window.requestAnimationFrame(function () {
      dragFrameRequested = false;
      recomputeAndDrawAll();
    });
  }

  function syncControls() {
    var point = selectedPoint();
    elements.pointTNumber.value = formatValue(point.t);
    elements.pointTSlider.value = String(point.t);
    elements.pointVNumber.value = formatValue(point.v);
    elements.pointVSlider.value = String(point.v);
    elements.pointControlLabel.textContent =
      "Line " + point.id + ", point " + (point.which === "p0" ? "1" : "2");
    elements.addLine.disabled = !model.canAddLine(state.lines);
    elements.removeLine.disabled = !model.canRemoveLine(state.lines);
  }

  function recomputeAndDrawAll() {
    var summary = model.summarize(state.lines);
    state.lastSummary = summary;
    drawMainChart(summary);
    drawSlopeChart(summary);
    drawBoundChart(summary);
    updateLiveSummary(summary);
  }

  // --- Geometry helpers

  function svgTOf(t, layout) {
    return layout.left + t * (layout.right - layout.left);
  }

  function svgVOf(v, layout) {
    return layout.bottom - v * (layout.bottom - layout.top);
  }

  function pixelToT(pixelX, layout) {
    return (pixelX - layout.left) / (layout.right - layout.left);
  }

  function pixelToV(pixelY, layout) {
    return (layout.bottom - pixelY) / (layout.bottom - layout.top);
  }

  function makeYMapper(yMin, yMax, layout) {
    var span = (yMax - yMin) || 1;
    return function (value) {
      return layout.bottom - ((value - yMin) / span) * (layout.bottom - layout.top);
    };
  }

  function padRange(rawMin, rawMax, minPad, fraction) {
    var span = rawMax - rawMin;
    var pad = Math.max(minPad, span * fraction);
    return { yMin: rawMin - pad, yMax: rawMax + pad };
  }

  function niceTicks(yMin, yMax) {
    var ticks = [yMin, yMax];
    if (yMin < -1e-9 && yMax > 1e-9) {
      ticks.push(0);
    }
    return ticks.sort(function (a, b) { return a - b; });
  }

  // No y-axis title on any panel: only the numeric y-tick labels identify
  // the vertical scale. The x-axis title reads "Parameter, t," not "Type,"
  // since t here is an arbitrary parameter with no mechanism-design
  // meaning attached.
  function drawAxisFrame(svg, layout, xLabel, xTicks, yTicks, yMapper, formatYTick) {
    var formatY = formatYTick || formatSigned;
    xTicks.forEach(function (value) {
      var x = svgTOf(value, layout);
      appendSvg(svg, "line", {
        x1: x, y1: layout.bottom, x2: x, y2: layout.bottom + 6, class: "axis-line"
      });
      appendSvg(svg, "text", {
        x: x, y: layout.bottom + 18, class: "axis-text",
        "text-anchor": value === 0 ? "start" : (value === 1 ? "end" : "middle")
      }, formatTick(value));
    });

    yTicks.forEach(function (value) {
      var y = yMapper(value);
      appendSvg(svg, "line", {
        x1: layout.left - 6, y1: y, x2: layout.left, y2: y, class: "axis-line"
      });
      appendSvg(svg, "text", {
        x: layout.left - 10, y: y + 4, class: "axis-text", "text-anchor": "end"
      }, formatY(value));
    });

    appendSvg(svg, "rect", {
      x: layout.left, y: layout.top,
      width: layout.right - layout.left, height: layout.bottom - layout.top,
      fill: "none", class: "axis-line"
    });

    if (xLabel) {
      appendSvg(svg, "text", {
        x: (layout.left + layout.right) / 2, y: layout.bottom + 34,
        class: "axis-title", "text-anchor": "middle"
      }, xLabel);
    }
  }

  // Splits one envelope segment (a single line's own extrapolated,
  // possibly out-of-[0,1] values at its two ends) into display pieces: any
  // portion within [0,1] is returned as an ordinary solid piece, and any
  // portion above 1 or below 0 is returned clamped to that boundary,
  // marked so the caller draws it dotted. A segment can cross at most two
  // boundaries (into range, then out the other side), since it is a
  // single affine function.
  function clipSegmentForDisplay(segment) {
    var boundaries = [{ t: segment.t0, v: segment.v0 }];
    [0, 1].forEach(function (target) {
      if (Math.abs(segment.v1 - segment.v0) < VALUE_EPSILON) {
        return;
      }
      var frac = (target - segment.v0) / (segment.v1 - segment.v0);
      if (frac > VALUE_EPSILON && frac < 1 - VALUE_EPSILON) {
        boundaries.push({ t: segment.t0 + frac * (segment.t1 - segment.t0), v: target });
      }
    });
    boundaries.push({ t: segment.t1, v: segment.v1 });
    boundaries.sort(function (a, b) { return a.t - b.t; });

    var pieces = [];
    var i;
    for (i = 0; i < boundaries.length - 1; i += 1) {
      var a = boundaries[i];
      var b = boundaries[i + 1];
      if (b.t - a.t < VALUE_EPSILON) {
        continue;
      }
      var midV = (a.v + b.v) / 2;
      if (midV > 1 + VALUE_EPSILON) {
        pieces.push({ t0: a.t, t1: b.t, clampedAt: 1 });
      } else if (midV < -VALUE_EPSILON) {
        pieces.push({ t0: a.t, t1: b.t, clampedAt: 0 });
      } else {
        pieces.push({ t0: a.t, t1: b.t, v0: a.v, v1: b.v, clampedAt: null });
      }
    }
    return pieces;
  }

  // --- Panels

  function drawMainChart(summary) {
    var svg = elements.mainChart;
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "main-chart-title" }, "Family of lines and their envelope V(t)");
    appendSvg(svg, "desc", { id: "main-chart-description" }, mainChartDescription(summary));
    appendSvg(svg, "text", {
      x: MAIN_LAYOUT.left, y: 24, class: "panel-caption"
    }, "Envelope V(t) = max of the lines");

    var yMapper = function (value) { return svgVOf(value, MAIN_LAYOUT); };
    drawAxisFrame(
      svg, MAIN_LAYOUT, "Parameter, t",
      [0, 0.25, 0.5, 0.75, 1], [0, 0.25, 0.5, 0.75, 1], yMapper, formatTick
    );

    // Both diagonals, faint: together they mark the four regions a drag
    // snaps into (left/right/bottom/top edge), since each region is
    // exactly "closer to that edge than to any other."
    appendSvg(svg, "line", {
      x1: svgTOf(0, MAIN_LAYOUT), y1: svgVOf(0, MAIN_LAYOUT),
      x2: svgTOf(1, MAIN_LAYOUT), y2: svgVOf(1, MAIN_LAYOUT),
      class: "diagonal-guide"
    });
    appendSvg(svg, "line", {
      x1: svgTOf(0, MAIN_LAYOUT), y1: svgVOf(1, MAIN_LAYOUT),
      x2: svgTOf(1, MAIN_LAYOUT), y2: svgVOf(0, MAIN_LAYOUT),
      class: "diagonal-guide"
    });

    // Every line, drawn only across its own native domain (a literal
    // vertical segment if its two points share a t), at consistent medium
    // opacity in its own color -- always visible, whether or not it is
    // currently winning anywhere.
    summary.lines.forEach(function (line) {
      appendSvg(svg, "line", {
        x1: svgTOf(line.p0.t, MAIN_LAYOUT), y1: svgVOf(line.p0.v, MAIN_LAYOUT),
        x2: svgTOf(line.p1.t, MAIN_LAYOUT), y2: svgVOf(line.p1.v, MAIN_LAYOUT),
        class: "family-line", stroke: colorForId(line.id)
      });
    });

    // The bold envelope: each exact segment split into display pieces --
    // solid where the winning line's own (universally-extended) value
    // stays within [0,1], dotted and clamped to the top/bottom edge where
    // it does not, since the search is universal but the plot is not.
    summary.segments.forEach(function (segment) {
      var pieces = clipSegmentForDisplay(segment);
      pieces.forEach(function (piece) {
        if (piece.clampedAt === null) {
          appendSvg(svg, "line", {
            x1: svgTOf(piece.t0, MAIN_LAYOUT), y1: svgVOf(piece.v0, MAIN_LAYOUT),
            x2: svgTOf(piece.t1, MAIN_LAYOUT), y2: svgVOf(piece.v1, MAIN_LAYOUT),
            class: "envelope-segment", stroke: colorForId(segment.id)
          });
        } else {
          var y = svgVOf(piece.clampedAt, MAIN_LAYOUT);
          appendSvg(svg, "line", {
            x1: svgTOf(piece.t0, MAIN_LAYOUT), y1: y,
            x2: svgTOf(piece.t1, MAIN_LAYOUT), y2: y,
            class: "envelope-segment-clamped", stroke: colorForId(segment.id)
          });
        }
      });
    });

    // Kinks: exactly where the argmax switches, marked directly on V --
    // only when the switch itself is visible on screen; a switch that
    // happens entirely off-scale (both neighbors clamped) is not marked,
    // since nothing distinguishable is visible there.
    summary.kinks.forEach(function (kink) {
      if (kink.value < -VALUE_EPSILON || kink.value > 1 + VALUE_EPSILON) {
        return;
      }
      appendSvg(svg, "circle", {
        cx: svgTOf(kink.t, MAIN_LAYOUT), cy: svgVOf(kink.value, MAIN_LAYOUT), r: 4,
        class: "kink-marker"
      });
    });

    var list = pointList(summary.lines);
    list.forEach(function (point, index) {
      var isSelected = index === state.selectedIndex;
      var radius = isSelected ? POINT_RADIUS + 1.5 : POINT_RADIUS;
      var cx = svgTOf(point.t, MAIN_LAYOUT);
      var cy = svgVOf(point.v, MAIN_LAYOUT);
      appendSvg(svg, "circle", {
        cx: cx, cy: cy, r: radius,
        class: isSelected ? "line-endpoint line-endpoint-selected" : "line-endpoint",
        stroke: colorForId(point.id)
      });
      appendSvg(svg, "text", {
        x: cx, y: cy, class: "point-letter", fill: colorForId(point.id),
        "text-anchor": "middle", "dominant-baseline": "central"
      }, point.id);
    });
  }

  function drawSlopeChart(summary) {
    var svg = elements.slopeChart;
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "slope-chart-title" }, "Active slope");
    appendSvg(svg, "desc", { id: "slope-chart-description" }, slopeChartDescription(summary));
    appendSvg(svg, "text", {
      x: DIAG_LAYOUT.left, y: 18, class: "panel-caption"
    }, "Active slope f_t(x*(t),t)");

    var slopes = summary.segments.length > 0 ?
      summary.segments.map(function (segment) { return segment.slope; }) : [0];
    var range = padRange(Math.min.apply(null, slopes), Math.max.apply(null, slopes), DIAG_PAD_MIN, DIAG_PAD_FRACTION);
    var yMapper = makeYMapper(range.yMin, range.yMax, DIAG_LAYOUT);

    drawAxisFrame(
      svg, DIAG_LAYOUT, "Parameter, t",
      [0, 0.25, 0.5, 0.75, 1], niceTicks(range.yMin, range.yMax), yMapper, formatSigned
    );

    summary.segments.forEach(function (segment, index) {
      var y = yMapper(segment.slope);
      appendSvg(svg, "line", {
        x1: svgTOf(segment.t0, DIAG_LAYOUT), y1: y,
        x2: svgTOf(segment.t1, DIAG_LAYOUT), y2: y,
        class: "slope-step", stroke: colorForId(segment.id)
      });
      appendSvg(svg, "circle", {
        cx: svgTOf(segment.t0, DIAG_LAYOUT), cy: y, r: 3,
        class: "slope-endpoint", fill: colorForId(segment.id)
      });
      appendSvg(svg, "circle", {
        cx: svgTOf(segment.t1, DIAG_LAYOUT), cy: y, r: 3,
        class: "slope-endpoint", fill: colorForId(segment.id)
      });
      var next = summary.segments[index + 1];
      if (next && Math.abs(next.t0 - segment.t1) < 1e-6) {
        appendSvg(svg, "line", {
          x1: svgTOf(segment.t1, DIAG_LAYOUT), y1: y,
          x2: svgTOf(segment.t1, DIAG_LAYOUT), y2: yMapper(next.slope),
          class: "slope-jump-guide"
        });
      }
    });

    // A vertical (infinite-slope) line has no finite height to plot at;
    // it is marked instead by a dotted vertical line, in its own color,
    // spanning the whole panel at its own t, independent of whether it
    // ever wins the envelope.
    summary.infiniteLines.forEach(function (line) {
      var t = line.p0.t;
      appendSvg(svg, "line", {
        x1: svgTOf(t, DIAG_LAYOUT), y1: DIAG_LAYOUT.top,
        x2: svgTOf(t, DIAG_LAYOUT), y2: DIAG_LAYOUT.bottom,
        class: "slope-infinite-marker", stroke: colorForId(line.id)
      });
    });
  }

  function drawBoundChart(summary) {
    var svg = elements.boundChart;
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "bound-chart-title" }, "Steepest slope required");
    appendSvg(svg, "desc", { id: "bound-chart-description" }, boundChartDescription(summary));
    appendSvg(svg, "text", {
      x: DIAG_LAYOUT.left, y: 18, class: "panel-caption"
    }, "|Slope| by line");

    var n = summary.lines.length;
    var slotWidth = (DIAG_LAYOUT.right - DIAG_LAYOUT.left) / n;
    var barWidth = Math.min(36, slotWidth * 0.5);

    if (summary.hasInfiniteLine) {
      // No finite height represents infinity: every non-infinite line's
      // bar is suppressed entirely, the infinite line(s) are drawn at the
      // full height of the panel, and the top tick reads the word
      // "infinity" instead of a number.
      var yMapper = makeYMapper(0, 1, DIAG_LAYOUT);
      drawAxisFrame(svg, DIAG_LAYOUT, null, [], [0], yMapper, formatSigned);
      appendSvg(svg, "text", {
        x: DIAG_LAYOUT.left - 10, y: DIAG_LAYOUT.top + 4, class: "axis-text", "text-anchor": "end"
      }, "∞");

      summary.lines.forEach(function (line, index) {
        var slotCenter = DIAG_LAYOUT.left + slotWidth * (index + 0.5);
        appendSvg(svg, "text", {
          x: slotCenter, y: DIAG_LAYOUT.bottom + 18, class: "axis-text", "text-anchor": "middle"
        }, line.id);
        if (!Number.isFinite(model.slopeOf(line))) {
          appendSvg(svg, "rect", {
            x: slotCenter - barWidth / 2, y: DIAG_LAYOUT.top,
            width: barWidth, height: DIAG_LAYOUT.bottom - DIAG_LAYOUT.top,
            class: "bound-bar", fill: colorForId(line.id)
          });
        }
      });
      return;
    }

    var magnitudes = summary.lines.map(function (line) { return Math.abs(model.slopeOf(line)); });
    var maxMagnitude = Math.max.apply(null, magnitudes.concat([0]));
    var yMax = Math.max(DIAG_PAD_MIN, maxMagnitude * (1 + DIAG_PAD_FRACTION));
    var yMapperNormal = makeYMapper(0, yMax, DIAG_LAYOUT);

    drawAxisFrame(svg, DIAG_LAYOUT, null, [], [0, yMax], yMapperNormal, formatSigned);

    var baseline = yMapperNormal(0);
    summary.lines.forEach(function (line, index) {
      var slotCenter = DIAG_LAYOUT.left + slotWidth * (index + 0.5);
      var magnitude = Math.abs(model.slopeOf(line));
      var top = yMapperNormal(magnitude);
      appendSvg(svg, "rect", {
        x: slotCenter - barWidth / 2, y: top,
        width: barWidth, height: Math.max(0, baseline - top),
        class: "bound-bar", fill: colorForId(line.id)
      });
      appendSvg(svg, "text", {
        x: slotCenter, y: DIAG_LAYOUT.bottom + 18, class: "axis-text", "text-anchor": "middle"
      }, line.id);
    });

    if (maxMagnitude > 0) {
      appendSvg(svg, "line", {
        x1: DIAG_LAYOUT.left, y1: yMapperNormal(maxMagnitude),
        x2: DIAG_LAYOUT.right, y2: yMapperNormal(maxMagnitude),
        class: "bound-max-guide"
      });
    }
  }

  function updateLiveSummary(summary) {
    elements.liveSummary.textContent =
      "There are " + summary.lines.length + " lines. " +
      "The envelope has " + summary.kinks.length +
      (summary.kinks.length === 1 ? " switch (kink). " : " switches (kinks). ") +
      (summary.hasInfiniteLine ?
        "At least one line is currently vertical, with infinite slope. " :
        "The steepest line currently has slope magnitude " + formatSigned(summary.maxAbsSlope) + ".");
  }

  // --- Accessible descriptions

  function mainChartDescription(summary) {
    var point = selectedPoint();
    return "A family of " + summary.lines.length + " straight lines, each " +
      "with two points independently draggable anywhere along the plot's " +
      "own edge, with their pointwise-maximum envelope V(t) drawn in " +
      "bold, colored by whichever line currently attains the maximum and " +
      "shown dotted where that line's own value runs outside [0,1]. The " +
      "selected point is line " + point.id + "'s point " +
      (point.which === "p0" ? "1" : "2") + ", at t = " + formatValue(point.t) +
      ", value " + formatValue(point.v) + ".";
  }

  function slopeChartDescription(summary) {
    return "The active line's own slope as a step function of t, jumping " +
      "at each of the " + summary.kinks.length + " points where the " +
      "envelope's maximizing line switches. A vertical line's infinite " +
      "slope is marked by a dotted vertical line, in its own color, at " +
      "its own t instead of a finite step.";
  }

  function boundChartDescription(summary) {
    if (summary.hasInfiniteLine) {
      return "At least one line is currently vertical: its bar is drawn " +
        "at the full height of the panel, labeled infinity, and every " +
        "other line's bar is suppressed.";
    }
    return "The magnitude of each line's own slope. The tallest bar is the " +
      "smallest bound that currently dominates every line's slope; " +
      "narrowing a line's own t-domain while keeping its value swinging " +
      "from 0 to 1 can always raise this bar further, with no fixed " +
      "ceiling, since both plot axes stay fixed to [0,1].";
  }

  // --- Formatting

  function formatValue(value) {
    return value.toFixed(2);
  }

  function formatSigned(value) {
    var cleaned = Math.abs(value) < 1e-9 ? 0 : value;
    return cleaned.toFixed(2);
  }

  function formatTick(value) {
    return value.toFixed(value === 0 || value === 1 ? 0 : 2);
  }

  function appendSvg(parent, name, attributes, text) {
    var node = document.createElementNS(SVG_NS, name);
    Object.keys(attributes || {}).forEach(function (key) {
      node.setAttribute(key, String(attributes[key]));
    });
    if (typeof text === "string") {
      node.textContent = text;
    }
    parent.appendChild(node);
    return node;
  }
}());
