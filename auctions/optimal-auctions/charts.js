"use strict";

window.OptimalAuctionsCharts = (function () {
  var S = window.SvgUtils;
  var M = window.OptimalAuctionsModel;
  var visuals = window.BilateralTradeVisuals;
  var append = S.appendSvg;
  var mesh = S.createTriangleMesh(M.RESOLUTION);
  var layout = { left: 50, right: 450, top: 40, bottom: 440, viewWidth: 480, viewHeight: 520 };
  var simplex = { center: 130, top: 18, bottom: 132, halfWidth: 114 };
  var gradientCache = null;

  // Match the M-S initial axis frame without fitting to changing annotations.
  // Only a width change can update this fixed-axis margin, before rendering.
  function alignMainFrame(svg) {
    var width = parseFloat(getComputedStyle(svg).width);
    if (svg.dataset.alignedWidth === String(width)) { return; }
    var ticks = svg.querySelectorAll(".axis-text");
    if (!ticks.length) { return; }
    var top = Math.min.apply(null, Array.from(ticks).map(function (tick) { return tick.getBBox().y; }));
    svg.parentElement.style.marginTop = -(top * width / layout.viewWidth) + "px";
    svg.dataset.alignedWidth = String(width);
  }

  function fixed(x) { return (Math.abs(x) < 0.00005 ? 0 : x).toFixed(4); }
  function clear(svg) { svg.querySelectorAll(":scope > g, :scope > defs").forEach(function (node) { node.remove(); }); }
  function line(parent, x1, y1, x2, y2, attributes) {
    return append(parent, "line", Object.assign({ x1: x1, y1: y1, x2: x2, y2: y2, class: "axis" }, attributes));
  }
  function palette() {
    var style = getComputedStyle(document.documentElement);
    return ["neutral", "blue", "orange"].map(function (name) {
      return style.getPropertyValue("--heatmap-" + name + "-rgb").split(",").map(Number);
    });
  }
  function color(q, colors) {
    var weights = [1 - q[0] - q[1], q[0], q[1]];
    return "rgb(" + [0, 1, 2].map(function (channel) {
      return Math.round(colors.reduce(function (sum, c, k) { return sum + weights[k] * c[channel]; }, 0));
    }).join(",") + ")";
  }
  function point(svg, event) {
    var matrix = svg.getScreenCTM();
    if (!matrix) { return null; }
    var p = svg.createSVGPoint();
    p.x = event.clientX; p.y = event.clientY;
    return p.matrixTransform(matrix.inverse());
  }
  function reportPoint(svg, event) {
    var p = point(svg, event);
    if (!p) { return null; }
    return { x: (p.x - layout.left) / (layout.right - layout.left),
      y: (layout.bottom - p.y) / (layout.bottom - layout.top),
      inside: p.x >= layout.left && p.x <= layout.right && p.y >= layout.top && p.y <= layout.bottom };
  }
  function lotteryPoint(svg, event) {
    var p = point(svg, event);
    if (!p) { return null; }
    var total = (simplex.bottom - p.y) / simplex.halfWidth;
    var difference = (p.x - simplex.center) / simplex.halfWidth;
    var a = Math.max(0, (total + difference) / 2);
    var b = Math.max(0, (total - difference) / 2);
    if (a + b > 1) { a = NumberUtils.clamp((a - b + 1) / 2, 0, 1); b = 1 - a; }
    // Keep the simplex edge in integer hundredths before dividing once.
    var aHundredths = Math.round(a * 100);
    var bHundredths = Math.min(Math.round(b * 100), 100 - aHundredths);
    return [aHundredths / 100, bHundredths / 100];
  }

  function allocation(svg, grid) {
    clear(svg);
    var g = append(svg, "g", { class: "allocation-layer" });
    var colors = palette();
    var nodes = mesh.drawTriangleMesh(g, grid, layout, function (q) { return color(q, colors); });
    visuals.drawFrame(svg, layout, mesh, false);
    alignMainFrame(svg);
    var overlay = append(svg, "g", { "pointer-events": "none" });
    var selected = append(overlay, "polygon", { class: "cell-cursor" });
    return {
      update: function (current) {
        alignMainFrame(svg);
        var colorsNow = palette();
        ["lower", "upper"].forEach(function (half) {
          current[half].forEach(function (row, i) { row.forEach(function (q, j) {
            nodes[half][i][j].setAttribute("fill", color(q, colorsNow));
          }); });
        });
      },
      select: function (cell) {
        selected.setAttribute("points", mesh.trianglePoints(mesh.cellCorners(cell.i, cell.j, layout), cell.half === "lower"));
        var prior = overlay.querySelector(".cell-label");
        if (prior) { prior.remove(); }
        function range(k) { return "[" + (k / 20).toFixed(2) + ", " + ((k + 1) / 20).toFixed(2) + "]"; }
        visuals.drawCellLabel(overlay, layout, mesh.cellRect(cell.i, cell.j, layout),
          range(cell.i) + " × " + range(cell.j) + " " + (cell.half === "lower" ? "R" : "L"));
      },
      probe: function (position, current) {
        var prior = svg.querySelector(".allocation-probe");
        if (prior) { prior.remove(); }
        if (!position.visible) { return; }
        var q = M.allocationAt(current, position.x, position.y);
        var boxWidth = 170;
        var scaffold = visuals.drawProbeScaffold(svg, {
          layout: layout, x: mesh.svgXOf(position.x, layout), y: mesh.svgYOf(position.y, layout),
          boxWidth: boxWidth, groupClass: "allocation-probe chart-480x520-probe", radius: 3.5,
          xValue: visuals.formatProbe(position.x), yValue: visuals.formatProbe(position.y)
        });
        visuals.appendProbeValueText(scaffold.group, scaffold.textX, scaffold.textY,
          { symbol: "q", subscript: "1", value: visuals.formatProbe(q[0]) });
        visuals.appendProbeValueText(scaffold.group, scaffold.textX + boxWidth / 2, scaffold.textY,
          { symbol: "q", subscript: "2", value: visuals.formatProbe(q[1]) });
      }

    };
  }

  // A cached bitmap interpolates the same three RGB colors as the allocation
  // grid, with barycentric weights (1-q1-q2, q1, q2) throughout the triangle.
  function lotteryGradient() {
    var colors = palette(), key = JSON.stringify(colors);
    if (gradientCache && gradientCache.key === key) { return gradientCache.url; }
    var canvas = document.createElement("canvas");
    canvas.width = 229; canvas.height = 115;
    var context = canvas.getContext("2d");
    var pixels = context.createImageData(229, 115);
    for (var y = 0; y <= 114; y += 1) {
      for (var x = y; x <= 228 - y; x += 1) {
        var weights = [y / 114, (x - y) / 228, (228 - y - x) / 228];
        var offset = (y * 229 + x) * 4;
        for (var channel = 0; channel < 3; channel += 1) {
          pixels.data[offset + channel] = Math.round(colors.reduce(function (sum, c, i) { return sum + weights[i] * c[channel]; }, 0));
        }
        pixels.data[offset + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
    gradientCache = { key: key, url: canvas.toDataURL() };
    return gradientCache.url;
  }

  function lottery(svg, q) {
    clear(svg);
    var defs = append(svg, "defs", {});
    var clip = append(defs, "clipPath", { id: "lottery-fill-clip" });
    append(clip, "polygon", { points: "130,132 16,18 244,18" });
    var g = append(svg, "g", {});
    append(g, "image", { class: "lottery-gradient", href: lotteryGradient(), x: 16, y: 18, width: 228, height: 114,
      "clip-path": "url(#lottery-fill-clip)", preserveAspectRatio: "none" });
    append(g, "polygon", { class: "lottery-boundary", points: "130,132 16,18 244,18", fill: "none", stroke: "var(--axis)", "stroke-width": 1.5 });
    append(g, "text", { x: 130, y: 152, "text-anchor": "middle" }, "No sale");
    append(g, "text", { x: 244, y: 12, "text-anchor": "end" }, "Bidder 1");
    append(g, "text", { x: 16, y: 12, "text-anchor": "start" }, "Bidder 2");
    var x = simplex.center + simplex.halfWidth * (q[0] - q[1]);
    var y = simplex.bottom - simplex.halfWidth * (q[0] + q[1]);
    line(g, simplex.center + simplex.halfWidth * q[0], simplex.bottom - simplex.halfWidth * q[0], x, y, { "stroke-dasharray": "3 3" });
    line(g, simplex.center - simplex.halfWidth * q[1], simplex.bottom - simplex.halfWidth * q[1], x, y, { "stroke-dasharray": "3 3" });
    append(g, "circle", { cx: x, cy: y, r: 5, fill: color(q, palette()), stroke: "var(--ink)", "stroke-width": 2 });
  }

  function alignDiagnosticText(svg) {
    var width = parseFloat(getComputedStyle(svg).width);
    var title = svg.closest("figure").querySelector(".diagnostic-axis-label");
    var size = parseFloat(getComputedStyle(title).fontSize);
    if (width > 0) {
      var font = size * svg.viewBox.baseVal.width / width + "px";
      if (svg.style.getPropertyValue("--diagnostic-font-size") !== font) {
        svg.style.setProperty("--diagnostic-font-size", font);
      }
    }
  }

  function axes(g, box, low, high) {
    alignDiagnosticText(g.ownerSVGElement);
    function x(v) { return box.left + v * (box.right - box.left); }
    function y(v) { return box.bottom - (v - low) / (high - low) * (box.bottom - box.top); }
    append(g, "rect", { class: "diagnostic-frame axis-line", x: box.left, y: box.top,
      width: box.right - box.left, height: box.bottom - box.top, fill: "none" });
    line(g, box.left, y(0), box.right, y(0), { class: "zero-line" });
    [0, 0.5, 1].forEach(function (v) {
      line(g, x(v), box.bottom, x(v), box.bottom + 4);
      append(g, "text", { x: x(v), y: box.bottom + 20, "text-anchor": "middle" }, Number.isInteger(v) ? String(v) : S.formatTick(v));
    });
    [low, 0, high].filter(function (v, i, arr) { return arr.indexOf(v) === i; }).forEach(function (v) {
      append(g, "text", { x: box.left - 7, y: y(v) + 5, "text-anchor": "end" }, Number.isInteger(v) ? String(v) : S.formatTick(v));
    });
    return { x: x, y: y };
  }

  // All plotted functions are quadratic per interval. A quadratic Bezier draws
  // each entire piece exactly, and separate pieces preserve one-sided jumps.
  function curve(piece, field, scale, a, b) {
    a = a === undefined ? piece.a : a;
    b = b === undefined ? piece.b : b;
    var first = M.evaluatePiece(piece, a)[field];
    var last = M.evaluatePiece(piece, b)[field];
    var middle = M.evaluatePiece(piece, (a + b) / 2)[field];
    return { start: scale.x(a) + "," + scale.y(first), end: scale.x(b) + "," + scale.y(last),
      segment: "Q" + scale.x((a + b) / 2) + "," + scale.y(2 * middle - (first + last) / 2) + " " + scale.x(b) + "," + scale.y(last) };
  }

  var diagnosticBox = { left: 40, right: 340, top: 20, bottom: 270 };

  function interim(svg, agent, bidder) {
    clear(svg);
    var g = append(svg, "g", {});
    var scale = axes(g, diagnosticBox, -1, 1);
    var suffix = bidder === 1 ? "₁" : "₂";
    line(g, scale.x(0), scale.y(-1), scale.x(1), scale.y(1), { class: "virtual-value-curve" });
    agent.pieces.forEach(function (piece) {
      var c = curve(piece, "allocation", scale);
      append(g, "path", { d: "M" + c.start + c.segment, class: "interim-curve curve-" + (bidder === 1 ? "one" : "two") });
    });
    append(g, "text", { x: scale.x(0.2), y: scale.y(-0.6) + 17, class: "annotation-halo" }, "φ" + suffix);
    svg.querySelector("desc").textContent = "Bidder " + bidder + ": solid interim allocation Q" + suffix +
      "; dashed virtual value φ" + suffix + " = 2v − 1. Vertical scale −1 to 1.";
  }

  // Payment pieces are monotone because P'(v) = v Q'(v). Restrict their
  // geometry to [0,1] before drawing, so invisible negatives cannot enlarge
  // the reserved plotting area. Model values and integrals stay signed.
  function visiblePaymentInterval(piece) {
    var first = M.evaluatePiece(piece, piece.a).payment;
    var last = M.evaluatePiece(piece, piece.b).payment;
    if (Math.max(first, last) < 0 || Math.min(first, last) > 1) { return null; }
    function crossing(target) {
      var a = piece.a, b = piece.b;
      for (var k = 0; k < 45; k += 1) {
        var middle = (a + b) / 2;
        if ((M.evaluatePiece(piece, middle).payment < target) === (first < last)) { a = middle; }
        else { b = middle; }
      }
      return (a + b) / 2;
    }
    return [first < 0 ? crossing(0) : first > 1 ? crossing(1) : piece.a,
      last < 0 ? crossing(0) : last > 1 ? crossing(1) : piece.b];
  }

  function paymentLabel(g, agent, bidder, scale) {
    var box = diagnosticBox;
    var suffix = bidder === 1 ? "₁" : "₂";
    var label = append(g, "text", { x: (box.left + box.right) / 2, y: box.bottom - 10,
      "text-anchor": "middle", class: "expected-payment-label annotation-halo bidder-" + (bidder === 1 ? "one" : "two"),
      "data-value": agent.expectedPayment }, (agent.bic ? "E[P" : "Candidate E[P") + suffix + "(V" + suffix + ")] = " + fixed(agent.expectedPayment));
    var width = label.getComputedTextLength() + 12;
    var height = label.getBBox().height + 12;
    var best = null;
    for (var left = box.right - width; left >= box.left; left -= 3) {
      var a = (left - box.left) / (box.right - box.left);
      var b = (left + width - box.left) / (box.right - box.left);
      var minimum = 1;
      agent.pieces.forEach(function (piece) {
        if (piece.b <= a || piece.a >= b) { return; }
        minimum = Math.min(minimum, M.evaluatePiece(piece, Math.max(a, piece.a)).payment,
          M.evaluatePiece(piece, Math.min(b, piece.b)).payment);
      });
      var clearance = box.bottom - scale.y(minimum);
      if (clearance >= height && (!best || clearance > best.clearance)) {
        best = { x: left + width / 2, clearance: clearance };
      }
    }
    label.dataset.placement = best ? "inside-area" : "panel-floor";
    if (best) {
      label.setAttribute("x", best.x);
      label.setAttribute("y", box.bottom - best.clearance / 2 + 4);
    }
  }

  function payment(svg, agent, bidder) {
    clear(svg);
    var g = append(svg, "g", {});
    var scale = axes(g, diagnosticBox, 0, 1);
    svg.dataset.yMin = "0"; svg.dataset.yMax = "1";
    var defs = append(svg, "defs", {});
    var clipId = svg.id + "-clip";
    var clip = append(defs, "clipPath", { id: clipId });
    append(clip, "rect", { x: diagnosticBox.left, y: diagnosticBox.top,
      width: diagnosticBox.right - diagnosticBox.left, height: diagnosticBox.bottom - diagnosticBox.top });
    var plot = append(g, "g", { "clip-path": "url(#" + clipId + ")" });
    agent.pieces.forEach(function (piece) {
      var interval = visiblePaymentInterval(piece);
      if (!interval) { return; }
      var c = curve(piece, "payment", scale, interval[0], interval[1]);
      append(plot, "path", { class: "payment-area", d: "M" + scale.x(interval[0]) + "," + scale.y(0) + "L" + c.start + c.segment + "L" + scale.x(interval[1]) + "," + scale.y(0) + "Z",
        fill: bidder === 1 ? "var(--blue)" : "var(--orange)", "fill-opacity": 0.2 });
      append(plot, "path", { d: "M" + c.start + c.segment, class: "payment-curve curve-" + (bidder === 1 ? "one" : "two") });
    });
    paymentLabel(g, agent, bidder, scale);
    svg.querySelector("desc").textContent = "Bidder " + bidder + (agent.bic ? " interim payment. " : " envelope payment candidate; BIC fails. ") +
      "Expected payment " + fixed(agent.expectedPayment) + ". Fixed vertical scale 0 to 1; values outside this range are clipped. The label uses the full signed integral, including any clipped part.";
  }

  return Object.freeze({ allocation: allocation, lottery: lottery, interim: interim,
    payment: payment, reportPoint: reportPoint, lotteryPoint: lotteryPoint, fixed: fixed });
}());
