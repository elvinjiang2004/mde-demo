(function (global) {
  "use strict";

  var numbers = global.NumberUtils;
  var appendSvg = global.SvgUtils.appendSvg;
  var formatTick = global.SvgUtils.formatTick;
  var HEATMAP_FALLBACKS = {
    neutral: [255, 255, 255],
    blue: [23, 107, 156],
    green: [35, 116, 81],
    yellow: [214, 171, 0],
    orange: [168, 84, 22],
    red: [150, 60, 60]
  };
  var MISMATCH_THRESHOLD = 0.02;
  var DIAGNOSTIC_RASTER_SIZE = 330;

  function readRgbTriplet(style, propertyName, fallback) {
    var source = style.getPropertyValue(propertyName).trim()
      .replace(/^rgb\(\s*/i, "").replace(/\s*\)$/, "");
    var parts = source.split(/[\s,]+/);
    if (parts.length !== 3) {
      return fallback.slice();
    }
    var channels = parts.map(Number);
    if (!channels.every(function (channel) {
      return Number.isFinite(channel) && channel >= 0 && channel <= 255;
    })) {
      return fallback.slice();
    }
    return channels;
  }

  function readHeatmapPalette(style) {
    return {
      neutral: readRgbTriplet(
        style, "--heatmap-neutral-rgb", HEATMAP_FALLBACKS.neutral
      ),
      blue: readRgbTriplet(
        style, "--heatmap-blue-rgb", HEATMAP_FALLBACKS.blue
      ),
      green: readRgbTriplet(
        style, "--heatmap-green-rgb", HEATMAP_FALLBACKS.green
      ),
      yellow: readRgbTriplet(
        style, "--heatmap-yellow-rgb", HEATMAP_FALLBACKS.yellow
      ),
      orange: readRgbTriplet(
        style, "--heatmap-orange-rgb", HEATMAP_FALLBACKS.orange
      ),
      red: readRgbTriplet(
        style, "--heatmap-red-rgb", HEATMAP_FALLBACKS.red
      )
    };
  }

  function mixChannels(c0, c1, amount) {
    var t = numbers.clamp(amount, 0, 1);
    return [0, 1, 2].map(function (index) {
      return Math.round(c0[index] + (c1[index] - c0[index]) * t);
    });
  }

  function sequentialColor(palette, paletteKey, value) {
    var channels = mixChannels(
      palette.neutral, palette[paletteKey], numbers.clamp(value, 0, 1)
    );
    return "rgb(" + channels[0] + "," + channels[1] + "," + channels[2] + ")";
  }

  function qChannels(palette, value) {
    return mixChannels(
      palette.neutral, palette.blue, numbers.clamp(value, 0, 1)
    );
  }

  function signedChannels(value, extent, negativeColor, positiveColor) {
    var color = value >= 0 ? positiveColor : negativeColor;
    var amount = extent > 0 ? Math.abs(value) / extent : 0;
    return [color[0], color[1], color[2],
      Math.round(255 * numbers.clamp(amount, 0, 1))];
  }

  function efficiencyChannels(value, pixelX, pixelY, palette, threshold) {
    var mismatchThreshold = threshold === undefined ?
      MISMATCH_THRESHOLD : threshold;
    var base = qChannels(palette, value.q);
    if (value.over > mismatchThreshold && (pixelX + pixelY) % 9 < 3) {
      return palette.orange;
    }
    var backslashBand = (pixelX - pixelY) % 9;
    if (backslashBand < 0) {
      backslashBand += 9;
    }
    if (value.under > mismatchThreshold && backslashBand < 3) {
      return palette.blue;
    }
    return base;
  }

  function payoffDisplayExtent(summary) {
    var values = [
      0.05,
      Math.abs(summary.deviation.buyer.range.min),
      Math.abs(summary.deviation.buyer.range.max),
      Math.abs(summary.deviation.seller.range.min),
      Math.abs(summary.deviation.seller.range.max)
    ];
    if (summary.ir && summary.ir.exPost) {
      values.push(
        Math.abs(summary.ir.exPost.buyerRange.min),
        Math.abs(summary.ir.exPost.buyerRange.max),
        Math.abs(summary.ir.exPost.sellerRange.min),
        Math.abs(summary.ir.exPost.sellerRange.max)
      );
    }
    return Math.max.apply(Math, values);
  }

  function plotPointFromEvent(chart, event, layout) {
    var rect = chart.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) {
      return null;
    }
    var svgX = (event.clientX - rect.left) / rect.width * layout.viewWidth;
    var svgY = (event.clientY - rect.top) / rect.height * layout.viewHeight;
    if (svgX < layout.left || svgX > layout.right ||
        svgY < layout.top || svgY > layout.bottom) {
      return null;
    }
    return {
      x: numbers.clamp(
        (svgX - layout.left) / (layout.right - layout.left), 0, 1
      ),
      y: numbers.clamp(
        (layout.bottom - svgY) / (layout.bottom - layout.top), 0, 1
      )
    };
  }

  function bindProbeChart(chart, layout, currentPoint, setProbe, hideProbe) {
    chart.addEventListener("pointerdown", function (event) {
      var point = plotPointFromEvent(chart, event, layout);
      if (point) {
        setProbe(point.x, point.y, true);
      }
    });
    chart.addEventListener("pointermove", function (event) {
      var point = plotPointFromEvent(chart, event, layout);
      if (point) {
        setProbe(point.x, point.y, false);
      }
    });
    chart.addEventListener("pointerleave", function () {
      if (document.activeElement !== chart) {
        hideProbe();
      }
    });
    chart.addEventListener("focus", function () {
      var point = currentPoint();
      setProbe(point.x, point.y, true);
    });
    chart.addEventListener("blur", hideProbe);
    chart.addEventListener("keydown", function (event) {
      var point = currentPoint();
      var step = event.shiftKey ? 0.1 : 0.01;
      var handled = true;
      if (event.key === "ArrowLeft") {
        point.x -= step;
      } else if (event.key === "ArrowRight") {
        point.x += step;
      } else if (event.key === "ArrowUp") {
        point.y += step;
      } else if (event.key === "ArrowDown") {
        point.y -= step;
      } else if (event.key === "Home") {
        point.x = 0;
      } else if (event.key === "End") {
        point.x = 1;
      } else if (event.key === "Escape") {
        hideProbe();
      } else {
        handled = false;
      }
      if (handled) {
        event.preventDefault();
        if (event.key !== "Escape") {
          setProbe(point.x, point.y, true);
        }
      }
    });
  }

  function drawAxisFrame(svg, layout, mesh, ticks) {
    ticks.forEach(function (value) {
      var x = mesh.svgXOf(value, layout);
      var y = mesh.svgYOf(value, layout);
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
      x: layout.left,
      y: layout.top,
      width: layout.right - layout.left,
      height: layout.bottom - layout.top,
      fill: "none",
      class: "axis-line"
    });
  }

  function drawFrame(svg, layout, mesh, compact) {
    drawAxisFrame(
      svg, layout, mesh, compact ? [0, 1] : [0, 0.25, 0.5, 0.75, 1]
    );
    appendSvg(svg, "line", {
      x1: layout.left,
      y1: layout.bottom,
      x2: layout.right,
      y2: layout.top,
      class: "diagonal-guide"
    });
  }

  function drawLineFrame(svg, layout, mesh) {
    drawAxisFrame(svg, layout, mesh, [0, 1]);
  }

  function drawCellLabel(svg, layout, cursorRect, text) {
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
      x: x,
      y: y,
      class: "cell-label annotation-halo",
      "text-anchor": anchor
    }, text);
  }

  function drawProbeScaffold(svg, options) {
    var compact = Boolean(options.compact);
    var layout = options.layout;
    var boxHeight = compact ? 22 : 24;
    var offset = compact ? 8 : 10;
    var boxX = options.x + offset;
    var boxY = options.y - boxHeight - offset;
    if (boxX + options.boxWidth > layout.right) {
      boxX = options.x - options.boxWidth - offset;
    }
    if (boxY < layout.top) {
      boxY = options.y + offset;
    }
    var group = appendSvg(svg, "g", { class: options.groupClass });
    appendSvg(group, "line", {
      x1: options.x, y1: layout.top, x2: options.x, y2: layout.bottom,
      class: "plot-probe-line"
    });
    appendSvg(group, "line", {
      x1: layout.left, y1: options.y, x2: layout.right, y2: options.y,
      class: "plot-probe-line"
    });
    appendSvg(group, "circle", {
      cx: options.x,
      cy: options.y,
      r: options.radius || (compact ? 2.8 : 3),
      class: "plot-probe-point"
    });
    appendSvg(group, "rect", {
      x: boxX,
      y: boxY,
      width: options.boxWidth,
      height: boxHeight,
      class: "plot-probe-box"
    });
    appendSvg(group, "text", {
      x: numbers.clamp(
        options.x,
        layout.left + (compact ? 22 : 28),
        layout.right - (compact ? 22 : 28)
      ),
      y: layout.bottom + (compact ? 30 : 31),
      class: "plot-probe-coordinate",
      "text-anchor": "middle"
    }, options.xValue);
    appendSvg(group, "text", {
      x: layout.left + (compact ? 5 : 6),
      y: numbers.clamp(
        options.y + 4,
        layout.top + (compact ? 14 : 16),
        layout.bottom - (compact ? 8 : 10)
      ),
      class: "plot-probe-coordinate",
      "text-anchor": "start"
    }, options.yValue);
    return {
      group: group,
      textX: boxX + (compact ? 5 : 6),
      textY: boxY + (compact ? 15 : 16)
    };
  }

  function appendProbeValueText(group, x, y, valueLabel, separator) {
    var valueText = appendSvg(group, "text", {
      x: x, y: y, class: "plot-probe-text"
    });
    if (valueLabel.label) {
      appendSvg(valueText, "tspan", {}, valueLabel.label);
    } else {
      appendSvg(valueText, "tspan", {
        class: "plot-probe-symbol"
      }, valueLabel.symbol);
      if (valueLabel.subscript) {
        appendSvg(valueText, "tspan", {
          class: "plot-probe-subscript", "baseline-shift": "sub"
        }, valueLabel.subscript);
      }
    }
    appendSvg(valueText, "tspan", {},
      (separator === undefined ? " = " : separator) + valueLabel.value);
  }

  function formatProbe(value) {
    var cleaned = Math.abs(value) < 5e-12 ? 0 : value;
    return cleaned.toFixed(3);
  }

  global.BilateralTradeVisuals = Object.freeze({
    DIAGNOSTIC_RASTER_SIZE: DIAGNOSTIC_RASTER_SIZE,
    readHeatmapPalette: readHeatmapPalette,
    sequentialColor: sequentialColor,
    qChannels: qChannels,
    signedChannels: signedChannels,
    efficiencyChannels: efficiencyChannels,
    payoffDisplayExtent: payoffDisplayExtent,
    plotPointFromEvent: plotPointFromEvent,
    bindProbeChart: bindProbeChart,
    drawFrame: drawFrame,
    drawLineFrame: drawLineFrame,
    drawCellLabel: drawCellLabel,
    drawProbeScaffold: drawProbeScaffold,
    appendProbeValueText: appendProbeValueText,
    formatProbe: formatProbe
  });
}(window));
