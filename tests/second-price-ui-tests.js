(function () {
  "use strict";
  var T = window.MechanismTest, frame = document.getElementById("app-frame");
  var keepAlive = window.setInterval(function () {}, 50);
  var doc, win, tests = [];
  function test(name, run) { tests.push({ name: name, run: run }); }
  function element(id) { return doc.getElementById(id); }
  function chart() { return element("second-price-chart"); }
  function set(id, value, event) {
    element(id).value = String(value);
    T.dispatch(element(id), event || "input", win);
  }
  function close(actual, expected, message) { T.assertClose(actual, expected, 1e-8, message); }
  function payoff(id) { return Number(element(id + "-payoff").dataset.value); }
  function reset() { element("reset-button").click(); }
  function point(price, fraction) {
    var rect = chart().querySelector(".plot-frame").getBoundingClientRect();
    return { clientX: rect.left + price / 100 * rect.width, clientY: rect.top + rect.height * (fraction === undefined ? 0.45 : fraction) };
  }
  function pointer(type, price, overrides, fraction) {
    T.dispatch(chart(), type, win, Object.assign({ pointerId: 7, pointerType: "mouse", isPrimary: true, button: 0, buttons: 0 }, point(price, fraction), overrides || {}));
  }
  function hover(price, fraction) { pointer("pointermove", price, {}, fraction); }
  function key(value, shift) { T.dispatch(chart(), "keydown", win, { key: value, shiftKey: Boolean(shift) }); }
  function plotBounds() {
    var box = chart().querySelector(".plot-frame").getBoundingClientRect();
    return [box.left + win.scrollX, box.top + win.scrollY, box.width, box.height];
  }

  test("The production demo uses the two-control payoff comparison without distributions or outcome text", async function () {
    var loaded = await T.loadFrame(frame, "../auction-equilibria/second-price/index.html", {
      ready: function (d) { return d.querySelector('#second-price-demo[data-ready="true"]'); },
      math: ".introduction, .choice-controls, .chart-x-axis-label, .derivation", timeout: 30000
    });
    doc = loaded.document; win = loaded.window;
    T.assert(element("value-number").value === "50" && element("bid-number").value === "30", "The original choices must remain the defaults.");
    T.assert(!doc.querySelector('script[src*="distributions"], script[src*="auction-chart"], script[src*="auction-controls"], value-density-preview, model-parameter-controls'), "No distributional runtime or controls may remain.");
    T.assert(doc.querySelectorAll('#second-price-demo input[type="range"]').length === 2 && doc.querySelectorAll("#second-price-demo button").length === 1, "Only the value/bid pairs and Reset remain.");
    T.assert(!doc.querySelector("#second-price-demo table, #second-price-demo details, #opposing-slider, #opposing-number, #payoff-loss, #case-description"), "The outcome table, below-plot text, tie menu and price controls must be absent.");
    T.assert(!doc.querySelector(".spa-probe") && doc.querySelectorAll(".spa-open-dot").length === 2, "Inspection starts hidden; the nontruthful bid discontinuity remains exact.");
    T.assertScriptOrder(doc, ["../../js/components.js", "../../js/mathjax-config.js", "../../assets/mathjax/tex-svg.js", "../../js/mathjax-runtime.js", "../../js/svg-utils.js", "../../js/chart-layout.js", "../../js/numeric-controls.js", "model.js", "charts.js", "controls.js", "app.js"]);
  });
  test("Hover without a button press spans the full plot and shows both payoff expressions in a cursor box", function () {
    reset();
    hover(40, 0.35);
    close(Number(chart().dataset.opposing), 40);
    close(payoff("truthful"), 10); close(payoff("proposed"), 0);
    var line = chart().querySelector(".spa-opposing"), frameBox = chart().querySelector(".plot-frame");
    var left = Number(frameBox.getAttribute("x")), top = Number(frameBox.getAttribute("y"));
    var width = Number(frameBox.getAttribute("width")), height = Number(frameBox.getAttribute("height"));
    close(Number(line.getAttribute("x1")), left + 0.4 * width);
    close(Number(line.getAttribute("x2")), left + 0.4 * width);
    close(Number(line.getAttribute("y1")), top);
    close(Number(line.getAttribute("y2")), top + height);
    ["truthful-payoff", "proposed-payoff"].forEach(function (id) {
      var bounds = element(id).getBoundingClientRect(), plot = frameBox.getBoundingClientRect();
      T.assert(bounds.left >= plot.left && bounds.right <= plot.right && bounds.top >= plot.top && bounds.bottom <= plot.bottom, "Both numeric payoffs must be inside the plot.");
    });
    T.assert(element("truthful-payoff").getAttribute("aria-label") === "u_i(v_i,v_i,p_i) = 10" &&
      element("proposed-payoff").getAttribute("aria-label") === "u_i(v_i,x_i,p_i) = 0", "Readouts must identify the requested payoff arguments.");
    var box = chart().querySelector(".spa-payoff-box rect").getBoundingClientRect();
    var cursor = point(40, 0.35);
    T.assertClose(box.left, cursor.clientX + 10, 0.001, "The payoff box should sit next to the cursor when there is room.");
    T.assertClose(box.bottom, cursor.clientY - 10, 0.001, "The payoff box should sit above the cursor when there is room.");
    hover(80, 0.7);
    var moved = chart().querySelector(".spa-payoff-box rect").getBoundingClientRect();
    T.assert(moved.left > box.left && moved.top > box.top, "The payoff box must follow the cursor in both dimensions.");
    hover(40, 0.35);
    T.assert(element("live-summary").textContent.indexOf("Truthful payoff 10") >= 0, "Inspected results must have a text equivalent.");
    pointer("pointerleave", 40);
    T.assert(!doc.querySelector(".spa-probe"), "Leaving the plot must remove the hover guide and readouts.");
    hover(-5);
    T.assert(!doc.querySelector(".spa-probe"), "Axis margins outside the plotting box must not select a price.");
  });
  test("Underbidding, overbidding and exact ties give the correct hovered payoffs", function () {
    reset();
    [[20, 30, 30], [30, 20, 10], [40, 10, 0], [50, 0, 0], [90, 0, 0]].forEach(function (example) {
      hover(example[0]); close(payoff("truthful"), example[1]); close(payoff("proposed"), example[2]);
    });
    hover(30);
    T.assert(element("proposed-payoff").dataset.outcome === "tie", "Hovering at the exact proposed bid must use a tie.");
    close(Number(element("proposed-payoff").dataset.winProbability), 0.5);
    set("bid-number", 70);
    [[20, 30, 30], [50, 0, 0], [60, 0, -10], [70, 0, -10], [90, 0, 0]].forEach(function (example) {
      hover(example[0]); close(payoff("truthful"), example[1]); close(payoff("proposed"), example[2]);
    });
    set("value-number", 35.7); set("bid-number", 12.345);
    hover(12.3);
    close(payoff("proposed"), (35.7 - 12.3) / 2, "Rounded controls and exact fractional-price ties must agree.");
  });
  test("Number and slider changes synchronize, clamp and recover invalid commits", function () {
    reset(); set("value-slider", 75.25); set("bid-number", 80.123);
    close(Number(element("value-number").value), 75.3); close(Number(element("bid-slider").value), 80.1);
    close(Number(chart().dataset.value), 75.3); close(Number(chart().dataset.bid), 80.1);
    set("value-number", "", "change"); close(Number(element("value-number").value), 75.3);
    ["value", "bid"].forEach(function (field) {
      T.assert(element(field + "-slider").step === "0.1", "Sliders must move in tenths.");
      var endpoints = element(field + "-slider").nextElementSibling;
      T.assert(endpoints.querySelectorAll("mjx-container").length === 2 && endpoints.querySelectorAll('[data-mml-node="msub"]').length === 2,
        "Both endpoints must render the indexed lower and upper value bounds.");
    });
    set("bid-number", 200); close(Number(element("bid-number").value), 100);
    set("value-number", -5); close(Number(element("value-slider").value), 0);
    hover(50); close(payoff("proposed"), -50);
    T.assert(!/NaN|Infinity/.test(chart().innerHTML), "All accepted changes must leave finite geometry.");
  });
  test("Coincident bids have identical curves and payoffs at every inspected price", function () {
    reset(); set("bid-number", 50);
    T.assert(!doc.querySelector(".spa-loss-area, .spa-open-dot"), "Truthful bidding has no deviation loss or jump.");
    T.assert(doc.querySelector(".spa-curve-label").textContent === "Both bids", "Coincident curves need one direct label.");
    [0, 30, 50, 100].forEach(function (price) { hover(price); close(payoff("truthful"), payoff("proposed")); });
  });
  test("Keyboard inspection reaches both endpoints, supports larger steps and clears", function () {
    reset(); chart().focus({ preventScroll: true });
    T.assert(doc.querySelector(".spa-probe"), "Keyboard focus must expose an inspection point.");
    key("Home"); close(Number(chart().dataset.opposing), 0);
    key("ArrowRight"); close(Number(chart().dataset.opposing), 1);
    key("ArrowRight", true); close(Number(chart().dataset.opposing), 11);
    key("End"); key("ArrowRight"); close(Number(chart().dataset.opposing), 100);
    key("ArrowLeft", true); close(Number(chart().dataset.opposing), 90);
    key("Home"); key("ArrowLeft"); close(Number(chart().dataset.opposing), 0);
    key("Escape"); T.assert(!doc.querySelector(".spa-probe"), "Escape must dismiss inspection.");
    key("ArrowRight"); close(Number(chart().dataset.opposing), 1);
    element("reset-button").focus({ preventScroll: true });
    T.assert(!doc.querySelector(".spa-probe"), "Leaving keyboard focus clears inspection.");
  });
  test("Touch inspection has one owner, clamps endpoints and stops on release, cancel, loss or reset", function () {
    var svg = chart(), capture = null;
    var methods = [svg.setPointerCapture, svg.hasPointerCapture, svg.releasePointerCapture];
    svg.setPointerCapture = function (id) { capture = id; };
    svg.hasPointerCapture = function (id) { return capture === id; };
    svg.releasePointerCapture = function () { capture = null; };
    function touch(type, price, overrides) {
      pointer(type, price, Object.assign({ pointerType: "touch", pointerId: 8, buttons: 1 }, overrides || {}));
    }
    try {
      reset(); touch("pointerdown", 20, { isPrimary: false });
      T.assert(capture === null && !doc.querySelector(".spa-probe"), "Secondary touches must not begin inspection.");
      touch("pointerdown", 20); T.assert(capture === 8, "The primary touch must own capture.");
      touch("pointermove", 80, { pointerId: 9 }); close(Number(svg.dataset.opposing), 20);
      touch("pointermove", -20); close(Number(svg.dataset.opposing), 0);
      touch("pointerup", 120); close(Number(svg.dataset.opposing), 100);
      T.assert(capture === null, "Release must end capture.");
      touch("pointermove", 10); close(Number(svg.dataset.opposing), 100);
      ["pointercancel", "lostpointercapture", "reset"].forEach(function (ending) {
        touch("pointerdown", 25);
        if (ending === "reset") { reset(); } else { touch(ending, 25); }
        var previous = Number(svg.dataset.opposing);
        touch("pointermove", 80);
        T.assert(capture === null, "Ending a touch must release its capture.");
        close(Number(svg.dataset.opposing), previous, "Ending a touch must prevent later moves from changing the price.");
      });
    } finally {
      reset(); svg.setPointerCapture = methods[0]; svg.hasPointerCapture = methods[1]; svg.releasePointerCapture = methods[2];
    }
  });
  test("Reset restores both choices, clears inspection and retains button focus", function () {
    set("value-number", 80); set("bid-number", 95); hover(90);
    var button = element("reset-button"); button.focus({ preventScroll: true }); button.click();
    close(Number(element("value-number").value), 50); close(Number(element("bid-number").value), 30);
    T.assert(!doc.querySelector(".spa-probe") && doc.activeElement === button, "Reset must clear inspection without moving focus.");
    T.assert(element("live-summary").textContent.indexOf("reset") >= 0, "Reset must be announced.");
  });
  test("Responsive frames stay stable and all readouts remain visible at edge and extreme states", async function () {
    for (var width of [320, 375, 640, 768, 1280]) {
      frame.style.width = width + "px";
      await T.waitFor(function () { return win.innerWidth === width; }, 5000);
      await T.nextAnimationFrames(win, 4);
      reset();
      var original = plotBounds();
      for (var choice of [[50, 30], [50, 70], [0, 100], [100, 0], [0, 0], [100, 100]]) {
        set("value-number", choice[0]); set("bid-number", choice[1]);
        for (var price of [0, 30, 50, 70, 100]) {
          for (var fraction of [0, 0.25, 1]) {
            hover(price, fraction);
            plotBounds().forEach(function (value, index) { close(value, original[index], "Hover and choice edits must leave plot bounds stable."); });
            var svgBox = chart().getBoundingClientRect(), plotBox = chart().querySelector(".plot-frame").getBoundingClientRect();
            chart().querySelectorAll("text").forEach(function (label) {
              if (win.getComputedStyle(label).visibility === "hidden") { return; }
              var box = label.getBoundingClientRect();
              T.assert(box.left >= svgBox.left - 1 && box.right <= svgBox.right + 1, "Chart text must fit at " + width + "px: " + label.textContent);
              if (label.classList.contains("spa-payoff")) {
                T.assert(box.left >= plotBox.left && box.right <= plotBox.right && box.top >= plotBox.top && box.bottom <= plotBox.bottom, "Both payoffs must stay inside the plotting box at " + width + "px.");
              }
            });
            var tooltip = chart().querySelector(".spa-payoff-box rect").getBoundingClientRect();
            T.assert(tooltip.left >= plotBox.left && tooltip.right <= plotBox.right && tooltip.top >= plotBox.top && tooltip.bottom <= plotBox.bottom,
              "The entire cursor box must remain inside the plot at all edges.");
            T.assert(!/NaN|Infinity/.test(chart().innerHTML), "All endpoint geometry must remain finite.");
          }
        }
      }
      T.assert(doc.documentElement.scrollWidth <= win.innerWidth + 1, "The page must not overflow at " + width + "px.");
    }
  });
  test("The authored lesson, citations, QED and page appendix remain rendered", function () {
    T.assert(doc.querySelector('.environment-link[href="../environment/index.html"]'), "Retain the IPV Environment link.");
    T.assert(doc.querySelector('.qed mjx-container') && doc.querySelector('.reference-list [data-reference="vickrey-1961"] a'), "Retain the proof endpoint and Vickrey citation.");
    T.assert(doc.querySelector('learning-sidebar[page="second-price"]') && win.MechanismNotation.pages["second-price"], "Keep the page-specific notation and appendix.");
    T.assert(!doc.querySelector('mjx-merror, merror, [data-render-error]'), "All lesson and control math must render successfully.");
  });
  T.run(tests, { title: "Second-price dominance interface tests", cleanup: function () { window.clearInterval(keepAlive); } });
})();
