"use strict";
document.addEventListener("DOMContentLoaded", async function () {
  var harness = window.MechanismTest;
  var frame = document.getElementById("app-frame");
  var routes = ["auctions/first-price", "auctions/second-price",
    "bilateral-trade/myerson-satterthwaite-theorem",
    "bilateral-trade/bargaining-mechanism-sandbox",
    "general-topics/envelope-theorem", "general-topics/payments-from-allocation-rule"];
  var failures = 0;
  function charts(doc) {
    return Array.from(doc.querySelectorAll("svg[viewBox]"))
      .filter(function (svg) { return !svg.closest("mjx-container"); });
  }
  function gaps(svg) {
    var box = svg.getBBox();
    var matrix = svg.getScreenCTM();
    var top = matrix.b * box.x + matrix.d * box.y + matrix.f;
    var bottom = matrix.b * box.x + matrix.d * (box.y + box.height) + matrix.f;
    var viewport = svg.closest(".chart-viewport");
    viewport.querySelectorAll(".math-chart-axis-label, .envelope-chart-axis-label")
      .forEach(function (label) {
        var bounds = label.getBoundingClientRect();
        if (bounds.width && bounds.height) {
          top = Math.min(top, bounds.top);
          bottom = Math.max(bottom, bounds.bottom);
        }
      });
    var outer = viewport.getBoundingClientRect();
    return [top - outer.top, outer.bottom - bottom];
  }
  async function assertPadding(doc, label) {
    var errors;
    try {
      await harness.waitFor(function () {
        errors = [];
        charts(doc).forEach(function (svg) {
          if (!svg.closest(".chart-viewport")) { errors.push(svg.id + " has no viewport"); return; }
          var padding = gaps(svg);
          if (padding.some(function (gap) { return Math.abs(gap - 14) > 0.8; })) {
            errors.push(svg.id + ": " + padding.map(function (gap) { return gap.toFixed(2); }).join(", "));
          }
        });
        return errors.length === 0;
      }, 5000);
    } catch (error) { throw new Error(label + " padding: " + errors.join("; ")); }
  }
  for (var route of routes) {
    try {
      frame.style.width = "1280px";
      frame.src = "../" + route + "/index.html";
      await harness.waitFor(function () {
        var doc = frame.contentDocument;
        return doc && doc.URL.includes(route) && doc.querySelector("mjx-container") &&
          charts(doc).length > 0 && doc.querySelector("[data-chart-padding='14']");
      }, 20000);
      var doc = frame.contentDocument;
      var originalMath = doc.querySelector(".introduction mjx-container, .derivation mjx-container");
      for (var width of [320, 375, 640, 768, 1280, 1440]) {
        frame.style.width = width + "px";
        await harness.nextAnimationFrames(frame.contentWindow, 4);
        await assertPadding(doc, route + " at " + width);
        harness.assert(doc.documentElement.scrollWidth <= frame.contentWindow.innerWidth + 1,
          route + " must fit at " + width + "px.");
      }
      harness.assert(!originalMath || !originalMath.closest(".chart-viewport"),
        "Lesson equations must not be cropped or wrapped.");
      var main = charts(doc).find(function (svg) { return svg.getAttribute("tabindex") === "0"; });
      if (main) {
        main.focus();
        harness.dispatch(main, "keydown", frame.contentWindow, { key: "ArrowRight" });
        await harness.nextAnimationFrames(frame.contentWindow, 3);
        await assertPadding(doc, route + " with keyboard probe");
      }
      var alpha = doc.getElementById("alpha-number");
      if (alpha) {
        alpha.value = "0.2";
        harness.dispatch(alpha, "change", frame.contentWindow);
        await assertPadding(doc, route + " with singular density");
      }
      harness.addResult(route + " keeps 14px padding across sizes and updates", null);
    } catch (error) {
      failures += 1;
      harness.addResult(route + " keeps 14px padding across sizes and updates", error);
    }
  }
  harness.finish(failures, routes.length);
});
