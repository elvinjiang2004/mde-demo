"use strict";

(function () {
  var appendSvg = window.SvgUtils.appendSvg;
  var EPSILON = 1e-12;

  function clamp(value, lower, upper) {
    return window.NumberUtils.clamp(value, lower, upper);
  }

  function formatMoney(value, span) {
    if (!Number.isFinite(value)) {
      return "—";
    }
    var cleaned = Math.abs(value) < 1e-10 ? 0 : value;
    var digits = span <= 2 ? 3 : (span <= 20 ? 2 : 1);
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    }).format(cleaned);
  }

  function formatDensityAxis(value) {
    var absolute = Math.abs(value);
    if (absolute > 0 && (absolute < 0.001 || absolute >= 10000)) {
      return value.toExponential(1);
    }
    return new Intl.NumberFormat(undefined, {
      maximumSignificantDigits: 3
    }).format(value);
  }

  function formatProbabilityAxis(value) {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatPercent(value) {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value);
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
    chartLayout: chartLayout
  });
})();
