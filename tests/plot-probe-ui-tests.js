(function () {
  "use strict";
  var T = MechanismTest, frame = document.getElementById("app-frame"), tests = [], doc, win;
  function el(id) { return doc.getElementById(id); }
  async function load(route) {
    frame.style.width = "1280px";
    var page = await T.loadFrame(frame, "../" + route + "/index.html?probe-test=" + Math.random(), { math: "main", timeout: 30000 });
    doc = page.document; win = page.window;
    await T.waitFor(function () { return doc.querySelector(".curve-inspectable"); }, 15000);
    await T.nextAnimationFrames(win, 3);
  }
  function key(svg, name, options) { T.dispatch(svg, "keydown", win, Object.assign({ key: name }, options)); }
  function value(svg, series) {
    var node = svg.querySelector('.curve-probe-text[data-series="' + series + '"]');
    T.assert(node, "Inspection includes " + series); return Number(node.dataset.value);
  }
  async function hover(svg, x, y) {
    svg.scrollIntoView({ block: "center" });
    await T.nextAnimationFrames(win, 2);
    var p = new win.DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
    T.dispatch(svg, "pointermove", win, { pointerId: 3, pointerType: "mouse", isPrimary: true, buttons: 0, clientX: p.x, clientY: p.y });
    await T.nextAnimationFrames(win, 2);
    T.assert(svg.querySelector(".curve-probe"), "Hover inspection is visible without a click: " + svg.id + " at " + win.innerWidth + "px and zoom " + doc.body.style.zoom);
    svg.querySelectorAll(".curve-probe-text").forEach(function (text) {
      var first = text.firstElementChild;
      T.assert(first.classList.contains("chart-math-symbol") || !/[a-zA-Z]/.test(first.textContent), "Hover begins with mathematical notation, without a curve name");
      T.assert(!/left limit|right limit/.test(text.textContent), "One-sided arguments use mathematical superscripts");
    });
  }
  function contained(svg, boxNode) {
    var line = svg.querySelector(".curve-probe-line"), m = svg.getScreenCTM();
    var a = new win.DOMPoint(Number(line.getAttribute("x1")), Number(line.getAttribute("y1"))).matrixTransform(m);
    var b = new win.DOMPoint(Number(line.getAttribute("x2")), Number(line.getAttribute("y2"))).matrixTransform(m);
    var border = svg.querySelector(".plot-frame,.diagnostic-frame,rect.axis-line,.panel-background");
    var bounds = border.getBoundingClientRect(), box = boxNode.getBoundingClientRect();
    T.assert(box.left >= bounds.left - .5 && box.right <= bounds.right + .5 && box.top >= a.y - .5 && box.bottom <= b.y + .5,
      svg.id + " popup fits inside the inspected plot");
    T.assertClose(Number(line.getAttribute("x1")), Number(line.getAttribute("x2")), 1e-9, "The guide is vertical");
    svg.querySelectorAll(".curve-probe-text").forEach(function (text) {
      var r = text.getBoundingClientRect();
      T.assert(r.left >= box.left + 3 && r.right <= box.right - 3 && r.top >= box.top + 3 && r.bottom <= box.bottom - 3,
        "The popup contains its complete readable output");
    });
  }
  function test(name, run) { tests.push({ name: name, run: run }); }
  test("First-price hover uses exact model values without changing the selected bid or resampling curves", async function () {
    await load("auction-equilibria/first-price");
    var svg = el("tradeoff-chart"), panels = svg.querySelectorAll(".panel-background"), panel = panels[0];
    var x = Number(panel.getAttribute("x")) + .4 * Number(panel.getAttribute("width"));
    var count = svg.dataset.curveCacheBuildCount;
    await hover(svg, x, Number(panel.getAttribute("y")) + 20);
    T.assertClose(value(svg, "density"), .02, 1e-9, "Uniform opposing-bid PDF");
    T.assert(svg.querySelectorAll(".curve-probe-dot").length === 1);
    T.assert(win.getComputedStyle(svg.querySelector(".curve-probe-dot")).fill === win.getComputedStyle(svg.querySelector(".highest-bid-density-curve")).stroke,
      "The inspection dot matches the curve color");
    panel = panels[1]; await hover(svg, x, Number(panel.getAttribute("y")) + 40);
    T.assertClose(value(svg, "cdf"), .8, 1e-9);
    T.assert(svg.querySelectorAll(".curve-probe-text").length === 1 && !svg.querySelector('.curve-probe-text[data-series="payoff"]'), "Only the CDF appears in its hover box");
    T.assert(svg.querySelectorAll(".curve-probe-dot").length === 1, "Payoff is rectangle area, so it has no false ordinate dot");
    T.assert(el("bid-number").value === "30" && svg.dataset.curveCacheBuildCount === count);
    var captions = doc.querySelectorAll(".first-price-plot-title");
    T.assert(captions[0].textContent.includes("PDF") && captions[1].textContent.includes("CDF"));
    T.assert(captions[0].querySelector("mjx-container") && captions[1].querySelector("mjx-container"));
    T.assert(svg.querySelector(".area-label").textContent.includes("Probability of winning") && svg.querySelector(".expected-payoff-label").textContent.includes("Expected payoff"));
    T.assert(!svg.querySelector(".maximum-label,.support-label,.winning-probability-guide-label"));
  });
  test("First-price keyboard inspection switches panels and leaves ordinary bid editing available", function () {
    var svg = el("tradeoff-chart"); svg.focus(); key(svg, "Home", { altKey: true });
    T.assertClose(value(svg, "cdf"), 0, 1e-10);
    key(svg, "ArrowUp", { altKey: true }); T.assert(svg.querySelector(".curve-probe").dataset.view === "density");
    key(svg, "ArrowDown", { altKey: true }); key(svg, "End", { altKey: true });
    T.assertClose(value(svg, "cdf"), 1, 1e-10);
    T.assert(el("bid-number").value === "30");
    key(svg, "ArrowRight"); T.assert(Number(el("bid-number").value) > 30, "Unmodified arrows still edit the bid");
    key(svg, "Escape"); T.assert(!svg.querySelector(".curve-probe"));
  });
  test("First-price inspection identifies the orange equilibrium marker only when nearby", async function () {
    var svg = el("tradeoff-chart"), marker = svg.querySelector(".density-equilibrium-marker");
    var x = Number(marker.getAttribute("x1")), y = Number(marker.getAttribute("y1")) + 25;
    var count = svg.dataset.curveCacheBuildCount, bid = el("bid-number").value;
    await hover(svg, x + win.ChartLayout.svgUnits(svg, 3), y);
    T.assertClose(value(svg, "equilibrium-bid"), Number(marker.dataset.equilibriumBid), 1e-10);
    T.assert(svg.querySelector('[data-series="equilibrium-bid"]').textContent.startsWith("βI(vi) = "));
    T.assert(!svg.querySelector('.curve-probe-dot[data-series="equilibrium-bid"]'), "The bid is a horizontal reference, so it has no false ordinate dot");
    await hover(svg, x + win.ChartLayout.svgUnits(svg, 12), y);
    T.assert(!svg.querySelector('[data-series="equilibrium-bid"]'));
    T.assert(el("bid-number").value === bid && svg.dataset.curveCacheBuildCount === count);
  });
  test("The Beta density preview has the same inspector and reports singular endpoints without nonfinite geometry", async function () {
    var svg = el("value-pdf-preview"); await hover(svg, 14 + .35 * 292, 50);
    T.assertClose(value(svg, "density"), .01, 1e-10);
    ["alpha-number", "beta-number"].forEach(function (id) { el(id).value = ".5"; T.dispatch(el(id), "change", win); });
    svg.focus(); key(svg, "Home");
    T.assert(svg.querySelector(".curve-probe-text").textContent.includes("∞"), "Singular density is stated explicitly");
    T.assert(!svg.querySelector(".curve-probe-dot"), "Infinity has no finite ordinate");
    svg.querySelectorAll("path, circle, rect, line").forEach(function (node) {
      T.assert(!/NaN|Infinity/.test(Array.from(node.attributes).map(function (a) { return a.value; }).join(" ")), "Finite geometry at singular endpoints");
    });
  });
  test("Editable touch inspection follows the owning bid drag without replacing it", async function () {
    await load("auction-equilibria/first-price");
    var svg = el("tradeoff-chart"), panel = svg.querySelectorAll(".panel-background")[1], captured = null;
    svg.setPointerCapture = function (id) { captured = id; };
    svg.hasPointerCapture = function (id) { return captured === id; };
    svg.releasePointerCapture = function () { captured = null; };
    function touch(type, bid, buttons) {
      var p = new win.DOMPoint(Number(panel.getAttribute("x")) + bid / 100 * Number(panel.getAttribute("width")), Number(panel.getAttribute("y")) + 40).matrixTransform(svg.getScreenCTM());
      T.dispatch(svg, type, win, { pointerId: 12, pointerType: "touch", isPrimary: true, button: 0, buttons: buttons, clientX: p.x, clientY: p.y });
    }
    touch("pointerdown", 40, 1); await T.nextAnimationFrames(win, 2);
    T.assertClose(Number(el("bid-number").value), 40, 1e-8); T.assertClose(value(svg, "cdf"), .8, 1e-8);
    touch("pointermove", 35, 1); await T.nextAnimationFrames(win, 2);
    T.assertClose(Number(el("bid-number").value), 35, 1e-8); T.assertClose(value(svg, "cdf"), .7, 1e-8);
    touch("pointerup", 35, 0);
    T.assertClose(Number(svg.querySelector(".expected-payoff-label").dataset.value), Number(svg.querySelector(".expected-payoff-rectangle").dataset.signedPayoff), 1e-10,
      "The label uses the exact edited state, including unrounded pointer coordinates");
    T.assert(svg.querySelector(".expected-payoff-label").textContent.replace(/\s+/g, " ").trim() === "Expected payoff = 10.5");
    T.assert(captured === null, "The existing editor finishes its own capture");
  });
  test("All four regular-auction function panels inspect the same exact interim model and both curve colors", async function () {
    await load("auction-design/regular-optimal-auctions");
    var M = win.OptimalAuctionsModel, result = M.diagnose(M.preset("efficient"));
    for (var bidder of [1, 2]) {
      for (var kind of ["interim", "payment"]) {
        var svg = el(kind + "-" + bidder + "-chart"), v = .37;
        await hover(svg, 40 + v * 300, 100);
        var expected = M.evaluate(result.bidders[bidder - 1], v);
        T.assertClose(value(svg, kind === "interim" ? "allocation" : "payment"), expected[kind === "interim" ? "allocation" : "payment"], 1e-9);
        if (kind === "interim") {
          T.assertClose(value(svg, "virtual"), expected.virtual, 1e-9);
          T.assert(svg.querySelectorAll(".curve-probe-dot").length === 2, "Each intersected curve gets a dot");
          T.assert(svg.closest("figure").querySelector("figcaption").textContent.includes("Virtual value"));
        }
      }
    }
  });
  test("Regular-auction inspection preserves right-continuous values and open one-sided limits after support shifts", async function () {
    var M = win.OptimalAuctionsModel, grid = M.gridFrom(function (v) { return v < .5 ? [0, 0] : [1, 0]; });
    var agent = M.diagnose(grid, [.3, 0]).bidders[0], svg = el("interim-1-chart");
    win.OptimalAuctionsCharts.interim(svg, agent, 1); await hover(svg, 190, 100);
    T.assertClose(value(svg, "allocation"), 1, 1e-9); T.assertClose(value(svg, "allocation-left"), 0, 1e-9);
    T.assertClose(Number(svg.querySelector(".curve-probe").dataset.input), .8, 1e-9);
    T.assert(svg.querySelector('.curve-probe-open[data-series="allocation-left"]'));
    T.assert(svg.querySelector('.curve-probe-text[data-series="allocation-left"] .chart-math-superscript').textContent === "−",
      "The left limit is identified mathematically in the argument");
  });
  test("General-auction inspectors evaluate allocation, payment, both virtual-value scales, and capacity exactly", async function () {
    await load("auction-design/general-optimal-auctions");
    var M = win.IroningModel, d = M.defaultDistribution, rule = M.diagnose(M.initial(2), 2, d);
    for (var kind of ["allocation", "payment"]) {
      var svg = el(kind + "-chart"); await hover(svg, 54 + .37 * 560, 100);
      T.assertClose(value(svg, kind), M.evaluate(rule, .37)[kind === "allocation" ? "q" : "payment"], 1e-9);
    }
    var integrated = el("integrated-chart"), pool = M.ironing(d).intervals[0], z = (pool.lower + pool.upper) / 2;
    await hover(integrated, 54 + z * 560, 100);
    T.assertClose(value(integrated, "integrated"), M.integratedVirtual(z, d), 1e-9);
    T.assertClose(value(integrated, "virtual"), M.phi(M.quantile(z, d), d), 1e-9);
    T.assertClose(value(integrated, "convex"), M.convexIntegrated(z, M.ironing(d)), 1e-9);
    T.assertClose(value(integrated, "ironed"), pool.virtual, 1e-9);
    T.assert(integrated.querySelectorAll(".curve-probe-dot").length === 4, "Both axes and both ironing overlays have correctly scaled dots");
    var capacity = el("feasibility-chart"), level = M.levelAt(rule, .37); await hover(capacity, 54 + .37 * 560, 100);
    T.assertClose(value(capacity, "demand"), 2 * level.allocation, 1e-9); T.assertClose(value(capacity, "capacity"), 2 * level.capacity, 1e-9);
    T.assert(!doc.querySelector(".virtual-value-label,.feasibility-capacity-label"));
  });
  test("The piecewise density preview inspects both sides of its jump and supports touch capture", async function () {
    var svg = el("value-pdf-preview"), d = win.IroningModel.defaultDistribution;
    await hover(svg, 14 + d.split * 292, 50);
    T.assertClose(value(svg, "density"), d.upperDensity, 1e-9); T.assertClose(value(svg, "density-left"), d.lowerDensity, 1e-9);
    var p = new win.DOMPoint(14 + .2 * 292, 50).matrixTransform(svg.getScreenCTM()), captured = null;
    svg.setPointerCapture = function (id) { captured = id; };
    T.dispatch(svg, "pointerdown", win, { pointerId: 8, pointerType: "touch", isPrimary: true, button: 0, clientX: p.x, clientY: p.y });
    T.assert(captured === 8); T.assertClose(value(svg, "density"), d.lowerDensity, 1e-9);
    T.dispatch(svg, "pointercancel", win, { pointerId: 8 }); T.assert(!svg.querySelector(".curve-probe"));
    svg.focus(); key(svg, "Home");
    for (var i = 0; i < Math.round(d.split * 100); i += 1) { key(svg, "ArrowRight"); }
    T.assertClose(value(svg, "density-left"), d.lowerDensity, 1e-9, "Keyboard steps retain exact knot ownership");
  });
  test("General-auction inspection preserves exact loaded polynomial rules and allocation-level jumps", async function () {
    el("bidder-number").value = "4"; T.dispatch(el("bidder-number"), "input", win); el("use-optimum").click();
    var M = win.IroningModel, d = M.defaultDistribution, benchmark = M.benchmark(4, d), v = .91;
    var svg = el("allocation-chart"); await hover(svg, 54 + v * 560, 100);
    T.assertClose(value(svg, "allocation"), benchmark.allocation(v), 1e-9, "Loaded allocation is evaluated as a polynomial");
    svg = el("payment-chart"); await hover(svg, 54 + v * 560, 100);
    T.assertClose(value(svg, "payment"), benchmark.payment(v), 1e-9, "Loaded payment uses the exact antiderivative");
    var pool = benchmark.pools[0], rule = M.adoptedRule(benchmark, 4, d), level = M.levelAt(rule, pool.q);
    svg = el("feasibility-chart"); await hover(svg, 54 + pool.q * 560, 100);
    T.assertClose(value(svg, "demand"), 4 * level.allocation, 1e-9);
    T.assertClose(value(svg, "demand-right"), 4 * M.levelAt(rule, pool.q, "right").allocation, 1e-9);
    T.assert(svg.querySelector('.curve-probe-open[data-series="demand-right"]'));
  });
  test("Envelope inspection shows only V(t), while slope inspection preserves one-sided limits", async function () {
    await load("general-topics/envelope-theorem");
    var svg = el("main-chart"); await hover(svg, 60 + .75 * 570, 180);
    T.assertClose(value(svg, "envelope"), .65, 1e-9);
    T.assert(svg.querySelectorAll(".curve-probe-text").length === 1 && svg.querySelectorAll(".curve-probe-dot").length === 1,
      "Only V(t) is inspected, while family functions remain editable");
    T.assert(svg.closest("figure").querySelector("figcaption").textContent.startsWith("Envelope, ") && !svg.closest("figure").textContent.includes("Family functions"));
    var before = el("point-control-label").textContent; svg.focus(); key(svg, "ArrowLeft", { altKey: true });
    T.assert(el("point-control-label").textContent === before, "Inspection does not select or move a handle");
    key(svg, "ArrowRight"); T.assert(el("point-control-label").textContent !== before, "Normal selection arrows remain available");
    svg = el("slope-chart"); await hover(svg, 60 + .5 * 570, 180);
    T.assertClose(value(svg, "slope-0"), -.6, 1e-9); T.assertClose(value(svg, "slope-1"), 0, 1e-9);
    T.assert(svg.querySelectorAll(".curve-probe-open").length === 2 && svg.textContent.includes("not differentiable"));
  });
  test("Envelope-only inspection stays readable with eight family functions on phones and at 200 percent zoom", async function () {
    for (var i = 0; i < 5; i += 1) { el("add-line").click(); }
    var svg = el("main-chart");
    async function inspectMidpoint() {
      svg.focus({ preventScroll: true }); key(svg, "Home", { altKey: true });
      for (var i = 0; i < 5; i += 1) { key(svg, "ArrowRight", { altKey: true, shiftKey: true }); }
      await T.nextAnimationFrames(win, 2);
    }
    for (var width of [320, 375, 768, 1280]) {
      frame.style.width = width + "px"; await T.nextAnimationFrames(win, 3);
      await inspectMidpoint();
      T.assert(svg.querySelectorAll(".curve-probe-text").length === 1 && svg.querySelectorAll(".family-line").length === 8);
      contained(svg, svg.querySelector(".curve-probe-box"));
      T.assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1);
    }
    doc.body.style.zoom = "2"; await T.nextAnimationFrames(win, 3); await inspectMidpoint();
    contained(svg, svg.querySelector(".curve-probe-box")); doc.body.style.zoom = "1";
  });
  test("Hover refreshes layout once and leaves an already-hidden inspector idle", async function () {
    await load("auction-equilibria/first-price");
    var svg = el("tradeoff-chart"), panel = svg.querySelector(".panel-background");
    var original = win.PlotStyle, refreshes = 0;
    win.PlotStyle = Object.assign({}, original, { refresh: function (target) {
      if (target === svg) { refreshes += 1; }
      return original.refresh(target);
    } });
    try {
      var x = Number(panel.getAttribute("x")) + .4 * Number(panel.getAttribute("width"));
      var y = Number(panel.getAttribute("y")) + 30;
      await hover(svg, x, y);
      T.assert(refreshes === 1, "Overlay mutations do not repeat the synchronous layout refresh");
      key(svg, "Escape"); await T.nextAnimationFrames(win, 3);
      T.assert(!svg.querySelector(".curve-probe"), "Escape clears the active inspector");
      refreshes = 0;
      var p = new win.DOMPoint(Number(panel.getAttribute("x")) - 12, y).matrixTransform(svg.getScreenCTM());
      T.dispatch(svg, "pointermove", win, { pointerId: 3, pointerType: "mouse", isPrimary: true, buttons: 0, clientX: p.x, clientY: p.y });
      await T.nextAnimationFrames(win, 3);
      T.assert(refreshes === 0, "Moving through plot margins does no layout work when inspection is already hidden");
    } finally { win.PlotStyle = original; }
  });
  test("Feasibility inspection reuses analytic cuts until the edited rule changes", async function () {
    await load("auction-design/general-optimal-auctions");
    var original = win.PlotProbe, options, bindings = 0;
    win.PlotProbe = Object.assign({}, original, { attach: function (svg, next) {
      if (svg.id === "feasibility-chart") { options = next; bindings += 1; }
      return original.attach(svg, next);
    } });
    try {
      el("bidder-number").value = "5"; T.dispatch(el("bidder-number"), "input", win);
      T.assert(options, "The current rule supplies its inspector");
      var cuts = options.views()[0].knots;
      await hover(el("feasibility-chart"), 54 + .37 * 560, 120);
      T.assert(options.views()[0].knots === cuts, "Hover reuses the existing analytic cuts");
      var before = bindings;
      frame.style.width = "375px";
      await T.waitFor(function () { return bindings > before; }, 5000, "Responsive curves redraw");
      T.assert(options.views()[0].knots === cuts, "A display resize also reuses the same rule's cuts");
      el("allocation-number").value = ".123"; T.dispatch(el("allocation-number"), "input", win);
      T.assert(options.views()[0].knots.some(function (cut) { return Math.abs(cut - .123) < 1e-10; }),
        "An allocation edit supplies its new breakpoint to inspection");
    } finally { win.PlotProbe = original; }
  });
  T.run(tests, { title: "Plot inspection tests" });
}());
