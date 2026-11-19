(function (global) {
  "use strict";
  var M = IroningModel;
  var resizeFrame = 0;
  var latestRender = null;
  function S(parent, name, attributes, text) {
    var node = SvgUtils.appendSvg(parent, name, attributes, text);
    if (name === "text" && typeof text === "string") { ChartLayout.mathText(node, text); }
    return node;
  }
  var frame = { width: 640, height: 360, left: 54, right: 614, top: 24, bottom: 316 };
  function x(v, chart) { var box = chart ? chart.frame : frame; return box.left + v * (box.right - box.left); }
  function y(v, domain) { return frame.bottom - (v - domain[0]) / (domain[1] - domain[0]) * (frame.bottom - frame.top); }
  function create(svg, domain, ticks, box) {
    box = box || frame;
    svg.dataset.yMin = domain[0]; svg.dataset.yMax = domain[1];
    var axes = S(svg, "g", { "class": "axes" });
    S(axes, "rect", { x: box.left, y: frame.top, width: box.right - box.left, height: frame.bottom - frame.top, "class": "plot-frame" });
    PlotStyle.axis(axes, { orientation: "x", frame: box, domain: [0, 1] });
    var yAxis = PlotStyle.axis(axes, { orientation: "y", frame: box, domain: domain, grid: true });
    return { svg: svg, frame: box, domain: domain, axes: axes, yAxis: yAxis,
      layer: S(svg, "g", {}), handles: S(svg, "g", { "class": "control-points" }) };
  }
  function path(chart, fn, a, b, className, count, domain) {
    var scale = PlotStyle.dimensions(chart.svg, chart.frame).width / (chart.frame.right - chart.frame.left);
    function evaluate(v) { return { v: v, value: fn(v) }; }
    var points = count === 1 ? [evaluate(a), evaluate(b)] : PlotStyle.adaptive(evaluate, function (p) {
      return [[x(p.v, chart) * scale, y(p.value, domain || chart.domain) * scale]];
    }, a, b);
    var d = points.map(function (p, i) {
      return (i ? "L" : "M") + x(p.v, chart).toFixed(4) + "," + y(p.value, domain || chart.domain).toFixed(4);
    }).join("");
    return S(chart.layer, "path", { d: d, "class": className });
  }
  function setDomain(chart, domain, ticks) {
    chart.domain = domain;
    chart.svg.dataset.yMin = domain[0]; chart.svg.dataset.yMax = domain[1];
    chart.yAxis.update(domain);
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
    PlotStyle.axis(chart.secondary, { orientation: "right", frame: chart.frame, domain: domain });
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
    chart.distribution = d;
  }
  function select(chart, selected) {
    for (var i = 0; i < chart.handles.children.length; i += 1) {
      chart.handles.children[i].classList.toggle("selected", i === selected);
    }
  }
  function renderFeasibility(chart, rule) {
    setDomain(chart, [0, rule.n], [0, rule.n / 2, rule.n]);
    if (chart.thresholdRule !== rule) {
      chart.thresholds = M.feasibilityThresholds(rule).filter(Number.isFinite);
      chart.thresholdRule = rule;
    }
    var check = rule.feasibility, cuts = chart.thresholds;
    var scale = PlotStyle.dimensions(chart.svg, chart.frame).width / (chart.frame.right - chart.frame.left);
    function violates(level) { return rule.n * (level.allocation - level.capacity) > M.tolerance; }
    // Analytic cuts keep each path on one side of capacity, including narrow violations.
    cuts.slice(1).forEach(function (b, index) {
      var a = cuts[index], demand = "", capacity = "";
      if (b <= a) { return; }
      var points = PlotStyle.adaptive(function (alpha) {
        return { alpha: alpha, level: M.levelAt(rule, alpha, alpha === a ? "right" : undefined) };
      }, function (p) {
        return ["allocation", "capacity"].map(function (key) {
          return [x(p.alpha, chart) * scale, y(rule.n * p.level[key], chart.domain) * scale];
        });
      }, a, b);
      points.forEach(function (p, i) {
        var level = p.level;
        var prefix = (i ? "L" : "M") + x(p.alpha, chart).toFixed(4) + ",";
        demand += prefix + y(rule.n * level.allocation, chart.domain).toFixed(4);
        capacity += prefix + y(rule.n * level.capacity, chart.domain).toFixed(4);
      });
      var midpoint = M.levelAt(rule, (a + b) / 2);
      S(chart.layer, "path", { d: demand, "class": "learner-curve" + (violates(midpoint) ? " violation-curve" : ""),
        "data-alpha-start": a, "data-alpha-end": b });
      S(chart.layer, "path", { d: capacity, "class": "capacity-curve" });
    });
    cuts.forEach(function (alpha) {
      var included = M.levelAt(rule, alpha), excluded = M.levelAt(rule, alpha, "right");
      ["allocation", "capacity"].forEach(function (key) {
        var className = "feasibility-limit " + (key === "allocation" ? "demand-limit" : "capacity-limit");
        var includedClass = className + (key === "allocation" && violates(included) ? " violation-limit" : "");
        var excludedClass = className + (key === "allocation" && violates(excluded) ? " violation-limit" : "");
        if (alpha < 1 && Math.abs(included[key] - excluded[key]) > 1e-12) {
          S(chart.layer, "circle", { cx: x(alpha, chart), cy: y(rule.n * excluded[key], chart.domain), r: 3.5, "class": excludedClass + " limit-open" });
          S(chart.layer, "circle", { cx: x(alpha, chart), cy: y(rule.n * included[key], chart.domain), r: 3.5, "class": includedClass + " limit-closed" });
        } else if (alpha === 1 && included.mass > 0) {
          S(chart.layer, "circle", { cx: x(alpha, chart), cy: y(rule.n * included[key], chart.domain), r: 3.5, "class": includedClass + " limit-closed" });
        }
      });
    });
    chart.witness = null;
    if (!check.feasible) {
      var alpha = clampLevel(check.witness.q), level = M.levelAt(rule, alpha), side = "included";
      var right = M.levelAt(rule, alpha, "right");
      if (alpha < 1 && right.allocation - right.capacity > level.allocation - level.capacity) { level = right; side = "right"; }
      chart.witness = { alpha: alpha, side: side, excess: rule.n * (level.allocation - level.capacity) };
    }
  }
  function clampLevel(value) { return Math.max(0, Math.min(1, value)); }
  function render(charts, rule, benchmark, selected) {
    latestRender = { charts: charts, rule: rule, benchmark: benchmark, selected: selected };
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
    renderFeasibility(charts.feasibility, rule);
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
      handle.setAttribute("aria-valuetext", "Value v_i " + p.v.toFixed(3) + ", allocation Q_i(v_i) " + p.q.toFixed(3) + side);
    });
    select(charts.allocation, selected);
    bindProbes(charts, rule, benchmark.ironing);
    Object.keys(charts).forEach(function (key) {
      PlotStyle.watchResize(charts[key].svg, "curves", function () {
        if (resizeFrame) { cancelAnimationFrame(resizeFrame); }
        resizeFrame = requestAnimationFrame(function () {
          resizeFrame = 0;
          var latest = latestRender;
          latest.charts.integrated.distribution = null;
          render(latest.charts, latest.rule, latest.benchmark, latest.selected);
        });
      });
    });
  }
  function bindProbes(charts, rule, solution) {
    var P = window.PlotProbe, sym = P.symbol, d = rule.distribution;
    ["allocation", "payment"].forEach(function (key) {
      var chart = charts[key], field = key === "allocation" ? "q" : "payment";
      P.attach(chart.svg, { editable: key === "allocation", views: function () { return [{ id: key, name: "Value",
        frame: chart.frame, domain: [0, 1], yDomain: chart.domain, input: [sym("v", "i")], knots: rule.points.map(function (p) { return p.v; }),
        sample: function (v) {
          var value = M.evaluate(rule, v)[field];
          var rows = [{ key: key, label: key === "allocation" ? "Interim allocation" : "Interim payment", notation: P.expression(key === "allocation" ? "Q" : "P", "i", "v"), value: value, color: "var(--blue)" }];
          var left = rule.pieces.find(function (p) { return p.v1 === v; });
          if (left) {
            var limit = M.evaluatePiece(left, v)[field];
            if (Math.abs(limit - value) > 1e-10) { rows.push(Object.assign({}, rows[0], { key: key + "-left", value: limit, open: true, side: "left limit" })); }
          }
          return rows;
        } }]; } });
    });
    var integrated = charts.integrated;
    P.attach(integrated.svg, { views: function () { return [{ id: "integrated", name: "Quantile", frame: integrated.frame,
      domain: [0, 1], yDomain: integrated.domain, input: [sym("z")], knots: solution.intervals.reduce(function (cuts, p) { return cuts.concat([p.lower, p.upper]); }, [0, d.mass, 1]),
      sample: function (u) {
        var v = u === d.mass ? d.split : M.quantile(u, d);
        var rightDomain = [Number(integrated.svg.dataset.y2Min), Number(integrated.svg.dataset.y2Max)];
        var rows = [{ key: "integrated", label: "Integrated value", notation: P.expression("H", "i", "z", ""), value: M.integratedVirtual(u, d), color: "var(--ink)" },
          { key: "virtual", label: "Virtual value", notation: P.expression("h", "i", "z", ""), value: M.phi(v, d), color: "var(--muted)", domain: rightDomain }];
        if (u === d.mass && d.mass !== d.split) { rows.push(Object.assign({}, rows[1], { key: "virtual-left", value: M.phi(d.split, d, "left"), open: true, side: "left limit" })); }
        var pool = solution.intervals.find(function (p) { return u >= p.lower && u <= p.upper; });
        if (pool) {
          rows.push({ key: "convex", label: "Convex lower bound", notation: P.expression("G", "i", "z", ""), value: M.convexIntegrated(u, solution), color: "var(--orange)" });
          rows.push({ key: "ironed", label: "Ironed value", notation: P.expression("g", "i", "z", ""), value: pool.virtual, color: "var(--orange)", domain: rightDomain });
        }
        return rows;
      } }]; } });
    var feasibility = charts.feasibility;
    var demand = P.expression("A", "i", "α", "");
    var capacity = P.expression("C", "i", "α", "");
    P.attach(feasibility.svg, { views: function () { return [{ id: "feasibility", name: "Allocation threshold", frame: feasibility.frame,
      domain: [0, 1], yDomain: feasibility.domain, input: [sym("α")], knots: feasibility.thresholds,
      sample: function (a) {
        var included = M.levelAt(rule, a), right = M.levelAt(rule, a, "right"), rows = [];
        function add(level, suffix) {
          var color = rule.n * (level.allocation - level.capacity) > M.tolerance ? "var(--red)" : "var(--blue)";
          rows.push({ key: "demand" + suffix, label: "Total allocation probability in E_alpha", notation: demand, value: rule.n * level.allocation, color: color, open: Boolean(suffix), side: suffix ? "right limit" : "" });
          rows.push({ key: "capacity" + suffix, label: "Total value probability in E_alpha", notation: capacity, value: rule.n * level.capacity, color: "var(--ink)", open: Boolean(suffix), side: suffix ? "right limit" : "" });
        }
        add(included, "");
        if (a < 1 && (Math.abs(included.allocation - right.allocation) > 1e-10 || Math.abs(included.capacity - right.capacity) > 1e-10)) { add(right, "-right"); }
        return rows;
      } }]; } });
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
      S(layer, "text", { x: xx(v), y: 108, "text-anchor": v ? "end" : "start", "class": "value-pdf-endpoint-label", "data-endpoint": v ? "b" : "a" }, v ? "vᵢ = 1" : "vᵢ = 0");
    });
    document.getElementById("value-pdf-preview-description").textContent = "Piecewise-uniform density f_i(v_i), " + d.lowerDensity.toFixed(4) + " below value v_i = " +
      d.split.toFixed(4) + ", and " + d.upperDensity.toFixed(4) + " above it. Lower-interval probability " + d.mass.toFixed(4) + ".";
    ChartLayout.refresh(svg);
    PlotProbe.attach(svg, { views: function () { return [{ id: "value-density", name: "Value", frame: { left: left, right: right, top: top, bottom: bottom },
      domain: [0, 1], yDomain: [0, max], input: [PlotProbe.symbol("v", "i")], knots: [0, d.split, 1], sample: function (v) {
        var rows = [{ key: "density", label: "Value density", notation: PlotProbe.expression("f", "i", "v"), value: M.pdf(v, d), color: "var(--blue)" }];
        if (v === d.split && d.lowerDensity !== d.upperDensity) { rows.push(Object.assign({}, rows[0], { key: "density-left", value: M.pdf(v, d, "left"), open: true, side: "left limit" })); }
        return rows;
      } }]; } });
  }
  global.IroningCharts = Object.freeze({ create: create, render: render, select: select, density: density, pointer: pointer, frame: frame });
})(window);
