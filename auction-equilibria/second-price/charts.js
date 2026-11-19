(function (global) {
  "use strict";
  function create(state, elements) {
    var appendSvg = global.SvgUtils.appendSvg;
    var layout;
    function format(value) {
      return global.PlotStyle.probe(value);
    }
    function path(points) {
      return points.map(function (point, index) { return (index ? "L" : "M") + layout.x(point[0]) + "," + layout.y(point[1]); }).join(" ");
    }
    function line(x1, y1, x2, y2, className, parent) {
      return appendSvg(parent || elements.chart, "line", { x1: x1, y1: y1, x2: x2, y2: y2, class: className });
    }
    function text(x, y, content, className, anchor, parent) {
      var node = appendSvg(parent || elements.chart, "text", { x: x, y: y, class: className || "", "text-anchor": anchor || "start" }, content);
      return global.ChartLayout.mathText(node, content);
    }
    function dot(opposing, payoff, radius, className, parent) {
      return appendSvg(parent || elements.chart, "circle", { cx: layout.x(opposing), cy: layout.y(payoff), r: radius, class: className });
    }
    function labelX(value, label) {
      var halfWidth = label.length * 3.6;
      return Math.max(layout.left + halfWidth, Math.min(layout.right - halfWidth, layout.x(value)));
    }
    function indexedSymbol(parent, symbol) {
      global.ChartLayout.appendSymbol(parent, symbol, "i");
    }
    function drawPayoffBox(group, result, x, y) {
      var box = appendSvg(group, "g", { class: "spa-payoff-box" });
      var background = appendSvg(box, "rect", { class: "plot-probe-box" });
      var rows = [["truthful", result.truthful, "v"], ["proposed", result.proposed, "x"]].map(function (item, index) {
        var expression = "u_i(v_i," + item[2] + "_i,p_i)";
        var readout = text(8, 19 + index * 22, "", "spa-payoff spa-" + item[0] + "-label", "start", box);
        readout.id = item[0] + "-payoff";
        readout.setAttribute("aria-label", expression + " = " + format(item[1].payoff));
        indexedSymbol(readout, "u");
        appendSvg(readout, "tspan", {}, "("); indexedSymbol(readout, "v");
        appendSvg(readout, "tspan", {}, ","); indexedSymbol(readout, item[2]);
        appendSvg(readout, "tspan", {}, ","); indexedSymbol(readout, "p");
        appendSvg(readout, "tspan", {}, ") = " + format(item[1].payoff));
        readout.dataset.value = item[1].payoff;
        readout.dataset.outcome = item[1].outcome;
        readout.dataset.winProbability = item[1].winProbability;
        return readout;
      });
      var width = Math.ceil(Math.max.apply(null, rows.map(function (row) { return row.getComputedTextLength(); }))) + 16;
      var height = 52, offset = 10;
      var boxX = x + offset;
      if (boxX + width > layout.right) { boxX = x - width - offset; }
      boxX = Math.max(layout.left + 2, Math.min(layout.right - width - 2, boxX));
      var boxY = y - height - offset;
      if (boxY < layout.top) { boxY = y + offset; }
      boxY = Math.max(layout.top + 2, Math.min(layout.bottom - height - 2, boxY));
      background.setAttribute("width", width);
      background.setAttribute("height", height);
      box.setAttribute("transform", "translate(" + boxX + "," + boxY + ")");
    }
    function drawProbe(result) {
      if (!state.probe) { return; }
      var group = appendSvg(elements.chart, "g", { class: "spa-probe" });
      var x = layout.x(state.opposing);
      var y = state.probe.y === null ? (layout.top + layout.bottom) / 2 : Math.max(layout.top, Math.min(layout.bottom, state.probe.y));
      line(x, layout.top, x, layout.bottom, "spa-opposing", group);
      dot(state.opposing, result.truthful.payoff, 6, "spa-truth-dot", group);
      dot(state.opposing, result.proposed.payoff, result.loss === 0 ? 3 : 5, "spa-proposed-dot", group);
      var label = "pᵢ = " + format(state.opposing);
      text(labelX(state.opposing, label), layout.bottom + 18, label, "spa-probe-coordinate spa-halo", "middle", group);
      drawPayoffBox(group, result, x, y);
      elements.chart.querySelectorAll(".plot-x-tick").forEach(function (tick) {
        tick.style.visibility = Math.abs(Number(tick.getAttribute("x")) - layout.x(state.opposing)) < label.length * 3.6 + 14 ? "hidden" : "";
      });
    }
    function drawChart(result) {
      var svg = elements.chart;
      var bounds = svg.getBoundingClientRect();
      var width = bounds.width || 300, height = bounds.height || 380;
      var lower = -Math.max(20, state.bid - state.value + 5);
      var upper = Math.max(20, state.value + 5);
      layout = {
        width: width, height: height, left: 46, right: width - 14, top: 12, bottom: height - 28,
        x: function (p) { return this.left + p / 100 * (this.right - this.left); },
        y: function (u) { return this.bottom - (u - lower) / (upper - lower) * (this.bottom - this.top); }
      };
      svg.setAttribute("viewBox", "0 0 " + width + " " + height);
      global.ChartLayout.setTextSize(svg);
      svg.dataset.value = state.value; svg.dataset.bid = state.bid; svg.dataset.opposing = state.opposing;
      svg.replaceChildren();
      appendSvg(svg, "title", { id: "chart-title" }, "Truthful and proposed-bid payoffs against highest opposing bids");
      appendSvg(svg, "desc", { id: "chart-description" },
        "The solid green curve shows truthful-bid payoff; the dashed blue curve shows proposed-bid payoff. " +
        "The red region marks the payoff loss from deviating. Ties with one other buyer are broken equally: each wins with probability one half. " +
        "Hover inside the plot for a full-height price guide and a cursor box comparing u_i(v_i,v_i,p_i) and u_i(v_i,x_i,p_i). " +
        "Click or touch and drag horizontally to change the proposed bid. Focus the plot and use Left and Right to inspect, Shift for steps of ten, Home and End for endpoints, and Escape to clear." +
        (state.probe ? " Highest opposing bid " + format(state.opposing) + ". Truthful payoff " + format(result.truthful.payoff) +
        "; proposed-bid payoff " + format(result.proposed.payoff) + "." : ""));
      appendSvg(svg, "rect", { x: layout.left, y: layout.top, width: layout.right - layout.left,
        height: layout.bottom - layout.top, class: "plot-frame spa-frame" });
      global.PlotStyle.axis(svg, { orientation: "x", frame: layout, domain: [0, 100] });
      global.PlotStyle.axis(svg, { orientation: "y", frame: layout, domain: [lower, upper], grid: true });
      var shade;
      if (state.bid < state.value) { shade = [[state.bid, 0], [state.bid, state.value - state.bid], [state.value, 0]]; }
      if (state.bid > state.value) { shade = [[state.value, 0], [state.bid, 0], [state.bid, state.value - state.bid]]; }
      if (shade) { appendSvg(svg, "path", { d: path(shade) + " Z", class: "spa-loss-area" }); }
      [state.value, state.bid].forEach(function (threshold) {
        line(layout.x(threshold), layout.top, layout.x(threshold), layout.bottom, "spa-threshold");
      });
      appendSvg(svg, "path", { d: path([[0, state.value], [state.value, 0], [100, 0]]), class: "spa-truth" });
      if (state.bid > 0) { appendSvg(svg, "path", { d: path([[0, state.value], [state.bid, state.value - state.bid]]), class: "spa-proposed" }); }
      if (state.bid < 100) { appendSvg(svg, "path", { d: path([[state.bid, 0], [100, 0]]), class: "spa-proposed" }); }
      if (state.bid !== state.value) {
        dot(state.bid, state.value - state.bid, 4, "spa-open-dot");
        dot(state.bid, 0, 4, "spa-open-dot");
        dot(state.bid, global.SPAModel.outcome(state.value, state.bid, state.bid).payoff, 4, "spa-proposed-dot");
      }
      drawProbe(result);
    }
    function pointerPosition(event, clampOutside) {
      if (!layout) { return null; }
      var bounds = elements.chart.getBoundingClientRect();
      var x = (event.clientX - bounds.left) / bounds.width * layout.width;
      var y = (event.clientY - bounds.top) / bounds.height * layout.height;
      var edgeTolerance = 1e-7;
      if (!clampOutside && (x < layout.left - edgeTolerance || x > layout.right + edgeTolerance ||
        y < layout.top - edgeTolerance || y > layout.bottom + edgeTolerance)) { return null; }
      var opposing = Math.max(0, Math.min(100, (x - layout.left) / (layout.right - layout.left) * 100));
      // Preserve exact threshold ties despite floating-point coordinate conversion.
      [0, 100, state.value, state.bid].some(function (threshold) {
        if (Math.abs(opposing - threshold) < 1e-10) { opposing = threshold; return true; }
        return false;
      });
      return { opposing: opposing, y: y };
    }
    return Object.freeze({ drawChart: drawChart, pointerPosition: pointerPosition, format: format });
  }
  global.SecondPriceCharts = Object.freeze({ create: create });
})(window);
