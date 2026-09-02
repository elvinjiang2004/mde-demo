(function () {
  "use strict";

  var model = window.BilateralTradeModel;
  var math = window.MechanismMath;
  var visuals = window.BilateralTradeVisuals;
  var appendSvg = window.SvgUtils.appendSvg;
  var createFieldRaster = window.SvgUtils.createFieldRaster;
  var plotPointFromEvent = visuals.plotPointFromEvent;
  var formatProbe = visuals.formatProbe;
  var R = model.CELL_RESOLUTION;
  var CELL_SIZE = model.CELL_SIZE;
  var triangleMesh = window.SvgUtils.createTriangleMesh(R);
  var svgXOf = triangleMesh.svgXOf;
  var svgYOf = triangleMesh.svgYOf;
  var cellRect = triangleMesh.cellRect;
  var cellCorners = triangleMesh.cellCorners;
  var trianglePoints = triangleMesh.trianglePoints;
  var drawTriangleMesh = triangleMesh.drawTriangleMesh;
  var DIAGNOSTIC_RASTER_SIZE = visuals.DIAGNOSTIC_RASTER_SIZE;

  var MAIN_LAYOUT = {
    viewWidth: 480,
    viewHeight: 520,
    left: 50,
    right: 450,
    top: 40,
    bottom: 440
  };
  var DIAG_LAYOUT = {
    viewWidth: 220,
    viewHeight: 240,
    left: 35,
    right: 200,
    top: 15,
    bottom: 180
  };

  var elements = {};
  var state = {
    grid: null,
    selected: { i: 0, j: 0, isLower: true },
    brushValue: 0,
    lastSummary: null,
    heatmapPalette: null,
    allocationProbe: { v: 0.5, c: 0.5, visible: false },
    diagnosticProbe: {
      buyerIc: { x: 0.5, y: 0.5, visible: false },
      sellerIc: { x: 0.5, y: 0.5, visible: false },
      revenue: { x: 0.5, y: 0.5, visible: false },
      buyerPayoff: { x: 0.5, y: 0.5, visible: false },
      sellerPayoff: { x: 0.5, y: 0.5, visible: false },
      efficiency: { x: 0.5, y: 0.5, visible: false }
    }
  };
  var dragActive = false;
  var dragDirty = false;
  var dragFrameRequested = false;
  var paintFrameRequested = false;
  var paintTriangles = null;
  var pendingPaintTriangles = {};
  var keyboardPaintKeys = { Enter: false, Space: false };
  var keyboardPaintDirty = false;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    elements = {
      paintChart: byId("paint-chart"),
      brushValueSlider: byId("brush-value-slider"),
      brushValueNumber: byId("brush-value-number"),
      liveSummary: byId("live-summary"),
      buyerIcChart: byId("buyer-ic-chart"),
      buyerIcText: byId("buyer-ic-text"),
      sellerIcChart: byId("seller-ic-chart"),
      sellerIcText: byId("seller-ic-text"),
      buyerPayoffChart: byId("buyer-payoff-chart"),
      buyerPayoffText: byId("buyer-payoff-text"),
      sellerPayoffChart: byId("seller-payoff-chart"),
      sellerPayoffText: byId("seller-payoff-text"),
      revenueChart: byId("revenue-chart"),
      revenueText: byId("revenue-text"),
      efficiencyChart: byId("efficiency-chart"),
      efficiencyText: byId("efficiency-text"),
      diagnosticProbeStatus: byId("diagnostic-probe-status")
    };

    state.grid = model.efficientGrid();
    var center = Math.floor((R - 1) / 2);
    state.selected = { i: center, j: center, isLower: true };
    state.brushValue = state.grid.lower[center][center];

    math.typesetInitial(
      ".introduction, .explorable, .derivation, .notes, .references"
    );
    window.EquationChain.initDividers();
    bindEvents();
    syncBrushControls();
    recomputeAndDrawAll();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function bindEvents() {
    elements.brushValueSlider.addEventListener("input", function () {
      setBrushValue(Number.parseFloat(elements.brushValueSlider.value));
    });
    elements.brushValueNumber.addEventListener("change", function () {
      var next = elements.brushValueNumber.valueAsNumber;
      if (!Number.isFinite(next)) {
        elements.brushValueNumber.value = formatQ(state.brushValue);
        return;
      }
      setBrushValue(next);
    });

    elements.paintChart.addEventListener("pointerdown", function (event) {
      finishKeyboardPaint();
      var point = plotPointFromEvent(elements.paintChart, event, MAIN_LAYOUT);
      if (point) {
        setAllocationProbe(point.x, point.y, true);
      }
      var triangle = pointerToTriangle(event);
      if (!triangle || !triangle.insidePlot) {
        return;
      }
      dragActive = true;
      dragDirty = false;
      elements.paintChart.setPointerCapture(event.pointerId);
      dragDirty = paintTriangle(triangle.i, triangle.j, triangle.isLower);
    });

    elements.paintChart.addEventListener("pointermove", function (event) {
      var point = plotPointFromEvent(elements.paintChart, event, MAIN_LAYOUT);
      if (point) {
        setAllocationProbe(point.x, point.y, false);
      }
      if (!dragActive) {
        return;
      }
      var triangle = pointerToTriangle(event);
      if (triangle) {
        dragDirty = paintTriangle(triangle.i, triangle.j, triangle.isLower) ||
          dragDirty;
      }
    });

    elements.paintChart.addEventListener("pointerup", endPaintStroke);
    elements.paintChart.addEventListener("pointercancel", endPaintStroke);
    elements.paintChart.addEventListener("pointerleave", function () {
      if (!dragActive && document.activeElement !== elements.paintChart) {
        hideAllocationProbe();
      }
    });
    elements.paintChart.addEventListener("focus", function () {
      var centroid = model.triangleCentroid(
        state.selected.i, state.selected.j, state.selected.isLower
      );
      setAllocationProbe(centroid.v, centroid.c, true);
    });
    elements.paintChart.addEventListener("blur", function () {
      hideAllocationProbe();
      finishKeyboardPaint();
    });

    elements.paintChart.addEventListener("keydown", function (event) {
      var moved = true;
      var selectionChanged = false;
      if (event.key === "ArrowLeft") {
        moveHorizontalSelection(-1);
        selectionChanged = true;
      } else if (event.key === "ArrowRight") {
        moveHorizontalSelection(1);
        selectionChanged = true;
      } else if (event.key === "ArrowUp") {
        moveVerticalSelection(1);
        selectionChanged = true;
      } else if (event.key === "ArrowDown") {
        moveVerticalSelection(-1);
        selectionChanged = true;
      } else if (event.key === "Home") {
        selectTriangle(0, state.selected.j, false);
        selectionChanged = true;
      } else if (event.key === "End") {
        selectTriangle(R - 1, state.selected.j, true);
        selectionChanged = true;
      } else if (event.key === "l" || event.key === "L") {
        selectTriangle(state.selected.i, state.selected.j, false);
        selectionChanged = true;
      } else if (event.key === "r" || event.key === "R") {
        selectTriangle(state.selected.i, state.selected.j, true);
        selectionChanged = true;
      } else if (event.key === "Enter" || event.key === " ") {
        startKeyboardPaint(event.key);
      } else if (event.key === "Escape") {
        hideAllocationProbe();
        finishKeyboardPaint();
      } else {
        moved = false;
      }
      if (selectionChanged && keyboardPaintActive()) {
        applyKeyboardBrush();
      }
      if (moved) {
        event.preventDefault();
        if (event.key !== "Escape") {
          var centroid = model.triangleCentroid(
            state.selected.i, state.selected.j, state.selected.isLower
          );
          setAllocationProbe(centroid.v, centroid.c, true);
        }
      }
    });
    elements.paintChart.addEventListener("keyup", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        stopKeyboardPaint(event.key);
      }
    });

    [
      ["buyerIc", elements.buyerIcChart],
      ["sellerIc", elements.sellerIcChart],
      ["revenue", elements.revenueChart],
      ["buyerPayoff", elements.buyerPayoffChart],
      ["sellerPayoff", elements.sellerPayoffChart],
      ["efficiency", elements.efficiencyChart]
    ].forEach(function (entry) {
      bindDiagnosticChart(entry[0], entry[1]);
    });

    if (typeof window.matchMedia === "function") {
      ["(prefers-color-scheme: dark)", "print"].forEach(function (queryText) {
        var mediaQuery = window.matchMedia(queryText);
        var handlePaletteChange = function () {
          recomputeAndDrawAll();
        };
        if (typeof mediaQuery.addEventListener === "function") {
          mediaQuery.addEventListener("change", handlePaletteChange);
        } else if (typeof mediaQuery.addListener === "function") {
          mediaQuery.addListener(handlePaletteChange);
        }
      });
    }
  }

  function bindDiagnosticChart(key, chart) {
    visuals.bindProbeChart(
      chart,
      DIAG_LAYOUT,
      function () {
        var probe = state.diagnosticProbe[key];
        return { x: probe.x, y: probe.y };
      },
      function (x, y, announce) {
        setDiagnosticProbe(key, x, y, announce);
      },
      function () {
        hideDiagnosticProbe(key);
      }
    );
  }

  function setDiagnosticProbe(key, x, y, announce) {
    state.diagnosticProbe[key] = {
      x: model.clamp(x, 0, 1),
      y: model.clamp(y, 0, 1),
      visible: true
    };
    drawDiagnosticProbe(key);
    if (announce) {
      announceDiagnosticProbe(key);
    }
  }

  function hideDiagnosticProbe(key) {
    state.diagnosticProbe[key].visible = false;
    var group = diagnosticChart(key).querySelector(".diagnostic-probe");
    if (group) {
      group.remove();
    }
  }

  function setAllocationProbe(v, c, announce) {
    state.allocationProbe.v = model.clamp(v, 0, 1);
    state.allocationProbe.c = model.clamp(c, 0, 1);
    state.allocationProbe.visible = true;
    drawAllocationProbe();
    if (announce) {
      announceAllocationProbe();
    }
  }

  function hideAllocationProbe() {
    state.allocationProbe.visible = false;
    drawAllocationProbe();
  }

  function pointerToTriangle(event) {
    return triangleMesh.pointerToTriangle(elements.paintChart, event, MAIN_LAYOUT);
  }

  function endPaintStroke(event) {
    if (!dragActive) {
      return;
    }
    dragActive = false;
    if (elements.paintChart.hasPointerCapture(event.pointerId)) {
      elements.paintChart.releasePointerCapture(event.pointerId);
    }
    var shouldRefresh = dragDirty;
    dragDirty = false;
    if (shouldRefresh) {
      flushPendingPaintTriangles();
      recomputeAndDrawAll(false);
    }
  }

  function paintTriangle(i, j, isLower) {
    var selectionChanged = state.selected.i !== i || state.selected.j !== j ||
      state.selected.isLower !== isLower;
    var currentValue = isLower ? state.grid.lower[i][j] : state.grid.upper[i][j];
    state.selected = { i: i, j: j, isLower: isLower };
    if (currentValue === state.brushValue) {
      if (selectionChanged && state.lastSummary) {
        schedulePaintChart();
      }
      return false;
    }
    if (isLower) {
      state.grid.lower[i][j] = state.brushValue;
    } else {
      state.grid.upper[i][j] = state.brushValue;
    }
    scheduleRepaint(i, j, isLower);
    return true;
  }

  function moveHorizontalSelection(direction) {
    if (direction > 0) {
      if (!state.selected.isLower) {
        selectTriangle(state.selected.i, state.selected.j, true);
      } else if (state.selected.i < R - 1) {
        selectTriangle(state.selected.i + 1, state.selected.j, false);
      }
    } else if (state.selected.isLower) {
      selectTriangle(state.selected.i, state.selected.j, false);
    } else if (state.selected.i > 0) {
      selectTriangle(state.selected.i - 1, state.selected.j, true);
    }
  }

  function moveVerticalSelection(direction) {
    if (direction > 0) {
      if (state.selected.isLower) {
        selectTriangle(state.selected.i, state.selected.j, false);
      } else if (state.selected.j < R - 1) {
        selectTriangle(state.selected.i, state.selected.j + 1, true);
      }
    } else if (!state.selected.isLower) {
      selectTriangle(state.selected.i, state.selected.j, true);
    } else if (state.selected.j > 0) {
      selectTriangle(state.selected.i, state.selected.j - 1, false);
    }
  }

  function keyboardPaintActive() {
    return keyboardPaintKeys.Enter || keyboardPaintKeys.Space;
  }

  function startKeyboardPaint(key) {
    keyboardPaintKeys[key === "Enter" ? "Enter" : "Space"] = true;
    applyKeyboardBrush();
  }

  function applyKeyboardBrush() {
    keyboardPaintDirty = paintTriangle(
      state.selected.i, state.selected.j, state.selected.isLower
    ) || keyboardPaintDirty;
  }

  function stopKeyboardPaint(key) {
    keyboardPaintKeys[key === "Enter" ? "Enter" : "Space"] = false;
    if (!keyboardPaintActive()) {
      finishKeyboardPaint();
    }
  }

  function finishKeyboardPaint() {
    keyboardPaintKeys.Enter = false;
    keyboardPaintKeys.Space = false;
    var shouldRefresh = keyboardPaintDirty;
    keyboardPaintDirty = false;
    if (shouldRefresh) {
      flushPendingPaintTriangles();
      recomputeAndDrawAll(false);
    }
  }

  function selectTriangle(i, j, isLower) {
    state.selected = { i: i, j: j, isLower: isLower };
    drawPaintSelection();
  }

  function setBrushValue(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    state.brushValue = model.clamp(value, 0, 1);
    syncBrushControls();
  }

  function syncBrushControls() {
    elements.brushValueSlider.value = String(state.brushValue);
    elements.brushValueNumber.value = formatQ(state.brushValue);
    elements.brushValueSlider.setAttribute(
      "aria-valuetext",
      "Brush q = " + formatQ(state.brushValue)
    );
  }

  function paintTriangleKey(i, j, isLower) {
    return i + ":" + j + ":" + (isLower ? "R" : "L");
  }

  function scheduleRepaint(i, j, isLower) {
    pendingPaintTriangles[paintTriangleKey(i, j, isLower)] = {
      i: i, j: j, isLower: isLower
    };
    if (dragFrameRequested) {
      return;
    }
    dragFrameRequested = true;
    window.requestAnimationFrame(function () {
      dragFrameRequested = false;
      flushPendingPaintTriangles();
    });
  }

  function flushPendingPaintTriangles() {
    var updates = pendingPaintTriangles;
    var keys = Object.keys(updates);
    pendingPaintTriangles = {};
    keys.forEach(function (key) {
      var update = updates[key];
      drawPaintTriangle(update.i, update.j, update.isLower);
    });
    if (keys.length) {
      drawPaintSelection();
    }
  }

  function schedulePaintChart() {
    if (paintFrameRequested || dragFrameRequested) {
      return;
    }
    paintFrameRequested = true;
    window.requestAnimationFrame(function () {
      paintFrameRequested = false;
      if (!dragFrameRequested) {
        drawPaintSelection();
      }
    });
  }

  function recomputeAndDrawAll(redrawAllocation) {
    pendingPaintTriangles = {};
    var nextPalette = visuals.readHeatmapPalette(
      window.getComputedStyle(document.documentElement)
    );
    var paletteChanged = paletteKey(nextPalette) !== paletteKey(state.heatmapPalette);
    state.heatmapPalette = nextPalette;
    var summary = model.summarize(state.grid);
    state.lastSummary = summary;
    if (redrawAllocation !== false || paletteChanged) {
      drawPaintChart(state.grid);
    }
    drawBuyerIcChart(summary);
    drawSellerIcChart(summary);
    drawPayoffCharts(summary);
    drawRevenueChart(summary);
    drawEfficiencyChart(summary);
    drawDiagnosticProbes();
    updateDiagnosticText(summary);
    updateLiveSummary(summary);
  }

  function paletteKey(palette) {
    if (!palette) {
      return "";
    }
    return ["neutral", "blue", "green", "yellow", "orange", "red"]
      .map(function (key) { return palette[key].join(","); })
      .join("|");
  }

  function sequentialScale(paletteKey) {
    return function (value) {
      return visuals.sequentialColor(
        state.heatmapPalette, paletteKey, value
      );
    };
  }

  function revenueChannels(value, extent) {
    return visuals.signedChannels(
      value, extent, state.heatmapPalette.red, state.heatmapPalette.green
    );
  }

  function efficiencyChannels(value, pixelX, pixelY) {
    return visuals.efficiencyChannels(
      value, pixelX, pixelY, state.heatmapPalette
    );
  }

  var qColor = sequentialScale("blue");

  function drawPaintChart(grid) {
    var svg = elements.paintChart;
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "paint-chart-title" }, "Allocation rule, q(v,c)");
    appendSvg(svg, "desc", { id: "paint-chart-description" }, paintChartDescription());

    paintTriangles = drawTriangleMesh(svg, grid, MAIN_LAYOUT, qColor);
    visuals.drawFrame(svg, MAIN_LAYOUT, triangleMesh, false);

    drawPaintSelection();
    drawAllocationProbe();
  }

  function drawPaintTriangle(i, j, isLower) {
    if (!paintTriangles) {
      drawPaintChart(state.grid);
      return;
    }
    var side = isLower ? "lower" : "upper";
    var value = state.grid[side][i][j];
    paintTriangles[side][i][j].setAttribute(
      "fill", qColor(value, i, j, isLower)
    );
  }

  function drawPaintSelection() {
    if (!elements.paintChart || !paintTriangles) {
      return;
    }
    var svg = elements.paintChart;
    var priorCursor = svg.querySelector(".cell-cursor");
    var priorLabel = svg.querySelector(".cell-label");
    if (priorCursor) {
      priorCursor.remove();
    }
    if (priorLabel) {
      priorLabel.remove();
    }
    var description = svg.querySelector("#paint-chart-description");
    if (description) {
      description.textContent = paintChartDescription();
    }

    var cellBounds = cellRect(state.selected.i, state.selected.j, MAIN_LAYOUT);
    var corners = cellCorners(state.selected.i, state.selected.j, MAIN_LAYOUT);
    appendSvg(svg, "polygon", {
      points: trianglePoints(corners, state.selected.isLower),
      class: "cell-cursor"
    });

    drawCellLabel(svg, MAIN_LAYOUT, cellBounds);
  }

  function drawAllocationProbe() {
    var svg = elements.paintChart;
    var prior = svg.querySelector(".allocation-probe");
    if (prior) {
      prior.remove();
    }
    var probe = state.allocationProbe;
    if (!probe.visible || !state.grid) {
      return;
    }
    var value = model.allocationErrorAt(
      state.grid, probe.v, probe.c
    ).q;
    var x = svgXOf(probe.v, MAIN_LAYOUT);
    var y = svgYOf(probe.c, MAIN_LAYOUT);
    var scaffold = visuals.drawProbeScaffold(svg, {
      layout: MAIN_LAYOUT,
      x: x,
      y: y,
      boxWidth: 72,
      groupClass: "allocation-probe chart-480x520-probe",
      radius: 3.5,
      xValue: formatProbe(probe.v),
      yValue: formatProbe(probe.c)
    });
    visuals.appendProbeValueText(
      scaffold.group,
      scaffold.textX,
      scaffold.textY,
      { symbol: "q", value: formatProbe(value) },
      "="
    );
  }

  function announceAllocationProbe() {
    var probe = state.allocationProbe;
    var value = model.allocationErrorAt(
      state.lastSummary.grid, probe.v, probe.c
    ).q;
    elements.diagnosticProbeStatus.textContent =
      "Buyer value " + formatProbe(probe.v) + ", seller value " +
      formatProbe(probe.c) + ", allocation " + formatProbe(value) + ".";
  }

  function drawCellLabel(svg, layout, cursorRect) {
    var text = formatCellRange(state.selected.i) + " × " +
      formatCellRange(state.selected.j) + " " + formatSelectionSide();
    visuals.drawCellLabel(svg, layout, cursorRect, text);
  }

  function drawDeviationChart(svg, agent, summary, extent) {
    var diagnostic = summary.deviation[agent];
    var buyer = agent === "buyer";
    var titleText = buyer ? "Buyer IC" : "Seller IC";
    svg.replaceChildren();
    appendSvg(svg, "title", { id: svg.id + "-title" }, titleText);
    appendSvg(svg, "desc", { id: svg.id + "-description" },
      buyer ? buyerIcChartDescription(summary) :
        sellerIcChartDescription(summary));
    appendSvg(svg, "image", {
      x: DIAG_LAYOUT.left,
      y: DIAG_LAYOUT.top,
      width: DIAG_LAYOUT.right - DIAG_LAYOUT.left,
      height: DIAG_LAYOUT.bottom - DIAG_LAYOUT.top,
      href: createFieldRaster(
        DIAGNOSTIC_RASTER_SIZE,
        function (trueType, report) {
          return buyer ?
            model.buyerInterimDeviationUtility(
              summary.interim, trueType, report
            ) : model.sellerInterimDeviationUtility(
              summary.interim, trueType, report
            );
        },
        function (value) {
          return visuals.signedChannels(
            value, extent,
            state.heatmapPalette.blue,
            state.heatmapPalette.yellow
          );
        }
      ),
      preserveAspectRatio: "none",
      "data-renderer": "payoff-raster",
      "data-raster-size": DIAGNOSTIC_RASTER_SIZE
    });
    visuals.drawLineFrame(svg, DIAG_LAYOUT, triangleMesh);
    appendSvg(svg, "line", {
      x1: DIAG_LAYOUT.left,
      y1: DIAG_LAYOUT.bottom,
      x2: DIAG_LAYOUT.right,
      y2: DIAG_LAYOUT.top,
      class: "truthful-report-line"
    });
    appendSvg(svg, "polyline", {
      points: diagnostic.bestResponses.map(function (response) {
        return svgXOf(response.trueType, DIAG_LAYOUT) + "," +
          svgYOf(response.report, DIAG_LAYOUT);
      }).join(" "),
      class: "best-report-line"
    });
    svg.dataset.maxDeviationGain = String(
      diagnostic.bestResponses.reduce(function (maximum, response) {
        return Math.max(maximum, response.gain);
      }, 0)
    );
    svg.dataset.colorLow = "blue";
    svg.dataset.colorZero = "clear";
    svg.dataset.colorHigh = "yellow";
  }

  function drawBuyerIcChart(summary) {
    drawDeviationChart(
      elements.buyerIcChart, "buyer", summary,
      visuals.payoffDisplayExtent(summary)
    );
  }

  function drawSellerIcChart(summary) {
    drawDeviationChart(
      elements.sellerIcChart, "seller", summary,
      visuals.payoffDisplayExtent(summary)
    );
  }

  function drawPayoffCharts(summary) {
    var extent = visuals.payoffDisplayExtent(summary);
    var colorFn = function (value) {
      return visuals.signedChannels(
        value, extent,
        state.heatmapPalette.blue,
        state.heatmapPalette.yellow
      );
    };
    drawSingleDiagnostic(
      elements.buyerPayoffChart,
      "buyer-payoff-chart",
      "Buyer IR",
      "Buyer payoff u sub B at every buyer-value, seller-value pair, with blue low, a clear zero, and yellow high.",
      function (v, c) {
        return model.patchGridValueAt(summary.patches.buyerPayoff, v, c);
      },
      colorFn
    );
    drawSingleDiagnostic(
      elements.sellerPayoffChart,
      "seller-payoff-chart",
      "Seller IR",
      "Seller payoff u sub S at every buyer-value, seller-value pair, with blue low, a clear zero, and yellow high.",
      function (v, c) {
        return model.patchGridValueAt(summary.patches.sellerPayoff, v, c);
      },
      colorFn
    );
    [elements.buyerPayoffChart, elements.sellerPayoffChart]
      .forEach(function (svg) {
        svg.dataset.colorLow = "blue";
        svg.dataset.colorZero = "clear";
        svg.dataset.colorHigh = "yellow";
      });
  }

  function drawSingleDiagnostic(svg, idPrefix, titleText, descText, valueAt, colorFn) {
    svg.replaceChildren();
    appendSvg(svg, "title", { id: idPrefix + "-title" }, titleText);
    appendSvg(svg, "desc", { id: idPrefix + "-description" }, descText);
    appendSvg(svg, "image", {
      x: DIAG_LAYOUT.left,
      y: DIAG_LAYOUT.top,
      width: DIAG_LAYOUT.right - DIAG_LAYOUT.left,
      height: DIAG_LAYOUT.bottom - DIAG_LAYOUT.top,
      href: createFieldRaster(DIAGNOSTIC_RASTER_SIZE, valueAt, colorFn),
      preserveAspectRatio: "none",
      "data-renderer": "diagnostic-raster",
      "data-raster-size": DIAGNOSTIC_RASTER_SIZE
    });
    visuals.drawFrame(svg, DIAG_LAYOUT, triangleMesh, true);
  }

  function drawRevenueChart(summary) {
    var svg = elements.revenueChart;
    var extent = Math.max(
      0.05,
      Math.abs(summary.verdicts.minRevenue),
      Math.abs(summary.verdicts.maxRevenue)
    );
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "revenue-chart-title" }, "Net revenue");
    appendSvg(svg, "desc", { id: "revenue-chart-description" }, revenueChartDescription(summary));

    appendSvg(svg, "image", {
      x: DIAG_LAYOUT.left,
      y: DIAG_LAYOUT.top,
      width: DIAG_LAYOUT.right - DIAG_LAYOUT.left,
      height: DIAG_LAYOUT.bottom - DIAG_LAYOUT.top,
      href: createFieldRaster(
        DIAGNOSTIC_RASTER_SIZE,
        function (v, c) {
          return model.patchGridValueAt(summary.patches.revenue, v, c);
        },
        function (value) { return revenueChannels(value, extent); }
      ),
      preserveAspectRatio: "none",
      "data-renderer": "diagnostic-raster",
      "data-raster-size": DIAGNOSTIC_RASTER_SIZE
    });
    visuals.drawFrame(svg, DIAG_LAYOUT, triangleMesh, true);
    svg.dataset.colorLow = "red";
    svg.dataset.colorZero = "clear";
    svg.dataset.colorHigh = "green";
  }

  function drawEfficiencyChart(summary) {
    var svg = elements.efficiencyChart;
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "efficiency-chart-title" }, "Efficiency comparison");
    appendSvg(svg, "desc", { id: "efficiency-chart-description" }, efficiencyChartDescription(summary));

    appendSvg(svg, "image", {
      x: DIAG_LAYOUT.left,
      y: DIAG_LAYOUT.top,
      width: DIAG_LAYOUT.right - DIAG_LAYOUT.left,
      height: DIAG_LAYOUT.bottom - DIAG_LAYOUT.top,
      href: createFieldRaster(
        DIAGNOSTIC_RASTER_SIZE,
        function (v, c) {
          return model.allocationErrorAt(summary.grid, v, c);
        },
        efficiencyChannels
      ),
      preserveAspectRatio: "none",
      "data-renderer": "diagnostic-raster",
      "data-raster-size": DIAGNOSTIC_RASTER_SIZE
    });
    visuals.drawFrame(svg, DIAG_LAYOUT, triangleMesh, true);
  }

  function diagnosticChart(key) {
    if (key === "buyerIc") {
      return elements.buyerIcChart;
    }
    if (key === "sellerIc") {
      return elements.sellerIcChart;
    }
    if (key === "revenue") {
      return elements.revenueChart;
    }
    if (key === "buyerPayoff") {
      return elements.buyerPayoffChart;
    }
    if (key === "sellerPayoff") {
      return elements.sellerPayoffChart;
    }
    return elements.efficiencyChart;
  }

  function diagnosticValueAt(key, x, y) {
    if (key === "buyerIc") {
      return model.buyerInterimDeviationUtility(
        state.lastSummary.interim, x, y
      );
    }
    if (key === "sellerIc") {
      return model.sellerInterimDeviationUtility(
        state.lastSummary.interim, x, y
      );
    }
    if (key === "revenue") {
      return model.patchGridValueAt(
        state.lastSummary.patches.revenue, x, y
      );
    }
    if (key === "buyerPayoff") {
      return model.patchGridValueAt(
        state.lastSummary.patches.buyerPayoff, x, y
      );
    }
    if (key === "sellerPayoff") {
      return model.patchGridValueAt(
        state.lastSummary.patches.sellerPayoff, x, y
      );
    }
    return model.allocationErrorAt(state.lastSummary.grid, x, y);
  }

  function diagnosticValueLabel(key, value) {
    if (key === "buyerIc") {
      return { symbol: "U", subscript: "B", value: formatSigned(value), width: 70 };
    }
    if (key === "sellerIc") {
      return { symbol: "U", subscript: "S", value: formatSigned(value), width: 70 };
    }
    if (key === "buyerPayoff") {
      return { symbol: "u", subscript: "B", value: formatSigned(value), width: 70 };
    }
    if (key === "sellerPayoff") {
      return { symbol: "u", subscript: "S", value: formatSigned(value), width: 70 };
    }
    if (key === "revenue") {
      return { symbol: "Rev", value: formatSigned(value), width: 76 };
    }
    return {
      label: "Loss",
      value: formatProbe(value.over + value.under),
      width: 70
    };
  }

  function drawDiagnosticProbes() {
    Object.keys(state.diagnosticProbe).forEach(drawDiagnosticProbe);
  }

  function drawDiagnosticProbe(key) {
    var svg = diagnosticChart(key);
    var prior = svg.querySelector(".diagnostic-probe");
    if (prior) {
      prior.remove();
    }
    var probe = state.diagnosticProbe[key];
    if (!probe.visible || !state.lastSummary) {
      return;
    }
    var value = diagnosticValueAt(key, probe.x, probe.y);
    var label = diagnosticValueLabel(key, value);
    drawCompactDiagnosticProbe(
      svg,
      svgXOf(probe.x, DIAG_LAYOUT),
      svgYOf(probe.y, DIAG_LAYOUT),
      label,
      formatProbe(probe.x),
      formatProbe(probe.y)
    );
  }

  function drawCompactDiagnosticProbe(svg, x, y, valueLabel, xValue, yValue) {
    var scaffold = visuals.drawProbeScaffold(svg, {
      layout: DIAG_LAYOUT,
      x: x,
      y: y,
      boxWidth: valueLabel.width,
      groupClass: "diagnostic-probe chart-220x240-probe",
      compact: true,
      xValue: xValue,
      yValue: yValue
    });
    visuals.appendProbeValueText(
      scaffold.group,
      scaffold.textX,
      scaffold.textY,
      valueLabel,
      "="
    );
  }

  function announceDiagnosticProbe(key) {
    var probe = state.diagnosticProbe[key];
    var value = diagnosticValueAt(key, probe.x, probe.y);
    var result;
    var coordinates;
    if (key === "buyerIc") {
      coordinates = "Buyer value " + formatProbe(probe.x) +
        ", alternate buyer report " + formatProbe(probe.y);
      result = "U B equals " + formatSigned(value);
    } else if (key === "sellerIc") {
      coordinates = "Seller value " + formatProbe(probe.x) +
        ", alternate seller report " + formatProbe(probe.y);
      result = "U S equals " + formatSigned(value);
    } else {
      coordinates = "Buyer value " + formatProbe(probe.x) +
        ", seller value " + formatProbe(probe.y);
      if (key === "buyerPayoff") {
        result = "u B equals " + formatSigned(value);
      } else if (key === "sellerPayoff") {
        result = "u S equals " + formatSigned(value);
      } else if (key === "revenue") {
        result = "Rev equals " + formatSigned(value);
      } else {
        result = "allocation loss " + formatProbe(value.over + value.under);
      }
    }
    elements.diagnosticProbeStatus.textContent = coordinates + ", " + result + ".";
  }

  function appendFormattedText(container, segments) {
    segments.forEach(function (segment) {
      if (typeof segment === "string") {
        container.appendChild(document.createTextNode(segment));
      } else {
        container.appendChild(document.createTextNode(segment[0]));
        var sub = document.createElement("sub");
        sub.textContent = segment[1];
        container.appendChild(sub);
      }
    });
  }

  function renderDiagnosticLines(container, lines) {
    container.replaceChildren();
    lines.forEach(function (line) {
      var p = document.createElement("p");
      if (line.segments) {
        appendFormattedText(p, line.segments);
      } else {
        p.textContent = line.text;
      }
      p.className = "verdict-" + line.state;
      container.appendChild(p);
    });
  }

  function updateDiagnosticText(summary) {
    var v = summary.verdicts;

    elements.buyerIcText.dataset.icImplementable = String(v.icImplementable);
    elements.buyerIcText.dataset.buyerIcViolationCount =
      String(v.buyerIcViolationCount);
    elements.sellerIcText.dataset.icImplementable = String(v.icImplementable);
    elements.sellerIcText.dataset.sellerIcViolationCount =
      String(v.sellerIcViolationCount);

    elements.revenueText.dataset.exPostBudgetBalanced = String(v.exPostBudgetBalanced);
    elements.revenueText.dataset.exPostNoDeficit = String(v.exPostNoDeficit);
    elements.revenueText.dataset.expectedRevenue = String(v.expectedRevenue);
    elements.revenueText.dataset.expectedNoDeficit = String(v.expectedNoDeficit);

    elements.efficiencyText.dataset.welfare = String(v.welfare);
    elements.efficiencyText.dataset.efficiencyLoss = String(v.efficiencyLoss);

    renderDiagnosticLines(elements.buyerIcText, [{
      segments: v.buyerIcViolationCount > 0 ?
        [["Q", "B"], " nonmonotonic on " + v.buyerIcViolationCount + " intervals."] :
        [["Q", "B"], " weakly increasing."],
      state: v.buyerIcViolationCount > 0 ? "fail" : "pass"
    }]);

    renderDiagnosticLines(elements.sellerIcText, [{
      segments: v.sellerIcViolationCount > 0 ?
        [["Q", "S"], " nonmonotonic on " + v.sellerIcViolationCount + " intervals."] :
        [["Q", "S"], " weakly decreasing."],
      state: v.sellerIcViolationCount > 0 ? "fail" : "pass"
    }]);

    var buyerPayoffLines = [{
      text: "Expected buyer payoff: " + formatSigned(v.expectedBuyerPayoff) + ".",
      state: "pass"
    }];
    var sellerPayoffLines = [{
      text: "Expected seller payoff: " + formatSigned(v.expectedSellerPayoff) + ".",
      state: "pass"
    }];
    var revenueLines = [
      {
        text: "Expected revenue: " + formatSigned(v.expectedRevenue) + ".",
        state: v.expectedNoDeficit ? "pass" : "fail"
      }
    ];
    renderDiagnosticLines(elements.buyerPayoffText, buyerPayoffLines);
    renderDiagnosticLines(elements.sellerPayoffText, sellerPayoffLines);
    renderDiagnosticLines(elements.revenueText, revenueLines);

    var efficient = Math.abs(v.efficiencyLoss) <= model.BALANCE_TOLERANCE;
    renderDiagnosticLines(elements.efficiencyText, [{
      text: efficient ?
        "Efficient (loss = " + formatSigned(v.efficiencyLoss) + ")." :
        "Inefficient (loss = " + formatSigned(v.efficiencyLoss) + ").",
      state: efficient ? "pass" : "fail"
    }]);
  }

  function updateLiveSummary(summary) {
    var v = summary.verdicts;
    elements.liveSummary.textContent =
      (v.icImplementable ?
        "The allocation rule is IC-implementable. " :
        "The allocation rule is not IC-implementable, with " +
        v.buyerIcViolationCount + " buyer and " +
        v.sellerIcViolationCount + " seller interim-monotonicity violations. ") +
      "Expected buyer payoff " + formatSigned(v.expectedBuyerPayoff) +
      ", expected seller payoff " + formatSigned(v.expectedSellerPayoff) + ". " +
      "Expected revenue " + formatSigned(v.expectedRevenue) +
      (v.exPostBudgetBalanced ? ", exactly balanced ex-post. " :
        (v.exPostNoDeficit ? ", ex-post no-deficit. " : ". ")) +
      "Gains from trade " + formatSigned(v.welfare) + " versus a first-best " +
      "of " + formatSigned(v.firstBestWelfare) + ", an efficiency loss of " +
      formatSigned(v.efficiencyLoss) + ".";
  }

  function paintChartDescription() {
    return "A " + R + " by " + R + " paintable grid of 0.05 by 0.05 cells, " +
      "each split by its own diagonal into two independently paintable " +
      "triangles, holding the probability of trade q. The selected " +
      "triangle (" + (state.selected.isLower ? "lower-right" : "upper-left") +
      ") is on " + formatSelectionDescription() + ", with q = " +
      formatQ(state.selected.isLower ?
        state.grid.lower[state.selected.i][state.selected.j] :
        state.grid.upper[state.selected.i][state.selected.j]) +
      ". The brush is q = " + formatQ(state.brushValue) + ".";
  }

  function buyerIcChartDescription(summary) {
    return "Exact buyer interim payoff by true value and alternate report. " +
      "The exact best-report trace " +
      (summary.verdicts.buyerIcViolationCount > 0 ?
        "leaves the truthful diagonal." : "stays on the truthful diagonal.");
  }

  function sellerIcChartDescription(summary) {
    return "Exact seller interim payoff by true value and alternate report. " +
      "The exact best-report trace " +
      (summary.verdicts.sellerIcViolationCount > 0 ?
        "leaves the truthful diagonal." : "stays on the truthful diagonal.");
  }

  function revenueChartDescription(summary) {
    return "Net revenue, red for a deficit, clear at zero, and green for a surplus. " +
      "Expected revenue is " + formatSigned(summary.verdicts.expectedRevenue) + ".";
  }

  function efficiencyChartDescription(summary) {
    return "The allocation rule with orange marking trade where v is less " +
      "than c and blue marking missing trade where v is greater than c. " +
      "Efficiency loss is " + formatSigned(summary.verdicts.efficiencyLoss) + ".";
  }

  function formatQ(value) {
    return value.toFixed(2);
  }

  function formatCoord(value) {
    return value.toFixed(2);
  }

  function formatCellRange(index) {
    return "[" + formatCoord(index * CELL_SIZE) + ", " +
      formatCoord((index + 1) * CELL_SIZE) + ")";
  }

  function formatSelectionSide() {
    return state.selected.isLower ? "R" : "L";
  }

  function formatSelectionDescription() {
    return "v ∈ " + formatCellRange(state.selected.i) +
      ", c ∈ " + formatCellRange(state.selected.j) +
      ", " + formatSelectionSide();
  }

  function formatSigned(value) {
    var cleaned = Math.abs(value) < 1e-9 ? 0 : value;
    return cleaned.toFixed(3);
  }

}());
