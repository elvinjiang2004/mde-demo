(function () {
  "use strict";

  var model = window.BilateralTradeModel;
  var math = window.MechanismMath;
  var appendSvg = window.SvgUtils.appendSvg;
  var formatTick = window.SvgUtils.formatTick;
  var R = model.CELL_RESOLUTION;
  var CELL_SIZE = model.CELL_SIZE;
  var MISMATCH_THRESHOLD = 0.02;

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

  var BLUE = [23, 107, 156];
  var GREEN = [35, 116, 81];
  var RED = [150, 60, 60];
  var ORANGE = [168, 84, 22];
  var WHITE = [255, 255, 255];

  var elements = {};
  var state = {
    grid: null,
    selected: { i: 0, j: 0, isLower: true },
    cellValue: 0,
    lastSummary: null
  };
  var dragActive = false;
  var dragFrameRequested = false;
  var paintFrameRequested = false;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    elements = {
      paintChart: byId("paint-chart"),
      cellValueSlider: byId("cell-value-slider"),
      cellValueNumber: byId("cell-value-number"),
      liveSummary: byId("live-summary"),
      buyerIcChart: byId("buyer-ic-chart"),
      buyerIcText: byId("buyer-ic-text"),
      sellerIcChart: byId("seller-ic-chart"),
      sellerIcText: byId("seller-ic-text"),
      buyerUtilityChart: byId("buyer-utility-chart"),
      buyerUtilityText: byId("buyer-utility-text"),
      sellerUtilityChart: byId("seller-utility-chart"),
      sellerUtilityText: byId("seller-utility-text"),
      budgetChart: byId("budget-chart"),
      budgetText: byId("budget-text"),
      efficiencyChart: byId("efficiency-chart"),
      efficiencyText: byId("efficiency-text")
    };

    state.grid = model.efficientGrid();
    var center = Math.floor((R - 1) / 2);
    state.selected = { i: center, j: center, isLower: true };
    state.cellValue = state.grid.lower[center][center];

    math.typesetInitial(
      ".introduction, .explorable, .derivation, .notes, .references"
    );
    window.EquationChain.initDividers();
    bindEvents();
    syncCellControls();
    recomputeAndDrawAll();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function bindEvents() {
    elements.cellValueSlider.addEventListener("input", function () {
      setSelectedCellValue(Number.parseFloat(elements.cellValueSlider.value));
    });
    elements.cellValueNumber.addEventListener("change", function () {
      var next = elements.cellValueNumber.valueAsNumber;
      if (!Number.isFinite(next)) {
        elements.cellValueNumber.value = formatQ(state.cellValue);
        return;
      }
      setSelectedCellValue(next);
    });

    elements.paintChart.addEventListener("pointerdown", function (event) {
      var triangle = pointerToTriangle(event);
      if (!triangle || !triangle.insidePlot) {
        return;
      }
      dragActive = true;
      elements.paintChart.setPointerCapture(event.pointerId);
      paintTriangle(triangle.i, triangle.j, triangle.isLower);
    });

    elements.paintChart.addEventListener("pointermove", function (event) {
      if (!dragActive) {
        return;
      }
      var triangle = pointerToTriangle(event);
      if (triangle) {
        paintTriangle(triangle.i, triangle.j, triangle.isLower);
      }
    });

    elements.paintChart.addEventListener("pointerup", function (event) {
      dragActive = false;
      if (elements.paintChart.hasPointerCapture(event.pointerId)) {
        elements.paintChart.releasePointerCapture(event.pointerId);
      }
    });
    elements.paintChart.addEventListener("pointercancel", function () {
      dragActive = false;
    });

    elements.paintChart.addEventListener("keydown", function (event) {
      var moved = true;
      if (event.key === "ArrowLeft") {
        moveSelection(-1, 0);
      } else if (event.key === "ArrowRight") {
        moveSelection(1, 0);
      } else if (event.key === "ArrowUp") {
        moveSelection(0, 1);
      } else if (event.key === "ArrowDown") {
        moveSelection(0, -1);
      } else if (event.key === "Home") {
        selectTriangle(0, state.selected.j, state.selected.isLower);
      } else if (event.key === "End") {
        selectTriangle(R - 1, state.selected.j, state.selected.isLower);
      } else if (event.key === "l" || event.key === "L") {
        selectTriangle(state.selected.i, state.selected.j, false);
      } else if (event.key === "r" || event.key === "R") {
        selectTriangle(state.selected.i, state.selected.j, true);
      } else {
        moved = false;
      }
      if (moved) {
        event.preventDefault();
      }
    });
  }

  function pointerToTriangle(event) {
    var rect = elements.paintChart.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) {
      return null;
    }
    var scaleX = MAIN_LAYOUT.viewWidth / rect.width;
    var scaleY = MAIN_LAYOUT.viewHeight / rect.height;
    var svgX = (event.clientX - rect.left) * scaleX;
    var svgY = (event.clientY - rect.top) * scaleY;
    var insidePlot = svgX >= MAIN_LAYOUT.left && svgX <= MAIN_LAYOUT.right &&
      svgY >= MAIN_LAYOUT.top && svgY <= MAIN_LAYOUT.bottom;
    var v = model.clamp(
      (svgX - MAIN_LAYOUT.left) / (MAIN_LAYOUT.right - MAIN_LAYOUT.left), 0, 1
    );
    var c = model.clamp(
      (MAIN_LAYOUT.bottom - svgY) / (MAIN_LAYOUT.bottom - MAIN_LAYOUT.top), 0, 1
    );
    var i = model.clamp(Math.floor(v / CELL_SIZE), 0, R - 1);
    var j = model.clamp(Math.floor(c / CELL_SIZE), 0, R - 1);
    var delta = v - i * CELL_SIZE;
    var epsilon = c - j * CELL_SIZE;
    return {
      i: i,
      j: j,
      isLower: delta >= epsilon,
      insidePlot: insidePlot
    };
  }

  function paintTriangle(i, j, isLower) {
    var selectionChanged = state.selected.i !== i || state.selected.j !== j ||
      state.selected.isLower !== isLower;
    var currentValue = isLower ? state.grid.lower[i][j] : state.grid.upper[i][j];
    state.selected = { i: i, j: j, isLower: isLower };
    if (currentValue === state.cellValue) {
      syncCellControls();
      if (selectionChanged && state.lastSummary) {
        schedulePaintChart();
      }
      return;
    }
    if (isLower) {
      state.grid.lower[i][j] = state.cellValue;
    } else {
      state.grid.upper[i][j] = state.cellValue;
    }
    syncCellControls();
    scheduleRepaint();
  }

  function moveSelection(di, dj) {
    selectTriangle(
      model.clamp(state.selected.i + di, 0, R - 1),
      model.clamp(state.selected.j + dj, 0, R - 1),
      state.selected.isLower
    );
  }

  function selectTriangle(i, j, isLower) {
    state.selected = { i: i, j: j, isLower: isLower };
    state.cellValue = isLower ? state.grid.lower[i][j] : state.grid.upper[i][j];
    syncCellControls();
    if (state.lastSummary) {
      drawPaintChart(state.lastSummary);
    }
  }

  function setSelectedCellValue(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    var nextValue = model.clamp(value, 0, 1);
    var currentValue = state.selected.isLower ?
      state.grid.lower[state.selected.i][state.selected.j] :
      state.grid.upper[state.selected.i][state.selected.j];
    state.cellValue = nextValue;
    if (currentValue === nextValue) {
      syncCellControls();
      return;
    }
    if (state.selected.isLower) {
      state.grid.lower[state.selected.i][state.selected.j] = state.cellValue;
    } else {
      state.grid.upper[state.selected.i][state.selected.j] = state.cellValue;
    }
    syncCellControls();
    recomputeAndDrawAll();
  }

  function syncCellControls() {
    elements.cellValueSlider.value = String(state.cellValue);
    elements.cellValueNumber.value = formatQ(state.cellValue);
    elements.cellValueSlider.setAttribute(
      "aria-valuetext",
      "q = " + formatQ(state.cellValue) + " on " + formatSelectionDescription()
    );
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

  function schedulePaintChart() {
    if (paintFrameRequested || dragFrameRequested) {
      return;
    }
    paintFrameRequested = true;
    window.requestAnimationFrame(function () {
      paintFrameRequested = false;
      if (!dragFrameRequested && state.lastSummary) {
        drawPaintChart(state.lastSummary);
      }
    });
  }

  function recomputeAndDrawAll() {
    var summary = model.summarize(state.grid);
    state.lastSummary = summary;
    drawPaintChart(summary);
    drawBuyerIcChart(summary);
    drawSellerIcChart(summary);
    drawIrCharts(summary);
    drawBudgetChart(summary);
    drawEfficiencyChart(summary);
    updateDiagnosticText(summary);
    updateLiveSummary(summary);
  }

  function mixColor(c0, c1, t) {
    var r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
    var g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
    var b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function sequentialScale(baseColor) {
    return function (value) {
      return mixColor(WHITE, baseColor, model.clamp(value, 0, 1));
    };
  }

  function divergingScale(value, extent) {
    var t = extent > 1e-9 ? model.clamp(value / extent, -1, 1) : 0;
    return t >= 0 ?
      mixColor(WHITE, GREEN, t) :
      mixColor(WHITE, RED, -t);
  }

  var qColor = sequentialScale(BLUE);
  var utilityColor = sequentialScale(GREEN);

  function svgXOf(v, layout) {
    return layout.left + v * (layout.right - layout.left);
  }

  function svgYOf(c, layout) {
    return layout.bottom - c * (layout.bottom - layout.top);
  }

  function cellRect(i, j, layout) {
    var v0 = i * CELL_SIZE;
    var v1 = (i + 1) * CELL_SIZE;
    var c0 = j * CELL_SIZE;
    var c1 = (j + 1) * CELL_SIZE;
    var x = svgXOf(v0, layout);
    var xEnd = svgXOf(v1, layout);
    var yTop = svgYOf(c1, layout);
    var yBottom = svgYOf(c0, layout);
    return { x: x, y: yTop, width: xEnd - x, height: yBottom - yTop };
  }

  function cellCorners(i, j, layout) {
    var v0 = i * CELL_SIZE;
    var v1 = (i + 1) * CELL_SIZE;
    var c0 = j * CELL_SIZE;
    var c1 = (j + 1) * CELL_SIZE;
    return {
      bottomLeft: { x: svgXOf(v0, layout), y: svgYOf(c0, layout) },
      bottomRight: { x: svgXOf(v1, layout), y: svgYOf(c0, layout) },
      topLeft: { x: svgXOf(v0, layout), y: svgYOf(c1, layout) },
      topRight: { x: svgXOf(v1, layout), y: svgYOf(c1, layout) }
    };
  }

  function trianglePoints(corners, isLower) {
    var pts = isLower ?
      [corners.bottomLeft, corners.bottomRight, corners.topRight] :
      [corners.bottomLeft, corners.topLeft, corners.topRight];
    return pts.map(function (p) { return p.x + "," + p.y; }).join(" ");
  }

  function drawTriangleMesh(svg, grid, layout, colorFn) {
    var i;
    var j;
    for (i = 0; i < R; i += 1) {
      for (j = 0; j < R; j += 1) {
        var corners = cellCorners(i, j, layout);
        appendSvg(svg, "polygon", {
          points: trianglePoints(corners, true),
          fill: colorFn(grid.lower[i][j], i, j, true),
          stroke: "none"
        });
        appendSvg(svg, "polygon", {
          points: trianglePoints(corners, false),
          fill: colorFn(grid.upper[i][j], i, j, false),
          stroke: "none"
        });
      }
    }
  }

  function drawFrame(svg, layout, compact) {
    var ticks = compact ? [0, 1] : [0, 0.25, 0.5, 0.75, 1];
    ticks.forEach(function (value) {
      var x = svgXOf(value, layout);
      var y = svgYOf(value, layout);
      appendSvg(svg, "line", {
        x1: x, y1: layout.bottom, x2: x, y2: layout.bottom + 6,
        class: "axis-line"
      });
      appendSvg(svg, "text", {
        x: x, y: layout.bottom + 18, class: "axis-text",
        "text-anchor": value === 0 ? "start" : (value === 1 ? "end" : "middle")
      }, formatTick(value));
      appendSvg(svg, "line", {
        x1: layout.left - 6, y1: y, x2: layout.left, y2: y,
        class: "axis-line"
      });
      appendSvg(svg, "text", {
        x: layout.left - 10, y: y + 4, class: "axis-text",
        "text-anchor": "end"
      }, formatTick(value));
    });

    appendSvg(svg, "rect", {
      x: layout.left, y: layout.top,
      width: layout.right - layout.left, height: layout.bottom - layout.top,
      fill: "none", class: "axis-line"
    });

    appendSvg(svg, "line", {
      x1: layout.left, y1: layout.bottom,
      x2: layout.right, y2: layout.top,
      class: "diagonal-guide"
    });

  }

  function drawTickAt(svg, x, y, size, className, direction) {
    var inset = size * 0.28;
    if (direction > 0) {
      appendSvg(svg, "line", {
        x1: x - inset, y1: y + inset, x2: x + inset, y2: y - inset,
        class: className
      });
    } else {
      appendSvg(svg, "line", {
        x1: x - inset, y1: y - inset, x2: x + inset, y2: y + inset,
        class: className
      });
    }
  }

  function drawPaintChart(summary) {
    var svg = elements.paintChart;
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "paint-chart-title" }, "Allocation rule, q(v,c)");
    appendSvg(svg, "desc", { id: "paint-chart-description" }, paintChartDescription());

    drawTriangleMesh(svg, summary.grid, MAIN_LAYOUT, qColor);
    drawFrame(svg, MAIN_LAYOUT, false);

    var cellBounds = cellRect(state.selected.i, state.selected.j, MAIN_LAYOUT);
    var corners = cellCorners(state.selected.i, state.selected.j, MAIN_LAYOUT);
    appendSvg(svg, "polygon", {
      points: trianglePoints(corners, state.selected.isLower),
      class: "cell-cursor"
    });

    drawCellLabel(svg, MAIN_LAYOUT, cellBounds);
  }

  function drawCellLabel(svg, layout, cursorRect) {
    var text = formatCellRange(state.selected.i) + " × " +
      formatCellRange(state.selected.j) + " " + formatSelectionSide();
    var cx = cursorRect.x + cursorRect.width / 2;
    var above = cursorRect.y - 8;
    var below = cursorRect.y + cursorRect.height + 14;
    var y = above >= layout.top + 10 ? above : below;

    var anchor = "middle";
    var x = cx;
    var estimatedHalfWidth = text.length * 3.2;
    if (cx - estimatedHalfWidth < layout.left) {
      anchor = "start";
      x = layout.left;
    } else if (cx + estimatedHalfWidth > layout.right) {
      anchor = "end";
      x = layout.right;
    }

    appendSvg(svg, "text", {
      x: x, y: y, class: "cell-label annotation-halo", "text-anchor": anchor
    }, text);
  }

  function drawLineFrame(svg, layout) {
    var ticks = [0, 1];
    ticks.forEach(function (value) {
      var x = svgXOf(value, layout);
      var y = svgYOf(value, layout);
      appendSvg(svg, "line", {
        x1: x, y1: layout.bottom, x2: x, y2: layout.bottom + 6,
        class: "axis-line"
      });
      appendSvg(svg, "text", {
        x: x, y: layout.bottom + 18, class: "axis-text",
        "text-anchor": value === 0 ? "start" : "end"
      }, formatTick(value));
      appendSvg(svg, "line", {
        x1: layout.left - 6, y1: y, x2: layout.left, y2: y,
        class: "axis-line"
      });
      appendSvg(svg, "text", {
        x: layout.left - 10, y: y + 4, class: "axis-text",
        "text-anchor": "end"
      }, formatTick(value));
    });

    appendSvg(svg, "rect", {
      x: layout.left, y: layout.top,
      width: layout.right - layout.left, height: layout.bottom - layout.top,
      fill: "none", class: "axis-line"
    });

  }

  function drawStepChart(
    svg, idPrefix, titleText, descText, values, violations, layout, ascending
  ) {
    svg.replaceChildren();
    appendSvg(svg, "title", { id: idPrefix + "-title" }, titleText);
    appendSvg(svg, "desc", { id: idPrefix + "-description" }, descText);

    drawLineFrame(svg, layout);

    var segments = [];
    var i;
    for (i = 0; i < R; i += 1) {
      segments.push({
        x0: svgXOf(i * CELL_SIZE, layout),
        x1: svgXOf((i + 1) * CELL_SIZE, layout),
        y: svgYOf(model.clamp(values[i], 0, 1), layout)
      });
    }

    var tol = model.MONOTONICITY_TOLERANCE;
    for (i = 0; i < R; i += 1) {
      appendSvg(svg, "line", {
        x1: segments[i].x0, y1: segments[i].y,
        x2: segments[i].x1, y2: segments[i].y,
        class: "interim-curve"
      });
      if (i < R - 1) {
        var stepViolates = ascending ?
          values[i + 1] < values[i] - tol :
          values[i + 1] > values[i] + tol;
        appendSvg(svg, "line", {
          x1: segments[i].x1, y1: segments[i].y,
          x2: segments[i].x1, y2: segments[i + 1].y,
          class: stepViolates ? "interim-curve interim-curve-violation" :
            "interim-curve"
        });
      }
    }

    for (i = 0; i < R; i += 1) {
      if (violations[i]) {
        appendSvg(svg, "circle", {
          cx: (segments[i].x0 + segments[i].x1) / 2, cy: segments[i].y,
          r: 3.2, class: "violation-point"
        });
      }
    }
  }

  function drawBuyerIcChart(summary) {
    drawStepChart(
      elements.buyerIcChart, "buyer-ic-chart", "Interim buyer probability",
      buyerIcChartDescription(summary), summary.interimBuyerProbability,
      summary.buyerIcViolations, DIAG_LAYOUT, true
    );
  }

  function drawSellerIcChart(summary) {
    drawStepChart(
      elements.sellerIcChart, "seller-ic-chart", "Interim seller probability",
      sellerIcChartDescription(summary), summary.interimSellerProbability,
      summary.sellerIcViolations, DIAG_LAYOUT, false
    );
  }

  function drawIrCharts(summary) {
    drawSingleDiagnostic(
      elements.buyerUtilityChart,
      "buyer-utility-chart",
      "Buyer utility",
      "Buyer utility U sub B at every buyer-value, seller-cost pair.",
      summary.buyerUtility,
      utilityColor
    );
    drawSingleDiagnostic(
      elements.sellerUtilityChart,
      "seller-utility-chart",
      "Seller utility",
      "Seller utility U sub S at every buyer-value, seller-cost pair.",
      summary.sellerUtility,
      utilityColor
    );
  }

  function drawSingleDiagnostic(svg, idPrefix, titleText, descText, grid, colorFn) {
    svg.replaceChildren();
    appendSvg(svg, "title", { id: idPrefix + "-title" }, titleText);
    appendSvg(svg, "desc", { id: idPrefix + "-description" }, descText);
    drawTriangleMesh(svg, grid, DIAG_LAYOUT, colorFn);
    drawFrame(svg, DIAG_LAYOUT, true);
  }

  function drawBudgetChart(summary) {
    var svg = elements.budgetChart;
    var extent = Math.max(
      0.05,
      Math.abs(summary.verdicts.minRevenue),
      Math.abs(summary.verdicts.maxRevenue)
    );
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "budget-chart-title" }, "Net revenue");
    appendSvg(svg, "desc", { id: "budget-chart-description" }, budgetChartDescription(summary));

    drawTriangleMesh(svg, summary.revenue, DIAG_LAYOUT, function (value) {
      return divergingScale(value, extent);
    });
    drawFrame(svg, DIAG_LAYOUT, true);
  }

  function drawEfficiencyChart(summary) {
    var svg = elements.efficiencyChart;
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "efficiency-chart-title" }, "Efficiency comparison");
    appendSvg(svg, "desc", { id: "efficiency-chart-description" }, efficiencyChartDescription(summary));

    drawTriangleMesh(svg, summary.grid, DIAG_LAYOUT, qColor);

    var over = summary.overTrade;
    var under = summary.underTrade;
    var i;
    var j;
    var triangleSize = (DIAG_LAYOUT.right - DIAG_LAYOUT.left) / R;
    [true, false].forEach(function (isLower) {
      var overGrid = isLower ? over.lower : over.upper;
      var underGrid = isLower ? under.lower : under.upper;
      for (i = 0; i < R; i += 1) {
        for (j = 0; j < R; j += 1) {
          var corners = cellCorners(i, j, DIAG_LAYOUT);
          var points = trianglePoints(corners, isLower);
          var centroid = model.triangleCentroid(i, j, isLower);
          var cx = svgXOf(centroid.v, DIAG_LAYOUT);
          var cy = svgYOf(centroid.c, DIAG_LAYOUT);
          if (overGrid[i][j] > MISMATCH_THRESHOLD) {
            appendSvg(svg, "polygon", {
              points: points,
              fill: mixColor(WHITE, ORANGE, model.clamp(overGrid[i][j], 0, 1)),
              opacity: 0.55
            });
            drawTickAt(svg, cx, cy, triangleSize, "overtrade-mark", 1);
          } else if (underGrid[i][j] > MISMATCH_THRESHOLD) {
            appendSvg(svg, "polygon", {
              points: points,
              fill: mixColor(WHITE, BLUE, model.clamp(underGrid[i][j], 0, 1)),
              opacity: 0.55
            });
            drawTickAt(svg, cx, cy, triangleSize, "undertrade-mark", -1);
          }
        }
      }
    });

    drawFrame(svg, DIAG_LAYOUT, true);
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

    elements.buyerUtilityText.dataset.minBuyerUtility = String(v.minBuyerUtility);
    elements.buyerUtilityText.dataset.expectedBuyerUtility =
      String(v.expectedBuyerUtility);

    elements.sellerUtilityText.dataset.minSellerUtility = String(v.minSellerUtility);
    elements.sellerUtilityText.dataset.expectedSellerUtility =
      String(v.expectedSellerUtility);

    elements.budgetText.dataset.exPostBudgetBalanced = String(v.exPostBudgetBalanced);
    elements.budgetText.dataset.exPostNoDeficit = String(v.exPostNoDeficit);
    elements.budgetText.dataset.expectedRevenue = String(v.expectedRevenue);
    elements.budgetText.dataset.expectedNoDeficit = String(v.expectedNoDeficit);

    elements.efficiencyText.dataset.welfare = String(v.welfare);
    elements.efficiencyText.dataset.firstBestWelfare = String(v.firstBestWelfare);
    elements.efficiencyText.dataset.efficiencyLoss = String(v.efficiencyLoss);

    renderDiagnosticLines(elements.buyerIcText, [{
      segments: v.buyerIcViolationCount > 0 ?
        [["Q", "B"], " nonmonotonic at " + v.buyerIcViolationCount + " points."] :
        [["Q", "B"], " nondecreasing."],
      state: v.buyerIcViolationCount > 0 ? "fail" : "pass"
    }]);

    renderDiagnosticLines(elements.sellerIcText, [{
      segments: v.sellerIcViolationCount > 0 ?
        [["Q", "S"], " nonmonotonic at " + v.sellerIcViolationCount + " points."] :
        [["Q", "S"], " nonincreasing."],
      state: v.sellerIcViolationCount > 0 ? "fail" : "pass"
    }]);

    var buyerUtilityLines = [{
      text: "Expected buyer rent: " + formatSigned(v.expectedBuyerUtility) + ".",
      state: "pass"
    }];
    var sellerUtilityLines = [{
      text: "Expected seller rent: " + formatSigned(v.expectedSellerUtility) + ".",
      state: "pass"
    }];
    var budgetLines = [
      {
        text: "Expected revenue: " + formatSigned(v.expectedRevenue) + ".",
        state: v.expectedNoDeficit ? "pass" : "fail"
      }
    ];
    renderDiagnosticLines(elements.buyerUtilityText, buyerUtilityLines);
    renderDiagnosticLines(elements.sellerUtilityText, sellerUtilityLines);
    renderDiagnosticLines(elements.budgetText, budgetLines);

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
      "Expected buyer rent " + formatSigned(v.expectedBuyerUtility) +
      ", expected seller rent " + formatSigned(v.expectedSellerUtility) + ". " +
      "Expected budget balance E[R] = " + formatSigned(v.expectedRevenue) +
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
      formatQ(state.cellValue) + ".";
  }

  function buyerIcChartDescription(summary) {
    var v = summary.verdicts;
    return "The buyer's interim probability of trade, averaged over the " +
      "seller's cost, as a step function of buyer value. " +
      (v.buyerIcViolationCount > 0 ?
        "Nonmonotonic at " + v.buyerIcViolationCount + " points." :
        "Nondecreasing everywhere.");
  }

  function sellerIcChartDescription(summary) {
    var v = summary.verdicts;
    return "The seller's interim probability of trade, averaged over the " +
      "buyer's value, as a step function of seller cost. " +
      (v.sellerIcViolationCount > 0 ?
        "Nonmonotonic at " + v.sellerIcViolationCount + " points." :
        "Nonincreasing everywhere.");
  }

  function budgetChartDescription(summary) {
    return "Net revenue R, green for a surplus and red for a deficit. " +
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
