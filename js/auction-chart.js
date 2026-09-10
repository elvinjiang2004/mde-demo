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
  var densityFormat = new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 3
  });
  var probabilityFormat = new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 0
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

  function formatDensityAxis(value) {
    var absolute = Math.abs(value);
    if (absolute > 0 && (absolute < 0.001 || absolute >= 10000)) {
      return value.toExponential(1);
    }
    return densityFormat.format(value);
  }

  function formatProbabilityAxis(value) {
    return probabilityFormat.format(value);
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

  function panelTicks(minimum, maximum, count) {
    var ticks = [];
    var i;
    for (i = 0; i <= count; i += 1) {
      ticks.push(minimum + (i / count) * (maximum - minimum));
    }
    return ticks;
  }

  function drawPanelScaffold(svg, panel, left, right) {
    appendSvg(svg, "rect", {
      x: left,
      y: panel.top,
      width: right - left,
      height: panel.height,
      class: "panel-background"
    });

    appendSvg(svg, "text", {
      x: left,
      y: panel.top - 29,
      class: "panel-caption"
    }, panel.title);

    panelTicks(panel.min, panel.max, panel.tickCount).forEach(function (tick) {
      var y = yScale(tick, panel);
      appendSvg(svg, "line", {
        x1: left,
        y1: y,
        x2: right,
        y2: y,
        class: Math.abs(tick) <= EPSILON ? "zero-line" : "grid-line"
      });
      appendSvg(svg, "text", {
        x: left - 10,
        y: y + 4,
        class: "axis-text",
        "text-anchor": "end"
      }, panel.format(tick));
    });

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
    var width = 320;
    var height = 120;
    var left = 14;
    var right = 306;
    var top = 9;
    var baseY = 91;
    var plotHeight = baseY - top;
    var sampleCount = 161;
    var endpointInset = 1 / (sampleCount * 3);
    var span = options.upper - options.lower;
    var points = [];
    var peak = 0;
    var i;

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
    appendSvg(svg, "title", { id: "value-pdf-preview-title" }, "PDF of value, V subscript i");
    appendSvg(svg, "desc", { id: "value-pdf-preview-description" },
      "Beta value density on [" + options.formatEditableNumber(options.lower) +
      ", " + options.formatEditableNumber(options.upper) + "] with alpha " +
      options.formatChoiceNumber(options.alpha) + " and beta " +
      options.formatChoiceNumber(options.beta) + ".");

    for (i = 0; i < sampleCount; i += 1) {
      var ratio = i / (sampleCount - 1);
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
      peak = Math.max(peak, density);
      points.push({ ratio: ratio, density: density });
    }
    peak = peak > 0 ? peak : 1;

    function previewX(ratio) {
      return left + ratio * (right - left);
    }

    function previewY(density) {
      return baseY - (clamp(density, 0, peak) / peak) * plotHeight;
    }

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
    appendSvg(svg, "text", {
      x: left, y: 108, class: "value-pdf-endpoint-label",
      "text-anchor": "start", "data-endpoint": "a"
    }, "a = " + formatMoney(options.lower, span));
    appendSvg(svg, "text", {
      x: right, y: 108, class: "value-pdf-endpoint-label",
      "text-anchor": "end", "data-endpoint": "b"
    }, "b = " + formatMoney(options.upper, span));
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
    formatDensityAxis: formatDensityAxis,
    formatProbabilityAxis: formatProbabilityAxis,
    formatPercent: formatPercent,
    roundCoordinate: roundCoordinate,
    yScale: yScale,
    densityY: densityY,
    densityScaleMaximum: densityScaleMaximum,
    uniqueByBid: uniqueByBid,
    panelTicks: panelTicks,
    drawPanelScaffold: drawPanelScaffold,
    drawCurve: drawCurve,
    drawCircle: drawCircle,
    drawDiamond: drawDiamond,
    drawValueDensityPreview: drawValueDensityPreview,
    chartLayout: chartLayout
  });
})();
