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
      " envelope-theorem interface tests passed.";
    summary.className = failures ? "fail" : "pass";
    document.body.dataset.status = failures ? "failed" : "passed";
    document.title = (failures ? "FAIL" : "PASS") +
      " — Envelope-theorem interface tests";
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

    function fireKey(chart, key, shiftKey) {
      chart.dispatchEvent(new appWindow.KeyboardEvent("keydown", {
        key: key,
        shiftKey: Boolean(shiftKey),
        bubbles: true,
        cancelable: true
      }));
    }

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
        name: "The simplified interface contains exactly the two requested plots and no coordinate controls",
        run: function () {
          var explorable = appDocument.querySelector(".explorable");
          var charts = Array.from(explorable.querySelectorAll(
            ":scope #main-chart, :scope #slope-chart"
          ));
          assert(charts.length === 2 && charts[0].id === "main-chart" &&
            charts[1].id === "slope-chart",
          "Only the envelope and active-slope plots should remain.");
          assert(!appDocument.getElementById("bound-chart"),
            "The former bound chart should be absent.");
          assert(explorable.querySelectorAll('input[type="range"], input[type="number"]').length === 0,
            "The explorable should not retain coordinate sliders or number fields.");
          assert(appDocument.getElementById("add-line") &&
            appDocument.getElementById("remove-line"),
          "The line-family add/remove actions should remain available.");
        }
      },
      {
        name: "Local MathJax renders every plot title and axis label outside the graph SVGs",
        run: function () {
          var sources = Array.from(appDocument.querySelectorAll("head > script[defer]"))
            .map(function (script) { return script.getAttribute("src"); });
          assert(JSON.stringify(sources) === JSON.stringify([
            "../../js/components.js",
            "../../js/mathjax-config.js",
            "../../assets/mathjax/tex-svg.js",
            "../../js/mathjax-runtime.js",
            "../../js/math-utils.js",
            "../../js/svg-utils.js",
            "model.js",
            "app.js"
          ]), "The page should keep the established local script order.");
          assert(appWindow.MechanismMath &&
            typeof appWindow.MechanismMath.typesetInitial === "function" &&
            typeof appWindow.MechanismMath.setText === "function" &&
            appWindow.mechanismMathReady &&
            typeof appWindow.mechanismMathReady.then === "function",
          "The shared MathJax lifecycle and readiness promise should be available.");
          assert(appDocument.querySelectorAll('.introduction mjx-container[jax="SVG"]').length > 0,
            "The introduction should contain rendered mathematics.");
          assert(!/\\\(|\\\[/.test(appDocument.querySelector(".introduction").textContent),
            "No raw opening TeX delimiters should remain visible.");
          assert(appDocument.querySelectorAll("mjx-merror").length === 0,
            "MathJax should not report an expression error.");
          var labels = Array.from(appDocument.querySelectorAll(
            ".envelope-chart-figure > figcaption, .envelope-chart-axis-label"
          ));
          assert(labels.length === 4,
            "Both plots should have one HTML title and one HTML x-axis label.");
          labels.forEach(function (label) {
            assert(label.firstChild && label.firstChild.nodeType === 3 &&
              /, $/.test(label.firstChild.nodeValue),
            "Each label's plain text should end with a comma and a space.");
            assert(label.querySelector('mjx-container[jax="SVG"]'),
              "Each plot label should contain MathJax-rendered notation.");
            assert(!/\\\(/.test(label.textContent),
              "No plot label should retain a raw TeX delimiter.");
          });
          assert(appDocument.querySelectorAll(".explorable svg mjx-container").length === 0,
            "MathJax output should remain outside the graph SVGs.");
          assert(appDocument.querySelectorAll(
            'svg[role="img"] .panel-caption, svg[role="img"] .axis-title'
          ).length === 0,
          "The old plain-text SVG captions and axis titles should be absent.");
          assert(appDocument.getElementById("main-chart-title").textContent ===
            "Envelope, V(t)" &&
            appDocument.getElementById("slope-chart-title").textContent ===
              "Active slope, f_t(x*(t),t)",
          "The plain-text accessible SVG titles should mirror the comma-space convention.");
        }
      },
      {
        name: "The two desktop plots have equal 660-by-450 geometry and fill the demo width",
        run: function () {
          var layout = appDocument.querySelector(".two-panel-layout");
          var main = appDocument.getElementById("main-chart");
          var slope = appDocument.getElementById("slope-chart");
          var mainRect = main.getBoundingClientRect();
          var slopeRect = slope.getBoundingClientRect();
          var layoutRect = layout.getBoundingClientRect();
          assert(main.getAttribute("viewBox") === "0 0 660 450" &&
            slope.getAttribute("viewBox") === "0 0 660 450",
          "Both SVGs should use the same intrinsic geometry.");
          assertClose(mainRect.width, slopeRect.width,
            "Both desktop plots should render at the same width.", 1);
          assertClose(mainRect.height, slopeRect.height,
            "Both desktop plots should render at the same height.", 1);
          assertClose(mainRect.top, slopeRect.top,
            "Both desktop plots should align at the top.", 1);
          assert(mainRect.width >= 650,
            "At the 1400px test viewport each plot should reach approximately 660px.");
          assert(slopeRect.right - mainRect.left >= layoutRect.width * 0.99,
            "The two plots together should use essentially the full demo width.");
        }
      },
      {
        name: "Dragging an endpoint directly updates both the line family and active-slope plot",
        run: async function () {
          var main = appDocument.getElementById("main-chart");
          var slope = appDocument.getElementById("slope-chart");
          var oldSlope = slope.innerHTML;
          firePointer(main, "pointerdown", 60, 316.8, 41);
          firePointer(main, "pointermove", 231, 49.8, 41);
          firePointer(main, "pointerup", 231, 49.8, 41);
          await nextFrames(appWindow, 2);

          var selected = main.querySelector(".line-endpoint-selected");
          var lineA = main.querySelector('.family-line[stroke="#1b6fa8"]');
          assertClose(Number(selected.getAttribute("cx")), 231,
            "The selected endpoint should move to t = 0.30.");
          assertClose(Number(selected.getAttribute("cy")), 32,
            "The endpoint should project exactly onto the top edge.");
          assertClose(Number(lineA.getAttribute("x1")), 231,
            "Line A should begin at the dragged endpoint.");
          assertClose(Number(lineA.getAttribute("y1")), 32,
            "Line A should use the projected endpoint value.");
          assert(main.querySelector("desc").textContent.includes("t = 0.30, value 1.00"),
            "The accessible description should report the moved point.");
          assert(slope.innerHTML !== oldSlope,
            "The linked active-slope plot should update after the drag.");
        }
      },
      {
        name: "The focused graph keeps direct keyboard selection and movement after control removal",
        run: function () {
          var main = appDocument.getElementById("main-chart");
          fireKey(main, "Home");
          fireKey(main, "ArrowRight", true);
          var selected = main.querySelector(".line-endpoint-selected");
          assertClose(Number(selected.getAttribute("cx")), 242.4,
            "Shift+ArrowRight should move the top-edge point from t = 0.30 to 0.32.");

          fireKey(main, "ArrowRight");
          assert(appDocument.getElementById("point-control-label").textContent ===
            "Line A, point 2",
          "ArrowRight should still select the next endpoint.");
          fireKey(main, "ArrowDown");
          selected = main.querySelector(".line-endpoint-selected");
          assertClose(Number(selected.getAttribute("cx")), 630,
            "The second endpoint should remain on the right edge.");
          assertClose(Number(selected.getAttribute("cy")), 110.32,
            "ArrowDown should move its value from 0.80 to 0.78.", 1e-5);
          assert(main.getAttribute("aria-keyshortcuts").includes("Shift+ArrowRight"),
            "The horizontal movement shortcut should be exposed accessibly.");
        }
      },
      {
        name: "Adding and removing a line still updates the two linked plots",
        run: function () {
          var main = appDocument.getElementById("main-chart");
          appDocument.getElementById("add-line").click();
          assert(main.querySelectorAll(".family-line").length === 4 &&
            main.querySelectorAll(".line-endpoint").length === 8,
          "Adding should produce four lines and eight endpoints.");
          assert(appDocument.getElementById("point-control-label").textContent ===
            "Line D, point 1",
          "The new line's first endpoint should become selected.");
          appDocument.getElementById("remove-line").click();
          assert(main.querySelectorAll(".family-line").length === 3 &&
            main.querySelectorAll(".line-endpoint").length === 6,
          "Removing the selected new line should restore the three-line family.");
        }
      },
      {
        name: "Both SVGs retain finite geometry and accessible descriptions",
        run: function () {
          ["main-chart", "slope-chart"].forEach(function (id) {
            var chart = appDocument.getElementById(id);
            assert(!/(NaN|Infinity|undefined)/.test(numericSvgAttributes(chart)),
              "Chart " + id + " should contain only finite coordinates.");
            assert(chart.querySelector("title") && chart.querySelector("desc"),
              "Chart " + id + " should expose a title and description.");
          });
          assert(appDocument.getElementById("live-summary").getAttribute("aria-live") === "polite",
            "The linked state summary should remain politely announced.");
        }
      },
      {
        name: "The equal plots stack responsively without horizontal overflow",
        run: async function () {
          frame.style.width = "800px";
          await nextFrames(appWindow, 2);
          var mainRect = appDocument.getElementById("main-chart").getBoundingClientRect();
          var slopeRect = appDocument.getElementById("slope-chart").getBoundingClientRect();
          assertClose(mainRect.width, slopeRect.width,
            "Stacked plots should remain equally wide.", 1);
          assertClose(mainRect.height, slopeRect.height,
            "Stacked plots should remain equally tall.", 1);
          assert(slopeRect.top > mainRect.bottom,
            "At 800px the active-slope plot should stack below the main plot.");

          frame.style.width = "360px";
          await nextFrames(appWindow, 2);
          mainRect = appDocument.getElementById("main-chart").getBoundingClientRect();
          slopeRect = appDocument.getElementById("slope-chart").getBoundingClientRect();
          assertClose(mainRect.width, slopeRect.width,
            "Narrow plots should remain equally wide.", 1);
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
