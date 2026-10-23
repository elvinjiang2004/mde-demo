(function () {
  "use strict";
  var T = MechanismTest, frame = document.getElementById("app-frame");
  var routes = ["auction-equilibria/first-price", "auction-equilibria/second-price", "auction-design/optimal-auctions", "auction-design/ironing",
    "general-topics/envelope-theorem", "bilateral-trade/myerson-satterthwaite-theorem", "bilateral-trade/bargaining-mechanism-sandbox"];
  function border(svg) { return svg.querySelector("rect.plot-frame, rect.diagnostic-frame, rect.axis-line"); }
  function check(doc, win) {
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
    doc.querySelectorAll(".panel-caption").forEach(function (caption, i) {
      T.assertClose(panels[i].getBoundingClientRect().top - caption.getBoundingClientRect().bottom, 26, 0.2, "Embedded caption gap");
    });
    doc.querySelectorAll(".value-pdf-preview-figure").forEach(function (figure) {
      T.assertClose(figure.querySelector(".value-pdf-curve").getBoundingClientRect().top - figure.querySelector("figcaption").getBoundingClientRect().bottom,
        14, 0.2, "Shared density caption gap");
      var bottom = figure.querySelector(".chart-density-viewport").getBoundingClientRect().bottom;
      figure.querySelectorAll(".value-pdf-endpoint-label").forEach(function (label) {
        T.assert(bottom - label.getBoundingClientRect().bottom >= 13.5, "Density endpoint padding at expanded widths");
      });
    });
    doc.querySelectorAll(".chart-grid").forEach(function (grid) { T.assertClose(parseFloat(win.getComputedStyle(grid).rowGap), 16, 0.1, "Shared row spacing"); });
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
          (doc.querySelector(".chart-figure rect.axis-line, .chart-figure rect.plot-frame, .panel-caption"));
      }, 20000);
      var doc = frame.contentDocument, win = frame.contentWindow;
      for (var width of [320, 375, 640, 768, 1280]) {
        frame.style.width = width + "px";
        // Auction redraws debounce resize; observe completed geometry instead
        // of assuming a timer ran before a fixed delay under aggregate load.
        await T.nextAnimationFrames(win, 2);
        await waitForLayout(doc, win, route + " at " + width + "px");
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
