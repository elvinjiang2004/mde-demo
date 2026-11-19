"use strict";

(function (global) {
  var namespace = "http://www.w3.org/2000/svg";
  var mutationObservers = new WeakMap();
  function svgUnits(svg, pixels) {
    var width = parseFloat(getComputedStyle(svg).width);
    return width > 0 ? pixels * svg.viewBox.baseVal.width / width : pixels;
  }
  function setTextSize(svg) {
    var pixels = 0.86 * parseFloat(getComputedStyle(document.documentElement).fontSize);
    var size = svgUnits(svg, pixels) + "px";
    if (svg.style.getPropertyValue("--chart-font-size") !== size) {
      svg.style.setProperty("--chart-font-size", size);
    }
    var unit = svgUnits(svg, 1) + "px";
    if (svg.style.getPropertyValue("--chart-unit") !== unit) {
      svg.style.setProperty("--chart-unit", unit);
    }
  }
  function appendSpan(parent, text, className, attributes) {
    var span = document.createElementNS(namespace, "tspan");
    span.textContent = text;
    if (className) { span.setAttribute("class", className); }
    Object.keys(attributes || {}).forEach(function (name) { span.setAttribute(name, attributes[name]); });
    parent.appendChild(span);
    return span;
  }
  function appendSymbol(parent, symbol, subscript, superscript, decoration) {
    var main = appendSpan(parent, symbol, "chart-math-symbol");
    if (decoration) { main.setAttribute("text-decoration", decoration); }
    if (subscript) { appendSpan(parent, subscript, "chart-math-subscript", { "baseline-shift": "sub" }); }
    if (superscript) { appendSpan(parent, superscript, "chart-math-superscript", { "baseline-shift": "super" }); }
  }
  // This is the site's small set of native chart symbols, not a TeX parser.
  function mathText(node, source) {
    var pattern = /Fᵢ⁻¹|βᴵ|[A-Za-zφ][ᵢ₁₂]|v[̲̅̄]ᵢ?/g;
    var match, end = 0;
    if (!pattern.test(source)) { return node; }
    pattern.lastIndex = 0;
    node.textContent = "";
    node.setAttribute("aria-label", source);
    while ((match = pattern.exec(source))) {
      appendSpan(node, source.slice(end, match.index));
      var token = match[0];
      if (token === "βᴵ") { appendSymbol(node, "β", "", "I"); }
      else if (token.charAt(0) === "v" && /[̲̅̄]/.test(token)) {
        appendSymbol(node, "v", token.charAt(2) === "ᵢ" ? "i" : "", "", token.charAt(1) === "̲" ? "underline" : "overline");
      } else {
        var subscript = { "ᵢ": "i", "₁": "1", "₂": "2" }[token.charAt(1)];
        appendSymbol(node, token.charAt(0), subscript, token === "Fᵢ⁻¹" ? "−1" : "");
      }
      end = pattern.lastIndex;
    }
    appendSpan(node, source.slice(end));
    return node;
  }
  function measureText(svg, source, className) {
    var node = document.createElementNS(namespace, "text");
    node.setAttribute("class", className || "");
    node.setAttribute("visibility", "hidden");
    node.textContent = source;
    svg.appendChild(node);
    mathText(node, source);
    var width = node.getComputedTextLength();
    node.remove();
    return width;
  }
  function appendProbeValueText(group, x, y, field) {
    var text = document.createElementNS(namespace, "text");
    text.setAttribute("x", x); text.setAttribute("y", y);
    text.setAttribute("class", "plot-probe-text");
    group.appendChild(text);
    appendSymbol(text, field.symbol, field.subscript);
    text.firstElementChild.classList.add("plot-probe-symbol");
    if (field.subscript) { text.children[1].classList.add("plot-probe-subscript"); }
    if (field.args) {
      appendSpan(text, "(");
      field.args.forEach(function (argument, index) {
        if (index) { appendSpan(text, ","); }
        var part = typeof argument === "string" ? { symbol: argument } : argument;
        appendSymbol(text, part.symbol, part.subscript, part.superscript);
      });
      appendSpan(text, ")");
    }
    appendSpan(text, " = " + field.value).classList.add("plot-probe-result");
    fitProbe(group);
    return text;
  }
  function setAttribute(node, name, value) {
    var text = typeof value === "number" ? String(Math.round(value * 1000) / 1000) : value;
    if (node.getAttribute(name) !== text) { node.setAttribute(name, text); }
  }
  function fitProbe(group) {
    var svg = group.ownerSVGElement;
    var box = group.querySelector(".plot-probe-box");
    var point = group.querySelector(".plot-probe-point");
    var lines = group.querySelectorAll(".plot-probe-line");
    var labels = Array.from(group.querySelectorAll(".plot-probe-text"));
    if (!box || !point || lines.length < 2 || !labels.length) { return; }
    var left = Number(lines[1].getAttribute("x1")), right = Number(lines[1].getAttribute("x2"));
    var top = Number(lines[0].getAttribute("y1")), bottom = Number(lines[0].getAttribute("y2"));
    var x = Number(point.getAttribute("cx")), y = Number(point.getAttribute("cy"));
    var padding = svgUnits(svg, 6), gap = svgUnits(svg, 10);
    var metrics = labels.map(function (label) {
      var result = label.querySelector(".plot-probe-result");
      if (result) {
        result.removeAttribute("x"); result.removeAttribute("dy");
        if (label.getBBox().width > right - left - 2 * padding) {
          setAttribute(result, "x", Number(label.getAttribute("x")));
          setAttribute(result, "dy", svgUnits(svg, 20));
        }
      }
      var bounds = label.getBBox();
      return { width: bounds.width, height: bounds.height,
        ascent: Number(label.getAttribute("y")) - bounds.y,
        bearing: bounds.x - Number(label.getAttribute("x")) };
    });
    var rowHeight = Math.max.apply(null, metrics.map(function (m) { return m.height; }));
    var ascent = Math.max.apply(null, metrics.map(function (m) { return m.ascent; }));
    var width = Math.max.apply(null, metrics.map(function (m) { return m.width; })) + 2 * padding;
    var rowGap = svgUnits(svg, 4);
    var height = 2 * padding + rowHeight * labels.length + (labels.length - 1) * rowGap;
    var boxX = x + gap;
    if (boxX + width > right) { boxX = x - width - gap; }
    boxX = Math.max(left, Math.min(right - width, boxX));
    var boxY = y - height - gap;
    if (boxY < top) { boxY = y + gap; }
    boxY = Math.max(top, Math.min(bottom - height, boxY));
    setAttribute(box, "x", boxX); setAttribute(box, "y", boxY);
    setAttribute(box, "width", width); setAttribute(box, "height", height);
    labels.forEach(function (label, index) {
      setAttribute(label, "x", boxX + padding - metrics[index].bearing);
      setAttribute(label, "y", boxY + padding + ascent + index * (rowHeight + rowGap));
      var result = label.querySelector(".plot-probe-result[dy]");
      if (result) { setAttribute(result, "x", label.getAttribute("x")); }
    });
    group.querySelectorAll(".plot-probe-coordinate").forEach(function (label) {
      if (label.getAttribute("text-anchor") === "middle") {
        var half = label.getBBox().width / 2;
        setAttribute(label, "x", Math.max(left + half, Math.min(right - half, x)));
        setAttribute(label, "y", bottom + svgUnits(svg, 18));
      } else {
        setAttribute(label, "x", left + padding);
        setAttribute(label, "y", Math.max(top + svgUnits(svg, 15), Math.min(bottom - svgUnits(svg, 6), y + svgUnits(svg, 4))));
      }
    });
  }
  function fitCellLabel(label) {
    var svg = label.ownerSVGElement;
    var frame = svg.querySelector("rect.axis-line");
    if (!frame) { return; }
    var left = Number(frame.getAttribute("x")), right = left + Number(frame.getAttribute("width"));
    var width = label.getBBox().width, x = Number(label.getAttribute("x"));
    var anchor = label.getAttribute("text-anchor");
    var start = anchor === "middle" ? x - width / 2 : (anchor === "end" ? x - width : x);
    if (start < left) { setAttribute(label, "x", left); setAttribute(label, "text-anchor", "start"); }
    else if (start + width > right) { setAttribute(label, "x", right); setAttribute(label, "text-anchor", "end"); }
    if (!label.hasAttribute("data-chart-label-y")) { label.setAttribute("data-chart-label-y", label.getAttribute("y")); }
    setAttribute(label, "y", label.getAttribute("data-chart-label-y"));
    svg.querySelectorAll(".plot-probe-box").forEach(function (box) {
      var a = label.getBBox(), b = box.getBBox();
      if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) {
        var top = Number(frame.getAttribute("y"));
        var baseline = b.y - svgUnits(svg, 6);
        if (baseline - a.height < top) { baseline = b.y + b.height + svgUnits(svg, 18); }
        setAttribute(label, "y", baseline);
      }
    });
  }
  function clearProbeTicks(svg) {
    var bounds = Array.from(svg.querySelectorAll(".plot-probe-coordinate")).map(function (coordinate) {
      return coordinate.getBoundingClientRect();
    });
    if (!bounds.length) {
      svg.querySelectorAll("[data-chart-probe-hidden]").forEach(function (tick) {
        tick.style.visibility = ""; tick.removeAttribute("data-chart-probe-hidden");
      });
      return;
    }
    svg.querySelectorAll("text.axis-text, .value-pdf-endpoint-label").forEach(function (tick) {
      var a = tick.getBoundingClientRect();
      var overlaps = bounds.some(function (b) {
        return a.left < b.right + 3 && a.right > b.left - 3 && a.top < b.bottom && a.bottom > b.top;
      });
      if (overlaps && !tick.hasAttribute("data-chart-probe-hidden")) {
        tick.style.visibility = "hidden"; tick.setAttribute("data-chart-probe-hidden", "");
      } else if (!overlaps && tick.hasAttribute("data-chart-probe-hidden")) {
        tick.style.visibility = ""; tick.removeAttribute("data-chart-probe-hidden");
      }
    });
  }
  function refresh(svg) {
    setTextSize(svg);
    if (global.PlotStyle) { global.PlotStyle.refresh(svg); }
    svg.querySelectorAll(".allocation-probe, .surface-probe, .diagnostic-probe").forEach(fitProbe);
    svg.querySelectorAll(".cell-label").forEach(fitCellLabel);
    clearProbeTicks(svg);
    svg.querySelectorAll(".value-pdf-endpoint-label").forEach(function (label) {
      setAttribute(label, "y", 91 + svgUnits(svg, 18));
    });
    var mutations = mutationObservers.get(svg);
    // This pass covers queued mutations, including axis redraws it performed.
    if (mutations) { mutations.takeRecords(); }
  }
  global.ChartLayout = Object.freeze({ svgUnits: svgUnits, setTextSize: setTextSize,
    appendSymbol: appendSymbol, mathText: mathText, measureText: measureText,
    appendProbeValueText: appendProbeValueText, fitProbe: fitProbe, refresh: refresh });
  document.addEventListener("DOMContentLoaded", function () {
    var observer = new ResizeObserver(function (entries) {
      entries.forEach(function (entry) { refresh(entry.target); });
    });
    document.querySelectorAll(".chart-canvas-frame > svg, #tradeoff-chart, .chart-260x160").forEach(function (svg) {
      refresh(svg);
      observer.observe(svg);
      var mutations = new MutationObserver(function () { refresh(svg); });
      mutationObservers.set(svg, mutations);
      mutations.observe(svg, { childList: true, characterData: true, subtree: true });
    });
  });
}(window));
