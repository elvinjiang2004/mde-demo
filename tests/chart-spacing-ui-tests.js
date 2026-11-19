(function () {
  "use strict";
  var T = MechanismTest, frame = document.getElementById("app-frame");
  var routes = ["auction-equilibria/first-price", "auction-equilibria/second-price", "auction-design/regular-optimal-auctions", "auction-design/general-optimal-auctions",
    "general-topics/envelope-theorem", "bilateral-trade/myerson-satterthwaite-theorem", "bilateral-trade/bargaining-mechanism-sandbox",
    "general-topics/revelation-principle", "voting/gibbard-satterthwaite-theorem"];
  function border(svg) { return svg.querySelector("rect.plot-frame, rect.diagnostic-frame, rect.axis-line"); }
  function overlaps(a, b) {
    return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  }
  async function inspectFields(doc, win, route) {
    var fields;
    var diagnostics = { "buyer-ic-chart": "UB(v,v′)", "seller-ic-chart": "US(c,c′)", "revenue-chart": "R(v,c)",
      "buyer-payoff-chart": "uB(v,c)", "seller-payoff-chart": "uS(v,c)", "efficiency-chart": "L(v,c)" };
    if (route.includes("regular-optimal-auctions")) { fields = { "allocation-chart": "q1(v1,v2)" }; }
    else if (route.includes("myerson-satterthwaite")) { fields = Object.assign({ "paint-chart": "q(v,c)" }, diagnostics); }
    else if (route.includes("bargaining-mechanism-sandbox")) {
      fields = Object.assign({ "allocation-chart": "q(v,c)", "buyer-payment-chart": "pB(v,c)", "seller-payment-chart": "pS(v,c)" }, diagnostics);
    } else { return; }
    for (var id of Object.keys(fields)) {
      var svg = doc.getElementById(id), plot = border(svg).getBoundingClientRect();
      svg.focus({ preventScroll: true });
      T.dispatch(svg, "pointermove", win, { pointerId: 41, isPrimary: true, pointerType: "mouse", buttons: 0,
        clientX: plot.left + .25 * plot.width, clientY: plot.top + .75 * plot.height });
      await T.nextAnimationFrames(win, 2);
      var rows = svg.querySelectorAll(".plot-probe-text"), box = svg.querySelector(".plot-probe-box").getBoundingClientRect();
      T.assert(rows[0].textContent.startsWith(fields[id] + " = "), id + " uses the full field notation at " + win.innerWidth + "px");
      T.assert(box.left >= plot.left - .6 && box.right <= plot.right + .6 && box.top >= plot.top - .6 && box.bottom <= plot.bottom + .6,
        id + " complete function readout fits inside its plot");
      if (rows.length > 1) {
        var first = rows[0].getBoundingClientRect(), second = rows[1].getBoundingClientRect();
        T.assert(rows[1].textContent.startsWith("q2(v1,v2) = ") && second.top >= first.bottom + 3 && Math.abs(first.left - second.left) < .2,
          "Allocation readouts remain vertically stacked at every width");
      }
    }
  }
  function check(doc, win) {
    doc.querySelectorAll(".chart-canvas-frame > svg, #tradeoff-chart, #lottery-chart").forEach(function (svg) {
      var horizontalFrame = (svg.closest(".chart-canvas-frame") || svg).getBoundingClientRect();
      svg.querySelectorAll("text").forEach(function (text) {
        T.assertClose(parseFloat(win.getComputedStyle(text).fontSize) * svg.getScreenCTM().a,
          0.86 * parseFloat(win.getComputedStyle(doc.documentElement).fontSize), 0.1,
          svg.id + " readable text, including annotations and preview endpoints");
        var bounds = text.getBoundingClientRect();
        T.assert(bounds.left >= horizontalFrame.left - 0.6 && bounds.right <= horizontalFrame.right + 0.6,
          svg.id + " text fits within its reserved horizontal frame: " + text.textContent);
      });
      svg.querySelectorAll(".chart-math-symbol, .plot-probe-symbol").forEach(function (symbol) {
        T.assert(win.getComputedStyle(symbol).fontStyle === "italic", svg.id + " mathematical variables use the shared italic style");
      });
      svg.querySelectorAll(".chart-math-subscript, .chart-math-superscript").forEach(function (script) {
        T.assertClose(parseFloat(win.getComputedStyle(script).fontSize),
          0.75 * parseFloat(win.getComputedStyle(script.parentNode).fontSize), 0.1, svg.id + " mathematical scripts use the shared size");
      });
      svg.querySelectorAll(".plot-probe-text, .spa-payoff, .curve-probe-text").forEach(function (text) {
        var box = text.parentNode.querySelector(".plot-probe-box").getBoundingClientRect();
        var value = text.getBoundingClientRect();
        T.assert(value.left >= box.left + 4 && value.right <= box.right - 4 &&
          value.top >= box.top + 3 && value.bottom <= box.bottom - 3,
          svg.id + " tooltip reserves readable padding around its complete output");
      });
      var figure = svg.closest("figure");
      var title = figure && figure.querySelector(".math-chart-y-axis-label");
      if (title) {
        svg.querySelectorAll(".axis-text").forEach(function (tick) {
          if (win.getComputedStyle(tick).visibility !== "hidden") {
            T.assert(!overlaps(title.getBoundingClientRect(), tick.getBoundingClientRect()),
              svg.id + " vertical title clears its ticks");
          }
        });
      }
    });
    doc.querySelectorAll(".chart-figure").forEach(function (figure) {
      var viewport = figure.querySelector(".chart-plot-viewport"), svg = viewport.querySelector("svg");
      var plot = border(svg).getBoundingClientRect(), caption = figure.querySelector("figcaption").getBoundingClientRect();
      var axis = viewport.querySelector(".chart-x-axis-label").getBoundingClientRect();
      T.assertClose(plot.top - caption.bottom, 26, 0.2, svg.id + " title gap");
      T.assertClose(axis.top - plot.bottom, 28, 0.2, svg.id + " tick gutter");
      T.assertClose((axis.left + axis.right) / 2, (plot.left + plot.right) / 2, 0.2, svg.id + " centered value label");
      var diagnostic = figure.querySelector(".chart-diagnostic");
      if (!diagnostic && figure.nextElementSibling && figure.nextElementSibling.matches(".diagnostic-text")) { diagnostic = figure.nextElementSibling; }
      if (diagnostic) { T.assertClose(diagnostic.getBoundingClientRect().top - axis.bottom, 14, 0.2, svg.id + " diagnostic gap"); }
      var outside = viewport.getBoundingClientRect();
      T.assertClose(outside.bottom - axis.bottom, 14, 0.2, svg.id + " lower padding");
      svg.querySelectorAll(".axis-text").forEach(function (text) {
        T.assert(text.getBoundingClientRect().top >= outside.top + 13.5, svg.id + " upper tick padding");
        T.assertClose(parseFloat(win.getComputedStyle(text).fontSize) * svg.getScreenCTM().a, 13.76, 0.1, svg.id + " readable tick size");
      });
    });
    var panels = Array.from(doc.querySelectorAll(".panel-background"));
    doc.querySelectorAll(".panel-caption, .first-price-plot-title").forEach(function (caption, i) {
      T.assertClose(panels[i].getBoundingClientRect().top - caption.getBoundingClientRect().bottom, 26, 0.2, "Embedded caption gap");
    });
    var maximum = doc.querySelector(".maximum-label:not(.density-equilibrium-label)");
    var probability = doc.querySelector(".winning-probability-guide-label");
    if (maximum && probability) {
      T.assert(!overlaps(maximum.getBoundingClientRect(), probability.getBoundingClientRect()),
        "Readable equilibrium and probability annotations remain separate");
    }
    doc.querySelectorAll(".value-pdf-preview-figure").forEach(function (figure) {
      T.assertClose(figure.querySelector(".value-pdf-curve").getBoundingClientRect().top - figure.querySelector("figcaption").getBoundingClientRect().bottom,
        14, 0.2, "Shared density caption gap");
      var bottom = figure.querySelector(".chart-density-viewport").getBoundingClientRect().bottom;
      figure.querySelectorAll(".value-pdf-endpoint-label").forEach(function (label) {
        T.assert(bottom - label.getBoundingClientRect().bottom >= 13.5, "Density endpoint padding at expanded widths");
      });
    });
    doc.querySelectorAll(".chart-grid, .surface-editor-grid, .main-diagnostic-layout").forEach(function (grid) {
      T.assertClose(parseFloat(win.getComputedStyle(grid).rowGap), 16, 0.1, "Shared plot row spacing");
    });
    doc.querySelectorAll(".main-diagnostic-layout").forEach(function (layout) {
      T.assertClose(parseFloat(win.getComputedStyle(layout).columnGap), 20, 0.1, "Main and diagnostic column spacing");
    });
    doc.querySelectorAll(".main-column > .choice-controls").forEach(function (controls) {
      var style = win.getComputedStyle(controls);
      [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].forEach(function (value) {
        T.assertClose(parseFloat(value), 0, 0.1, "Below-plot controls must not inherit sidebar padding");
      });
    });
    doc.querySelectorAll(".explorable-divider").forEach(function (section) {
      var style = win.getComputedStyle(section);
      T.assertClose(parseFloat(style.marginTop), win.innerWidth <= 520 ? 24 : 32, 0.1, "Responsive introduction-to-demo spacing");
      T.assertClose(parseFloat(style.paddingTop), 14.4, 0.1, "Demo separator padding");
      T.assertClose(parseFloat(style.marginBottom), 22.4, 0.1, "Demo-to-lesson spacing");
    });
    var votingLayout = doc.querySelector(".voting-layout");
    if (votingLayout) { T.assertClose(parseFloat(win.getComputedStyle(votingLayout).marginTop), 0, 0.1, "Voting grid must not double the separator padding"); }
    T.assert(!doc.querySelector(".notes > li"), "Notes must use their shared list indentation and item spacing");
    T.assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1, "No horizontal overflow");
    T.assert(!doc.querySelector("merror, .chart-plot-viewport mjx-merror"), "Valid mathematics");
  }
  async function waitForLayout(doc, win, label) {
    var lastError;
    try {
      await T.waitFor(function () {
        try { check(doc, win); return true; }
        catch (error) { lastError = error; return false; }
      }, 5000);
    } catch (error) {
      throw new Error(label + ": " + (lastError || error).message);
    }
    await T.nextAnimationFrames(win, 2);
    check(doc, win);
  }
  var tests = routes.map(function (route) {
    return { name: route + " shares chart spacing at every responsive width", run: async function () {
      frame.style.width = "1280px";
      frame.src = "../" + route + "/index.html?spacing-test=1";
      await T.waitFor(function () {
        var doc = frame.contentDocument;
        return doc && doc.URL.includes(route) && doc.querySelector("main mjx-container") &&
          (doc.querySelector(".chart-figure rect.axis-line, .chart-figure rect.plot-frame, .panel-caption, .first-price-plot-title, #voting-demo"));
      }, 20000);
      var doc = frame.contentDocument, win = frame.contentWindow;
      if (win.mechanismMathReady) { await win.mechanismMathReady; }
      for (var width of [320, 375, 640, 768, 1280]) {
        frame.style.width = width + "px";
        // Auction redraws debounce resize; observe completed geometry instead
        // of assuming a timer ran before a fixed delay under aggregate load.
        await T.nextAnimationFrames(win, 2);
        await waitForLayout(doc, win, route + " at " + width + "px");
        await inspectFields(doc, win, route);
        check(doc, win);
      }
      if (route.includes("regular-optimal-auctions") || route.includes("bilateral-trade/")) {
        doc.body.style.zoom = "2"; await T.nextAnimationFrames(win, 3);
        await inspectFields(doc, win, route);
        doc.body.style.zoom = "1"; await T.nextAnimationFrames(win, 3);
      }
      var before = Array.from(doc.querySelectorAll(".chart-figure .chart-canvas-frame > svg")).map(function (svg) {
        var b = border(svg).getBoundingClientRect(); return [b.x + win.scrollX, b.y + win.scrollY, b.width, b.height];
      });
      var interactive = doc.querySelector(".chart-figure svg[tabindex='0']");
      if (interactive) {
        interactive.focus({ preventScroll: true });
        T.dispatch(interactive, "keydown", win, { key: "ArrowRight" });
        await T.nextAnimationFrames(win, 3);
        Array.from(doc.querySelectorAll(".chart-figure .chart-canvas-frame > svg")).forEach(function (svg, i) {
          var b = border(svg).getBoundingClientRect();
          // Focus may scroll the page; document positions isolate actual layout changes.
          [b.x + win.scrollX, b.y + win.scrollY, b.width, b.height].forEach(function (value, j) { T.assertClose(value, before[i][j], 0.1, "Stable plot on keyboard inspection"); });
        });
        var coordinate = interactive.querySelector('.plot-probe-coordinate[text-anchor="middle"]');
        if (coordinate) {
          var label = interactive.closest(".chart-plot-viewport").querySelector(".chart-x-axis-label");
          T.assert(coordinate.getBoundingClientRect().bottom < label.getBoundingClientRect().top, "Probe coordinate clears the axis label");
        }
        await waitForLayout(doc, win, route + " with keyboard inspection");
      }
    } };
  });
  T.run(tests, { title: "Shared chart spacing tests" });
}());
