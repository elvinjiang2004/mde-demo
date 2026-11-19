"use strict";

(function () {
  var appendSvg = window.SvgUtils.appendSvg;
  var EPSILON = 1e-12;
  var moneyFormats = [1, 2, 3].map(function (digits) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    });
  });
  var percentFormat = new Intl.NumberFormat(undefined, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  function clamp(value, lower, upper) {
    return window.NumberUtils.clamp(value, lower, upper);
  }

  function formatMoney(value, span) {
    if (!Number.isFinite(value)) {
      return "—";
    }
    var cleaned = Math.abs(value) < 1e-10 ? 0 : value;
    var digits = span <= 2 ? 3 : (span <= 20 ? 2 : 1);
    return moneyFormats[digits - 1].format(cleaned);
  }

  function formatPercent(value) {
    return percentFormat.format(value);
  }

  function roundCoordinate(value) {
    return Math.round(value * 1000) / 1000;
  }

  function yScale(value, panel) {
    var ratio = (value - panel.min) / (panel.max - panel.min);
    return panel.top + panel.height - ratio * panel.height;
  }

  function densityY(value, panel) {
    var bounded = Number.isFinite(value) ?
      clamp(value, panel.min, panel.max) : panel.max;
    return yScale(bounded, panel);
  }

  function densityScaleMaximum(points) {
    var maximum = 0;
    points.forEach(function (point) {
      if (Number.isFinite(point.density) && point.density > maximum) {
        maximum = point.density;
      }
    });
    return maximum > 0 ? maximum : 1;
  }

  function uniqueByBid(points) {
    return points.filter(function (point, index) {
      return index === 0 ||
        Math.abs(point.bid - points[index - 1].bid) > EPSILON;
    });
  }

  function drawPanelScaffold(svg, panel, left, right) {
    ChartLayout.setTextSize(svg);
    appendSvg(svg, "rect", {
      x: left,
      y: panel.top,
      width: right - left,
      height: panel.height,
      class: "panel-background plot-frame"
    });

    if (panel.title) {
      appendSvg(svg, "text", {
        x: left,
        y: panel.top - ChartLayout.svgUnits(svg, 26),
        "dominant-baseline": "text-after-edge",
        style: "font-size:var(--chart-font-size)",
        class: "panel-caption"
      }, panel.title);
    }

    PlotStyle.axis(svg, { id: panel.id, orientation: "y",
      frame: { left: left, right: right, top: panel.top, bottom: panel.top + panel.height },
      domain: [panel.min, panel.max], grid: true, percent: panel.percent });

    appendSvg(svg, "line", {
      x1: left,
      y1: panel.top,
      x2: left,
      y2: panel.top + panel.height,
      class: "axis-line"
    });
  }

  function drawCurve(svg, points, getX, getY, className) {
    if (points.length < 2) {
      return;
    }
    var path = points.map(function (point, index) {
      return (index === 0 ? "M" : "L") + " " +
        roundCoordinate(getX(point)) + " " +
        roundCoordinate(getY(point));
    }).join(" ");
    appendSvg(svg, "path", { d: path, class: className });
  }

  // Keep these coordinates identical to the unrounded probability guide endpoints.
  function drawCircle(svg, x, y, className) {
    appendSvg(svg, "circle", {
      cx: x,
      cy: y,
      r: 6,
      class: className
    });
  }

  function drawDiamond(svg, x, y, className, radius) {
    var r = radius === undefined ? 7 : radius;
    appendSvg(svg, "polygon", {
      points: [
        [x, y - r],
        [x + r, y],
        [x, y + r],
        [x - r, y]
      ].map(function (point) {
        return roundCoordinate(point[0]) + "," + roundCoordinate(point[1]);
      }).join(" "),
      class: className
    });
  }

  function drawValueDensityPreview(svg, options) {
    PlotStyle.watchResize(svg, "density-curve", function () { drawValueDensityPreview(svg, options); });
    var width = 320;
    var height = 120;
    var left = 14;
    var right = 306;
    var top = 9;
    var baseY = 91;
    var plotHeight = baseY - top;
    // A fixed display inset regularizes singular endpoints without changing
    // the density or its exact hover values as the preview is resized.
    var endpointInset = 1 / 483;
    var span = options.upper - options.lower;
    var peak = 0;

    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-labelledby",
      "value-pdf-preview-title value-pdf-preview-description"
    );
    svg.setAttribute("data-alpha", options.alpha);
    svg.setAttribute("data-beta", options.beta);
    svg.setAttribute("data-lower-bound", options.lower);
    svg.setAttribute("data-upper-bound", options.upper);
    svg.replaceChildren();
    appendSvg(svg, "title", { id: "value-pdf-preview-title" }, "Value density, f subscript i of v subscript i");
    appendSvg(svg, "desc", { id: "value-pdf-preview-description" },
      "Beta value density on [" + options.formatEditableNumber(options.lower) +
      ", " + options.formatEditableNumber(options.upper) + "] with alpha " +
      options.formatChoiceNumber(options.alpha) + " and beta " +
      options.formatChoiceNumber(options.beta) + ".");

    function evaluate(ratio) {
      var evaluationRatio = clamp(ratio, endpointInset, 1 - endpointInset);
      var density = options.pdf(
        options.lower + evaluationRatio * span,
        options.lower,
        options.upper,
        options.distribution
      );
      if (!Number.isFinite(density) || density < 0) {
        density = 0;
      }
      return { ratio: ratio, density: density };
    }
    var mode = (options.alpha - 1) / (options.alpha + options.beta - 2);
    var cuts = [0, endpointInset, 1 - endpointInset, 1];
    if (options.alpha > 1 && options.beta > 1 && mode > endpointInset && mode < 1 - endpointInset) { cuts.push(mode); }
    cuts.sort(function (a, b) { return a - b; });
    for (var i = 0; i <= 32; i += 1) { peak = Math.max(peak, evaluate(i / 32).density); }
    cuts.forEach(function (t) { peak = Math.max(peak, evaluate(t).density); });
    peak = peak > 0 ? peak : 1;

    function previewX(ratio) {
      return left + ratio * (right - left);
    }

    function previewY(density) {
      return baseY - (clamp(density, 0, peak) / peak) * plotHeight;
    }

    var rendered = PlotStyle.dimensions(svg, { left: left, right: right, top: top, bottom: baseY });
    var scale = rendered.width / (right - left), points = [];
    cuts.slice(1).forEach(function (end, index) {
      var segment = PlotStyle.adaptive(evaluate, function (p) {
        return [[previewX(p.ratio) * scale, previewY(p.density) * scale]];
      }, cuts[index], end);
      points = points.concat(index ? segment.slice(1) : segment);
    });

    var curvePath = points.map(function (point, index) {
      return (index === 0 ? "M " : "L ") +
        roundCoordinate(previewX(point.ratio)) + " " +
        roundCoordinate(previewY(point.density));
    }).join(" ");
    var areaPath = "M " + left + " " + baseY + " " +
      curvePath.replace(/^M /, "L ") + " L " + right + " " + baseY + " Z";

    appendSvg(svg, "path", {
      d: areaPath,
      class: "value-pdf-area",
      "data-alpha": options.alpha,
      "data-beta": options.beta,
      "data-lower-bound": options.lower,
      "data-upper-bound": options.upper
    });
    appendSvg(svg, "line", {
      x1: left, y1: baseY, x2: right, y2: baseY, class: "value-pdf-axis"
    });
    appendSvg(svg, "path", {
      d: curvePath,
      class: "value-pdf-curve",
      "data-alpha": options.alpha,
      "data-beta": options.beta,
      "data-lower-bound": options.lower,
      "data-upper-bound": options.upper
    });
    appendSvg(svg, "line", {
      x1: left, y1: baseY - 4, x2: left, y2: baseY + 4,
      class: "value-pdf-axis"
    });
    appendSvg(svg, "line", {
      x1: right, y1: baseY - 4, x2: right, y2: baseY + 4,
      class: "value-pdf-axis"
    });
    var lowerLabel = appendSvg(svg, "text", {
      x: left, y: 108, class: "value-pdf-endpoint-label",
      "text-anchor": "start", "data-endpoint": "a"
    }, (options.lowerSymbol || "a") + " = " + PlotStyle.tick(options.lower, span));
    var upperLabel = appendSvg(svg, "text", {
      x: right, y: 108, class: "value-pdf-endpoint-label",
      "text-anchor": "end", "data-endpoint": "b"
    }, (options.upperSymbol || "b") + " = " + PlotStyle.tick(options.upper, span));
    ChartLayout.mathText(lowerLabel, lowerLabel.textContent);
    ChartLayout.mathText(upperLabel, upperLabel.textContent);
    ChartLayout.refresh(svg);
    if (window.PlotProbe) {
      PlotProbe.attach(svg, { views: function () { return [{ id: "value-density", name: "Value",
        frame: { left: left, right: right, top: baseY - plotHeight, bottom: baseY },
        domain: [options.lower, options.upper], yDomain: [0, peak], input: [PlotProbe.symbol("v", "i")],
        sample: function (v) { return [{ key: "density", label: "Value density", notation: PlotProbe.expression("f", "i", "v"),
          value: options.pdf(v, options.lower, options.upper, options.distribution), color: "var(--blue)" }]; }
      }]; } });
    }
  }

  function extend(base, extras) {
    Object.keys(extras || {}).forEach(function (key) {
      base[key] = extras[key];
    });
    return base;
  }

  function chartLayout(availableWidth, compactExtras, wideExtras) {
    if (availableWidth < 700) {
      return extend({
        width: 560,
        height: 820,
        left: 72,
        right: 544,
        densityTop: 80,
        densityHeight: 170,
        cdfTop: 350,
        cdfHeight: 350,
        compact: true
      }, compactExtras);
    }
    return extend({
      width: 1000,
      height: 800,
      left: 90,
      right: 975,
      densityTop: 70,
      densityHeight: 170,
      cdfTop: 330,
      cdfHeight: 350,
      compact: false
    }, wideExtras);
  }

  window.AuctionChart = Object.freeze({
    EPSILON: EPSILON,
    formatMoney: formatMoney,
    formatPercent: formatPercent,
    roundCoordinate: roundCoordinate,
    yScale: yScale,
    densityY: densityY,
    densityScaleMaximum: densityScaleMaximum,
    uniqueByBid: uniqueByBid,
    drawPanelScaffold: drawPanelScaffold,
    drawCurve: drawCurve,
    drawCircle: drawCircle,
    drawDiamond: drawDiamond,
    drawValueDensityPreview: drawValueDensityPreview,
    chartLayout: chartLayout
  });
})();
