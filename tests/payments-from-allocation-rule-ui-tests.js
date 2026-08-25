(function () {
  "use strict";

  var frame = document.getElementById("app-frame");
  var testKeepAlive = window.setInterval(function () {}, 50);
  var testsStarted = false;

  function startTests() {
    if (testsStarted) {
      return;
    }
    testsStarted = true;
    Promise.resolve(frame.contentWindow.mechanismMathReady).then(runTests).catch(
      function (error) {
        addResult("MathJax initializes before the interface tests", error);
        finish(0, 1);
      }
    );
  }

  frame.addEventListener("load", startTests);
  if (frame.contentDocument && frame.contentDocument.readyState === "complete" &&
      frame.contentWindow.location.href !== "about:blank") {
    startTests();
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed.");
    }
  }

  function assertClose(actual, expected, message, tolerance) {
    var allowed = tolerance === undefined ? 1e-6 : tolerance;
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > allowed) {
      throw new Error(
        (message || "Values differ.") +
        " Expected " + expected + ", received " + actual + "."
      );
    }
  }

  function addResult(name, error) {
    var item = document.createElement("li");
    item.className = error ? "fail" : "pass";
    item.textContent = (error ? "FAIL — " : "PASS — ") + name +
      (error ? ": " + error.message : "");
    document.getElementById("results").appendChild(item);
  }

  function finish(passed, total) {
    var failures = total - passed;
    var summary = document.getElementById("summary");
    summary.textContent = passed + " of " + total +
      " payments-from-allocation-rule interface tests passed.";
    summary.className = failures ? "fail" : "pass";
    document.body.dataset.status = failures ? "failed" : "passed";
    document.title = (failures ? "FAIL" : "PASS") +
      " — Payments-from-allocation-rule interface tests";
    window.clearInterval(testKeepAlive);
  }

  function nextFrames(appWindow, count) {
    return new Promise(function (resolve) {
      function advance(remaining) {
        appWindow.requestAnimationFrame(function () {
          if (remaining <= 1) {
            resolve();
          } else {
            advance(remaining - 1);
          }
        });
      }
      advance(count || 1);
    });
  }

  function numericSvgAttributes(chart) {
    var names = [
      "x", "x1", "x2", "y", "y1", "y2", "cx", "cy",
      "width", "height", "r", "d", "points", "transform"
    ];
    return Array.from(chart.querySelectorAll("*")).map(function (element) {
      return names.map(function (name) {
        return element.getAttribute(name) || "";
      }).join(" ");
    }).join(" ");
  }

  async function runTests() {
    var appDocument = frame.contentDocument;
    var appWindow = frame.contentWindow;
    var chartIds = ["curve-chart", "envelope-chart", "payment-chart"];

    function firePointer(chart, type, viewX, viewY, pointerId) {
      var rect = chart.getBoundingClientRect();
      chart.setPointerCapture = function () {};
      chart.hasPointerCapture = function () { return false; };
      chart.releasePointerCapture = function () {};
      chart.dispatchEvent(new appWindow.PointerEvent(type, {
        bubbles: true,
        clientX: rect.left + (viewX / 660) * rect.width,
        clientY: rect.top + (viewY / 450) * rect.height,
        pointerId: pointerId
      }));
    }

    var tests = [
      {
        name: "Local MathJax renders the three plot titles and three x-axis labels in HTML",
        run: function () {
          var sources = Array.from(appDocument.querySelectorAll("head > script[defer]"))
            .map(function (script) { return script.getAttribute("src"); });
          assert(JSON.stringify(sources) === JSON.stringify([
            "../../js/components.js",
            "../../js/mathjax-config.js",
            "../../assets/mathjax/tex-svg.js",
            "model.js",
            "app.js"
          ]), "The page should keep the established local script order.");

          var captions = Array.from(appDocument.querySelectorAll(
            ".math-chart-figure > figcaption"
          ));
          var axisLabels = Array.from(appDocument.querySelectorAll(
            ".math-chart-x-axis-label"
          ));
          assert(captions.length === 3,
            "The three plots should each have one HTML figcaption.");
          assert(axisLabels.length === 3,
            "The three plots should each have one HTML x-axis label.");

          var expectedMath = ["Q(v)", "U(v)", "P(v)", "v", "v", "v"];
          captions.concat(axisLabels).forEach(function (label, index) {
            assert(label.firstChild && label.firstChild.nodeType === 3 &&
              /, $/.test(label.firstChild.nodeValue),
            "Each label's plain text should end with a comma and a space.");
            assert(label.querySelectorAll('mjx-container[jax="SVG"]').length === 1,
              "Each label should contain exactly one MathJax rendering.");
            var math = label.querySelector('[data-mml-node="math"]');
            assert(math && math.getAttribute("data-latex") === expectedMath[index],
              "Each label should preserve its intended formula.");
            assert(!/\\\(|\\\[/.test(label.textContent),
              "No plot label should retain a raw TeX delimiter.");
          });
          assert(appDocument.querySelectorAll("mjx-merror").length === 0,
            "MathJax should not report an expression error.");
        }
      },
      {
        name: "The graph SVGs retain accessible metadata, intrinsic geometry, and native labels only",
        run: function () {
          var expectedViewBoxes = ["0 0 660 450", "0 0 440 300", "0 0 440 300"];
          chartIds.forEach(function (id, index) {
            var chart = appDocument.getElementById(id);
            var title = chart.querySelector("title");
            var description = chart.querySelector("desc");
            var labelledBy = (chart.getAttribute("aria-labelledby") || "").split(/\s+/);
            assert(chart.getAttribute("viewBox") === expectedViewBoxes[index],
              "Chart " + id + " should preserve its established viewBox.");
            assert(title && title.textContent.trim() && description &&
              description.textContent.trim(),
            "Chart " + id + " should retain a nonempty title and description.");
            assert(labelledBy.includes(title.id) && labelledBy.includes(description.id),
              "Chart " + id + " should reference both accessible metadata nodes.");
            assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(chart)),
              "Chart " + id + " should contain only finite numeric geometry.");
            var axisLabel = chart.closest(".math-chart-figure")
              .querySelector(".math-chart-x-axis-label");
            var chartRect = chart.getBoundingClientRect();
            var axisRect = axisLabel.getBoundingClientRect();
            assertClose(axisRect.left, chartRect.left,
              "Chart " + id + "'s HTML x-axis label should begin at the plot edge.", 1);
            assertClose(axisRect.width, chartRect.width,
              "Chart " + id + "'s HTML x-axis label should span only its plot.", 1);
          });
          assert(appDocument.querySelectorAll(
            ".explorable svg mjx-container, .explorable svg .panel-caption, " +
            ".explorable svg .axis-title"
          ).length === 0,
          "MathJax output and the former SVG captions/axis titles should be absent from every graph.");
        }
      },
      {
        name: "Dragging one control point directly updates all three linked charts",
        run: async function () {
          var curveChart = appDocument.getElementById("curve-chart");
          var envelopeChart = appDocument.getElementById("envelope-chart");
          var paymentChart = appDocument.getElementById("payment-chart");
          var oldCurve = curveChart.querySelector(".curve-q").getAttribute("d");
          var oldRent = envelopeChart.querySelector(".rent-curve").getAttribute("d");
          var oldPayment = paymentChart.querySelector(".payment-curve").getAttribute("d");

          firePointer(curveChart, "pointerdown", 345, 210, 51);
          firePointer(curveChart, "pointermove", 345, 103.2, 51);
          firePointer(curveChart, "pointerup", 345, 103.2, 51);
          await nextFrames(appWindow, 2);

          assertClose(Number(curveChart.querySelector(".control-point-selected")
            .getAttribute("cy")), 103.2,
          "The selected point should move from Q = 0.50 to Q = 0.80.", 1e-5);
          assert(appDocument.getElementById("point-value-number").value === "0.80",
            "The direct drag should synchronize the point-height number field.");
          assert(curveChart.querySelector(".curve-q").getAttribute("d") !== oldCurve,
            "The allocation curve should update after the drag.");
          assert(envelopeChart.querySelector(".rent-curve").getAttribute("d") !== oldRent,
            "The information-rent chart should update after the drag.");
          assert(paymentChart.querySelector(".payment-curve").getAttribute("d") !== oldPayment,
            "The payment chart should update after the drag.");
          chartIds.forEach(function (id) {
            assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(
              appDocument.getElementById(id)
            )), "Chart " + id + " should remain finite after direct editing.");
          });
        }
      },
      {
        name: "The module remains free of horizontal overflow at a narrow viewport",
        run: async function () {
          frame.style.width = "360px";
          await nextFrames(appWindow, 2);
          var contentWidth = appDocument.querySelector("main.page-width")
            .getBoundingClientRect().width;
          chartIds.forEach(function (id) {
            assert(appDocument.getElementById(id).getBoundingClientRect().width <=
              contentWidth + 1,
            "Chart " + id + " should fit inside the narrow page content.");
          });
          assert(appDocument.documentElement.scrollWidth <=
            appDocument.documentElement.clientWidth + 1,
          "The page should not overflow horizontally at 360px.");
        }
      }
    ];

    var failures = 0;
    for (var testIndex = 0; testIndex < tests.length; testIndex += 1) {
      var test = tests[testIndex];
      try {
        await test.run();
        addResult(test.name, null);
      } catch (error) {
        failures += 1;
        addResult(test.name, error);
      }
    }
    finish(tests.length - failures, tests.length);
  }
}());
