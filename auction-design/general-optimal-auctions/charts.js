(function (global) {
  "use strict";
  var S = SvgUtils.appendSvg, M = IroningModel;
  var frame = { width: 640, height: 360, left: 54, right: 614, top: 24, bottom: 316 };
  function x(v, chart) { var box = chart ? chart.frame : frame; return box.left + v * (box.right - box.left); }
  function y(v, domain) { return frame.bottom - (v - domain[0]) / (domain[1] - domain[0]) * (frame.bottom - frame.top); }
  function create(svg, domain, ticks, box) {
    box = box || frame;
    svg.dataset.yMin = domain[0]; svg.dataset.yMax = domain[1];
    var axes = S(svg, "g", { "class": "axes" });
    S(axes, "rect", { x: box.left, y: frame.top, width: box.right - box.left, height: frame.bottom - frame.top, "class": "plot-frame" });
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      S(axes, "line", { x1: box.left + v * (box.right - box.left), x2: box.left + v * (box.right - box.left), y1: frame.bottom, y2: frame.bottom + 5, "class": "plot-frame" });
      S(axes, "text", { x: box.left + v * (box.right - box.left), y: frame.bottom + 23, "text-anchor": "middle" }, String(v));
    });
    ticks.forEach(function (v) {
      var yy = y(v, domain);
      S(axes, "text", { x: box.left - 10, y: yy + 4, "text-anchor": "end" }, String(v));
      if (v === 0 && domain[0] < 0) { S(axes, "line", { x1: box.left, x2: box.right, y1: yy, y2: yy, "class": "zero-line" }); }
    });
    return { svg: svg, frame: box, domain: domain, axes: axes, layer: S(svg, "g", {}), handles: S(svg, "g", { "class": "control-points" }) };
  }
  function path(chart, fn, a, b, className, count, domain) {
    var d = "", steps = count || Math.max(4, Math.ceil((b - a) * 350));
    for (var i = 0; i <= steps; i += 1) {
      var v = a + (b - a) * i / steps, value = fn(v);
      d += (i ? "L" : "M") + x(v, chart).toFixed(4) + "," + y(value, domain || chart.domain).toFixed(4);
    }
    return S(chart.layer, "path", { d: d, "class": className });
  }
  function setDomain(chart, domain, ticks) {
    chart.domain = domain;
    chart.svg.dataset.yMin = domain[0]; chart.svg.dataset.yMax = domain[1];
    var labels = chart.axes.querySelectorAll("text");
    for (var i = 5; i < labels.length; i += 1) { labels[i].style.display = i - 5 < ticks.length ? "" : "none"; }
    ticks.forEach(function (value, i) {
      labels[5 + i].textContent = String(value);
      labels[5 + i].setAttribute("y", y(value, domain) + 4);
    });
    var zero = chart.axes.querySelector(".zero-line");
    if (zero) { zero.setAttribute("y1", y(0, domain)); zero.setAttribute("y2", y(0, domain)); }
  }
  function shade(chart, benchmark) {
    benchmark.pools.forEach(function (pool) {
      S(chart.layer, "rect", { x: x(pool.a), y: frame.top, width: x(pool.b) - x(pool.a),
        height: frame.bottom - frame.top, "class": "pool-shade" });
    });
  }
  function secondaryAxis(chart, domain) {
    if (!chart.secondary) { chart.secondary = S(chart.svg, "g", { "class": "secondary-axis" }); }
    chart.secondary.replaceChildren();
    chart.svg.dataset.y2Min = domain[0]; chart.svg.dataset.y2Max = domain[1];
    [domain[0], 0, domain[1]].forEach(function (value) {
      S(chart.secondary, "text", { x: chart.frame.right - 7, y: y(value, domain) + 4, "text-anchor": "end", "class": "annotation-halo" }, String(value));
    });
    S(chart.secondary, "line", { x1: chart.frame.left, x2: chart.frame.right, y1: y(0, domain), y2: y(0, domain), "class": "secondary-zero-line" });
  }
  function renderIntegrated(chart, d, solution) {
    if (chart.distribution && chart.distribution.split === d.split && chart.distribution.mass === d.mass) { return; }
    chart.layer.replaceChildren();
    var lower = Math.min(-1, Math.floor(-d.split / d.mass));
    var cuts = [0, d.mass, 1];
    // The minimum of H is at a branch virtual zero or a density boundary.
    var peak = Math.max.apply(null, [0, d.split, 1, d.split / (2 * d.mass), 0.5].map(function (v) {
      return -M.integratedVirtual(M.cdf(Math.min(1, v), d), d);
    }));
    var depth = Math.ceil(peak * 10) / 10, virtualDomain = [lower, 1];
    setDomain(chart, [-depth, 0], [-depth, -depth / 2, 0]);
    secondaryAxis(chart, virtualDomain);
    function rawVirtual(u, side) { return M.phi(u === d.mass ? d.split : M.quantile(u, d), d, side); }
    solution.intervals.forEach(function (p) {
      cuts.push(p.lower, p.upper);
      S(chart.layer, "rect", { x: x(p.lower, chart), y: frame.top, width: x(p.upper, chart) - x(p.lower, chart),
        height: frame.bottom - frame.top, "class": "pool-shade" });
    });
    cuts.sort(function (a, b) { return a - b; });
    cuts.slice(1).forEach(function (b, i) {
      var a = cuts[i];
      if (b <= a) { return; }
      path(chart, function (u) { return M.integratedVirtual(u, d); }, a, b, "integrated-curve");
    });
    solution.intervals.forEach(function (p) {
      path(chart, function (u) { return M.convexIntegrated(u, solution); }, p.lower, p.upper, "hull-curve", 1);
      path(chart, function () { return p.virtual; }, p.lower, p.upper, "ironed-virtual-curve", 1, virtualDomain);
    });
    path(chart, function (u) { return rawVirtual(u, "left"); }, 0, d.mass, "raw-curve", 1, virtualDomain);
    path(chart, function (u) { return rawVirtual(u, "right"); }, d.mass, 1, "raw-curve", 1, virtualDomain);
    if (d.mass !== d.split) {
      ["left", "right"].forEach(function (side) {
        S(chart.layer, "circle", { cx: x(d.mass, chart), cy: y(M.phi(d.split, d, side), virtualDomain),
          r: 4, "class": side === "left" ? "limit-open" : "limit-closed" });
      });
    }
    S(chart.layer, "text", { x: x(0.2, chart), y: Math.min(frame.bottom - 10, y(rawVirtual(0.2, "right"), virtualDomain) + 17),
      "class": "virtual-value-label annotation-halo" }, "φ ∘ F⁻¹");
    chart.distribution = d;
  }
  function select(chart, selected) {
    for (var i = 0; i < chart.handles.children.length; i += 1) {
      chart.handles.children[i].classList.toggle("selected", i === selected);
    }
  }
  function render(charts, rule, benchmark, selected) {
    ["allocation", "payment", "feasibility"].forEach(function (key) { charts[key].layer.replaceChildren(); });
    setDomain(charts.allocation, [0, 1], [0, 0.5, 1]);
    shade(charts.allocation, benchmark);
    rule.pieces.forEach(function (p) {
      path(charts.allocation, function (v) { return M.evaluatePiece(p, v).q; }, p.v0, p.v1, "learner-curve");
      path(charts.payment, function (v) { return M.evaluatePiece(p, v).payment; }, p.v0, p.v1, "learner-curve");
    });
    // Utility is continuous at a jump, so the payment jump is v times the Q jump.
    rule.points.slice(1).forEach(function (p, i) {
      var prev = rule.points[i];
      if (p.v === prev.v && p.q !== prev.q) {
        S(charts.allocation.layer, "line", { x1: x(p.v), x2: x(p.v), y1: y(prev.q, charts.allocation.domain), y2: y(p.q, charts.allocation.domain), "class": "jump-line" });
        var utility = M.evaluate(rule, p.v).utility;
        var left = y(p.v * prev.q - utility, charts.payment.domain), right = y(p.v * p.q - utility, charts.payment.domain);
        if (left !== right) {
          S(charts.payment.layer, "line", { x1: x(p.v), x2: x(p.v), y1: left, y2: right, "class": "jump-line" });
          S(charts.payment.layer, "circle", { cx: x(p.v), cy: left, r: 4, "class": "jump-limit limit-open" });
          S(charts.payment.layer, "circle", { cx: x(p.v), cy: right, r: 4, "class": "jump-limit limit-closed" });
        }
      }
    });
    renderIntegrated(charts.integrated, rule.distribution, benchmark.ironing);
    var feasibility = rule.feasibility;
    setDomain(charts.feasibility, [0, rule.n], [0, rule.n / 2, rule.n]);
    var masses = [0, 1, 1 - feasibility.witness.u];
    feasibility.segments.forEach(function (p) { masses.push(1 - p.u0, 1 - p.u1); });
    masses = masses.sort(function (a, b) { return a - b; }).filter(function (value, i, all) { return !i || value !== all[i - 1]; });
    // Keep analytic knots and the exact witness in the displayed curves too.
    masses.slice(1).forEach(function (b, i) {
      path(charts.feasibility, function (mass) { return rule.n * M.tailAt(feasibility, 1 - mass); }, masses[i], b, "learner-curve");
      path(charts.feasibility, function (mass) { return 1 - Math.pow(1 - mass, rule.n); }, masses[i], b, "capacity-curve");
    });
    if (!feasibility.feasible) {
      var mass = 1 - feasibility.witness.u;
      S(charts.feasibility.layer, "circle", { cx: x(mass), cy: y(rule.n * M.tailAt(feasibility, 1 - mass), charts.feasibility.domain), r: 5, "class": "violation-dot" });
    }
    var parent = charts.allocation.handles;
    while (parent.children.length > rule.points.length) { parent.lastChild.remove(); }
    rule.points.forEach(function (p, i) {
      var handle = parent.children[i];
      if (!handle) {
        handle = S(parent, "g", { tabindex: "0", role: "slider", "data-index": i, "aria-valuemin": "0", "aria-valuemax": "1", "aria-describedby": "point-help" });
        S(handle, "circle", { r: 22, "class": "handle-target" });
        S(handle, "circle", { r: 6, "class": "handle-dot" });
      }
      handle.setAttribute("data-index", i);
      handle.setAttribute("transform", "translate(" + x(p.v) + "," + y(p.q, charts.allocation.domain) + ")");
      handle.setAttribute("aria-label", "Control point " + (i + 1));
      handle.setAttribute("aria-valuenow", p.q);
      var side = i < rule.points.length - 1 && p.v === rule.points[i + 1].v ? "; left limit" :
        (i > 0 && p.v === rule.points[i - 1].v ? "; right-continuous value" : "");
      handle.setAttribute("aria-valuetext", "Value " + p.v.toFixed(3) + ", allocation " + p.q.toFixed(3) + side);
    });
    select(charts.allocation, selected);
  }
  function pointer(svg, event) {
    var point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    var local = point.matrixTransform(svg.getScreenCTM().inverse());
    return { v: (local.x - frame.left) / (frame.right - frame.left),
      q: Number(svg.dataset.yMin) + (frame.bottom - local.y) / (frame.bottom - frame.top) * (Number(svg.dataset.yMax) - Number(svg.dataset.yMin)) };
  }
  function density(svg, d) {
    svg.setAttribute("width", "320"); svg.setAttribute("height", "120");
    svg.setAttribute("viewBox", "0 0 320 120");
    var layer = svg.querySelector(".density-layer");
    if (!layer) { layer = S(svg, "g", { "class": "density-layer" }); }
    layer.replaceChildren();
    var left = 14, right = 306, top = 9, bottom = 91;
    var max = Math.max(d.lowerDensity, d.upperDensity);
    function xx(v) { return left + v * (right - left); }
    function yy(f) { return bottom - f / max * (bottom - top); }
    [[0, d.split, d.lowerDensity], [d.split, 1, d.upperDensity]].forEach(function (p) {
      S(layer, "rect", { x: xx(p[0]), y: yy(p[2]), width: xx(p[1]) - xx(p[0]), height: bottom - yy(p[2]), "class": "density-area value-pdf-area" });
    });
    S(layer, "line", { x1: left, x2: right, y1: bottom, y2: bottom, "class": "value-pdf-axis" });
    S(layer, "path", { d: "M" + left + "," + yy(d.lowerDensity) + "H" + xx(d.split) + "V" + yy(d.upperDensity) + "H" + right, "class": "value-pdf-curve" });
    [0, 1].forEach(function (v) {
      S(layer, "line", { x1: xx(v), x2: xx(v), y1: bottom - 4, y2: bottom + 4, "class": "value-pdf-axis" });
      S(layer, "text", { x: xx(v), y: 108, "text-anchor": v ? "end" : "start", "class": "value-pdf-endpoint-label", "data-endpoint": v ? "b" : "a" }, v ? "b = 1" : "a = 0");
    });
    document.getElementById("value-pdf-preview-description").textContent = "Piecewise-uniform density " + d.lowerDensity.toFixed(4) + " below value " +
      d.split.toFixed(4) + ", and " + d.upperDensity.toFixed(4) + " above it. Lower-interval probability " + d.mass.toFixed(4) + ".";
  }
  global.IroningCharts = Object.freeze({ create: create, render: render, select: select, density: density, pointer: pointer, frame: frame });
})(window);
