(function () {
  "use strict";
  var T = MechanismTest, assert = T.assert, close = T.assertClose, frame = document.getElementById("app-frame");
  var doc, win, tests = [];
  function el(id) { return doc.getElementById(id); }
  function revenue() { return Number(el("revenue-value").dataset.value); }
  function input(id, value) { el(id).value = value; T.dispatch(el(id), "input", win); }
  function choose(i) { handle(i).focus(); }
  function handle(i) { return el("allocation-chart").querySelector('[data-index="' + i + '"]'); }
  function finiteGeometry() {
    doc.querySelectorAll("svg:not(mjx-container svg) path[d], .control-points g").forEach(function (p) {
      assert(!/NaN|Infinity/.test(p.getAttribute("d") || p.getAttribute("transform") || ""), "Finite geometry");
    });
  }
  async function fresh() {
    frame.style.width = "1280px";
    var loaded = new Promise(function (resolve) { frame.onload = resolve; });
    frame.src = "../auctions/ironing/index.html?test=" + Math.random();
    await loaded; doc = frame.contentDocument; win = frame.contentWindow;
    await T.waitFor(function () { return doc.body.dataset.ready === "true" && !!doc.querySelector("#distribution-controls mjx-container"); }, 15000);
  }
  function test(name, run) { tests.push({ name: name, run: async function () { await fresh(); await run(); } }); }
  function captureStub() {
    var svg = el("allocation-chart"), captured = null;
    svg.setPointerCapture = function (id) { captured = id; };
    svg.hasPointerCapture = function (id) { return id === captured; };
    svg.releasePointerCapture = function () { captured = null; };
  }
  function pointer(target, type, v, q) {
    var svg = el("allocation-chart"), p = svg.createSVGPoint();
    p.x = 54 + 560 * v; p.y = 316 - 292 * q; p = p.matrixTransform(svg.getScreenCTM());
    T.dispatch(target, type, win, { pointerId: 17, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: p.x, clientY: p.y });
  }
  test("Local dependencies and interim editor replace the ex-post lottery grid", function () {
    T.assertScriptOrder(doc, ["../../js/components.js", "../../js/bibliography.js", "../../js/references.js", "../../js/mathjax-config.js",
      "../../assets/mathjax/tex-svg.js", "../../js/mathjax-runtime.js", "../../js/math-utils.js", "../../js/svg-utils.js", "model.js", "charts.js", "app.js"]);
    assert(!el("lottery-chart") && doc.querySelectorAll(".control-points [role=slider]").length === 11);
    assert(win.IroningModel && !win.OptimalAuctionsModel, "The two auction models have isolated namespaces");
    assert(doc.getElementById("page-title").textContent === "Ironing" &&
      doc.querySelector("page-header").getAttribute("category") === "Auctions", "Independent auction title and category");
    assert(el("bic-status").dataset.passed === "true" && el("feasibility-status").dataset.passed === "true");
    assert(el("bic-verdict").textContent === "BIC: passes" && el("bic-monotonicity").textContent === "is weakly increasing");
    assert(el("feasibility-status").textContent === "Feasibility: passes (all capacity constraints hold)");
    assert(el("feasibility-chart").closest("figure").querySelector("figcaption").textContent.includes("allocation demand and capacity"));
    assert(revenue() > 0 && !el("benchmark-summary"));
    assert(doc.querySelectorAll("merror").length === 0);
    assert(doc.querySelector('[data-reference="border-1991"]').textContent.includes("1991"));
  });
  test("Editing Q updates payments, revenue, and IC immediately", function () {
    var original = revenue(), payment = el("payment-chart").querySelector(".learner-curve").getAttribute("d");
    choose(0); input("allocation-number", "0.9");
    assert(el("bic-status").dataset.passed === "false");
    assert(el("bic-verdict").textContent === "BIC: fails" && el("bic-monotonicity").textContent === "is not weakly increasing");
    assert(el("revenue-label").textContent === "Candidate revenue");
    assert(revenue() !== original && el("payment-chart").querySelector(".learner-curve").getAttribute("d") !== payment);
    assert(el("payment-caption").textContent.includes("Candidate"));
    finiteGeometry();
  });
  test("Number and range controls synchronize and clamp to probability bounds", function () {
    choose(5); input("allocation-number", "4");
    close(Number(el("allocation-number").value), 1); close(Number(el("allocation-range").value), 1);
    input("allocation-number", "-2"); close(Number(el("allocation-range").value), 0);
    input("allocation-range", "0.25"); close(Number(el("allocation-number").value), 0.25);
    assert(el("allocation-range").getAttribute("aria-valuetext").includes("0.250"));
    input("allocation-number", "0.123456");
    assert(el("allocation-number").value === "0.123", "Displayed allocation rounds to three decimals");
    close(Number(handle(5).getAttribute("aria-valuenow")), 0.123456, 1e-12, "Display rounding preserves the exact allocation");
    input("value-number", "0.512345");
    assert(el("value-number").value === "0.512", "Displayed value rounds to three decimals");
    choose(0); assert(el("value-number").disabled && el("value-range").disabled);
    choose(10); assert(el("value-number").disabled);
  });
  test("Invalid fields preserve the last finite rule and raise an alert", function () {
    var before = revenue(); input("allocation-number", "");
    assert(el("control-error").getAttribute("role") === "alert" && el("control-error").textContent);
    close(revenue(), before); finiteGeometry();
    input("allocation-number", "0.35"); assert(!el("control-error").textContent);
  });
  test("Committing an invalid number restores its value and clears the resolved alert", function () {
    ["allocation", "value", "split", "mass"].forEach(function (prefix) {
      var field = el(prefix + "-number"), before = field.value, total = revenue();
      var error = el(prefix === "split" || prefix === "mass" ? "distribution-error" : "control-error");
      input(field.id, ""); assert(error.textContent);
      T.dispatch(field, "change", win);
      assert(field.value === before && !error.textContent, "Restored " + prefix + " is no longer invalid");
      close(revenue(), total, 1e-12);
    });
  });
  test("Clamped actions preserve the exact loaded optimum until a point actually changes", function () {
    input("bidder-number", "5"); el("use-optimum").click();
    var optimum = win.IroningModel.benchmark(5), before = sampleChart("allocation-chart", 0.74);
    choose(0);
    ["ArrowLeft", "ArrowRight", "ArrowDown", "Home"].forEach(function (key) {
      T.dispatch(handle(0), "keydown", win, { key: key });
      close(revenue(), optimum.revenue, 1e-12);
      close(sampleChart("allocation-chart", 0.74), before, 1e-12);
      assert(el("interpolation-kind").textContent.startsWith("Exact optimal curves"));
      assert(el("feasibility-status").dataset.passed === "true");
    });
    choose(2); // The right side of the reserve jump is already at its left bound.
    T.dispatch(handle(2), "keydown", win, { key: "ArrowLeft" });
    close(revenue(), optimum.revenue, 1e-12);
    T.dispatch(handle(2), "keydown", win, { key: "ArrowUp" });
    assert(el("interpolation-kind").textContent === "Interpolation: linear in value.");
    assert(Math.abs(revenue() - optimum.revenue) > 1e-6);
  });
  test("Keyboard edits follow their target handle when loading a rule changes the selection", function () {
    choose(0); input("bidder-number", "5"); el("use-optimum").click();
    assert(Number(el("allocation-chart").dataset.selectedIndex) !== 0);
    T.dispatch(handle(0), "keydown", win, { key: "ArrowRight" });
    assert(Number(el("allocation-chart").dataset.selectedIndex) === 0, "The key target becomes the selected point");
    assert(handle(0).classList.contains("selected"), "The visible selection follows the key target");
    close(revenue(), win.IroningModel.benchmark(5).revenue, 1e-12);
    T.dispatch(handle(0), "keydown", win, { key: "ArrowUp" });
    close(Number(handle(0).getAttribute("aria-valuenow")), 0.002, 1e-12);
  });
  test("Horizontal motion changes the value knots and is bounded by neighbors", function () {
    choose(5); var before = revenue();
    input("value-number", "0.54"); close(Number(el("value-range").value), 0.54);
    assert(revenue() !== before);
    input("value-number", "0.9"); close(Number(el("value-number").value), 0.6);
    assert(el("allocation-chart").querySelector(".jump-line"), "Equal neighboring values create an actual jump");
    finiteGeometry();
  });
  test("Every direct manipulation has a keyboard equivalent", function () {
    var h = handle(5); h.focus();
    var q = Number(el("allocation-number").value), v = Number(el("value-number").value);
    T.dispatch(h, "keydown", win, { key: "ArrowUp" }); close(Number(el("allocation-number").value), q + 0.002, 1e-6);
    T.dispatch(h, "keydown", win, { key: "ArrowLeft", shiftKey: true }); close(Number(el("value-number").value), v - 0.02, 1e-6);
    T.dispatch(h, "keydown", win, { key: "Home" }); close(Number(el("allocation-number").value), 0);
    T.dispatch(h, "keydown", win, { key: "End" }); close(Number(el("allocation-number").value), 1);
    handle(2).focus(); assert(Number(el("allocation-chart").dataset.selectedIndex) === 2);
    assert(handle(2).hasAttribute("aria-valuetext") && handle(2).getAttribute("aria-describedby") === "point-help");
  });
  test("Pointer drags move both coordinates and clamp beyond the chart", function () {
    captureStub(); pointer(handle(5).querySelector("circle"), "pointerdown", 0.5, 0.5);
    pointer(el("allocation-chart"), "pointermove", 0.53, 0.32);
    close(Number(el("value-number").value), 0.53, 1e-6); close(Number(el("allocation-number").value), 0.32, 1e-6);
    pointer(el("allocation-chart"), "pointermove", 2, -1);
    close(Number(el("value-number").value), 0.6, 1e-6); close(Number(el("allocation-number").value), 0, 1e-6);
    pointer(el("allocation-chart"), "pointerup", 2, -1); finiteGeometry();
  });
  test("Pointer cancellation and Reset stop an active edit", function () {
    captureStub(); pointer(handle(5), "pointerdown", 0.5, 0.5);
    pointer(el("allocation-chart"), "pointercancel", 0.5, 0.5);
    var before = revenue(); pointer(el("allocation-chart"), "pointermove", 0.55, 0.1); close(revenue(), before);
    pointer(handle(5), "pointerdown", 0.5, 0.5); el("reset-button").click();
    pointer(el("allocation-chart"), "pointermove", 0.55, 0.1); close(revenue(), before);
  });
  test("Other controls and Escape release pointer capture and stop the previous drag", function () {
    var svg = el("allocation-chart"); captureStub();
    [function () { T.dispatch(handle(5), "keydown", win, { key: "Escape" }); },
      function () { input("mass-number", "0.6"); },
      function () { input("bidder-number", "3"); },
      function () { input("allocation-number", "0.4"); },
      function () { el("add-point").click(); },
      function () { el("remove-point").click(); },
      function () { el("reset-button").click(); },
      function () { el("use-optimum").click(); }
    ].forEach(function (action) {
      el("reset-button").click(); choose(5);
      pointer(handle(5), "pointerdown", 0.5, 0.5);
      assert(svg.hasPointerCapture(17)); action();
      assert(!svg.hasPointerCapture(17), "Cancellation releases capture");
      var before = revenue();
      pointer(svg, "pointermove", 0.55, 0.1); close(revenue(), before, 1e-12);
    });
  });
  test("Payment jumps show both envelope limits and right-continuous ownership", function () {
    input("bidder-number", "4"); el("use-optimum").click();
    var M = win.IroningModel, optimum = M.benchmark(4), rule = M.adoptedRule(optimum, 4);
    var points = M.optimalPoints(optimum), jumps = el("payment-chart").querySelectorAll(".jump-line");
    assert(jumps.length === 3, "Reserve and both pooling boundaries retain payment jumps");
    var jumpIndex = 0;
    points.slice(1).forEach(function (point, i) {
      if (point.v !== points[i].v) { return; }
      var utility = M.evaluate(rule, point.v).utility, line = jumps[jumpIndex++];
      close(Number(line.getAttribute("x1")), 54 + 560 * point.v, 1e-9);
      close(Number(line.getAttribute("y1")), 316 - 146 * (points[i].v * points[i].q - utility + 1), 1e-9);
      close(Number(line.getAttribute("y2")), 316 - 146 * (point.v * point.q - utility + 1), 1e-9);
    });
    assert(el("payment-chart").querySelectorAll(".jump-limit.limit-open").length === 3);
    assert(el("payment-chart").querySelectorAll(".jump-limit.limit-closed").length === 3);
    assert(el("payment-description").textContent.includes("right-continuous"));
    assert(handle(1).getAttribute("aria-valuetext").includes("left limit"));
    assert(handle(2).getAttribute("aria-valuetext").includes("right-continuous"));
    finiteGeometry();
  });
  test("The feasibility demand path includes every analytic knot and its exact violation witness", function () {
    input("bidder-number", "4"); el("use-optimum").click(); input("mass-number", "0.62");
    var M = win.IroningModel, rule = M.adoptedRule(M.benchmark(4), 4, M.distribution(0.5, 0.62));
    var vertices = Array.from(el("feasibility-chart").querySelectorAll(".learner-curve")).flatMap(function (path) {
      var values = path.getAttribute("d").match(/-?\d+(?:\.\d+)?/g).map(Number), result = [];
      for (var i = 0; i < values.length; i += 2) { result.push([values[i], values[i + 1]]); }
      return result;
    });
    var cuts = rule.feasibility.segments.map(function (piece) { return piece.u0; });
    assert(!rule.feasibility.feasible); cuts.push(rule.feasibility.witness.u, 1);
    cuts.forEach(function (u) {
      var x = 54 + 560 * (1 - u), y = 316 - 292 * M.tailAt(rule.feasibility, u);
      assert(vertices.some(function (vertex) { return Math.abs(vertex[0] - x) < 0.0001 && Math.abs(vertex[1] - y) < 0.0001; }),
        "The demand curve includes quantile " + u);
    });
  });
  test("Adding an interpolated point preserves the rule; removing restores it", function () {
    var before = revenue(), count = el("allocation-chart").querySelectorAll("[data-index]").length;
    el("add-point").click(); assert(el("allocation-chart").querySelectorAll("[data-index]").length === count + 1);
    close(revenue(), before, 1e-11);
    el("remove-point").click(); assert(el("allocation-chart").querySelectorAll("[data-index]").length === count);
    close(revenue(), before, 1e-11);
    choose(0); assert(el("remove-point").disabled);
  });
  test("Ironing is always visible without replacing the learner's rule", function () {
    var before = revenue(), curve = el("allocation-chart").querySelector(".learner-curve").getAttribute("d");
    assert(!el("compare-optimum"));
    close(revenue(), before);
    assert(el("allocation-chart").querySelector(".learner-curve").getAttribute("d") === curve);
    assert(!el("allocation-chart").querySelector(".benchmark-curve") && !el("payment-chart").querySelector(".benchmark-curve"));
    assert(el("allocation-chart").querySelector(".pool-shade") && el("integrated-chart").querySelector(".hull-curve"));
    assert(el("integrated-chart").querySelector(".ironed-virtual-curve"));
    assert(el("pool-summary").textContent.includes("0.4390") && el("pool-summary").textContent.includes("0.6057"));
    var interval = win.IroningModel.ironing().intervals[0], diagnostic = el("pool-summary");
    assert(diagnostic.textContent === "Optimal ironing quantile: [" + interval.lower.toFixed(4) + ", " + interval.upper.toFixed(4) +
      "] (corresponds to [" + interval.a.toFixed(4) + ", " + interval.b.toFixed(4) + "] on value axis)");
    assert(!diagnostic.hidden && !diagnostic.classList.contains("sr-only") && diagnostic.closest("figure") === el("integrated-chart").closest("figure"));
    var orange = doc.createElement("span"); orange.style.color = "var(--orange)"; doc.body.appendChild(orange);
    assert(win.getComputedStyle(diagnostic).color === win.getComputedStyle(orange).color); orange.remove();
  });
  test("Bidder changes preserve the chosen Q and update capacity and the optimum", function () {
    input("bidder-number", "4");
    assert(Number(el("bidder-number").value) === 4);
    assert(el("feasibility-status").dataset.passed === "false", "The former two-bidder allocation is infeasible with four bidders");
    assert(el("feasibility-status").textContent === "Feasibility: fails (allocation exceeds capacity)");
    el("reset-button").click();
    assert(el("bic-status").dataset.passed === "true" && el("feasibility-status").dataset.passed === "true");
  });
  test("Supply-infeasible rules retain candidate revenue labels with ironing shown", function () {
    for (var i = 0; i < 11; i += 1) { choose(i); input("allocation-number", "1"); }
    assert(el("bic-status").dataset.passed === "true" && el("feasibility-status").dataset.passed === "false");
    assert(el("revenue-label").textContent.includes("Candidate"));
    assert(el("revenue-label").textContent.includes("Candidate") && !el("revenue-gap"));
  });
  test("All responsive layouts fit and reserve at least 14px of chart padding", async function () {
    for (var width of [320, 375, 768, 1280]) {
      frame.style.width = width + "px"; await T.nextAnimationFrames(win, 3);
      assert(doc.documentElement.scrollWidth <= width + 1, "No page overflow at " + width);
      var plots = doc.querySelector(".ironing-plots").getBoundingClientRect();
      var controls = doc.querySelector(".ironing-controls").getBoundingClientRect();
      if (width > 1050) { assert(controls.left >= plots.right, "Controls occupy the right sidebar"); }
      else { assert(controls.top >= plots.bottom - 1, "Sidebar stacks below the plots"); }
      assert(doc.querySelector(".ironing-controls").contains(el("value-pdf-preview")), "Density preview stays with the controls");
      doc.querySelectorAll(".chart-640x360, #value-pdf-preview").forEach(function (svg) {
        var viewport = svg.closest(".chart-viewport").getBoundingClientRect();
        var box = svg.querySelector("rect.plot-frame, .value-pdf-curve").getBoundingClientRect();
        assert(box.top - viewport.top >= 13.9, "Top padding around the plotted content");
        var label = svg.closest(".chart-viewport").querySelector(".chart-axis-label");
        var bottom = label ? label.getBoundingClientRect().bottom : Math.max.apply(null,
          Array.from(svg.querySelectorAll(".value-pdf-endpoint-label")).map(function (text) { return text.getBoundingClientRect().bottom; }));
        assert(viewport.bottom - bottom >= 13.9, "Bottom padding around labels");
      });
      finiteGeometry();
    }
    frame.style.width = "1280px"; doc.body.style.zoom = "2";
    await T.nextAnimationFrames(win, 3);
    assert(doc.documentElement.scrollWidth <= win.innerWidth + 1, "Parameter controls fit at 200% scale");
    doc.body.style.zoom = "1";
  });
  test("Data edits, comparison, and typesetting preserve all chart bounds", async function () {
    var before = Array.from(doc.querySelectorAll(".chart-640x360, #value-pdf-preview")).map(function (svg) {
      var b = svg.getBoundingClientRect(); return [b.x, b.y, b.width, b.height];
    });
    input("allocation-number", "0.7"); input("split-number", "0.9"); input("mass-number", "0.1");
    await win.mechanismMathReady; await T.nextAnimationFrames(win, 2);
    Array.from(doc.querySelectorAll(".chart-640x360, #value-pdf-preview")).forEach(function (svg, i) {
      var b = svg.getBoundingClientRect(); [b.x, b.y, b.width, b.height].forEach(function (x, j) { close(x, before[i][j], 0.1); });
    });
  });
  function sampleChart(id, v, selector) {
    var target = 54 + 560 * v;
    var paths = Array.from(el(id).querySelectorAll(selector || ".learner-curve"));
    var path = paths.find(function (p) { var b = p.getBBox(); return target >= b.x - 0.001 && target <= b.x + b.width + 0.001; });
    assert(path, "Curve covers the probe value");
    var lo = 0, hi = path.getTotalLength();
    for (var i = 0; i < 35; i += 1) {
      var mid = (lo + hi) / 2;
      if (path.getPointAtLength(mid).x < target) { lo = mid; } else { hi = mid; }
    }
    var yy = path.getPointAtLength((lo + hi) / 2).y;
    var secondary = id === "integrated-chart" && (selector === ".raw-curve" || selector === ".ironed-virtual-curve");
    var lower = Number(el(id).dataset[secondary ? "y2Min" : "yMin"]), upper = Number(el(id).dataset[secondary ? "y2Max" : "yMax"]);
    return lower + (316 - yy) / 292 * (upper - lower);
  }
  test("Auction and distribution controls occupy a separate FPA-style row", function () {
    var row = el("distribution-controls"), demo = el("auction-demo");
    assert(!row.closest("#auction-demo") && row.getBoundingClientRect().bottom <= demo.getBoundingClientRect().top + 1);
    ["split", "mass"].forEach(function (prefix) {
      assert(el(prefix + "-number").closest(".shape-parameter") && el(prefix + "-range").closest(".shape-parameter"));
      assert(el(prefix + "-range").getAttribute("aria-valuetext"));
    });
    assert(el("value-pdf-preview").getAttribute("aria-labelledby") === "value-pdf-preview-title value-pdf-preview-description");
    assert(el("distribution-status").textContent === "Irregular distribution");
    assert(el("bidder-number").tagName === "SELECT" && el("bidder-number").options.length === 4);
    assert(!el("point-select"));
    assert(doc.querySelector(".ironing-controls value-density-preview") && !row.contains(el("value-pdf-preview")));
    assert(el("value-number").classList.contains("range-number-input") && el("allocation-number").classList.contains("range-number-input"));
  });
  test("Density preview preserves probability mass and reflects both parameter input paths", function () {
    function lowerShare() {
      var bars = Array.from(el("value-pdf-preview").querySelectorAll(".density-area"));
      var areas = bars.map(function (r) { return Number(r.getAttribute("width")) * Number(r.getAttribute("height")); });
      return areas[0] / (areas[0] + areas[1]);
    }
    close(lowerShare(), 0.75, 1e-12);
    input("mass-range", "0.25"); close(Number(el("mass-number").value), 0.25); close(lowerShare(), 0.25, 1e-12);
    input("split-number", "0.63"); close(Number(el("split-range").value), 0.63);
    assert(el("value-pdf-preview-description").textContent.includes("0.6300"));
    finiteGeometry();
  });
  test("Distribution edits preserve allocation and payment values on the signed scale", function () {
    var probes = [0.13, 0.43, 0.62, 0.91];
    var before = probes.map(function (v) { return [sampleChart("allocation-chart", v), sampleChart("payment-chart", v)]; });
    var originalRevenue = revenue();
    input("split-number", "0.63"); input("mass-number", "0.31");
    probes.forEach(function (v, i) {
      close(sampleChart("allocation-chart", v), before[i][0], 0.0001);
      close(sampleChart("payment-chart", v), before[i][1], 0.0001);
    });
    assert(Math.abs(revenue() - originalRevenue) > 0.001);
    assert(el("bic-status").dataset.passed === "true");
  });
  test("Uniform transition preserves the learner rule and loads the correct optimum", function () {
    input("mass-number", "0.5");
    assert(el("distribution-status").textContent === "Regular distribution");
    assert(el("feasibility-status").dataset.passed === "false", "Preserved Q can become infeasible under a new distribution");
    assert(el("pool-summary").textContent === "Optimal ironing quantile: none (virtual values are nondecreasing)" && !el("allocation-chart").querySelector(".pool-shade"));
    assert(!el("integrated-chart").querySelector(".hull-curve, .ironed-virtual-curve"), "No orange construction outside ironing intervals");
    el("use-optimum").click(); close(revenue(), 5 / 12, 1e-10);
    el("reset-button").click();
    assert(el("bic-status").dataset.passed === "true" && el("feasibility-status").dataset.passed === "true");
  });
  test("Parameter bounds exclude zero densities and invalid edits preserve the previous environment", function () {
    var before = revenue(), description = el("value-pdf-preview-description").textContent;
    input("mass-number", ""); close(revenue(), before);
    assert(el("distribution-error").textContent && el("distribution-error").getAttribute("role") === "alert");
    assert(el("value-pdf-preview-description").textContent === description);
    input("mass-number", "1"); close(Number(el("mass-number").value), 0.9);
    input("split-number", "0"); close(Number(el("split-number").value), 0.1);
    input("mass-number", "0"); close(Number(el("mass-number").value), 0.1);
    input("bidder-number", "5"); close(Number(el("bidder-number").value), 5);
    assert(!el("distribution-error").textContent); finiteGeometry();
  });
  test("Reset parameters restores defaults while retaining the learner's allocation and visible ironing", function () {
    input("bidder-number", "4"); input("split-number", "0.63"); input("mass-number", "0.3");
    choose(5); input("allocation-number", "0.12");
    el("reset-parameters").click();
    close(Number(el("bidder-number").value), 2); close(Number(el("split-number").value), 0.5);
    close(Number(el("mass-number").value), 0.75); close(Number(el("allocation-number").value), 0.12);
    assert(el("integrated-chart").querySelector(".pool-shade") && !el("benchmark-summary"));
  });
  test("Virtual-value branches retain the jump and all parameter extremes fit the fixed frames", function () {
    [[0.5, 0.75], [0.9, 0.1], [0.1, 0.9], [0.25, 0.75]].forEach(function (setting) {
      input("split-number", String(setting[0])); input("mass-number", String(setting[1]));
      assert(el("integrated-chart").querySelectorAll(".raw-curve").length === 2);
      el("integrated-chart").querySelectorAll(".raw-curve").forEach(function (path) {
        var nums = path.getAttribute("d").match(/-?\d+(?:\.\d+)?/g).map(Number);
        for (var i = 1; i < nums.length; i += 2) { assert(nums[i] >= 24 - 1e-6 && nums[i] <= 316 + 1e-6); }
      });
      finiteGeometry();
    });
    assert(el("pool-summary").textContent.includes("Optimal ironing quantile: ["));
  });
  test("The integrated chart combines H, its lower convex hull, and labeled virtual values in the common frame", function () {
    assert(!el("revenue-chart") && el("integrated-chart").querySelector(".hull-curve"));
    assert(el("integrated-chart").getAttribute("aria-labelledby") === "integrated-title integrated-description");
    assert(!el("allocation-chart").querySelector(".raw-curve") && !el("allocation-chart").querySelector(".ironed-virtual-curve"));
    close(Number(el("allocation-chart").dataset.yMin), 0); close(Number(el("allocation-chart").dataset.yMax), 1);
    close(sampleChart("integrated-chart", 0, ".raw-curve"), -2 / 3, 1e-6);
    close(sampleChart("integrated-chart", 1, ".raw-curve"), 1, 1e-6);
    close(sampleChart("integrated-chart", 0.5, ".integrated-curve"), -1 / 6, 1e-5);
    var interval = win.IroningModel.ironing().intervals[0], u = (interval.lower + interval.upper) / 2;
    var chord = -((1 - interval.lower) * interval.a + (1 - interval.upper) * interval.b) / 2;
    close(sampleChart("integrated-chart", u, ".hull-curve"), chord, 1e-5);
    close(sampleChart("integrated-chart", u, ".ironed-virtual-curve"), interval.virtual, 1e-5);
    assert(sampleChart("integrated-chart", u, ".hull-curve") < sampleChart("integrated-chart", u, ".integrated-curve"));
    var band = el("integrated-chart").querySelector(".pool-shade");
    close(Number(band.getAttribute("x")), 54 + 560 * interval.lower, 1e-6);
    [".hull-curve", ".ironed-virtual-curve"].forEach(function (selector) {
      var paths = el("integrated-chart").querySelectorAll(selector);
      assert(paths.length === 1, "One dotted segment per ironing interval");
      var box = paths[0].getBBox(), style = win.getComputedStyle(paths[0]);
      close(box.x, Number(band.getAttribute("x")), 1e-3); close(box.width, Number(band.getAttribute("width")), 1e-3);
      assert(style.strokeDasharray !== "none" && style.strokeLinecap === "round", "Orange segments are dotted");
    });
    var label = el("integrated-chart").querySelector(".virtual-value-label");
    assert(label.textContent === "φ ∘ F⁻¹"); close(Number(label.getAttribute("x")), 166);
    assert(Number(label.getAttribute("y")) > 200 && Number(label.getAttribute("y")) < 280, "Virtual-value label is near the lower left branch");
    assert(!doc.querySelector(".integrated-axis-labels"));
    doc.querySelectorAll(".chart-640x360").forEach(function (svg) {
      var box = svg.querySelector("rect.plot-frame");
      close(Number(box.getAttribute("x")), 54); close(Number(box.getAttribute("y")), 24);
      close(Number(box.getAttribute("width")), 560); close(Number(box.getAttribute("height")), 292);
    });
    input("split-number", "0.1"); input("mass-number", "0.3");
    assert(!el("allocation-chart").querySelector(".pool-shade"), "Excluded types have no allocated pool");
    assert(el("integrated-chart").querySelector(".pool-shade"), "Full convex hull retains negative-priority ironing");
    assert(el("integrated-chart").querySelector(".hull-curve") && el("integrated-chart").querySelector(".ironed-virtual-curve"));
    assert(el("pool-summary").textContent.includes("corresponds to"), "Intervals below the cutoff retain their quantile and value diagnostic");
  });
  test("Allocation uses its full probability scale while integrated and virtual curves fit extreme parameters", function () {
    input("split-number", "0.9"); input("mass-number", "0.1");
    captureStub(); pointer(handle(5), "pointerdown", 0.5, 0.75);
    pointer(el("allocation-chart"), "pointermove", 0.53, 0.32);
    close(Number(el("allocation-number").value), 0.32, 5e-6); close(Number(el("value-number").value), 0.53, 1e-6);
    pointer(el("allocation-chart"), "pointerup", 0.53, 0.32);
    el("integrated-chart").querySelectorAll("path").forEach(function (p) {
      var b = p.getBBox(); assert(b.y >= 24 - 1e-3 && b.y + b.height <= 316 + 1e-3, "Revenue and hull fit their authored frame");
    });
    assert(el("integrated-description").textContent.includes("-9") && el("allocation-description").textContent.includes("0 to 1"));
    finiteGeometry();
  });
  test("Changing distribution parameters cancels an active allocation drag", function () {
    captureStub(); pointer(handle(5), "pointerdown", 0.5, 0.75);
    input("mass-number", "0.6");
    var before = Number(el("allocation-number").value);
    pointer(el("allocation-chart"), "pointermove", 0.53, 0.1);
    close(Number(el("allocation-number").value), before);
  });
  test("The construction is always visible, while the action loads the exact mechanism", function () {
    assert(!el("compare-optimum") && !doc.querySelector('input[type="checkbox"]'));
    assert(el("use-optimum").textContent === "Use optimal feasible mechanism");
    assert(!el("best-revenue") && !el("optimal-revenue") && !el("benchmark-summary") && !doc.querySelector(".chart-key"), "Removed diagnostics and legend sentences stay absent");
    assert(!doc.querySelector(".benchmark-curve"), "No optimal allocation or payment overlay");
    for (var n = 2; n <= 5; n += 1) {
      input("bidder-number", String(n)); el("use-optimum").click();
      var optimum = win.IroningModel.benchmark(n);
      close(revenue(), optimum.revenue, 1e-10);
      assert(el("bic-status").dataset.passed === "true" && el("feasibility-status").dataset.passed === "true");
      var points = win.IroningModel.optimalPoints(optimum), handles = el("allocation-chart").querySelectorAll("[data-index]");
      assert(handles.length === 8 && handles.length === points.length, "Only endpoints of continuous segments are displayed");
      handles.forEach(function (node, index) {
        node.focus();
        assert(el("value-number").value === points[index].v.toFixed(3) && el("allocation-number").value === points[index].q.toFixed(3));
        assert(el("value-number").validity.valid && el("allocation-number").validity.valid, "Rounded controls remain valid at exact boundaries");
        close(Number(node.getAttribute("aria-valuenow")), points[index].q, 1e-12);
        close(revenue(), optimum.revenue, 1e-10, "Selecting rounded endpoints preserves exact optimal revenue");
      });
      [0.18, 0.42, 0.52, 0.74, 0.91].forEach(function (v) {
        close(sampleChart("allocation-chart", v), optimum.allocation(v), 3e-5);
        close(sampleChart("payment-chart", v), optimum.payment(v), 3e-5);
      });
      assert(!doc.querySelector(".benchmark-curve"));
    }
    var before = sampleChart("allocation-chart", 0.74), payment = sampleChart("payment-chart", 0.74);
    input("mass-number", "0.3"); input("split-number", "0.63");
    close(sampleChart("allocation-chart", 0.74), before, 3e-5); close(sampleChart("payment-chart", 0.74), payment, 3e-5);
    choose(0); input("allocation-number", "0.9");
    assert(el("bic-status").dataset.passed === "false" && el("revenue-label").textContent === "Candidate revenue");
    finiteGeometry();
  });
  test("Revenue is attached below the value-based payment plot and retains its total-bidder interpretation", function () {
    var figure = el("payment-chart").closest("figure"), viewport = el("payment-chart").closest(".chart-viewport");
    assert(figure.contains(el("revenue-label")) && figure.contains(el("revenue-value")));
    assert(el("revenue-value").getBoundingClientRect().top >= viewport.getBoundingClientRect().bottom - 1);
    assert(viewport.querySelector(".chart-axis-label").textContent.includes("Value"));
    assert(!el("payment-chart").querySelector(".payment-area"));
    input("bidder-number", "5"); el("use-optimum").click();
    close(revenue(), win.IroningModel.benchmark(5).revenue, 1e-10);
    assert(el("payment-description").textContent.includes("across all bidders"));
  });
  test("Shared FPA controls and preview retain their box sizing, bolding, and compact layout", async function () {
    var reference = document.createElement("iframe");
    reference.style.cssText = "position:absolute;left:-10000px;width:1280px;height:1000px;";
    reference.title = "First-price shared-style reference";
    var loaded = new Promise(function (resolve) { reference.onload = resolve; });
    reference.src = "../auctions/first-price/index.html"; document.body.appendChild(reference);
    await loaded;
    var fpa = reference.contentDocument, fpaWindow = reference.contentWindow;
    await T.waitFor(function () { return fpa.querySelector("#value-pdf-preview .value-pdf-curve"); }, 15000);
    function sameStyle(actual, expected, properties) {
      var a = win.getComputedStyle(actual), b = fpaWindow.getComputedStyle(expected);
      properties.forEach(function (property) { assert(a[property] === b[property], property + ": " + a[property] + " versus " + b[property]); });
    }
    try {
      sameStyle(el("value-number"), fpa.getElementById("value-number"), ["width", "minHeight", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "fontSize", "fontWeight", "textAlign", "backgroundColor", "borderTopWidth", "borderTopStyle"]);
      sameStyle(doc.querySelector(".ironing-controls .range-label-row"), fpa.querySelector(".range-label-row"), ["fontSize", "fontWeight", "gap"]);
      sameStyle(el("reset-parameters"), fpa.getElementById("reset-button"), ["fontSize", "fontFamily", "fontWeight", "minHeight", "paddingTop", "paddingRight", "borderTopWidth", "borderBottomWidth", "borderBottomStyle", "textDecorationLine", "backgroundColor"]);
      sameStyle(el("split-number"), fpa.getElementById("alpha-number"), ["width", "minHeight", "paddingTop", "paddingRight", "fontSize", "fontWeight", "textAlign"]);
      sameStyle(doc.querySelector(".value-pdf-preview-figure figcaption"), fpa.querySelector(".value-pdf-preview-figure figcaption"), ["fontSize", "fontWeight", "marginLeft"]);
      assert(el("value-pdf-preview").getAttribute("viewBox") === fpa.getElementById("value-pdf-preview").getAttribute("viewBox"));
      assert(el("value-pdf-preview").querySelector(".value-pdf-curve") && el("value-pdf-preview").querySelectorAll(".value-pdf-axis").length === 3);
      assert(el("value-pdf-preview").querySelector('[data-endpoint="a"]').textContent === "a = 0");
      assert(el("value-pdf-preview").querySelector('[data-endpoint="b"]').textContent === "b = 1");
      for (var width of [320, 768, 1280]) {
        frame.style.width = width + "px"; await T.nextAnimationFrames(win, 3);
        var demoSize = 0.86 * parseFloat(win.getComputedStyle(doc.documentElement).fontSize);
        doc.querySelectorAll(".ironing-plots figcaption, .plot-diagnostic, .chart-axis-label").forEach(function (node) {
          close(parseFloat(win.getComputedStyle(node).fontSize), demoSize, 0.1);
        });
        doc.querySelectorAll(".chart-axis-label").forEach(function (node) { assert(win.getComputedStyle(node).textAlign === "center"); });
        doc.querySelectorAll(".ironing-plots figcaption, .plot-diagnostic, .constraint-status").forEach(function (node) {
          assert(win.getComputedStyle(node).textAlign === "left");
        });
        doc.querySelectorAll("#distribution-controls button, #auction-demo button").forEach(function (node) {
          var style = win.getComputedStyle(node);
          assert(style.backgroundColor === "rgba(0, 0, 0, 0)" && parseFloat(style.borderTopWidth) === 0);
          assert(style.borderBottomWidth === "1px" && style.borderBottomStyle === "solid" && style.textDecorationLine === "none", "Action underlines use the shared button geometry");
        });
        doc.querySelectorAll(".chart-640x360").forEach(function (svg) {
          var nativeWidth = Number(svg.getAttribute("width")), text = svg.querySelector("text");
          close(parseFloat(win.getComputedStyle(text).fontSize) * svg.getBoundingClientRect().width / nativeWidth, demoSize, 0.1);
        });
      }
    } finally { reference.remove(); }
  });
  T.run(tests, { title: "Ironing interface tests" });
})();
