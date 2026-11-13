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
  function capacityLabelFits() {
    var plot = el("feasibility-chart").querySelector(".plot-frame").getBoundingClientRect();
    var formula = el("feasibility-capacity-label"), label = formula.getBoundingClientRect();
    var exponent = formula.querySelector('tspan[baseline-shift="super"]');
    var bracket = exponent.previousElementSibling;
    assert(Number.parseFloat(exponent.getAttribute("dx")) > 0 &&
      exponent.getBoundingClientRect().left > bracket.getBoundingClientRect().right,
      "The exponent clears the preceding bracket at every responsive width");
    assert(label.width > 0 && label.height > 0, "The capacity formula is visible");
    assert(label.left >= plot.left - 0.5 && label.right <= plot.right + 0.5 &&
      label.top >= plot.top - 0.5 && label.bottom <= plot.bottom + 0.5,
      "The capacity formula stays inside the plot at " + win.innerWidth + "px; label=" + [label.left, label.top, label.right, label.bottom].join(",") + "; plot=" + [plot.left, plot.top, plot.right, plot.bottom].join(","));
  }
  async function fresh(math) {
    frame.style.width = "1280px";
    var page = await T.loadFrame(frame, "../auction-design/general-optimal-auctions/index.html?test=" + Math.random(), {
      timeout: 15000, math: math || "#distribution-controls",
      ready: function (loaded) { return loaded.body.dataset.ready === "true"; }
    });
    doc = page.document; win = page.window;
  }
  function test(name, run, math) { tests.push({ name: name, run: async function () { await fresh(math); await run(); } }); }
  function captureStub() {
    var svg = el("allocation-chart"), captured = null;
    svg.setPointerCapture = function (id) { captured = id; };
    svg.hasPointerCapture = function (id) { return id === captured; };
    svg.releasePointerCapture = function () { captured = null; };
  }
  function pointer(target, type, v, q, options) {
    var svg = el("allocation-chart"), p = svg.createSVGPoint();
    p.x = 54 + 560 * v; p.y = 316 - 292 * q; p = p.matrixTransform(svg.getScreenCTM());
    T.dispatch(target, type, win, Object.assign({ pointerId: 17, isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: p.x, clientY: p.y }, options));
  }
  // Check the complete lesson once; interaction cases need the control mathematics.
  test("Local dependencies, lesson mathematics, and the interim editor initialize correctly", async function () {
    T.assertScriptOrder(doc, ["../../js/components.js", "../../js/bibliography.js", "../../js/references.js", "../../js/mathjax-config.js",
      "../../assets/mathjax/tex-svg.js", "../../js/mathjax-runtime.js", "../../js/math-utils.js", "../../js/svg-utils.js", "model.js", "charts.js", "app.js"]);
    assert(!el("lottery-chart") && doc.querySelectorAll(".control-points [role=slider]").length === 11);
    assert(win.IroningModel && !win.OptimalAuctionsModel, "The two auction models have isolated namespaces");
    assert(doc.getElementById("page-title").textContent === "General Optimal Auctions" &&
      doc.querySelector("page-header").getAttribute("category") === "Auction Design", "Independent auction title and group");
    assert(el("bic-status").dataset.passed === "true" && el("feasibility-status").dataset.passed === "true");
    assert(el("bic-verdict").textContent === "BIC: passes" && el("bic-monotonicity").textContent === "is weakly increasing");
    assert(el("feasibility-status").textContent === "Single-item feasibility: passes (the curve lies entirely below or at the dotted curve)");
    var feasibilityTitle = el("feasibility-chart").closest("figure").querySelector("figcaption");
    assert(feasibilityTitle.textContent.startsWith("Total allocation above ") &&
      feasibilityTitle.querySelectorAll("mjx-container").length === 2 &&
      feasibilityTitle.querySelector('[data-mml-node="msub"]'), "The requested title renders alpha and the total-allocation integral");
    var capacityLabel = el("feasibility-capacity-label");
    assert(capacityLabel.tagName === "text" && el("feasibility-chart").contains(capacityLabel) &&
      capacityLabel.querySelector('tspan[baseline-shift="sub"]').textContent === "α" &&
      capacityLabel.querySelector('tspan[baseline-shift="super"]').textContent === "n", "The capacity formula uses native text with its subscript and superscript");
    var capacityStyle = win.getComputedStyle(capacityLabel), virtualStyle = win.getComputedStyle(el("integrated-chart").querySelector(".virtual-value-label"));
    ["fontFamily", "fontSize", "fill", "paintOrder"].forEach(function (property) {
      assert(capacityStyle[property] === virtualStyle[property], "Both in-plot annotations share " + property);
    });
    assert(!el("feasibility-chart").querySelector("mjx-container"), "Chart annotations contain no MathJax");
    var feasibilityAxis = el("feasibility-chart").closest("figure").querySelector(".chart-x-axis-label");
    assert(feasibilityAxis.textContent.includes("Allocation-probability threshold") && feasibilityAxis.querySelector("mjx-container"), "The alpha axis renders with local MathJax");
    assert(revenue() > 0 && !el("benchmark-summary"));
    var green = doc.createElement("span"); green.style.color = "var(--green)"; doc.body.appendChild(green);
    assert(win.getComputedStyle(el("revenue-value").closest("p")).color === win.getComputedStyle(green).color, "Expected revenue text is green"); green.remove();
    assert(doc.querySelectorAll("merror").length === 0);
    ["allocation-chart", "payment-chart", "integrated-chart"].forEach(function (id) {
      var figure = el(id).closest("figure");
      assert(figure.querySelector('figcaption mjx-container [data-mml-node="msub"]'), "Each buyer-specific caption renders its subscript i: " + id);
      assert(figure.querySelector('.chart-x-axis-label mjx-container [data-mml-node="msub"]'), "Value and quantile axes retain indexed buyer notation: " + id);
    });
    ["value-number", "allocation-number"].forEach(function (id) {
      assert(doc.querySelector('label[for="' + id + '"] mjx-container [data-mml-node="msub"]'), "Point controls render indexed notation: " + id);
    });
    assert(el("integrated-description").textContent.includes("z=F_i(v_i)") &&
      el("integrated-description").textContent.includes("H_i(z)") &&
      !el("integrated-description").textContent.includes("u=F(v)"), "Demo quantiles use z consistently with the proof.");
    var notation = win.MechanismNotation.pages["general-optimal-auctions"];
    var demoSymbols = notation.pageNotation.reduce(function (all, group, index) {
      return notation.pageNotationSections[index] === "Demo" ? all.concat(group.map(function (entry) { return entry[0]; })) : all;
    }, []);
    assert(demoSymbols.length === 4 && demoSymbols[0] === "c" && demoSymbols[1] === "\\pi" &&
      demoSymbols[2].startsWith("\\alpha") && demoSymbols[3].startsWith("E_\\alpha"),
      "Demo notation defines the breakpoint, interval probability, allocation cutoff and its type set separately.");
    assert(notation.environmentNotation === win.MechanismNotation.pages["auction-design"].environmentNotation,
      "Indexed buyer definitions retain their shared Environment owner.");
    assert(doc.querySelector('[data-reference="border-1991"]').textContent.includes("1991"));
    var note = el("border-feasibility-note"), noteReference = el("border-feasibility-note-ref");
    assert(note.querySelector('[data-citation="border-1991"]').textContent === "Border (1991)" &&
      note.querySelector("mjx-container"), "The supplied Border note renders its citation and allocation-level set");
    assert(!/\\\(|\\\[/.test(note.textContent), "The note contains rendered mathematics");
    assert(noteReference.getAttribute("role") === "doc-noteref" &&
      noteReference.closest("p").textContent.includes("allocate too much to any group of values."),
      "The numbered note reference accompanies the allocation warning");
    noteReference.click(); await T.nextAnimationFrames(win, 2);
    assert(win.location.hash === "#border-feasibility-note", "The reference navigates to the note");
    note.querySelector('[role="doc-backlink"]').click(); await T.nextAnimationFrames(win, 2);
    assert(win.location.hash === "#border-feasibility-note-ref", "The note links back to its reference");
    ["allocation-description", "live-summary"].forEach(function (id) {
      assert(!/\\\(|\\\[/.test(el(id).textContent), "Accessible summaries contain plain text: " + id);
    });
  }, ".introduction, #distribution-controls, #auction-demo, #derivation, #expected-revenue, #optimal-mechanism, #notes");
  test("Editing Q updates payments, revenue, and IC immediately", function () {
    var original = revenue(), payment = el("payment-chart").querySelector(".learner-curve").getAttribute("d");
    assert(el("payment-caption").textContent === "Interim payment", "Initial payment caption");
    choose(0); input("allocation-number", "0.9");
    assert(el("bic-status").dataset.passed === "false");
    assert(el("bic-verdict").textContent === "BIC: fails" && el("bic-monotonicity").textContent === "is not weakly increasing");
    assert(el("revenue-label").textContent === "Expected revenue", "IC failure preserves the expected-revenue label");
    assert(revenue() !== original && el("payment-chart").querySelector(".learner-curve").getAttribute("d") !== payment);
    assert(el("payment-caption").textContent === "Interim payment", "IC failure preserves the payment caption");
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
  test("Only one primary pointer can own an allocation drag", function () {
    var svg = el("allocation-chart"); captureStub();
    var original = Number(el("allocation-number").value);
    pointer(handle(6), "pointerdown", 0.6, 0.8, { isPrimary: false, pointerId: 99 });
    pointer(svg, "pointermove", 0.7, 0.9, { pointerId: 99 });
    pointer(handle(6), "pointerdown", 0.6, 0.8, { button: 2 });
    pointer(svg, "pointermove", 0.7, 0.9);
    close(Number(el("allocation-number").value), original, 1e-9, "Secondary pointers and right clicks cannot edit or select a point");
    assert(svg.dataset.selectedIndex === "5");

    pointer(handle(5), "pointerdown", 0.5, original);
    pointer(handle(6), "pointerdown", 0.6, 0.8, { pointerId: 99 });
    pointer(svg, "pointercancel", 0.6, 0.8, { pointerId: 99 });
    pointer(svg, "pointermove", 0.52, 0.6);
    assert(svg.dataset.selectedIndex === "5", "Another pointer cannot replace the dragged point");
    close(Number(el("allocation-number").value), 0.6, 1e-9, "The original pointer retains control after unrelated cancellation");
    pointer(svg, "lostpointercapture", 0.52, 0.6);
    pointer(svg, "pointermove", 0.8, 0.9);
    close(Number(el("allocation-number").value), 0.6, 1e-9, "Capture loss ends dragging");
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
  test("Alpha feasibility paths include allocation knots, both Border values, and the exact witness", function () {
    input("bidder-number", "4"); el("use-optimum").click(); input("mass-number", "0.62");
    var M = win.IroningModel, rule = M.adoptedRule(M.benchmark(4), 4, M.distribution(0.5, 0.62));
    var svg = el("feasibility-chart"), cuts = [0, 1, rule.feasibility.witness.q];
    rule.feasibility.segments.forEach(function (piece) { cuts.push(piece.q0, piece.q1); });
    assert(!rule.feasibility.feasible);
    close(Number(svg.dataset.yMax), rule.n);
    [["allocation", ".learner-curve", ".demand-limit"], ["capacity", ".capacity-curve", ".capacity-limit"]].forEach(function (curve) {
      var vertices = Array.from(svg.querySelectorAll(curve[1])).flatMap(function (path) {
        var values = path.getAttribute("d").match(/-?\d+(?:\.\d+)?/g).map(Number), result = [];
        for (var i = 0; i < values.length; i += 2) { result.push([values[i], values[i + 1]]); }
        return result;
      });
      Array.from(svg.querySelectorAll(curve[2])).forEach(function (point) {
        vertices.push([Number(point.getAttribute("cx")), Number(point.getAttribute("cy"))]);
      });
      cuts.forEach(function (alpha) {
        alpha = Math.max(0, Math.min(1, alpha));
        var value = M.levelAt(rule, alpha)[curve[0]], x = 54 + 560 * alpha, y = 316 - 292 * value;
        assert(vertices.some(function (vertex) { return Math.abs(vertex[0] - x) < 0.0001 && Math.abs(vertex[1] - y) < 0.0001; }),
          "The " + curve[0] + " curve includes allocation threshold " + alpha);
      });
    });
    assert(!svg.querySelector(".violation-dot"), "Violations use red curve portions without a separate red point");
    assert(svg.querySelector(".learner-curve.violation-curve"), "An infeasible rule has a red portion");
    assert(el("feasibility-description").textContent.includes("Maximum excess " + rule.feasibility.witness.excess.toFixed(6)));
    assert(el("feasibility-description").textContent.includes("at alpha") && el("feasibility-description").textContent.includes("multiplied by n"));
  });
  test("Flat allocation levels keep included endpoints and separate right limits at zero, one half, and one", function () {
    var svg = el("feasibility-chart");
    [0, 0.5, 1].forEach(function (q) {
      for (var i = 0; i < 11; i += 1) { choose(i); input("allocation-number", String(q)); }
      close(Number(svg.dataset.yMin), 0); close(Number(svg.dataset.yMax), 2);
      close(sampleChart("feasibility-chart", 0.25), 2 * q, 2e-6);
      close(sampleChart("feasibility-chart", 0.25, ".capacity-curve"), q === 0 ? 0 : 1, 2e-6);
      var closed = svg.querySelector(".capacity-limit.limit-closed"), open = svg.querySelector(".capacity-limit.limit-open");
      close(Number(closed.getAttribute("cx")), 54 + 560 * q, 1e-9);
      close(Number(closed.getAttribute("cy")), 170, 1e-9);
      if (q < 1) {
        assert(open, "A flat level has an open right limit within the alpha domain");
        close(Number(open.getAttribute("cx")), 54 + 560 * q, 1e-9);
        close(Number(open.getAttribute("cy")), 316, 1e-9);
        close(sampleChart("feasibility-chart", 0.75), 0, 2e-6);
        svg.querySelectorAll(".learner-curve, .capacity-curve").forEach(function (path) {
          var box = path.getBBox(), cutoff = 54 + 560 * q;
          assert(box.x >= cutoff - 0.0001 || box.x + box.width <= cutoff + 0.0001, "Paths never interpolate across a flat-level jump");
        });
      } else {
        assert(!open, "Alpha one has no right limit inside the domain");
        assert(svg.querySelector(".demand-limit.limit-closed") && svg.querySelector(".learner-curve.violation-curve") && !svg.querySelector(".violation-dot"));
      }
      finiteGeometry();
    });
  });
  test("Alpha curves use disconnected allocation-level sets even when BIC fails", function () {
    var points = win.IroningModel.initial(2);
    points.forEach(function (point, i) { choose(i); input("allocation-number", String(Math.abs(2 * point.v - 1))); });
    assert(el("bic-status").dataset.passed === "false" && el("feasibility-status").dataset.passed === "true");
    [0.1, 0.3, 0.7, 0.9].forEach(function (alpha) {
      var expected = 1 - alpha * alpha;
      close(sampleChart("feasibility-chart", alpha), expected, 2e-5);
      close(sampleChart("feasibility-chart", alpha, ".capacity-curve"), expected, 2e-5);
    });
  });
  test("Red allocation portions follow exact crossings, including a violation narrower than a drawing step", function () {
    input("mass-number", "0.5");
    var height = 2e-8, shift = (0.88 - Math.sqrt(0.768 + 0.8 * height)) / 0.4;
    var center = (2.8 + shift) / 5, radius = 6 * Math.sqrt(height / 5);
    var redRadius = 6 * Math.sqrt((height - 1e-9) / 5);
    for (var i = 0; i <= 10; i += 1) {
      var v = i / 10, q = v <= 0.5 ? Math.max(0, 0.4 * v - shift) : (v >= 0.6 ? 0.8 - shift : 6 * v - 2.8 - shift);
      choose(i); input("allocation-number", String(q));
    }
    var svg = el("feasibility-chart"), paths = Array.from(svg.querySelectorAll(".learner-curve"));
    var red = paths.filter(function (path) { return path.classList.contains("violation-curve"); });
    assert(el("feasibility-status").dataset.passed === "false" && red.length > 0 && red.length < paths.length,
      "The narrow violation is red while the remaining allocation curve stays blue");
    assert(!svg.querySelector(".violation-dot"), "The old red witness point is absent");
    var endpoints = [];
    paths.forEach(function (path) {
      var a = Number(path.dataset.alphaStart), b = Number(path.dataset.alphaEnd), midpoint = (a + b) / 2;
      assert(Number.isFinite(a) && Number.isFinite(b) && a < b, "Every curve portion has a nonempty alpha interval");
      endpoints.push(a, b);
      if (midpoint > 0.2 && midpoint < 0.78) {
        // Direct integration of this affine rule gives the scaled Border excess below.
        var gap = height - 5 * Math.pow(midpoint - center, 2) / 36;
        if (Math.abs(gap - 1e-9) > 1e-13) {
          assert(path.classList.contains("violation-curve") === (gap > 1e-9),
            "Each portion's color agrees with the independently integrated demand minus capacity");
        }
      }
    });
    [center - radius, center + radius, center - redRadius, center + redRadius].forEach(function (alpha) {
      assert(endpoints.some(function (endpoint) { return Math.abs(endpoint - alpha) < 2e-8; }),
        "Drawing cuts retain the exact crossing at alpha " + alpha);
    });
    var redStart = Math.min.apply(null, red.map(function (path) { return Number(path.dataset.alphaStart); }));
    var redEnd = Math.max.apply(null, red.map(function (path) { return Number(path.dataset.alphaEnd); }));
    close(redStart, center - redRadius, 2e-8); close(redEnd, center + redRadius, 2e-8);
    assert(redEnd - redStart < 1 / 350, "The violation is narrower than the ordinary drawing sample step");
    var colorProbe = doc.createElement("span"); doc.body.appendChild(colorProbe);
    colorProbe.style.color = "var(--red)";
    assert(win.getComputedStyle(red[0]).stroke === win.getComputedStyle(colorProbe).color, "Above-capacity portions use red");
    colorProbe.style.color = "var(--blue)";
    assert(win.getComputedStyle(paths.find(function (path) { return !path.classList.contains("violation-curve"); })).stroke ===
      win.getComputedStyle(colorProbe).color, "The remaining allocation portions use blue");
    colorProbe.remove();
    el("reset-button").click();
    assert(el("feasibility-status").dataset.passed === "true" && !svg.querySelector(".violation-curve"),
      "Exact equality of the efficient rule and capacity has no red portions");
    [0.13, 0.51, 0.87].forEach(function (alpha) {
      close(sampleChart("feasibility-chart", alpha), 1 - alpha * alpha, 2e-5);
      close(sampleChart("feasibility-chart", alpha, ".capacity-curve"), 1 - alpha * alpha, 2e-5);
    });
    finiteGeometry();
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
  test("Bidder changes load the exact efficient mechanism for the current distribution", function () {
    var M = win.IroningModel;
    [[0.5,0.75], [0.37,0.81]].forEach(function (values) {
      input("split-number", String(values[0])); input("mass-number", String(values[1]));
      var d = M.distribution(values[0], values[1]);
      [3,5,2,4].forEach(function (n) {
        ["edited", "optimal"].forEach(function (previous) {
          input("bidder-number", n === 2 ? "3" : "2");
          if (previous === "optimal") { el("use-optimum").click(); }
          else { choose(5); input("allocation-number", "0.95"); }
          input("bidder-number", String(n));
          var expected = M.adoptedRule(M.efficient(n,d), n, d);
          close(Number(el("bidder-number").value), n); close(revenue(), expected.revenue, 1e-10);
          close(Number(el("split-number").value), values[0]); close(Number(el("mass-number").value), values[1]);
          assert(el("bic-status").dataset.passed === "true" && el("feasibility-status").dataset.passed === "true");
          assert(el("interpolation-kind").textContent.includes("Exact efficient curves"));
          [0.137,0.713,1].forEach(function (v) {
            close(sampleChart("allocation-chart", v), Math.pow(M.cdf(v,d),n-1), 4e-5);
            close(sampleChart("payment-chart", v), M.evaluate(expected,v).payment, 4e-5);
          });
        });
      });
    });
  });
  test("Supply-infeasible rules retain expected-revenue labels and identify red allocation portions", function () {
    for (var i = 0; i < 11; i += 1) { choose(i); input("allocation-number", "1"); }
    assert(el("bic-status").dataset.passed === "true" && el("feasibility-status").dataset.passed === "false");
    assert(el("revenue-label").textContent === "Expected revenue" && !el("revenue-gap"));
    assert(el("feasibility-status").textContent === "Single-item feasibility: fails (the curve lies above the dotted curve where it is red)");
    assert(el("feasibility-chart").querySelector(".learner-curve.violation-curve") && !el("feasibility-chart").querySelector(".violation-dot"));
    assert(el("payment-caption").textContent === "Interim payment", "Supply infeasibility preserves the payment caption");
  });
  test("All responsive layouts fit and reserve at least 14px of chart padding", async function () {
    await win.mechanismMathReady;
    for (var width of [320, 375, 701, 768, 1280]) {
      frame.style.width = width + "px"; await T.nextAnimationFrames(win, 3);
      assert(doc.documentElement.scrollWidth <= width + 1, "No page overflow at " + width);
      capacityLabelFits();
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
    frame.style.width = "320px";
    input("bidder-number", "5");
    var count = el("allocation-chart").querySelectorAll(".control-points [data-index]").length;
    for (var i = 0; i < count; i += 1) { choose(i); input("allocation-number", "0"); }
    await T.nextAnimationFrames(win, 3);
    capacityLabelFits();
    assert(el("feasibility-capacity-label").querySelector("tspan"), "The native formula remains rendered after distribution and rule changes");
    frame.style.width = "1280px"; doc.body.style.zoom = "2";
    await T.nextAnimationFrames(win, 3);
    capacityLabelFits();
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
    assert(label.textContent === "φᵢ ∘ Fᵢ⁻¹"); close(Number(label.getAttribute("x")), 166);
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
    assert(el("bic-status").dataset.passed === "false" && el("revenue-label").textContent === "Expected revenue");
    finiteGeometry();
  });
  test("Revenue is attached below the payment plot and equals n times each buyer's expected payment", async function () {
    var figure = el("payment-chart").closest("figure"), viewport = el("payment-chart").closest(".chart-viewport");
    assert(figure.contains(el("revenue-label")) && figure.contains(el("revenue-value")));
    assert(el("revenue-value").getBoundingClientRect().top >= viewport.getBoundingClientRect().bottom - 1);
    assert(viewport.querySelector(".chart-axis-label").textContent.includes("Value"));
    assert(!el("payment-chart").querySelector(".payment-area"));
    await win.mechanismMathReady;
    var diagnostic = el("revenue-diagnostic");
    assert(diagnostic.querySelector('mjx-container [data-mml-node="mo"]') &&
      diagnostic.textContent.includes("expected payment from each buyer"), "The revenue line renders n times the per-buyer payment");
    function checkExpectedPayments(n) {
      var perBuyer = Number(el("expected-payment").dataset.value);
      assert(el("revenue-label").textContent === "Expected revenue");
      close(n * perBuyer, revenue(), 1e-12, "All buyers' payments sum to total expected revenue");
      close(Number(el("expected-payment").textContent), perBuyer, 0.00000051, "The displayed per-buyer payment rounds the same model value");
      close(Number(el("revenue-value").textContent), revenue(), 0.00000051, "The displayed total rounds the same model value");
    }
    checkExpectedPayments(2);
    [3, 5, 2].forEach(function (n) {
      input("bidder-number", String(n)); el("use-optimum").click();
      close(revenue(), win.IroningModel.benchmark(n).revenue, 1e-10);
      checkExpectedPayments(n);
    });
    choose(0); input("allocation-number", "0.9");
    assert(el("bic-status").dataset.passed === "false", "The payment decomposition also applies when IC fails");
    checkExpectedPayments(2);
    assert(el("payment-description").textContent.includes("across all bidders"));
  });
  test("Shared FPA controls and preview retain their box sizing, bolding, and compact layout", async function () {
    var reference = document.createElement("iframe");
    reference.style.cssText = "position:absolute;left:-10000px;width:1280px;height:1000px;";
    reference.title = "First-price shared-style reference";
    var loaded = new Promise(function (resolve) { reference.onload = resolve; });
    reference.src = "../auction-equilibria/first-price/index.html"; document.body.appendChild(reference);
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
      assert(el("value-pdf-preview").querySelector('[data-endpoint="a"]').textContent === "vᵢ = 0");
      assert(el("value-pdf-preview").querySelector('[data-endpoint="b"]').textContent === "vᵢ = 1");
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
  test("Use efficient mechanism loads exact highest-value allocations for 2 through 5 buyers", function () {
    var M = win.IroningModel;
    assert(el("reset-button").textContent === "Use efficient mechanism");
    [[0.5,0.75], [0.37,0.81], [0.6,0.6]].forEach(function (values) {
      input("split-number", String(values[0])); input("mass-number", String(values[1]));
      var d = M.distribution(values[0], values[1]);
      for (var n = 2; n <= 5; n += 1) {
        input("bidder-number", String(n)); el("use-optimum").click(); el("reset-button").click();
        assert(el("bic-status").dataset.passed === "true" && el("feasibility-status").dataset.passed === "true", "Efficient rule is implementable");
        assert(el("interpolation-kind").textContent.includes("Exact efficient curves"));
        [0,0.137,0.713,1].forEach(function (v) {
          close(sampleChart("allocation-chart", v), Math.pow(M.cdf(v,d), n - 1), 4e-5, "Efficient curve remains exact between handles");
        });
        var rule = M.adoptedRule(M.efficient(n,d),n,d); close(revenue(), rule.revenue, 1e-10);
        close(Number(el("split-number").value), values[0]); close(Number(el("mass-number").value), values[1]);
        choose(el("allocation-chart").querySelectorAll('.control-points [data-index]').length - 1);
        close(Number(el("allocation-number").value), 1, 1e-10, "Highest type wins with probability one");
      }
    });
  });
  test("Revenue uses the same diagnostic spacing as the other plots", async function () {
    for (var width of [320,375,768,1280]) {
      frame.style.width = width + "px"; await T.nextAnimationFrames(win,3);
      var figure = el("payment-chart").closest("figure"), axis = figure.querySelector(".chart-x-axis-label"), diagnostic = el("revenue-value").closest("p");
      close(diagnostic.getBoundingClientRect().top - axis.getBoundingClientRect().bottom, 14, 0.2, "Shared revenue spacing at " + width);
      assert(win.getComputedStyle(diagnostic).lineHeight === win.getComputedStyle(el("bic-status")).lineHeight);
    }
  });
  test("Selection reuses curves, and allocation edits preserve distribution-only charts", function () {
    function nodes() {
      return [el("allocation-chart").querySelector(".learner-curve"), el("payment-chart").querySelector(".learner-curve"),
        el("feasibility-chart").querySelector(".learner-curve"), el("integrated-chart").querySelector(".integrated-curve"),
        el("value-pdf-preview").querySelector(".value-pdf-curve")];
    }
    var before = nodes(); choose(2); choose(0);
    T.dispatch(handle(0), "keydown", win, { key: "ArrowLeft" });
    nodes().forEach(function (node,i) { assert(node === before[i], "Selection and clamped edits retain existing chart nodes"); });
    choose(5); input("allocation-number", "0.4");
    var edited = nodes();
    [0,1,2].forEach(function (i) { assert(edited[i] !== before[i], "Allocation-dependent curves update after editing"); });
    [3,4].forEach(function (i) { assert(edited[i] === before[i], "Irregularity and density depend only on the distribution"); });
    input("bidder-number", "4");
    assert(nodes()[3] === before[3] && nodes()[4] === before[4], "Bidder changes also preserve distribution-only charts");
    input("mass-number", "0.6");
    assert(nodes()[3] !== before[3] && nodes()[4] !== before[4], "Distribution changes refresh both charts");
    finiteGeometry();
  });
  T.run(tests, { title: "General Optimal Auctions interface tests" });
})();
