(function () {
  "use strict";
  var T = MechanismTest, frame = document.getElementById("app-frame"), tests = [], doc, win;
  function test(name, run) { tests.push({ name: name, run: run }); }
  async function load(route) {
    frame.style.width = "1280px";
    var page = await T.loadFrame(frame, "../" + route + "/index.html?style-test=" + Math.random(), {
      timeout: 30000,
      ready: function (d, w) { return w.PlotStyle && d.querySelector(".plot-axis-layer"); }
    });
    doc = page.document; win = page.window;
    await win.mechanismMathReady;
    await T.nextAnimationFrames(win, 4);
  }
  async function width(value) { frame.style.width = value + "px"; await T.nextAnimationFrames(win, 6); }
  function ticks(svg, axis) { return Array.from(svg.querySelectorAll('[data-axis="' + axis + '"] text')); }
  function assertAxis(svg, axis) {
    var values = ticks(svg, axis);
    T.assert(values.length >= 2 && values.length <= 6, "A readable major-tick count on " + svg.id);
    values.forEach(function (node, i) {
      T.assert(!/\.\d*0(?:%|$)/.test(node.textContent), "Ticks trim trailing zeros: " + node.textContent);
      T.assert(!/^-(?:0|0\.0+)$/.test(node.textContent), "Ticks never show negative zero");
      if (i) {
        var a = values[i - 1].getBoundingClientRect(), b = node.getBoundingClientRect();
        T.assert(axis === "x" ? a.right + 5 < b.left : b.bottom + 5 < a.top, "Adjacent tick labels have space on " + svg.id);
      }
    });
  }
  function legend(figure, expected) {
    var samples = figure.querySelectorAll(".plot-legend-line");
    T.assert(samples.length === expected.length, "Each named curve has a title line sample");
    samples.forEach(function (sample, i) {
      var style = win.getComputedStyle(sample);
      T.assertClose(sample.getBoundingClientRect().width, 22, .1, "Legend samples use a common visible length");
      var color = doc.createElement("span"); color.style.color = style.getPropertyValue("--plot-line-color");
      figure.appendChild(color);
      T.assert(win.getComputedStyle(color).color === win.getComputedStyle(expected[i]).stroke, "The title sample matches its curve color");
      color.remove();
    });
  }
  test("Numeric roles share trimmed ticks, three-place probes and four-place summaries", async function () {
    await load("auction-equilibria/first-price");
    var P = win.PlotStyle;
    T.assert(P.tick(0, .25) === "0" && P.tick(.5, .25) === "0.5" && P.tick(.25, .25) === "0.25");
    T.assert(P.tick(.25, .25, true) === "25%" && P.tick(-0, .1) === "0");
    T.assert(P.tick(.0224, .02) === "0.0224", "Padded density endpoints retain useful precision");
    T.assert(P.probe(.5) === "0.500" && P.summary(1 / 6) === "0.1667" && P.summary(1 / 6, 6) === "0.166667");
    [1e-12, -1e-9, 1e8].forEach(function (v) {
      var text = P.probe(v); T.assert(/e/.test(text) && Number(text) !== 0, "Nonzero extremes remain visible");
    });
    T.assert(P.probe(Infinity) === "∞" && P.probe(NaN) === "not defined");
    T.assert(P.ticks([0, 1], 140).values.length < P.ticks([0, 1], 500).values.length);
    var shifted = P.ticks([.17, 1.17], 400).values;
    T.assert(shifted[0] === .17 && shifted[shifted.length - 1] === 1.17, "Shifted support endpoints are retained");
  });
  test("Plot refresh releases axes whose drawing layers were removed", function () {
    var svg = win.SvgUtils.appendSvg(doc.body, "svg", { viewBox: "0 0 120 120", width: 120, height: 120 });
    var axis = win.PlotStyle.axis(svg, { id: "removed", orientation: "x", domain: [0, 1],
      frame: { left: 10, right: 110, top: 10, bottom: 90 } });
    var reads = 0;
    axis.layer.remove();
    win.PlotStyle.refresh(svg);
    Object.defineProperty(axis.layer, "parentNode", { configurable: true, get: function () { reads += 1; return null; } });
    try {
      win.PlotStyle.refresh(svg);
      T.assert(reads === 0, "Later refreshes no longer visit the removed axis");
    } finally { delete axis.layer.parentNode; svg.remove(); }
  });
  test("Adaptive curves meet a screen-space error bound and retain exact interval endpoints", function () {
    var P = win.PlotStyle;
    function points(size) { return P.adaptive(function (t) { return { t: t, y: Math.sin(2 * Math.PI * t) }; }, function (p) { return [[size * p.t, size * p.y]]; }, 0, 1); }
    var small = points(80), large = points(800);
    T.assert(large.length > small.length && large[0].t === 0 && large[large.length - 1].t === 1);
    T.assert(P.adaptive(function (t) { return t; }, function (v) { return [[800 * v, 20 + 100 * v]]; }, 0, 1).length === 5, "Straight pieces need no refinement");
    for (var i = 0; i <= 2000; i += 1) {
      var t = i / 2000, index = 1;
      while (index < large.length - 1 && large[index].t < t) { index += 1; }
      var a = large[index - 1], b = large[index], dx = 800 * (b.t - a.t), dy = 800 * (b.y - a.y);
      var distance = Math.abs(dx * 800 * (Math.sin(2 * Math.PI * t) - a.y) - dy * 800 * (t - a.t)) / Math.hypot(dx, dy);
      T.assert(distance <= P.curveTolerance + .015, "Curve error stays below a quarter CSS pixel");
    }
  });
  test("First-price adapts ticks and cached curves on resize while retaining exact cutoffs", async function () {
    var svg = doc.getElementById("tradeoff-chart"), bid = doc.getElementById("bid-number").value;
    var initialKey = svg.dataset.curveCacheKey;
    await width(375);
    await T.waitFor(function () { return svg.dataset.curveCacheKey !== initialKey; }, 3000, "The debounced resize redraw completes");
    T.assert(svg.dataset.curveCacheKey !== initialKey, "A new display size gets a new sampling budget");
    assertAxis(svg, "x");
    T.assert(Array.from(svg.querySelectorAll(".plot-y-tick")).some(function (n) { return n.textContent === "100%"; }));
    var path = svg.querySelector(".highest-bid-density-curve"), vertices = path.getAttribute("d").match(/-?\d+(?:\.\d+)?/g).map(Number);
    T.assert(vertices[vertices.length - 6] === vertices[vertices.length - 4], "The vertical support cutoff retains two heights at the same bid");
    T.assert(doc.getElementById("bid-number").value === bid, "Resizing preserves the selected bid");
    T.assert(win.getComputedStyle(path).vectorEffect === "non-scaling-stroke" && parseFloat(win.getComputedStyle(path).strokeWidth) === 2.25,
      "The density curve retains the common rendered stroke weight");
  });
  test("A density-parameter edit supersedes an unprocessed preview resize", async function () {
    var preview = doc.getElementById("value-pdf-preview");
    preview.style.width = preview.getBoundingClientRect().width * .75 + "px";
    var alpha = doc.getElementById("alpha-number"); alpha.value = "3"; T.dispatch(alpha, "change", win);
    await T.nextAnimationFrames(win, 4);
    T.assert(preview.dataset.alpha === "3" && preview.querySelector(".value-pdf-curve").dataset.alpha === "3",
      "The resized preview and its labels use the current distribution");
    var lower = doc.getElementById("lower-bound"); lower.value = ".000001"; T.dispatch(lower, "change", win);
    T.assert(preview.querySelector('[data-endpoint="a"]').textContent.endsWith("1e-6"),
      "Density preview endpoints use the shared tick formatter for small nonzero bounds");
  });
  [
    ["auction-equilibria/second-price", "second-price-chart"],
    ["auction-design/regular-optimal-auctions", "allocation-chart"],
    ["auction-design/general-optimal-auctions", "integrated-chart"],
    ["general-topics/envelope-theorem", "main-chart"]
  ].forEach(function (entry) {
    test(entry[0] + " uses readable ticks at phone and desktop widths", async function () {
      await load(entry[0]); var svg = doc.getElementById(entry[1]);
      T.assert(svg, "The chart is present");
      var wide = ticks(svg, "x").length;
      if (entry[1] === "second-price-chart") { legend(svg.closest("figure"), [svg.querySelector(".spa-truth"), svg.querySelector(".spa-proposed")]); }
      if (entry[0].includes("regular-optimal")) {
        [1, 2].forEach(function (i) {
          var chart = doc.getElementById("interim-" + i + "-chart");
          legend(chart.closest("figure"), [chart.querySelector(".curve-one,.curve-two"), chart.querySelector(".virtual-value-curve")]);
        });
      }
      if (entry[1] === "integrated-chart") {
        legend(svg.closest("figure"), [svg.querySelector(".integrated-curve"), svg.querySelector(".hull-curve"), svg.querySelector(".raw-curve"), svg.querySelector(".ironed-virtual-curve")]);
        var feasibility = doc.getElementById("feasibility-chart");
        legend(feasibility.closest("figure"), [feasibility.querySelector(".learner-curve"), feasibility.querySelector(".capacity-curve")]);
        var entries = win.MechanismNotation.pages["general-optimal-auctions"].pageNotation.flat();
        T.assert(entries.some(function (e) { return e[0].startsWith("A_i(") && e[0].includes("\\int_{E_"); }));
        T.assert(entries.some(function (e) { return e[0].startsWith("C_i(") && e[0].includes("1-[1-F_i(E_"); }));
      }
      await width(375); assertAxis(svg, "x"); assertAxis(svg, "y");
      T.assert(ticks(svg, "x").length <= wide, "Phone plots do not gain ticks");
      await width(1280); assertAxis(svg, "x"); assertAxis(svg, "y");
      if (entry[1] === "integrated-chart") { assertAxis(svg, "right"); T.assert(svg.dataset.yMin !== svg.dataset.y2Min, "The two scales remain independent"); }
    });
  });
  test("Trade rasters follow rendered size without rebuilding the exact editable mesh", async function () {
    await load("bilateral-trade/myerson-satterthwaite-theorem");
    var svg = doc.getElementById("buyer-ic-chart"), canvas = doc.querySelector('canvas[data-chart-for="buyer-ic-chart"]');
    var polygon = doc.querySelector("#paint-chart polygon[fill]"), firstSize = canvas.width;
    T.assert(doc.querySelectorAll("#paint-chart polygon[fill]").length === 800);
    await width(375);
    T.assert(canvas.width !== firstSize, "The compact and expanded diagnostic widths get different raster budgets");
    var dimensions = win.PlotStyle.dimensions(svg, { left: 35, right: 200, top: 15, bottom: 180 });
    T.assert(canvas.width >= Math.min(1200, dimensions.width * win.devicePixelRatio), "Raster resolution covers the displayed field");
    T.assert(polygon === doc.querySelector("#paint-chart polygon[fill]"), "Resizing retains the 800 editable triangles");
    assertAxis(svg, "x"); assertAxis(svg, "y");
  });
  test("Small M-S resizes reuse identical raster budgets while rule edits still repaint", async function () {
    await load("bilateral-trade/myerson-satterthwaite-theorem");
    var canvases = Array.from(doc.querySelectorAll("canvas[data-chart-for]"));
    var sizes = canvases.map(function (canvas) { return canvas.width; });
    var original = win.CanvasRenderingContext2D.prototype.putImageData, writes = 0;
    win.CanvasRenderingContext2D.prototype.putImageData = function () {
      if (canvases.indexOf(this.canvas) >= 0) { writes += 1; }
      return original.apply(this, arguments);
    };
    try {
      for (var size of [1278, 1276, 1274]) { await width(size); }
      T.assert(canvases.every(function (canvas, i) { return canvas.width === sizes[i]; }),
        "These widths keep each diagnostic in its existing pixel budget");
      T.assert(writes === 0, "Unchanged pixel budgets do not repaint diagnostic bitmaps");
      var paint = doc.getElementById("paint-chart"), brush = doc.getElementById("brush-value-slider");
      brush.value = "0"; T.dispatch(brush, "input", win);
      paint.setPointerCapture = function () {}; paint.hasPointerCapture = function () { return false; };
      var p = new win.DOMPoint(50 + 400 * .825, 440 - 400 * .215).matrixTransform(paint.getScreenCTM());
      ["pointerdown", "pointerup"].forEach(function (type) {
        T.dispatch(paint, type, win, { pointerId: 27, isPrimary: true, pointerType: "mouse", button: 0,
          buttons: type === "pointerdown" ? 1 : 0, clientX: p.x, clientY: p.y });
      });
      T.assert(writes === canvases.length, "An economic change repaints every diagnostic at the same size");
    } finally { win.CanvasRenderingContext2D.prototype.putImageData = original; }
  });
  test("Sandbox resizing upgrades display quality without recomputing or replacing the current rule", async function () {
    await load("bilateral-trade/bargaining-mechanism-sandbox");
    var root = doc.getElementById("bargaining-sandbox-explorable");
    await T.waitFor(function () { return root.dataset.qualityStatus === "complete"; }, 20000);
    var count = root.dataset.liveRenderCount, generation = root.dataset.appliedGeneration;
    var svg = doc.getElementById("allocation-chart"), canvas = doc.querySelector('canvas[data-chart-for="allocation-chart"]'), stateKey = canvas.dataset.stateKey;
    var frameNode = svg.querySelector('[data-layer="frame"]'), size = canvas.width;
    await width(375);
    await T.waitFor(function () { return root.dataset.qualityStatus === "complete" && canvas.width !== size; }, 20000);
    T.assert(root.dataset.liveRenderCount === count && root.dataset.appliedGeneration === generation && canvas.dataset.stateKey === stateKey);
    T.assert(frameNode === svg.querySelector('[data-layer="frame"]') && canvas.dataset.rasterQuality === "final");
    assertAxis(svg, "x"); assertAxis(svg, "y");
  });
  test("The M-S loss field reports and colors the actual lost surplus", async function () {
    await load("bilateral-trade/myerson-satterthwaite-theorem");
    var paint = doc.getElementById("paint-chart"), brush = doc.getElementById("brush-value-slider");
    brush.value = "0"; T.dispatch(brush, "input", win);
    paint.setPointerCapture = function () {}; paint.hasPointerCapture = function () { return false; };
    var p = new win.DOMPoint(50 + 400 * .825, 440 - 400 * .215).matrixTransform(paint.getScreenCTM());
    ["pointerdown", "pointerup"].forEach(function (type) {
      T.dispatch(paint, type, win, { pointerId: 21, isPrimary: true, pointerType: "mouse", button: 0, buttons: type === "pointerdown" ? 1 : 0, clientX: p.x, clientY: p.y });
    });
    await inspectLoss(.825, .215, .610);
  });
  async function inspectLoss(v, c, expected) {
    var svg = doc.getElementById("efficiency-chart"), box = svg.querySelector("rect.axis-line");
    var left = Number(box.getAttribute("x")), top = Number(box.getAttribute("y")), size = Number(box.getAttribute("width"));
    var p = new win.DOMPoint(left + v * size, top + (1 - c) * size).matrixTransform(svg.getScreenCTM());
    T.dispatch(svg, "pointermove", win, { pointerId: 31, isPrimary: true, pointerType: "mouse", buttons: 0, clientX: p.x, clientY: p.y });
    await T.nextAnimationFrames(win, 2);
    T.assert(svg.querySelector(".plot-probe-text").textContent === "L(v,c) = " + expected.toFixed(3));
    T.assert(svg.dataset.colorHigh === "yellow" && svg.dataset.colorZero === "clear", "Loss uses the utility palette");
    var canvas = doc.querySelector('canvas[data-chart-for="efficiency-chart"]');
    var color = canvas.getContext("2d").getImageData(Math.floor(v * canvas.width), Math.floor((1 - c) * canvas.height), 1, 1).data;
    T.assert(Math.abs(color[3] / 255 - expected) < .01, "Color intensity represents lost surplus, rather than unit allocation error");
  }
  test("Resizing during a Custom payment stroke waits for release and retains unrelated quality requests", async function () {
    await load("bilateral-trade/bargaining-mechanism-sandbox");
    await width(1280);
    doc.getElementById("preset-custom").click();
    var root = doc.getElementById("bargaining-sandbox-explorable"), checkbox = doc.getElementById("fix-ic-ir-checkbox");
    checkbox.checked = false; T.dispatch(checkbox, "change", win);
    var brush = doc.getElementById("seller-payment-value-number"); brush.value = ".15"; T.dispatch(brush, "change", win);
    var svg = doc.getElementById("seller-payment-chart"), canvas = doc.querySelector('canvas[data-chart-for="buyer-ic-chart"]');
    var captured = null, count = Number(root.dataset.liveRenderCount), size = canvas.width;
    svg.setPointerCapture = function (id) { captured = id; };
    svg.hasPointerCapture = function (id) { return id === captured; };
    svg.releasePointerCapture = function () { captured = null; };
    function pointer(type) {
      var p = new win.DOMPoint(374, 344).matrixTransform(svg.getScreenCTM());
      T.dispatch(svg, type, win, { pointerId: 18, pointerType: "mouse", isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: p.x, clientY: p.y });
    }
    pointer("pointerdown"); await width(375);
    T.assert(Number(root.dataset.liveRenderCount) === count && canvas.width === size, "Resize does not commit the stroke or repaint its derived diagnostics");
    pointer("pointerup");
    await T.waitFor(function () { return root.dataset.qualityStatus === "complete" && canvas.width !== size; }, 20000);
    T.assert(Number(root.dataset.liveRenderCount) === count + 1, "Exactly one economic refresh occurs on release");
    T.assert(canvas === doc.querySelector('canvas[data-chart-for="buyer-ic-chart"]') && canvas.dataset.rasterQuality === "final",
      "The unaffected buyer field receives its pending resize upgrade without replacing the canvas");
  });
  test("The sandbox loss field uses exact surplus units and utility colors", async function () {
    await load("bilateral-trade/bargaining-mechanism-sandbox");
    var root = doc.getElementById("bargaining-sandbox-explorable");
    doc.getElementById("preset-revenue-threshold").click();
    await T.waitFor(function () { return root.dataset.qualityStatus === "complete"; }, 20000);
    await inspectLoss(.4, .2, .2);
  });
  T.run(tests, { title: "Plot presentation tests" });
}());
