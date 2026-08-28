(function () {
  "use strict";

  var model = window.PaymentsFromAllocationRuleModel;
  var math = window.MechanismMath;
  var appendSvg = window.SvgUtils.appendSvg;
  var formatTick = window.SvgUtils.formatTick;

  var MAIN_LAYOUT = { viewWidth: 660, viewHeight: 450, left: 60, right: 630, top: 32, bottom: 388 };
  var DIAG_LAYOUT = { viewWidth: 440, viewHeight: 300, left: 50, right: 420, top: 28, bottom: 250 };

  var POINT_RADIUS = 6;
  var POINT_HIT_RADIUS = 18;
  var HEIGHT_KEY_STEP = 0.01;
  var CURVE_SAMPLE_COUNT = 160;

  var elements = {};
  var state = {
    points: null,
    selectedIndex: 0,
    lastSummary: null
  };
  var dragActive = false;
  var dragFrameRequested = false;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    elements = {
      curveChart: byId("curve-chart"),
      pointValueControlLabel: byId("point-value-control-label"),
      pointValueSlider: byId("point-value-slider"),
      pointValueNumber: byId("point-value-number"),
      addPoint: byId("add-point"),
      removePoint: byId("remove-point"),
      liveSummary: byId("live-summary"),
      envelopeChart: byId("envelope-chart"),
      paymentChart: byId("payment-chart")
    };

    state.points = model.defaultPoints();
    state.selectedIndex = Math.floor(state.points.length / 2);

    math.typesetInitial(
      ".introduction, .explorable, .derivation, .notes, .references"
    );
    bindEvents();
    syncPointControls();
    recomputeAndDrawAll();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function bindEvents() {
    elements.pointValueSlider.addEventListener("input", function () {
      setSelectedHeight(Number.parseFloat(elements.pointValueSlider.value));
    });
    elements.pointValueNumber.addEventListener("change", function () {
      var next = elements.pointValueNumber.valueAsNumber;
      if (!Number.isFinite(next)) {
        elements.pointValueNumber.value = formatQ(state.points[state.selectedIndex].q);
        return;
      }
      setSelectedHeight(next);
    });

    elements.addPoint.addEventListener("click", function () {
      var result = model.addPoint(state.points);
      if (result.insertedIndex === -1) {
        return;
      }
      state.points = result.points;
      state.selectedIndex = result.insertedIndex;
      syncPointControls();
      recomputeAndDrawAll();
    });

    elements.removePoint.addEventListener("click", function () {
      if (!model.canRemovePoint(state.points, state.selectedIndex)) {
        return;
      }
      state.points = model.removePointAt(state.points, state.selectedIndex);
      state.selectedIndex = model.clamp(state.selectedIndex, 0, state.points.length - 1);
      syncPointControls();
      recomputeAndDrawAll();
    });

    elements.curveChart.addEventListener("pointerdown", function (event) {
      var index = pointerToPointIndex(event);
      if (index === -1) {
        return;
      }
      dragActive = true;
      state.selectedIndex = index;
      elements.curveChart.setPointerCapture(event.pointerId);
      syncPointControls();
      dragSetHeightFromPointer(event);
    });

    elements.curveChart.addEventListener("pointermove", function (event) {
      if (!dragActive) {
        return;
      }
      dragSetHeightFromPointer(event);
    });

    elements.curveChart.addEventListener("pointerup", function (event) {
      dragActive = false;
      if (elements.curveChart.hasPointerCapture(event.pointerId)) {
        elements.curveChart.releasePointerCapture(event.pointerId);
      }
    });
    elements.curveChart.addEventListener("pointercancel", function () {
      dragActive = false;
    });

    elements.curveChart.addEventListener("keydown", function (event) {
      var handled = true;
      if (event.key === "ArrowLeft") {
        selectIndex(state.selectedIndex - 1);
      } else if (event.key === "ArrowRight") {
        selectIndex(state.selectedIndex + 1);
      } else if (event.key === "Home") {
        selectIndex(0);
      } else if (event.key === "End") {
        selectIndex(state.points.length - 1);
      } else if (event.key === "ArrowUp") {
        setSelectedHeight(state.points[state.selectedIndex].q + HEIGHT_KEY_STEP);
      } else if (event.key === "ArrowDown") {
        setSelectedHeight(state.points[state.selectedIndex].q - HEIGHT_KEY_STEP);
      } else {
        handled = false;
      }
      if (handled) {
        event.preventDefault();
      }
    });
  }

  function svgPointFromEvent(event) {
    var rect = elements.curveChart.getBoundingClientRect();
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
    var best = -1;
    var bestDist = POINT_HIT_RADIUS;
    state.points.forEach(function (point, index) {
      var x = svgXOf(point.v, MAIN_LAYOUT);
      var y = svgYOf01(point.q, MAIN_LAYOUT);
      var dist = Math.hypot(svgPoint.x - x, svgPoint.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    return best;
  }

  function dragSetHeightFromPointer(event) {
    var svgPoint = svgPointFromEvent(event);
    if (!svgPoint) {
      return;
    }
    var q = model.clamp(
      (MAIN_LAYOUT.bottom - svgPoint.y) / (MAIN_LAYOUT.bottom - MAIN_LAYOUT.top), 0, 1
    );
    dragSetHeight(q);
  }

  function selectIndex(index) {
    state.selectedIndex = model.clamp(index, 0, state.points.length - 1);
    syncPointControls();
    if (state.lastSummary) {
      drawCurveChart(state.lastSummary);
      drawEnvelopeChart(state.lastSummary);
    }
  }

  function setSelectedHeight(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    state.points = model.setPointHeight(state.points, state.selectedIndex, value);
    syncPointControls();
    recomputeAndDrawAll();
  }

  function dragSetHeight(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    state.points = model.setPointHeight(state.points, state.selectedIndex, value);
    syncPointControls();
    scheduleRepaint();
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

  function syncPointControls() {
    var point = state.points[state.selectedIndex];
    elements.pointValueSlider.value = String(point.q);
    elements.pointValueNumber.value = formatQ(point.q);
    var label = "Allocation probability at v = " + formatV(point.v);
    elements.pointValueControlLabel.textContent = label;
    elements.pointValueSlider.setAttribute(
      "aria-valuetext", "Q = " + formatQ(point.q) + " at v = " + formatV(point.v)
    );
    elements.addPoint.disabled = !model.canAddPoint(state.points);
    elements.removePoint.disabled = !model.canRemovePoint(state.points, state.selectedIndex);
  }

  function recomputeAndDrawAll() {
    var summary = model.summarize(state.points);
    state.lastSummary = summary;
    drawCurveChart(summary);
    drawEnvelopeChart(summary);
    drawPaymentChart(summary);
    updateLiveSummary(summary);
  }

  function svgXOf(v, layout) {
    return layout.left + v * (layout.right - layout.left);
  }

  function svgYOf01(value, layout) {
    return layout.bottom - value * (layout.bottom - layout.top);
  }

  function makeYMapper(yMin, yMax, layout) {
    var span = (yMax - yMin) || 1;
    return function (value) {
      return layout.bottom - ((value - yMin) / span) * (layout.bottom - layout.top);
    };
  }

  function buildDenseSamples(fn, count) {
    var samples = [];
    var i;
    for (i = 0; i <= count; i += 1) {
      var v = i / count;
      samples.push({ v: v, value: fn(v) });
    }
    return samples;
  }

  function niceTicks(yMin, yMax) {
    var ticks = [yMin, yMax];
    if (yMin < -1e-9 && yMax > 1e-9) {
      ticks.push(0);
    }
    return ticks.sort(function (a, b) { return a - b; });
  }

  function drawAxisFrame(svg, layout, xTicks, yTicks, yMapper) {
    xTicks.forEach(function (value) {
      var x = svgXOf(value, layout);
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
      }, formatSigned(value));
    });

    appendSvg(svg, "rect", {
      x: layout.left, y: layout.top,
      width: layout.right - layout.left, height: layout.bottom - layout.top,
      fill: "none", class: "axis-line"
    });

  }

  function hermitePathD(curve, layout, yMapper) {
    var points = curve.points;
    var tangents = curve.tangents;
    var n = points.length;
    var d = "";
    var i;
    for (i = 0; i < n - 1; i += 1) {
      var p0 = points[i];
      var p1 = points[i + 1];
      var h = p1.v - p0.v;
      var m0 = tangents[i];
      var m1 = tangents[i + 1];
      var b1v = p0.v + h / 3;
      var b1q = p0.q + (m0 * h) / 3;
      var b2v = p1.v - h / 3;
      var b2q = p1.q - (m1 * h) / 3;
      if (i === 0) {
        d += "M " + svgXOf(p0.v, layout) + " " + yMapper(p0.q) + " ";
      }
      d += "C " + svgXOf(b1v, layout) + " " + yMapper(b1q) + ", " +
        svgXOf(b2v, layout) + " " + yMapper(b2q) + ", " +
        svgXOf(p1.v, layout) + " " + yMapper(p1.q) + " ";
    }
    return d;
  }

  function drawCurveChart(summary) {
    var svg = elements.curveChart;
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "curve-chart-title" }, "Allocation rule, Q(v)");
    appendSvg(svg, "desc", { id: "curve-chart-description" }, curveChartDescription(summary));

    var yMapper = function (value) { return svgYOf01(value, MAIN_LAYOUT); };
    drawAxisFrame(
      svg, MAIN_LAYOUT,
      [0, 0.25, 0.5, 0.75, 1], [0, 0.25, 0.5, 0.75, 1], yMapper
    );

    appendSvg(svg, "path", {
      d: hermitePathD(summary.curve, MAIN_LAYOUT, yMapper), fill: "none", class: "curve-q"
    });

    summary.points.forEach(function (point, index) {
      var isSelected = index === state.selectedIndex;
      appendSvg(svg, "circle", {
        cx: svgXOf(point.v, MAIN_LAYOUT), cy: svgYOf01(point.q, MAIN_LAYOUT),
        r: isSelected ? POINT_RADIUS + 1.5 : POINT_RADIUS,
        class: isSelected ? "control-point control-point-selected" : "control-point"
      });
    });
  }

  function drawEnvelopeChart(summary) {
    var svg = elements.envelopeChart;
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "envelope-chart-title" }, "Envelope of deviation payoffs");
    appendSvg(svg, "desc", { id: "envelope-chart-description" }, envelopeChartDescription(summary));
    var uSamples = buildDenseSamples(summary.curve.U, CURVE_SAMPLE_COUNT);
    var allValues = uSamples.map(function (s) { return s.value; });
    summary.violations.forEach(function (viol) {
      allValues.push(deviationLineValue(viol, 0));
      allValues.push(deviationLineValue(viol, 1));
    });
    var yMin = Math.min(0, Math.min.apply(null, allValues));
    var yMax = Math.max(0, Math.max.apply(null, allValues));
    var pad = Math.max(0.05, (yMax - yMin) * 0.08);
    yMin -= pad;
    yMax += pad;
    var yMapper = makeYMapper(yMin, yMax, DIAG_LAYOUT);

    drawAxisFrame(
      svg, DIAG_LAYOUT,
      [0, 0.25, 0.5, 0.75, 1], niceTicks(yMin, yMax), yMapper
    );

    var baseline = yMapper(0);
    var areaPoints = uSamples.map(function (s) {
      return svgXOf(s.v, DIAG_LAYOUT) + "," + yMapper(s.value);
    }).join(" ");
    appendSvg(svg, "polygon", {
      points: svgXOf(0, DIAG_LAYOUT) + "," + baseline + " " + areaPoints + " " +
        svgXOf(1, DIAG_LAYOUT) + "," + baseline,
      class: "rent-area"
    });

    summary.violations.forEach(function (viol, index) {
      var isSelected = index === state.selectedIndex;
      var className = "deviation-line" +
        (viol.violates ? " deviation-line-violation" : "") +
        (isSelected ? " deviation-line-selected" : "");
      appendSvg(svg, "line", {
        x1: svgXOf(0, DIAG_LAYOUT), y1: yMapper(deviationLineValue(viol, 0)),
        x2: svgXOf(1, DIAG_LAYOUT), y2: yMapper(deviationLineValue(viol, 1)),
        class: className
      });
    });

    summary.violations.forEach(function (viol) {
      appendSvg(svg, "circle", {
        cx: svgXOf(viol.v, DIAG_LAYOUT), cy: yMapper(viol.u), r: 3,
        class: viol.violates ? "violation-point" : "tangency-point"
      });
    });

    var uPath = "M " + uSamples.map(function (s) {
      return svgXOf(s.v, DIAG_LAYOUT) + " " + yMapper(s.value);
    }).join(" L ");
    appendSvg(svg, "path", { d: uPath, fill: "none", class: "rent-curve" });
  }

  function deviationLineValue(viol, v) {
    return (v - viol.v) * viol.q + viol.u;
  }

  function drawPaymentChart(summary) {
    var svg = elements.paymentChart;
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "payment-chart-title" }, "Payment rule");
    appendSvg(svg, "desc", { id: "payment-chart-description" }, paymentChartDescription());
    var pSamples = buildDenseSamples(summary.curve.P, CURVE_SAMPLE_COUNT);
    var values = pSamples.map(function (s) { return s.value; });
    var yMin = Math.min(0, Math.min.apply(null, values));
    var yMax = Math.max(0, Math.max.apply(null, values));
    var pad = Math.max(0.05, (yMax - yMin) * 0.08);
    yMin -= pad;
    yMax += pad;
    var yMapper = makeYMapper(yMin, yMax, DIAG_LAYOUT);

    drawAxisFrame(
      svg, DIAG_LAYOUT,
      [0, 0.25, 0.5, 0.75, 1], niceTicks(yMin, yMax), yMapper
    );

    var pPath = "M " + pSamples.map(function (s) {
      return svgXOf(s.v, DIAG_LAYOUT) + " " + yMapper(s.value);
    }).join(" L ");
    appendSvg(svg, "path", { d: pPath, fill: "none", class: "payment-curve" });
  }

  function updateLiveSummary(summary) {
    elements.liveSummary.textContent =
      (summary.icHolds ?
        "The allocation curve is globally incentive compatible. " :
        "The allocation curve violates global incentive compatibility at " +
        summary.violationCount + " of " + summary.violations.length + " points. ") +
      "There are " + summary.points.length + " control points.";
  }

  function curveChartDescription(summary) {
    return "A shape-preserving cubic Hermite curve through " + summary.points.length +
      " draggable control points on [0,1], giving the allocation probability " +
      "Q as a function of type v. The selected point is at v = " +
      formatV(state.points[state.selectedIndex].v) + ", Q = " +
      formatQ(state.points[state.selectedIndex].q) + ".";
  }

  function envelopeChartDescription(summary) {
    return "The rent curve U(v), shaded beneath it, together with one " +
      "straight deviation-payoff line per control point. " +
      (summary.icHolds ?
        "Every line stays at or below U(v): global IC holds." :
        summary.violationCount + " of " + summary.violations.length +
        " lines rise above U(v) somewhere: global IC is violated there.");
  }

  function paymentChartDescription() {
    return "The payment rule P(v) = vQ(v) - U(v) implied by the painted " +
      "allocation curve.";
  }

  function formatQ(value) {
    return value.toFixed(2);
  }

  function formatV(value) {
    return value.toFixed(2);
  }

  function formatSigned(value) {
    var cleaned = Math.abs(value) < 1e-9 ? 0 : value;
    return cleaned.toFixed(2);
  }

}());
