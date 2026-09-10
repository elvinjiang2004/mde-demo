(function (global) {
  "use strict";

  function create(state, page, geometry, isSurfaceEditable) {
    var model = global.BargainingSandboxModel;
    var numbers = global.NumberUtils;
    var svgUtils = global.SvgUtils;
    var visuals = global.BilateralTradeVisuals;
    var appendSvg = svgUtils.appendSvg;
    var paintFieldRaster = svgUtils.paintFieldRaster;
    var R = model.CUSTOM_RESOLUTION;
    var mesh = geometry.mesh;
    var PREVIEW_RASTER_SIZE = 240;
    var SURFACE_RASTER_SIZE = 800;
    var DIAGNOSTIC_RASTER_SIZE = 330;
    var DIAGNOSTIC_KEYS = Object.freeze([
      "buyerIc", "sellerIc", "revenue",
      "buyerPayoff", "sellerPayoff", "efficiency"
    ]);
    var PRESET_LABELS = page.presetLabels;
    var LAYOUT = geometry.layout;
    var elements = page.elements;
    var surfaces = page.surfaces;
    var diagnostics = page.diagnostics;
    var chartStructures = {};
    var customTriangles = { q: null, pB: null, pS: null };

    function directChild(svg, name) {
      var index;
      for (index = 0; index < svg.children.length; index += 1) {
        if (svg.children[index].tagName.toLowerCase() === name) {
          return svg.children[index];
        }
      }
      return null;
    }

    function ensureCanvas(svg, renderer) {
      var canvas = svg.parentNode.querySelector(
        "canvas[data-chart-for='" + svg.id + "']"
      );
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.className = "chart-480x520-field-canvas";
        canvas.setAttribute("aria-hidden", "true");
        canvas.dataset.chartFor = svg.id;
        svg.parentNode.insertBefore(canvas, svg);
      }
      canvas.dataset.renderer = renderer;
      return canvas;
    }

    function ensureSurfaceStructure(key) {
      var definition = surfaces[key];
      var svg = definition.chart;
      if (chartStructures[svg.id]) {
        return chartStructures[svg.id];
      }
      var title = directChild(svg, "title") || appendSvg(
        svg, "title", { id: svg.id + "-title" }, definition.title
      );
      var description = directChild(svg, "desc") || appendSvg(
        svg, "desc", { id: svg.id + "-description" }, ""
      );
      var field = appendSvg(svg, "g", { "data-layer": "field" });
      var frame = appendSvg(svg, "g", { "data-layer": "frame" });
      var overlay = appendSvg(svg, "g", { "data-layer": "overlay" });
      var definitions = appendSvg(svg, "defs", { "data-layer": "definitions" });
      visuals.drawFrame(frame, LAYOUT, mesh, false);
      chartStructures[svg.id] = {
        svg: svg,
        title: title,
        description: description,
        field: field,
        frame: frame,
        overlay: overlay,
        definitions: definitions
      };
      return chartStructures[svg.id];
    }

    function ensureDiagnosticStructure(key) {
      var definition = diagnostics[key];
      var svg = definition.chart;
      if (chartStructures[svg.id]) {
        return chartStructures[svg.id];
      }
      var title = directChild(svg, "title") || appendSvg(
        svg, "title", { id: svg.id + "-title" }, definition.title
      );
      var description = directChild(svg, "desc") || appendSvg(
        svg, "desc", { id: svg.id + "-description" }, ""
      );
      var field = appendSvg(svg, "g", { "data-layer": "field" });
      var frame = appendSvg(svg, "g", { "data-layer": "frame" });
      var overlay = appendSvg(svg, "g", { "data-layer": "overlay" });
      if (definition.kind === "ic") {
        visuals.drawLineFrame(frame, LAYOUT, mesh);
        appendSvg(frame, "line", {
          x1: LAYOUT.left,
          y1: LAYOUT.bottom,
          x2: LAYOUT.right,
          y2: LAYOUT.top,
          class: "truthful-report-line"
        });
      } else {
        visuals.drawFrame(frame, LAYOUT, mesh, true);
      }
      chartStructures[svg.id] = {
        svg: svg,
        title: title,
        description: description,
        field: field,
        frame: frame,
        overlay: overlay
      };
      return chartStructures[svg.id];
    }

    function clearDynamicSurface(structure) {
      structure.field.replaceChildren();
      structure.overlay.replaceChildren();
      structure.definitions.replaceChildren();
      removeProbe(structure.svg, ".surface-probe");
      removeProbe(structure.svg, ".cell-cursor");
      removeProbe(structure.svg, ".cell-label");
    }

    function drawSurface(key, rasterSize) {
      if (state.activePreset === "custom") {
        drawCustomSurface(key);
        return;
      }
      var definition = surfaces[key];
      var svg = definition.chart;
      var structure = ensureSurfaceStructure(key);
      var stateKey = model.dependencyKey(state.rule, key);
      var canvas = ensureCanvas(svg, "formula-canvas");
      clearDynamicSurface(structure);
      canvas.hidden = false;
      paintSurfaceCanvas(key, canvas, rasterSize);
      canvas.dataset.rasterSize = String(rasterSize);
      canvas.dataset.stateKey = stateKey;
      structure.title.textContent = definition.title;
      structure.description.textContent = surfaceDescription(key);
      drawFormulaBoundary(structure.overlay);
      drawSurfaceProbe(key);
      state.renderCounts[key] += 1;
      svg.dataset.representation = state.rule.representation;
      svg.dataset.stateKey = stateKey;
      svg.dataset.renderCount = String(state.renderCounts[key]);
      svg.dataset.renderer = "formula-canvas";
      svg.dataset.colorLow = key === "q" ? "clear" :
        (key === "pB" ? "red" : "green");
      svg.dataset.colorHigh = key === "q" ? "blue" :
        (key === "pB" ? "green" : "red");
      if (rasterSize === PREVIEW_RASTER_SIZE) {
        state.previewFields[key] = true;
      }
    }

    function drawCustomSurface(key) {
      var definition = surfaces[key];
      var svg = definition.chart;
      var structure = ensureSurfaceStructure(key);
      var stateKey = model.dependencyKey(state.rule, key);
      clearDynamicSurface(structure);
      ensureCanvas(svg, "formula-canvas").hidden = true;
      structure.title.textContent = definition.title;
      structure.description.textContent = surfaceDescription(key);
      var extent = customSurfaceExtent(key);
      var definitions = key === "q" ? null : structure.definitions;
      customTriangles[key] = mesh.drawTriangleMesh(
        structure.field,
        state.rule.q,
        LAYOUT,
        function (value, i, j, isLower) {
          return customSurfaceFill(
            key, i, j, isLower, value, extent, definitions
          );
        }
      );
      tagCustomTriangles(customTriangles[key]);
      drawCustomSelection(key);
      drawSurfaceProbe(key);
      state.renderCounts[key] += 1;
      svg.dataset.representation = state.rule.representation;
      svg.dataset.stateKey = stateKey;
      svg.dataset.renderCount = String(state.renderCounts[key]);
      svg.dataset.renderer = "triangle-mesh";
      svg.dataset.triangleCount = String(2 * R * R);
      svg.dataset.paymentRendering = key === "q" ? "not-applicable" :
        "analytic-affine";
      svg.dataset.colorLow = key === "q" ? "clear" :
        (key === "pB" ? "red" : "green");
      svg.dataset.colorHigh = key === "q" ? "blue" :
        (key === "pB" ? "green" : "red");
    }
    function tagCustomTriangles(triangles) {
      ["lower", "upper"].forEach(function (side) {
        triangles[side].forEach(function (column, i) {
          column.forEach(function (triangle, j) {
            triangle.dataset.customTriangle = "true";
            triangle.dataset.i = String(i);
            triangle.dataset.j = String(j);
            triangle.dataset.side = side;
          });
        });
      });
    }

    function customSurfaceValue(key, i, j, isLower) {
      if (key === "q") {
        return state.rule.q[isLower ? "lower" : "upper"][i][j];
      }
      var point = model.customTriangleCentroid(i, j, isLower);
      return model.fieldValueAt(state.rule, key, point.v, point.c);
    }

    function customSurfaceExtent(key) {
      if (key === "q") {
        return 1;
      }
      var range = model.fieldRange(state.rule, key);
      return Math.max(
        0.05,
        Math.abs(range.min),
        Math.abs(range.max),
        isSurfaceEditable(key) ? Math.abs(state.brushes[key]) : 0
      );
    }

    function customSurfaceColor(key, i, j, isLower, qValue, extent) {
      var value = key === "q" ? qValue :
        customSurfaceValue(key, i, j, isLower);
      if (key === "q") {
        return cssColor(visuals.qChannels(state.palette, value));
      }
      return cssColor(paymentChannels(key, value, extent));
    }

    function customSurfaceFill(
        key, i, j, isLower, qValue, extent, definitions) {
      if (key === "q") {
        return customSurfaceColor(key, i, j, isLower, qValue, extent);
      }
      var patch = state.rule[key][isLower ? "lower" : "upper"][i][j];
      var vertices = triangleVertices(i, j, isLower);
      var values = vertices.map(function (vertex) {
        return model.evaluatePolynomial(patch, vertex.v, vertex.c);
      });
      var minimum = Math.min.apply(Math, values);
      var maximum = Math.max.apply(Math, values);
      var range = maximum - minimum;
      var plotWidth = LAYOUT.right - LAYOUT.left;
      var plotHeight = LAYOUT.bottom - LAYOUT.top;
      var gradientX = patch[1] / plotWidth;
      var gradientY = -patch[2] / plotHeight;
      var gradientNorm = gradientX * gradientX + gradientY * gradientY;
      if (!(range > 0) || !(gradientNorm > 0)) {
        return cssColor(paymentChannels(key, minimum, extent));
      }
      var minimumIndex = values.indexOf(minimum);
      var start = {
        x: mesh.svgXOf(vertices[minimumIndex].v, LAYOUT),
        y: mesh.svgYOf(vertices[minimumIndex].c, LAYOUT)
      };
      var scale = range / gradientNorm;
      var id = surfaces[key].chart.id + "-gradient-" +
        (isLower ? "lower" : "upper") + "-" + i + "-" + j;
      var gradient = appendSvg(definitions, "linearGradient", {
        id: id,
        gradientUnits: "userSpaceOnUse",
        x1: start.x,
        y1: start.y,
        x2: start.x + gradientX * scale,
        y2: start.y + gradientY * scale,
        "data-analytic-payment-gradient": "true",
        "data-value-min": minimum,
        "data-value-max": maximum,
        "data-coefficient-v": patch[1],
        "data-coefficient-c": patch[2]
      });
      appendPaymentGradientStop(gradient, 0, minimum, key, extent);
      if (minimum < 0 && maximum > 0) {
        appendPaymentGradientStop(
          gradient, -minimum / range, 0, key, extent
        );
      }
      appendPaymentGradientStop(gradient, 1, maximum, key, extent);
      return "url(#" + id + ")";
    }

    function triangleVertices(i, j, isLower) {
      var v0 = i / R;
      var v1 = (i + 1) / R;
      var c0 = j / R;
      var c1 = (j + 1) / R;
      return isLower ? [
        { v: v0, c: c0 },
        { v: v1, c: c0 },
        { v: v1, c: c1 }
      ] : [
        { v: v0, c: c0 },
        { v: v0, c: c1 },
        { v: v1, c: c1 }
      ];
    }

    function paymentChannels(key, value, extent) {
      return visuals.signedChannels(
        value,
        extent,
        key === "pB" ? state.palette.red : state.palette.green,
        key === "pB" ? state.palette.green : state.palette.red
      );
    }

    function appendPaymentGradientStop(
        gradient, offset, value, key, extent) {
      var channels = paymentChannels(key, value, extent);
      appendSvg(gradient, "stop", {
        offset: offset,
        "stop-color": "rgb(" + channels[0] + "," + channels[1] + "," +
          channels[2] + ")",
        "stop-opacity": channels[3] / 255
      });
    }

    function cssColor(channels) {
      if (channels.length > 3) {
        return "rgba(" + channels[0] + "," + channels[1] + "," +
          channels[2] + "," + channels[3] / 255 + ")";
      }
      return "rgb(" + channels[0] + "," + channels[1] + "," +
        channels[2] + ")";
    }

    function drawCustomTriangle(key, i, j, isLower) {
      var triangles = customTriangles[key];
      if (!triangles) {
        drawCustomSurface(key);
        return;
      }
      triangles[isLower ? "lower" : "upper"][i][j].setAttribute(
        "fill",
        customSurfaceColor(
          key,
          i,
          j,
          isLower,
          state.custom.q[isLower ? "lower" : "upper"][i][j],
          customSurfaceExtent(key)
        )
      );
    }

    function drawCustomSelection(key) {
      if (state.activePreset !== "custom" || !surfaces[key]) {
        return;
      }
      var svg = surfaces[key].chart;
      removeProbe(svg, ".cell-cursor");
      removeProbe(svg, ".cell-label");
      if (!isSurfaceEditable(key) || state.activeSurface !== key) {
        return;
      }
      var corners = mesh.cellCorners(state.selected.i, state.selected.j, LAYOUT);
      appendSvg(svg, "polygon", {
        points: mesh.trianglePoints(corners, state.selected.isLower),
        class: "cell-cursor"
      });
      var rangeText = formatCellRange(state.selected.i) + " × " +
        formatCellRange(state.selected.j) + " " + selectionSide();
      visuals.drawCellLabel(
        svg,
        LAYOUT,
        mesh.cellRect(state.selected.i, state.selected.j, LAYOUT),
        rangeText
      );
    }

    function formatCellRange(index) {
      var low = index / R;
      var high = (index + 1) / R;
      return "[" + low.toFixed(2) + ", " + high.toFixed(2) + ")";
    }

    function selectionSide() {
      return state.selected.isLower ? "R" : "L";
    }

    function surfaceDescription(key) {
      var field = key === "q" ? "allocation probability" :
        (key === "pB" ? "buyer payment" : "seller payment");
      if (state.activePreset === "custom") {
        var editing = isSurfaceEditable(key) ?
          " Enter or Space applies this surface's brush to the selected triangle." :
          " Fix IC/IR derives this payment from the allocation, so it is read-only.";
        var paymentDisplay = key === "q" ? "" :
          " Nonconstant affine payments vary continuously inside each triangle.";
        return "Custom " + field + " on a 20 by 20 split-triangle grid." +
          editing + paymentDisplay + " Probes evaluate the exact rule.";
      }
      return PRESET_LABELS[state.activePreset] + " formula-backed " + field +
        ". The raster is display-only; probes evaluate the exact rule.";
    }

    function paintSurfaceCanvas(key, canvas, rasterSize) {
      var range = model.fieldRange(state.rule, key);
      var extent = Math.max(0.05, Math.abs(range.min), Math.abs(range.max));
      var valueAt = model.fieldEvaluator(state.rule, key);
      paintFieldRaster(
        canvas,
        rasterSize,
        valueAt,
        function (value) {
          if (key === "q") {
            return visuals.qChannels(state.palette, value);
          }
          return visuals.signedChannels(
            value,
            extent,
            key === "pB" ? state.palette.red : state.palette.green,
            key === "pB" ? state.palette.green : state.palette.red
          );
        }
      );
    }
    function drawFormulaBoundary(layer) {
      if (state.rule.family === "posted-price") {
        var buyerPrice = state.rule.parameters.buyerPrice;
        var sellerPrice = state.rule.parameters.sellerPrice;
        appendSvg(layer, "line", {
          x1: mesh.svgXOf(buyerPrice, LAYOUT),
          y1: mesh.svgYOf(0, LAYOUT),
          x2: mesh.svgXOf(buyerPrice, LAYOUT),
          y2: mesh.svgYOf(sellerPrice, LAYOUT),
          class: "preset-boundary",
          "data-boundary-kind": "posted-vertical"
        });
        appendSvg(layer, "line", {
          x1: mesh.svgXOf(buyerPrice, LAYOUT),
          y1: mesh.svgYOf(sellerPrice, LAYOUT),
          x2: mesh.svgXOf(1, LAYOUT),
          y2: mesh.svgYOf(sellerPrice, LAYOUT),
          class: "preset-boundary",
          "data-boundary-kind": "posted-horizontal"
        });
        return;
      }
      var threshold = state.rule.family === "balanced-agv" ?
        0 : state.rule.parameters.threshold;
      if (threshold === 1) {
        appendSvg(layer, "circle", {
          cx: mesh.svgXOf(1, LAYOUT),
          cy: mesh.svgYOf(0, LAYOUT),
          r: 3,
          class: "preset-boundary",
          "data-boundary-kind": "point"
        });
        return;
      }
      appendSvg(layer, "line", {
        x1: mesh.svgXOf(threshold, LAYOUT),
        y1: mesh.svgYOf(0, LAYOUT),
        x2: mesh.svgXOf(1, LAYOUT),
        y2: mesh.svgYOf(1 - threshold, LAYOUT),
        class: "preset-boundary",
        "data-boundary-kind": "line"
      });
    }

    function upgradeSurfaceRaster(key, token) {
      var chart = surfaces[key].chart;
      var expectedKey = model.dependencyKey(state.rule, key);
      var canvas = ensureCanvas(chart, "formula-canvas");
      if (canvas.hidden || chart.dataset.stateKey !== expectedKey ||
          canvas.dataset.stateKey !== expectedKey || token !== state.generation) {
        return;
      }
      paintSurfaceCanvas(key, canvas, SURFACE_RASTER_SIZE);
      if (token !== state.generation || chart.dataset.stateKey !== expectedKey) {
        return;
      }
      canvas.dataset.rasterSize = String(SURFACE_RASTER_SIZE);
      canvas.dataset.qualityGeneration = String(token);
      state.qualityCounts[key] += 1;
      canvas.dataset.qualityCount = String(state.qualityCounts[key]);
      delete state.previewFields[key];
    }
    function drawDiagnostic(key, rasterSize) {
      var definition = diagnostics[key];
      var svg = definition.chart;
      var structure = ensureDiagnosticStructure(key);
      var stateKey = model.dependencyKey(state.rule, key);
      var canvas = ensureCanvas(svg, "formula-diagnostic-canvas");
      structure.field.replaceChildren();
      structure.overlay.replaceChildren();
      removeProbe(svg, ".diagnostic-probe");
      canvas.hidden = false;
      paintDiagnosticCanvas(key, canvas, rasterSize);
      canvas.dataset.rasterSize = String(rasterSize);
      canvas.dataset.stateKey = stateKey;
      structure.title.textContent = definition.title;
      structure.description.textContent = diagnosticDescription(key);
      if (definition.kind === "ic") {
        var ic = diagnosticState(key);
        if (ic.bestReportTrace.length > 0) {
          appendSvg(structure.overlay, "path", {
            d: bestReportPathData(ic.bestReportTrace),
            class: "best-report-line",
            "data-trace-key": stateKey,
            "data-trace-segments": ic.bestReportTrace.length
          });
        } else {
          drawBestReportPoints(structure.overlay, ic.bestReportPoints, stateKey);
        }
        svg.dataset.bic = String(ic.holds);
        svg.dataset.dsic = String(ic.dsicHolds);
        svg.dataset.maxDeviationGain = ic.maximumGain === null ?
          "not-computed" : String(ic.maximumGain);
      }
      drawDiagnosticProbe(key);
      state.renderCounts[key] += 1;
      svg.dataset.stateKey = stateKey;
      svg.dataset.renderCount = String(state.renderCounts[key]);
      svg.dataset.renderer = "formula-diagnostic-canvas";
      setDiagnosticColorDataset(key, svg);
      if (rasterSize === PREVIEW_RASTER_SIZE) {
        state.previewFields[key] = true;
      }
      updateDiagnosticText(key);
    }
    function diagnosticState(key) {
      return key === "buyerIc" ? state.summary.buyerIc : state.summary.sellerIc;
    }

    function diagnosticDescription(key) {
      if (key === "buyerIc" || key === "sellerIc") {
        var buyer = key === "buyerIc";
        var ic = diagnosticState(key);
        if (state.activePreset === "custom") {
          return "Exact " + (buyer ? "buyer" : "seller") +
            " interim utility by true type and alternate report. The dashed " +
            "diagonal is truthful reporting. The plotted marks are exact " +
            "best reports at 61 displayed true types; the BIC verdict uses the " +
            "exact grid monotonicity and payment identities.";
        }
        return "Exact " + (buyer ? "buyer" : "seller") +
          " interim utility by true type and alternate report. The dashed " +
          "diagonal is truthful reporting and the solid trace uses analytic " +
          "best reports. Maximum deviation gain is " +
          formatDiagnostic(ic.maximumGain) + ".";
      }
      if (key === "revenue") {
        return "Exact intermediary net revenue by buyer value and seller value. " +
          "The raster is display-only and probe values are exact.";
      }
      if (key === "buyerPayoff") {
        return "Exact buyer truthful payoff by buyer value and seller value. " +
          "The raster is display-only and probe values are exact.";
      }
      if (key === "sellerPayoff") {
        return "Exact seller truthful payoff by buyer value and seller value. " +
          "The raster is display-only and probe values are exact.";
      }
      return "Exact allocation error relative to efficient trade. Orange " +
        "forward hatching marks over-trade and blue back hatching marks " +
        "missing trade. Probe values are exact.";
    }

    function bestReportPathData(segments) {
      return segments.map(function (segment) {
        return segment.points.map(function (point, index) {
          return (index === 0 ? "M" : "L") + " " +
            mesh.svgXOf(point.trueValue, LAYOUT) + " " +
            mesh.svgYOf(point.report, LAYOUT);
        }).join(" ");
      }).join(" ");
    }

    function drawBestReportPoints(svg, points, stateKey) {
      points.forEach(function (point, index) {
        appendSvg(svg, "circle", {
          cx: mesh.svgXOf(point.trueValue, LAYOUT),
          cy: mesh.svgYOf(point.report, LAYOUT),
          r: 1.8,
          fill: "var(--blue)",
          stroke: "var(--annotation-halo)",
          "stroke-width": 0.7,
          "vector-effect": "non-scaling-stroke",
          "pointer-events": "none",
          "data-best-report-point": index,
          "data-trace-key": stateKey
        });
      });
    }

    function diagnosticExtent(key) {
      var range = state.summary.ranges[key];
      return Math.max(0.05, Math.abs(range.min), Math.abs(range.max));
    }

    function paintDiagnosticCanvas(key, canvas, rasterSize) {
      var extent = key === "efficiency" ? 1 : diagnosticExtent(key);
      var valueAt = model.diagnosticEvaluator(state.rule, key);
      paintFieldRaster(
        canvas,
        rasterSize,
        valueAt,
        function (value, pixelX, pixelY) {
          if (key === "efficiency") {
            return visuals.efficiencyChannels(
              value, pixelX, pixelY, state.palette
            );
          }
          if (key === "revenue") {
            return visuals.signedChannels(
              value, extent, state.palette.red, state.palette.green
            );
          }
          return visuals.signedChannels(
            value, extent, state.palette.blue, state.palette.yellow
          );
        }
      );
    }
    function upgradeDiagnosticRaster(key, token) {
      var chart = diagnostics[key].chart;
      var expectedKey = model.dependencyKey(state.rule, key);
      var canvas = ensureCanvas(chart, "formula-diagnostic-canvas");
      if (canvas.hidden || chart.dataset.stateKey !== expectedKey ||
          canvas.dataset.stateKey !== expectedKey || token !== state.generation) {
        return;
      }
      paintDiagnosticCanvas(key, canvas, DIAGNOSTIC_RASTER_SIZE);
      if (token !== state.generation || chart.dataset.stateKey !== expectedKey) {
        return;
      }
      canvas.dataset.rasterSize = String(DIAGNOSTIC_RASTER_SIZE);
      canvas.dataset.qualityGeneration = String(token);
      state.qualityCounts[key] += 1;
      canvas.dataset.qualityCount = String(state.qualityCounts[key]);
      delete state.previewFields[key];
    }
    function setDiagnosticColorDataset(key, svg) {
      if (key === "efficiency") {
        svg.dataset.colorOver = "orange-pattern";
        svg.dataset.colorUnder = "blue-pattern";
        return;
      }
      svg.dataset.colorLow = key === "revenue" ? "red" : "blue";
      svg.dataset.colorZero = "clear";
      svg.dataset.colorHigh = key === "revenue" ? "green" : "yellow";
    }

    function verdictParagraph(label, holds, detail) {
      var paragraph = document.createElement("p");
      paragraph.className = holds ? "verdict-pass" : "verdict-fail";
      var status = holds ? "passes" : "fails";
      paragraph.textContent = label + ": " + status +
        (detail ? " (" + detail + ")" : "");
      return paragraph;
    }

    function exPostEfficiencyDetail() {
      var maximum = state.summary.exPostEfficiency;
      return "largest loss = " + formatDiagnostic(maximum.loss) +
        (maximum.attained ? " at" : " approaching") + " (v, c) = (" +
        formatDiagnostic(maximum.v) + ", " + formatDiagnostic(maximum.c) + ")";
    }

    function updateDiagnosticText(key) {
      var definition = diagnostics[key];
      var verdicts = state.summary.verdicts;
      var lines;
      if (key === "buyerIc" || key === "sellerIc") {
        var ic = diagnosticState(key);
        lines = [
          verdictParagraph("BIC", ic.holds),
          verdictParagraph("DSIC", ic.dsicHolds,
            "maximum deviation gain = " + formatDiagnostic(ic.maximumExPostGain))
        ];
      } else if (key === "buyerPayoff" || key === "sellerPayoff") {
        var isBuyer = key === "buyerPayoff";
        var agent = isBuyer ? "Buyer" : "Seller";
        var expected = isBuyer ?
          state.summary.exAnte.buyerUtility : state.summary.exAnte.sellerUtility;
        var interimRange = isBuyer ?
          state.summary.interimPayoffRanges.buyer :
          state.summary.interimPayoffRanges.seller;
        var exPostRange = state.summary.ranges[key];
        lines = [
          verdictParagraph(
            agent + " ex-ante IR",
            isBuyer ? verdicts.exAnteBuyerIr : verdicts.exAnteSellerIr,
            "payoff = " + formatDiagnostic(expected)
          ),
          verdictParagraph(
            agent + " interim IR",
            isBuyer ? verdicts.interimBuyerIr : verdicts.interimSellerIr,
            "minimum = " + formatDiagnostic(interimRange.min)
          ),
          verdictParagraph(
            agent + " ex-post IR",
            isBuyer ? verdicts.exPostBuyerIr : verdicts.exPostSellerIr,
            "minimum = " + formatDiagnostic(exPostRange.min)
          )
        ];
      } else if (key === "revenue") {
        lines = [
          verdictParagraph(
            "Ex-ante BB",
            verdicts.expectedNoDeficit,
            "expected revenue = " + formatDiagnostic(verdicts.expectedRevenue)
          ),
          verdictParagraph("Ex-post BB", verdicts.exPostNoDeficit,
            "largest deficit = " +
              formatDiagnostic(Math.max(0, -state.summary.ranges.revenue.min)))
        ];
      } else {
        var efficient = Math.abs(verdicts.efficiencyLoss) <=
          model.VERDICT_TOLERANCE;
        lines = [
          verdictParagraph("Ex-ante efficiency", efficient,
            "expected loss = " + formatDiagnostic(verdicts.efficiencyLoss)),
          verdictParagraph("Ex-post efficiency", efficient, exPostEfficiencyDetail())
        ];
      }
      definition.text.replaceChildren.apply(definition.text, lines);
    }

    function updateDiagnosticLiveStatus() {
      var verdicts = state.summary.verdicts;
      elements.diagnosticLiveStatus.textContent =
        "Buyer BIC " + (verdicts.buyerBic ? "passes" : "fails") +
        ". Seller BIC " + (verdicts.sellerBic ? "passes" : "fails") +
        ". Expected revenue " + formatDiagnostic(verdicts.expectedRevenue) +
        ". " + diagnostics.efficiency.text.children[0].textContent +
        ". " + diagnostics.efficiency.text.children[1].textContent + ".";
    }

    function setSurfaceProbe(key, v, c, announce) {
      var probe = state.surfaceProbes[key];
      probe.v = normalizeProbeCoordinate(v);
      probe.c = normalizeProbeCoordinate(c);
      probe.visible = true;
      drawSurfaceProbe(key);
      if (announce) {
        announceSurfaceProbe(key);
      }
    }

    function hideSurfaceProbe(key) {
      state.surfaceProbes[key].visible = false;
      removeProbe(surfaces[key].chart, ".surface-probe");
    }

    function drawSurfaceProbe(key) {
      var svg = surfaces[key].chart;
      removeProbe(svg, ".surface-probe");
      var probe = state.surfaceProbes[key];
      if (!probe.visible) {
        return;
      }
      var value = model.fieldValueAt(state.rule, key, probe.v, probe.c);
      var scaffold = visuals.drawProbeScaffold(svg, {
        layout: LAYOUT,
        x: mesh.svgXOf(probe.v, LAYOUT),
        y: mesh.svgYOf(probe.c, LAYOUT),
        boxWidth: key === "q" ? 72 : 82,
        groupClass: "surface-probe chart-480x520-probe",
        radius: 3.5,
        xValue: visuals.formatProbe(probe.v),
        yValue: visuals.formatProbe(probe.c)
      });
      visuals.appendProbeValueText(
        scaffold.group,
        scaffold.textX,
        scaffold.textY,
        key === "q" ? {
          symbol: "q",
          value: visuals.formatProbe(value)
        } : {
          symbol: "p",
          subscript: key === "pB" ? "B" : "S",
          value: visuals.formatProbe(value)
        }
      );
    }

    function announceSurfaceProbe(key) {
      var probe = state.surfaceProbes[key];
      var value = model.fieldValueAt(state.rule, key, probe.v, probe.c);
      var name = key === "q" ? "allocation" :
        (key === "pB" ? "buyer payment" : "seller payment");
      elements.probeStatus.textContent = "Buyer value " +
        visuals.formatProbe(probe.v) + ", seller value " +
        visuals.formatProbe(probe.c) + ", " + name + " " +
        visuals.formatProbe(value) + ".";
    }

    function setDiagnosticProbe(key, x, y, announce) {
      var probe = state.diagnosticProbes[key];
      probe.x = normalizeProbeCoordinate(x);
      probe.y = normalizeProbeCoordinate(y);
      probe.visible = true;
      drawDiagnosticProbe(key);
      if (announce) {
        announceDiagnosticProbe(key);
      }
    }

    function hideDiagnosticProbe(key) {
      state.diagnosticProbes[key].visible = false;
      removeProbe(diagnostics[key].chart, ".diagnostic-probe");
    }

    function drawDiagnosticProbe(key) {
      var svg = diagnostics[key].chart;
      removeProbe(svg, ".diagnostic-probe");
      var probe = state.diagnosticProbes[key];
      if (!probe.visible) {
        return;
      }
      var value = model.diagnosticValueAt(state.rule, key, probe.x, probe.y);
      var scaffold = visuals.drawProbeScaffold(svg, {
        layout: LAYOUT,
        x: mesh.svgXOf(probe.x, LAYOUT),
        y: mesh.svgYOf(probe.y, LAYOUT),
        boxWidth: key === "efficiency" ? 94 : 82,
        groupClass: (diagnostics[key].kind === "ic" ? "ic-probe " : "") +
          "diagnostic-probe chart-480x520-probe",
        xValue: visuals.formatProbe(probe.x),
        yValue: visuals.formatProbe(probe.y)
      });
      visuals.appendProbeValueText(
        scaffold.group,
        scaffold.textX,
        scaffold.textY,
        diagnosticProbeLabel(key, value)
      );
    }

    function diagnosticScalarValue(key, value) {
      return key === "efficiency" ? value.q - value.efficient : value;
    }

    function diagnosticProbeLabel(key, value) {
      var scalar = diagnosticScalarValue(key, value);
      if (key === "buyerIc" || key === "sellerIc") {
        return {
          symbol: "U",
          subscript: key === "buyerIc" ? "B" : "S",
          value: visuals.formatProbe(scalar)
        };
      }
      if (key === "buyerPayoff" || key === "sellerPayoff") {
        return {
          symbol: "u",
          subscript: key === "buyerPayoff" ? "B" : "S",
          value: visuals.formatProbe(scalar)
        };
      }
      return {
        symbol: key === "revenue" ? "R" : "q-q*",
        value: visuals.formatProbe(scalar)
      };
    }

    function announceDiagnosticProbe(key) {
      var probe = state.diagnosticProbes[key];
      var value = model.diagnosticValueAt(state.rule, key, probe.x, probe.y);
      var prefix;
      var name;
      if (key === "buyerIc") {
        prefix = "True buyer value " + visuals.formatProbe(probe.x) +
          ", alternate buyer report " + visuals.formatProbe(probe.y);
        name = "buyer interim utility";
      } else if (key === "sellerIc") {
        prefix = "True seller value " + visuals.formatProbe(probe.x) +
          ", alternate seller report " + visuals.formatProbe(probe.y);
        name = "seller interim utility";
      } else {
        prefix = "Buyer value " + visuals.formatProbe(probe.x) +
          ", seller value " + visuals.formatProbe(probe.y);
        name = key === "revenue" ? "net revenue" :
          (key === "buyerPayoff" ? "buyer truthful payoff" :
            (key === "sellerPayoff" ? "seller truthful payoff" :
              "allocation minus efficient allocation"));
      }
      elements.probeStatus.textContent = prefix + ", " + name + " " +
        visuals.formatProbe(diagnosticScalarValue(key, value)) + ".";
    }

    function removeProbe(chart, selector) {
      var prior = chart.querySelector(selector);
      if (prior) {
        prior.remove();
      }
    }

    function normalizeProbeCoordinate(value) {
      var coordinate = numbers.clamp(value, 0, 1);
      if (coordinate <= model.ALGEBRA_TOLERANCE) {
        return 0;
      }
      if (coordinate >= 1 - model.ALGEBRA_TOLERANCE) {
        return 1;
      }
      return coordinate;
    }

    function formatDiagnostic(value) {
      if (Math.abs(value) < 5e-12) {
        return "0";
      }
      if (Math.abs(value) < 0.001) {
        return value.toExponential(2);
      }
      return value.toFixed(4);
    }

    function bindProbes() {
      DIAGNOSTIC_KEYS.forEach(function (key) {
        visuals.bindProbeChart(
          diagnostics[key].chart,
          LAYOUT,
          function () {
            return {
              x: state.diagnosticProbes[key].x,
              y: state.diagnosticProbes[key].y
            };
          },
          function (x, y, announce) {
            setDiagnosticProbe(key, x, y, announce);
          },
          function () {
            hideDiagnosticProbe(key);
          }
        );
      });
    }

    return Object.freeze({
      drawSurface: drawSurface,
      drawCustomTriangle: drawCustomTriangle,
      drawCustomSelection: drawCustomSelection,
      upgradeSurfaceRaster: upgradeSurfaceRaster,
      drawDiagnostic: drawDiagnostic,
      upgradeDiagnosticRaster: upgradeDiagnosticRaster,
      updateDiagnosticLiveStatus: updateDiagnosticLiveStatus,
      setSurfaceProbe: setSurfaceProbe,
      hideSurfaceProbe: hideSurfaceProbe,
      removeProbe: removeProbe,
      bindProbes: bindProbes
    });
  }

  global.BargainingSandboxCharts = Object.freeze({ create: create });
})(window);
