(function () {
  "use strict";
  var T = MechanismTest, assert = T.assert, close = T.assertClose;
  var frame = document.getElementById("app-frame");
  var doc, win, serial = 0;
  function el(id) { return doc.getElementById(id); }
  function totalPayments() { return Number(el("expected-payment-1").dataset.value) + Number(el("expected-payment-2").dataset.value); }
  function keyboard(key, type) { T.dispatch(el("allocation-chart"), type || "keydown", win, { key: key }); }
  function tap(key) { keyboard(key); keyboard(key, "keyup"); }
  function input(id, value) { el(id).value = value; T.dispatch(el(id), "input", win); }
  function brush(a, b) { input("brush-q1", "0"); input("brush-q2", "0"); input("brush-q1", String(a)); input("brush-q2", String(b)); }
  async function fresh() {
    frame.style.width = "1280px";
    var page = await T.loadFrame(frame, "../auction-design/regular-optimal-auctions/index.html?style-test=" + (++serial), {
      timeout: 15000, math: "main", ready: function (loaded) { return loaded.body.dataset.ready === "true"; }
    });
    doc = page.document; win = page.window;
    simulateCapture(el("allocation-chart")); simulateCapture(el("lottery-chart"));
  }
  function coordinates(svg, x, y) {
    var p = svg.createSVGPoint(); p.x = x; p.y = y;
    var screen = p.matrixTransform(svg.getScreenCTM());
    return { clientX: screen.x, clientY: screen.y };
  }
  function pointer(svg, type, x, y, id, options) {
    T.dispatch(svg, type, win, Object.assign({ pointerId: id || 11, isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }, coordinates(svg, x, y), options));
  }
  function simulateCapture(svg) {
    var captured = null;
    svg.setPointerCapture = function (id) { captured = id; };
    svg.hasPointerCapture = function (id) { return captured === id; };
    svg.releasePointerCapture = function () { captured = null; };
  }
  function padding(svg) {
    var box = svg.getBBox(), matrix = svg.getScreenCTM();
    var top = matrix.d * box.y + matrix.f;
    var bottom = matrix.d * (box.y + box.height) + matrix.f;
    var viewport = svg.closest(".chart-viewport");
    if (!viewport) { return [Infinity]; }
    viewport.querySelectorAll(".math-chart-axis-label").forEach(function (node) {
      var r = node.getBoundingClientRect(); top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom);
    });
    var outer = viewport.getBoundingClientRect();
    return [top - outer.top, outer.bottom - bottom];
  }
  var tests = [];
  function test(name, run) { tests.push({ name: name, run: async function () { await fresh(); await run(); } }); }

  test("Appendix equations fit the drawer at responsive widths", async function () {
    await T.waitFor(function () {
      return !/\\\(|\\\[/.test(doc.querySelector("main").textContent);
    }, 15000, "Initial lesson mathematics readiness");
    var host = doc.querySelector("learning-sidebar");
    host.querySelector(".learning-sidebar-toggle").click();
    host.querySelectorAll('[role="tab"]')[2].click();
    var panel = host.querySelector(".learning-sidebar-insights");
    await T.waitFor(function () {
      assert(!panel.hasAttribute("data-render-error"), "Insights mathematics must render successfully");
      return !panel.hasAttribute("aria-busy") && !!panel.querySelector("mjx-container");
    }, 45000, "Insights mathematics readiness");
    assert(!panel.querySelector("mjx-merror, merror"), "Insights equations render without errors");
    for (var width of [320, 375, 768, 1280]) {
      frame.style.width = width + "px";
      await T.nextAnimationFrames(win, 2);
      panel.querySelectorAll(".equation-display, .equation-chain-steps").forEach(function (equation) {
        assert(equation.scrollWidth <= equation.clientWidth + 1,
          "No horizontal equation scrollbar at " + width + "px");
      });
      var chain = panel.querySelector(".equation-chain-steps");
      close(parseFloat(win.getComputedStyle(chain).fontSize), parseFloat(win.getComputedStyle(panel).fontSize));
      var content = host.querySelector(".learning-sidebar-content");
      assert(content.scrollWidth <= content.clientWidth + 1, "The drawer should not scroll horizontally");
    }
  });

  test("M-S geometry and always-visible brush replace presets and mode controls", function () {
    T.assertScriptOrder(doc, ["../../js/components.js", "../../js/mathjax-config.js", "../../assets/mathjax/tex-svg.js", "../../js/mathjax-runtime.js", "../../js/math-utils.js", "../../js/svg-utils.js", "../../js/bilateral-trade-visuals.js", "model.js", "charts.js", "app.js"]);
    assert(el("allocation-chart").getAttribute("viewBox") === "0 0 480 520", "Same chart coordinate frame as M-S");
    var frameBox = el("allocation-chart").querySelector("rect.axis-line");
    assert(frameBox.getAttribute("x") === "50" && frameBox.getAttribute("y") === "40" && frameBox.getAttribute("width") === "400" && frameBox.getAttribute("height") === "400", "Same 400px plot and margins");
    assert(el("allocation-chart").querySelectorAll(".allocation-layer > polygon").length === 800, "Same exact 800 triangles");
    assert(!doc.querySelector("[data-preset], [data-brush], #interaction-mode, #paint-selected, #other-half, details"), "No unrelated presets, brush shortcuts, Paint/Inspect mode, or collapsed brush");
    assert(el("lottery-controls").closest(".main-column") && el("lottery-chart").getBoundingClientRect().height > 0, "Visible triangle brush under the grid");
    close(totalPayments(), 1 / 3);
    [1, 2].forEach(function (bidder) {
      assert(el("interim-" + bidder + "-chart").querySelectorAll(".interim-curve").length === 20, "Separate allocation pieces");
      assert(el("payment-" + bidder + "-chart").querySelectorAll(".payment-area").length === 20, "Separate payment pieces");
    });
    assert(!doc.querySelector(".assumption-line, .formula-label, .diagnostic-key, .payment-key, #optimal-revenue, #bic-details, #brush-summary, #bidder-revenues"), "Only requested diagnostic and control labels remain");
    assert(el("optimal-button").textContent === "Use optimal mechanism" && el("distribution-controls"), "Distribution controls and an optimal mechanism button are available");
  });
  test("Each bidder has directly labeled allocation and payment plots with diagnostics below", function () {
    [1, 2].forEach(function (bidder) {
      var interim = el("interim-" + bidder + "-chart");
      var payment = el("payment-" + bidder + "-chart");
      assert(interim.closest("figure") !== el("interim-" + (3 - bidder) + "-chart").closest("figure"), "Independent labeled allocation figures");
      assert(interim.querySelector(".virtual-value-curve") && win.getComputedStyle(interim.querySelector(".virtual-value-curve")).strokeDasharray !== "none", "Virtual value is dashed");
      assert(!interim.querySelector(".virtual-included, .virtual-excluded, .payment-area"), "No included/excluded virtual-surplus plots");
      var path = interim.querySelector(".interim-curve").getAttribute("d");
      var numbers = path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
      close(numbers[1], 145); close(numbers[numbers.length - 1], 138.75);
      assert(win.getComputedStyle(interim.querySelector(".interim-curve")).strokeDasharray === "none", "Interim allocation is solid for either bidder");
      var status = el("bic-status-" + bidder);
      assert(status.closest("figure") === interim.closest("figure") && status.getBoundingClientRect().top > interim.getBoundingClientRect().top, "BIC below its allocation chart");
      assert(win.getComputedStyle(status).textAlign === "left", "BIC diagnostic is left aligned");
      assert(!el("ir-status-" + bidder), "No IR diagnostic");
      assert(el("bic-monotonicity-" + bidder).textContent === "is weakly increasing", "Passing monotonicity explanation");
      var passProbe = doc.createElement("span");
      passProbe.style.color = "var(--green)"; doc.body.appendChild(passProbe);
      assert(win.getComputedStyle(status).color === win.getComputedStyle(passProbe).color, "Passing verdict is green");
      passProbe.remove();
      assert(Array.from(interim.querySelectorAll("text")).some(function (n) { return n.textContent === "-1"; }), "Integer negative tick");
      assert(!Array.from(interim.querySelectorAll("text")).some(function (n) { return /^Q[₁₂]$/.test(n.textContent); }), "No duplicate Q labels inside the plots");
      var value = el("expected-payment-" + bidder), label = value.closest("p");
      close(Number(value.dataset.value), 1 / 6);
      assert(label === el("revenue-diagnostic"), "Both payment amounts share the revenue diagnostic");
      assert(label.getBoundingClientRect().top >= payment.closest(".chart-viewport").getBoundingClientRect().bottom, "Expected payment is below the graph");
      assert(win.getComputedStyle(label).textAlign === "left", "Expected payment is left aligned");
      assert(!payment.querySelector(".expected-payment-label"), "Expected payment is outside the plot");
      assert(payment.dataset.yMin === "0" && payment.dataset.yMax === "1", "Fixed unit vertical scale");
      var paymentNumbers = payment.querySelector(".payment-curve:last-child").getAttribute("d").match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
      close(paymentNumbers[paymentNumbers.length - 1], 145);
    });
    assert(el("revenue-diagnostic").textContent === "Expected revenue = expected payment from buyer 1 (0.1667) + expected payment from buyer 2 (0.1667) = 0.3333", "Requested combined revenue text");
    close(Number(el("revenue-value").dataset.value), 1 / 3);
    var green = doc.createElement("span"); green.style.color = "var(--green)"; doc.body.appendChild(green);
    assert(win.getComputedStyle(el("revenue-diagnostic")).color === win.getComputedStyle(green).color, "Revenue text is green"); green.remove();
  });
  test("Fixed payment axes preserve signed integrals for zero, negative, and asymmetric candidates", function () {
    var M = win.OptimalAuctionsModel, C = win.OptimalAuctionsCharts;
    [M.preset("empty"), M.preset("optimal"), M.gridFrom(function (v1) { return v1 < 0.5 ? [1, 0] : [0, 0]; })].forEach(function (grid, index) {
      var result = M.diagnose(grid);
      result.bidders.forEach(function (agent, i) {
        var chart = el("payment-" + (i + 1) + "-chart");
        C.payment(chart, agent, i + 1);
        assert(chart.dataset.yMin === "0" && chart.dataset.yMax === "1", "Domain stays fixed for every mechanism");
        assert(chart.querySelector("desc").textContent.indexOf("Expected payment " + C.fixed(agent.expectedPayment)) !== -1, "Accessible signed integral remains exact");
        assert(chart.getBBox().y + chart.getBBox().height < 300, "Clipped negative curves do not enlarge viewport bounds");
        if (index === 1) { close(agent.expectedPayment, 5 / 24); }
        if (index === 2 && i === 0) {
          close(agent.expectedPayment, -0.25);
          assert(chart.querySelector("desc").textContent.indexOf("envelope payment candidate; BIC fails") !== -1, "Negative full integral remains labeled as a candidate");
        }
      });
    });
  });
  test("Native dimensions and label rows stay fixed across math, hover, and edits", async function () {
    assert(!doc.querySelector('script[src="../../js/chart-viewport.js"]'), "This module does not refit content bounds");
    var ids = ["allocation-chart", "interim-1-chart", "interim-2-chart", "payment-1-chart", "payment-2-chart", "lottery-chart"];
    function boxes() {
      return ids.map(function (id) {
        var chart = el(id), viewport = chart.closest(".stable-chart-viewport"), rect = viewport.getBoundingClientRect();
        assert(viewport && chart.hasAttribute("width") && chart.hasAttribute("height"), "Initial markup reserves dimensions");
        return [rect.x, rect.y, rect.width, rect.height];
      });
    }
    function unchanged(before) {
      boxes().forEach(function (rect, i) { rect.forEach(function (value, j) { close(value, before[i][j], 0.1, "Fixed chart frame " + ids[i]); }); });
    }
    await T.nextAnimationFrames(win, 3);
    close(el("allocation-chart").getBoundingClientRect().width, 480);
    close(el("interim-1-chart").getBoundingClientRect().width, (doc.querySelector(".allocation-diagnostics").getBoundingClientRect().width - 16) / 2);
    close(el("lottery-chart").getBoundingClientRect().width, 260);
    var before = boxes();
    await win.MechanismMath.typesetInitial("main");
    await T.nextAnimationFrames(win, 3); unchanged(before);
    pointer(el("allocation-chart"), "pointermove", 450, 40);
    await T.nextAnimationFrames(win, 3); unchanged(before);
    pointer(el("allocation-chart"), "pointerdown", 353, 326);
    pointer(el("allocation-chart"), "pointerup", 353, 326);
    await T.nextAnimationFrames(win, 3); unchanged(before);
    pointer(el("lottery-chart"), "pointerdown", 130, 70);
    pointer(el("lottery-chart"), "pointerup", 130, 70);
    await T.nextAnimationFrames(win, 3); unchanged(before);
  });
  test("Hover uses exact coordinates, crosshairs, and an output-only box without painting", function () {
    var s = el("allocation-chart");
    assert(!s.querySelector(".allocation-probe"), "Probe starts hidden");
    var before = s.querySelector(".allocation-layer").innerHTML;
    pointer(s, "pointermove", 350, 340);
    var g = s.querySelector(".allocation-probe");
    assert(g && g.querySelectorAll(".plot-probe-line").length === 2 && g.querySelector(".plot-probe-point"), "M-S probe scaffold");
    close(Number(g.querySelector("circle").getAttribute("cx")), 350);
    close(Number(g.querySelector("circle").getAttribute("cy")), 340);
    var coords = Array.from(g.querySelectorAll(".plot-probe-coordinate")).map(function (n) { return n.textContent; });
    assert(coords.join(",") === "0.750,0.250", "True pointer reports, not cell centroids");
    var outputs = Array.from(g.querySelectorAll(".plot-probe-text")).map(function (n) { return n.textContent; });
    assert(outputs.join(",") === "q1 = 1.000,q2 = 0.000", "Exact allocation probabilities in the box");
    assert(before === s.querySelector(".allocation-layer").innerHTML, "Hover never changes the rule");
    T.dispatch(s, "pointerleave", win); assert(!s.querySelector(".allocation-probe"), "Mouse departure hides an unfocused probe");
    s.focus(); assert(s.querySelector(".allocation-probe"), "Keyboard focus exposes the probe");
    tap("Escape"); assert(!s.querySelector(".allocation-probe"), "Escape dismisses it");
  });
  test("Pointer strokes always paint and preserve the mesh without an Undo control", function () {
    var s = el("allocation-chart");
    var first = s.querySelector(".allocation-layer > polygon");
    var before = s.querySelector(".allocation-layer").innerHTML;
    pointer(s, "pointerdown", 83, 432); pointer(s, "pointermove", 243, 432); pointer(s, "pointerup", 243, 432);
    close(Number(el("selected-cell").dataset.q1), 0);
    close(Number(el("selected-cell").dataset.q2), 0);
    assert(before !== s.querySelector(".allocation-layer").innerHTML, "Default no-sale brush changes the efficient allocation on a drag");
    assert(first === s.querySelector(".allocation-layer > polygon"), "Persistent allocation mesh");
    assert(!el("undo"), "Undo button removed");
    before = s.querySelector(".allocation-layer").innerHTML;
    pointer(s, "pointerdown", 8, 100); pointer(s, "pointermove", 8, 300); pointer(s, "pointerup", 8, 300);
    assert(before === s.querySelector(".allocation-layer").innerHTML, "Margins never start a stroke");
  });
  test("Arrow navigation visits both halves and held-key painting remains continuous", function () {
    tap("Home"); assert(el("selected-cell").dataset.cell === "0,0,upper", "Home selects L");
    tap("ArrowRight"); assert(el("selected-cell").dataset.cell === "0,0,lower", "Right visits R");
    tap("ArrowRight"); assert(el("selected-cell").dataset.cell === "1,0,upper", "Right advances to next L");
    tap("ArrowLeft"); assert(el("selected-cell").dataset.cell === "0,0,lower", "Left reverses");
    tap("ArrowUp"); assert(el("selected-cell").dataset.cell === "0,0,upper", "Up visits L");
    tap("ArrowUp"); assert(el("selected-cell").dataset.cell === "0,1,lower", "Up advances to next R");
    tap("ArrowDown"); assert(el("selected-cell").dataset.cell === "0,0,upper", "Down reverses");
    tap("End"); assert(el("selected-cell").dataset.cell === "19,0,lower", "End selects rightmost R");
    tap("Home"); tap("r");
    var before = el("allocation-chart").querySelector(".allocation-layer").innerHTML;
    keyboard("Enter"); tap("ArrowRight"); tap("ArrowRight"); tap("ArrowRight"); keyboard("Enter", "keyup");
    close(Number(el("selected-cell").dataset.q1), 0);
    assert(before !== el("allocation-chart").querySelector(".allocation-layer").innerHTML, "Held-key navigation paints continuously");
  });
  test("Lottery pointer, keyboard, and numbers synchronize without editing the rule", function () {
    var before = el("allocation-chart").querySelector(".allocation-layer").innerHTML;
    brush(0.2, 0.3);
    var marker = el("lottery-chart").querySelector("circle");
    close(Number(marker.getAttribute("cx")), 130 + 114 * (0.2 - 0.3));
    close(Number(marker.getAttribute("cy")), 132 - 114 * (0.2 + 0.3));
    var s = el("lottery-chart");
    pointer(s, "pointerdown", 130, 0); pointer(s, "pointerup", 130, 0);
    close(Number(el("brush-q1").value) + Number(el("brush-q2").value), 1);
    T.dispatch(s, "keydown", win, { key: "Home" });
    T.dispatch(s, "keydown", win, { key: "ArrowRight" });
    T.dispatch(s, "keydown", win, { key: "ArrowUp", shiftKey: true });
    close(Number(el("brush-q1").value), 0.01); close(Number(el("brush-q2").value), 0.1);
    assert(before === el("allocation-chart").querySelector(".allocation-layer").innerHTML, "Brush changes alone do not paint");
    brush(0.2, 0.3); tap("Enter");
    close(Number(el("selected-cell").dataset.q1), 0.2); close(Number(el("selected-cell").dataset.q2), 0.3);
    input("brush-q1", "0.9"); tap("Enter");
    close(Number(el("selected-cell").dataset.q1), 0.2);
    assert(el("brush-error").textContent.length > 0, "Invalid lottery blocks painting");
    input("brush-q1", ""); tap("Enter"); close(Number(el("selected-cell").dataset.q1), 0.2);
    input("brush-q1", "0.4"); tap("Enter"); close(Number(el("selected-cell").dataset.q1), 0.4);
  });
  test("Rotated equal-leg gradient brush keeps edge probabilities in exact hundredths", async function () {
    var s = el("lottery-chart");
    var boundary = s.querySelector(".lottery-boundary").points;
    close(Math.hypot(boundary[1].x-boundary[0].x,boundary[1].y-boundary[0].y), Math.hypot(boundary[2].x-boundary[0].x,boundary[2].y-boundary[0].y));
    close(boundary[1].y, boundary[2].y);
    close(boundary[0].y-boundary[1].y, (boundary[2].x-boundary[1].x)/2);
    assert(s.querySelector(".lottery-gradient").getAttribute("href").indexOf("data:image/png") === 0, "Gradient paints the feasible triangle");
    var image = new win.Image();
    image.src = s.querySelector(".lottery-gradient").getAttribute("href");
    await image.decode();
    var canvas = doc.createElement("canvas"); canvas.width = 229; canvas.height = 115;
    var context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
    [[114,114,"neutral"],[228,0,"blue"],[0,0,"orange"]].forEach(function (entry) {
      var expected = win.getComputedStyle(doc.documentElement).getPropertyValue("--heatmap-" + entry[2] + "-rgb").split(",").map(Number);
      var actual = context.getImageData(entry[0], entry[1], 1, 1).data;
      expected.forEach(function (value, i) { close(actual[i], value); });
    });
    pointer(s, "pointerdown", 16, 18);
    for (var k = 0; k <= 100; k += 1) {
      pointer(s, "pointermove", 16 + 2.28 * k, 18);
      close(Number(el("brush-q1").value), k / 100);
      close(Number(el("brush-q2").value), (100 - k) / 100);
      ["brush-q1", "brush-q2"].forEach(function (id) { assert(/^\d(?:\.\d{1,2})?$/.test(el(id).value), "No decimal noise at edge point " + k); });
    }
    pointer(s, "pointerup", 244, 18);
    brush(0.29, 0.7); T.dispatch(s, "keydown", win, { key: "ArrowUp" });
    assert(el("brush-q2").value === "0.71", "Keyboard edge also suppresses rounding noise");
  });
  test("An IC-breaking painted hole updates colored monotonicity and candidate labels", function () {
    var s = el("allocation-chart");
    pointer(s, "pointerdown", 353, 326); pointer(s, "pointerup", 353, 326);
    assert(el("bic-status-1").dataset.bic === "false", "Interior hole creates an interim downward jump");
    assert(el("payment-status-1").textContent === " (candidate)" && el("payment-caption-1").textContent === "Payment candidate", "Candidate labels preserved below and above the payment graph");
    assert(el("bic-status-2").dataset.bic === "true" && el("payment-caption-2").textContent === "Interim payment", "Unaffected bidder keeps a valid label");
    assert(el("payment-status-2").textContent === "", "Valid expected payment has no candidate warning");
    assert(el("revenue-status").textContent === " (candidate)" && /Expected revenue/.test(el("live-summary").textContent), "Combined revenue and live summary retain candidate warnings");
    assert(el("bic-monotonicity-1").textContent === "is not weakly increasing", "Failing monotonicity explanation");
    var status = el("bic-status-1"), probe = doc.createElement("span");
    probe.style.color = "var(--red)"; doc.body.appendChild(probe);
    assert(win.getComputedStyle(status).color === win.getComputedStyle(probe).color, "Failing verdict is red");
    probe.remove();
    brush(1, 0); pointer(s, "pointerdown", 353, 326); pointer(s, "pointerup", 353, 326);
    close(totalPayments(), 1 / 3);
    assert(el("payment-status-1").textContent === "", "Restoring BIC clears the payment warning");
    assert(el("bic-status-1").dataset.bic === "true", "Repainting the original lottery restores passing diagnostics");
  });
  test("Charts fit responsive widths with uniform text and reserved padding", async function () {
    for (var width of [320, 375, 768, 1280]) {
      frame.style.width = width + "px";
      await T.nextAnimationFrames(win, 4);
      await T.waitFor(function () {
        return ["allocation-chart", "interim-1-chart", "interim-2-chart", "payment-1-chart", "payment-2-chart", "lottery-chart"].every(function (id) {
          return padding(el(id)).every(function (gap) { return gap >= 13; });
        });
      }, 4000, "Chart padding at " + width);
      assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1, "No page overflow at " + width);
      close(parseFloat(win.getComputedStyle(doc.querySelector("figcaption")).fontSize), 13.76);
      close(parseFloat(win.getComputedStyle(el("brush-q1")).fontSize), 14.4);
      var main = el("allocation-chart"), tick = main.querySelector(".axis-text");
      close(parseFloat(win.getComputedStyle(tick).fontSize) * main.getScreenCTM().a, 13.76, 0.02);
      assert(win.getComputedStyle(doc.querySelector(".main-diagnostic-layout")).borderTopStyle === "none", "No outer demo border");
      var brushBox = el("lottery-chart").getBoundingClientRect(), fields = doc.querySelector(".brush-probabilities").getBoundingClientRect();
      assert(fields.left >= brushBox.right && fields.top < brushBox.bottom, "Stacked probability fields stay to the right");
      assert(el("brush-q1").getBoundingClientRect().right <= doc.documentElement.clientWidth, "Brush inputs stay fully visible beside the triangle");
      ["interim-1-chart","interim-2-chart","payment-1-chart","payment-2-chart"].forEach(function (id) {
        var chart = el(id), border = chart.querySelector(".diagnostic-frame");
        var figure = chart.closest("figure"), title = figure.querySelector(".diagnostic-axis-label");
        var targetSize = parseFloat(win.getComputedStyle(title).fontSize);
        chart.querySelectorAll("text").forEach(function (text) {
          close(parseFloat(win.getComputedStyle(text).fontSize) * chart.getScreenCTM().a, targetSize, 0.02, "Rendered diagnostic text matches its axis title");
        });
        var caption = figure.querySelector("figcaption").getBoundingClientRect();
        assert(border.getBoundingClientRect().top - caption.bottom < 30, "Compact caption-to-plot spacing");
        close(title.getBoundingClientRect().top - border.getBoundingClientRect().bottom, 28, 0.1, "Shared tick gutter");
        assert(border && border.getAttribute("width") === "300" && border.getAttribute("height") === "250", "Boxed diagnostic plotting edges");
      });
      assert(el("lottery-controls").getBoundingClientRect().top >= el("allocation-chart").getBoundingClientRect().top, "Brush remains below grid");
      var revenue = el("revenue-diagnostic"), lastAxis = el("payment-2-chart").closest("figure").querySelector(".chart-x-axis-label");
      close(revenue.getBoundingClientRect().top - lastAxis.getBoundingClientRect().bottom, 14, 0.2, "Revenue uses the shared diagnostic spacing at " + width);
      assert(win.getComputedStyle(revenue).lineHeight === win.getComputedStyle(el("bic-status-1")).lineHeight, "Revenue uses the shared diagnostic line height");
    }
    doc.body.style.zoom = "2";
    await T.nextAnimationFrames(win, 4);
    assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1, "200% scale overflow");
    doc.body.style.zoom = "";
  });
  test("Secondary pointers and right clicks cannot paint or change the lottery brush", function () {
    var svg = el("allocation-chart"), lottery = el("lottery-chart");
    [{ isPrimary: false }, { button: 2 }].forEach(function (options) {
      pointer(svg, "pointerdown", 130, 120, 41, options);
      pointer(svg, "pointermove", 140, 130, 41);
      pointer(svg, "pointerup", 140, 130, 41);
      close(totalPayments(), 1 / 3, 1e-9, "Invalid starts preserve the allocation");
      pointer(lottery, "pointerdown", 244, 18, 41, options);
      pointer(lottery, "pointermove", 244, 18, 41);
      pointer(lottery, "pointerup", 244, 18, 41);
      close(Number(el("brush-q1").value), 0);
      close(Number(el("brush-q2").value), 0);
    });
  });
  test("Reset restores the efficient allocation and cancels an active stroke", async function () {
    assert(el("reset-button").textContent === "Use efficient mechanism", "Efficient mechanism button label");
    var chart=el("allocation-chart"), initial=chart.querySelector(".allocation-layer").innerHTML;
    brush(0.2,0.3);
    pointer(chart,"pointerdown",353,326);
    pointer(chart,"pointermove",413,326);
    el("reset-button").click();
    pointer(chart,"pointermove",393,306);
    pointer(chart,"pointerup",393,306);
    await T.nextAnimationFrames(win,3);
    assert(initial===chart.querySelector(".allocation-layer").innerHTML,"Every lottery returns to efficient allocation");
    close(totalPayments(),1/3);
    assert(el("bic-status-1").dataset.bic==="true" && el("bic-status-2").dataset.bic==="true","Reset refreshes BIC");
    close(Number(el("brush-q1").value),0.2); close(Number(el("brush-q2").value),0.3);
  });
  test("Grid placement and text sizes match M-S at each responsive width", async function () {
    var reference=document.createElement("iframe"); reference.style.height="700px";
    var priorHeight=frame.style.height; frame.style.height="700px";
    var loaded=new Promise(function(resolve){reference.onload=resolve;});
    reference.src="../bilateral-trade/myerson-satterthwaite-theorem/index.html";
    document.body.appendChild(reference); await loaded;
    var refDoc=reference.contentDocument, refWin=reference.contentWindow;
    await T.waitFor(function(){return !!refDoc.querySelector("#paint-chart .cell-cursor") && !!refDoc.querySelector(".math-chart-axis-label mjx-container") && !!refDoc.querySelector("[data-chart-padding]");},12000,"M-S reference readiness");
    function plotBox(d,id) {
      var layout=d.querySelector(".main-diagnostic-layout").getBoundingClientRect(), p=d.getElementById(id).querySelector("rect.axis-line").getBoundingClientRect();
      return [p.left-layout.left,p.top-layout.top,p.width,p.height];
    }
    try {
      for(var width of [320,375,768,1280,1440]) {
        frame.style.width=reference.style.width=width+"px";
        await T.nextAnimationFrames(win,5); await T.nextAnimationFrames(refWin,3);
        var expected=plotBox(refDoc,"paint-chart");
        plotBox(doc,"allocation-chart").forEach(function(value,i){close(value,expected[i],0.15,"M-S plot geometry at "+width);});
        [["figcaption","figcaption"],[".math-chart-y-axis-label",".math-chart-y-axis-label"],["#brush-q1","#brush-value-number"],[".constraint-status",".diagnostic-text"],["#allocation-chart .axis-text","#paint-chart .axis-text"]].forEach(function(pair){
          assert(win.getComputedStyle(doc.querySelector(pair[0])).fontSize===refWin.getComputedStyle(refDoc.querySelector(pair[1])).fontSize,"M-S text size "+pair[0]);
        });
        close(doc.querySelector(".allocation-diagnostics").getBoundingClientRect().width,refDoc.querySelector(".diagnostic-panel-grid").getBoundingClientRect().width,0.15,"Same diagnostic column width");
      }
    } finally { reference.remove(); frame.style.height=priorHeight; }
  });
  test("Hover outputs stay in the plotting area at every corner and SVG/math remain valid", function () {
    var s = el("allocation-chart");
    [[50,40],[450,40],[50,440],[450,440]].forEach(function (p) {
      pointer(s, "pointermove", p[0], p[1]);
      var box = s.querySelector(".plot-probe-box").getBBox();
      assert(box.x >= 50 && box.x + box.width <= 450 && box.y >= 40 && box.y + box.height <= 440, "Probe stays inside plot");
    });
    ["allocation-chart", "interim-1-chart", "interim-2-chart", "payment-1-chart", "payment-2-chart", "lottery-chart"].forEach(function (id) {
      var chart = el(id);
      assert(chart.querySelector("title") && chart.querySelector("desc").textContent.length > 10, "Accessible chart " + id);
      assert(!/NaN|Infinity|undefined/.test(chart.innerHTML), "Finite geometry " + id);
    });
    assert(!doc.querySelector("mjx-merror, svg mjx-container"), "HTML math remains valid");
  });
  test("Distribution bar synchronizes tenths, actual value axes, and dynamic math", async function () {
    assert(el("distribution-controls").querySelectorAll('.shape-parameter').length === 2, "Separate buyer controls");
    input("shift-1-number", "0.34"); input("shift-2-range", "0.6");
    await win.mechanismMathReady;
    assert(el("shift-1-number").value === "0.3" && el("shift-1-range").value === "0.3", "Inputs round to the allowed lattice");
    assert(el("shift-2-number").value === "0.6" && el("shift-2-range").getAttribute("aria-valuetext") === "0.6", "Slider and number synchronize");
    [1,2].forEach(function (i) {
      assert(el("shift-" + i + "-number").step === "0.1" && el("shift-" + i + "-range").step === "0.1", "Both controls use tenths");
      assert(el("distribution-support-" + i).querySelector("mjx-container"), "Distribution formula is typeset");
      assert(!/\\[(]/.test(el("distribution-support-" + i).textContent), "No raw dynamic delimiters");
    });
    assert(el("payment-1-chart").dataset.xMin === "0.3" && el("payment-1-chart").dataset.xMax === "1.3", "Payment x axis follows buyer 1");
    assert(el("interim-2-chart").dataset.xMin === "0.6" && el("interim-2-chart").dataset.xMax === "1.6", "Allocation x axis follows buyer 2");
    assert(el("payment-2-chart").dataset.yMax === "1.6", "Payment scale covers the shifted support");
    var ticks = Array.from(el("allocation-chart").querySelectorAll(".axis-text")).map(function (n) { return Number(n.textContent); });
    close(ticks[0], 0.3); close(ticks[1], 0.6); close(ticks[8], 1.3); close(ticks[9], 1.6);
    var total = totalPayments(); input("shift-1-number", ""); close(totalPayments(), total);
    assert(el("distribution-error").textContent && el("shift-1-number").getAttribute("aria-invalid") === "true", "Blank input preserves the last valid calculation");
    T.dispatch(el("shift-1-number"), "change", win); assert(el("shift-1-number").value === "0.3" && !el("distribution-error").textContent, "Invalid value restores on commit");
    input("shift-1-number", "-1"); close(Number(el("shift-1-range").value), 0);
    input("shift-2-number", "2"); close(Number(el("shift-2-range").value), 1);
  });
  test("Use optimal mechanism replaces the painted grid and leaves painting available", function () {
    var chart = el("allocation-chart"), first = chart.querySelector(".allocation-layer > polygon");
    input("shift-1-number", "0.2"); input("shift-2-number", "0.6");
    pointer(chart, "pointerdown", 353, 326);
    el("optimal-button").click();
    var expected = win.OptimalAuctionsModel.diagnose(win.OptimalAuctionsModel.preset("optimal", [0.2,0.6]), [0.2,0.6]);
    close(totalPayments(), expected.revenue);
    assert(!el("optimal-button").hasAttribute("aria-pressed") && !doc.querySelector('#auction-demo input[type="checkbox"]'), "Optimal control is an ordinary button");
    assert(!el("reserve-controls") && !el("reserve-mode-button") && !chart.querySelector(".reserve-allocation-layer"), "Reserve mode is removed");
    assert(first === chart.querySelector(".allocation-layer > polygon") && chart.querySelectorAll(".allocation-layer > polygon").length === 800, "Optimal allocation uses the persistent painted grid");
    var optimal = chart.querySelector(".allocation-layer").innerHTML;
    pointer(chart, "pointermove", 393, 306); pointer(chart, "pointerup", 393, 306);
    assert(chart.querySelector(".allocation-layer").innerHTML === optimal, "Loading the optimum cancels the prior stroke");
    pointer(chart, "pointerdown", 353, 326); pointer(chart, "pointerup", 353, 326);
    assert(chart.querySelector(".allocation-layer").innerHTML !== optimal && totalPayments() !== expected.revenue, "Painting works immediately after loading the optimum");
    el("optimal-button").click(); assert(chart.querySelector(".allocation-layer").innerHTML === optimal, "Button restores the exact optimum");
    input("shift-1-number", "0.8");
    assert(chart.querySelector(".allocation-layer").innerHTML === optimal, "Later distribution changes preserve the chosen painted rule");
  });
  test("Distribution and allocation resets preserve their respective controls and brush", function () {
    var chart = el("allocation-chart"); brush(0.2,0.3);
    input("shift-1-number", "0.4"); input("shift-2-number", "0.9"); el("optimal-button").click();
    var painted = chart.querySelector(".allocation-layer").innerHTML;
    el("reset-parameters").click();
    assert(chart.querySelector(".allocation-layer").innerHTML === painted, "Parameter reset preserves the painted rule");
    close(Number(el("shift-1-number").value), 0); close(Number(el("shift-2-number").value), 0);
    input("shift-1-number", "1"); input("shift-2-number", "1"); el("reset-button").click();
    close(totalPayments(), 4 / 3); close(Number(el("shift-1-number").value), 1);
    close(Number(el("brush-q1").value), 0.2); close(Number(el("brush-q2").value), 0.3);
    pointer(chart, "pointermove", 350, 340);
    assert(Array.from(chart.querySelectorAll(".plot-probe-coordinate")).map(function (n) { return n.textContent; }).join() === "1.750,1.250", "Probe shows actual rather than relative values");
  });
  test("Shifted charts and distribution controls fit responsive widths with stable frames", async function () {
    input("shift-1-number", "1"); input("shift-2-number", "0.9"); el("optimal-button").click();
    await win.mechanismMathReady;
    for (var width of [320,375,768,1280]) {
      frame.style.width = width + "px"; await T.nextAnimationFrames(win, 4);
      assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1, "No shifted-mode overflow at " + width);
      assert(el("shift-2-range").getBoundingClientRect().right <= doc.documentElement.clientWidth, "Distribution controls fit");
      var chart = el("allocation-chart"), before = chart.getBoundingClientRect();
      pointer(chart, "pointermove", 450, 40); el("optimal-button").click(); await T.nextAnimationFrames(win, 2);
      var after = chart.getBoundingClientRect(); close(after.width, before.width); close(after.height, before.height); close(after.top, before.top);
      ["allocation-chart","interim-1-chart","interim-2-chart","payment-1-chart","payment-2-chart","lottery-chart"].forEach(function (id) {
        assert(padding(el(id)).every(function (gap) { return gap >= 13; }), "Shifted chart padding at " + width);
        assert(!/NaN|Infinity|undefined/.test(el(id).innerHTML), "Finite shifted chart geometry");
      });
      assert(!doc.querySelector("mjx-merror, svg mjx-container"), "Shifted mathematics renders correctly");
    }
  });
  test("The efficient button uses actual values for asymmetric supports", function () {
    input("shift-1-number", "0"); input("shift-2-number", "1"); el("optimal-button").click();
    el("reset-button").click();
    close(totalPayments(), 1, 1e-10);
    var chart = el("allocation-chart"); pointer(chart, "pointermove", 410, 356);
    assert(Array.from(chart.querySelectorAll(".plot-probe-text")).map(function (n) { return n.textContent; }).join() === "q1 = 0.000,q2 = 1.000", "Buyer with the higher actual value wins");
    close(Number(el("shift-2-number").value), 1);
  });
  test("Resizing and unchanged shifts reuse diagnostics; painting and changed shifts invalidate them", async function () {
    await T.nextAnimationFrames(win, 3);
    var numeric = win.NumberUtils, checks = 0;
    win.NumberUtils = Object.assign({}, numeric, { isFiniteNumber: function (value) { checks += 1; return numeric.isFiniteNumber(value); } });
    try {
      frame.style.width = "1040px"; await T.nextAnimationFrames(win, 4);
      assert(checks < 10, "Resizing does not revalidate all 800 lotteries");
      checks = 0; input("shift-1-number", "0.0");
      assert(checks < 10, "Unchanged shifts reuse the cached model result");
      checks = 0; var chart = el("allocation-chart");
      pointer(chart, "pointerdown", 353, 326); pointer(chart, "pointerup", 353, 326);
      assert(checks >= 1600 && Math.abs(totalPayments() - 1 / 3) > 1e-6, "Painting recalculates the changed grid");
      checks = 0; input("shift-1-number", "0.4");
      assert(checks >= 1600, "A changed distribution recalculates payments");
    } finally { win.NumberUtils = numeric; }
  });
  test("Palette-only renders retain diagnostic paths and one-cell painting changes one fill", function () {
    var selectors = "#interim-1-chart path, #interim-2-chart path, #payment-1-chart path, #payment-2-chart path";
    var paths = Array.from(doc.querySelectorAll(selectors));
    assert(paths.length > 0, "Diagnostic paths are present");
    function samePaths(message) {
      var current = Array.from(doc.querySelectorAll(selectors));
      assert(current.length === paths.length && current.every(function (node, i) { return node === paths[i]; }), message);
    }
    input("shift-1-number", "0.0");
    samePaths("An unchanged parameter keeps existing diagnostic nodes");
    var cells = Array.from(el("allocation-chart").querySelectorAll(".allocation-layer > polygon"));
    var fills = cells.map(function (node) { return node.getAttribute("fill"); });
    doc.documentElement.style.setProperty("--heatmap-blue-rgb", "1,2,3");
    input("shift-1-number", "0.0");
    samePaths("A palette-only render keeps existing diagnostic nodes");
    assert(cells.some(function (node, i) { return node.getAttribute("fill") !== fills[i]; }), "The changed palette recolors allocations");
    var mutations = [];
    var observer = new win.MutationObserver(function (records) { mutations = mutations.concat(records); });
    observer.observe(el("allocation-chart").querySelector(".allocation-layer"), { subtree: true, attributes: true, attributeFilter: ["fill"] });
    try {
      brush(0.2, 0.3); tap("Enter");
      mutations = mutations.concat(observer.takeRecords());
      assert(mutations.length === 1 && cells.indexOf(mutations[0].target) >= 0, "Painting one triangle updates only its fill");
      close(Number(el("selected-cell").dataset.q1), 0.2); close(Number(el("selected-cell").dataset.q2), 0.3);
    } finally { observer.disconnect(); }
  });
  T.run(tests);
}());
